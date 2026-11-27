(function () {
  "use strict";

  var DATA_BASE = (location.hostname === "66-42-93-24.sslip.io" || location.hostname === "66.42.93.24" || location.hostname === "localhost" || location.hostname === "127.0.0.1") ? "data/" : "https://66-42-93-24.sslip.io/data/";

  var COLUMNS = {
    tournaments: ["period", "name", "players", "games"],
    players: ["rank", "name", "rating", "std", "tournaments", "games"]
  };

  var NUMERIC = {
    tournaments: ["players", "games"],
    players: ["rank", "rating", "std", "tournaments", "games"]
  };

  var RESULT_SCORE = {
    "1": "1:0",
    "0": "0:1",
    "0.5": "½:½",
    "+-": "+:-",
    "-+": "-:+",
    "--": "-:-"
  };

  var SVGNS = "http://www.w3.org/2000/svg";

  function getFeed() {
    var table = document.querySelector("table[data-feed]");
    return table ? table.getAttribute("data-feed") : "";
  }

  function normalize(json) {
    if (Array.isArray(json)) return json;
    if (!json || typeof json !== "object") return [];
    var keys = ["response", "data", "rows", "results", "items", "list"];
    for (var i = 0; i < keys.length; i++) {
      if (Array.isArray(json[keys[i]])) return json[keys[i]];
    }
    return [];
  }

  function load(feed) {
    return fetch(DATA_BASE + feed + ".json")
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(normalize)
      .catch(function () { return []; });
  }

  function formatPeriod(row) {
    var start = row.start_date || row.startDate || "";
    var end = row.end_date || row.endDate || "";
    if (!start && !end) return String(row.period || row.date_range || "");
    start = String(start).slice(0, 10);
    end = String(end).slice(0, 10);
    var noGames = row.game_count === 0 || row.games === 0 || (Array.isArray(row.games) && row.games.length === 0) || (start && !end);
    if (start && noGames) {
      return "开赛于 " + start;
    }
    if (start && end && start !== end) {
      // 同一年只写一次年份：2026-05-16 至 05-20
      var tail = start.slice(0, 4) === end.slice(0, 4) ? end.slice(5) : end;
      return start + " 至 " + tail;
    }
    return start || end;
  }

  function render(feed, rows) {
    var table = document.querySelector("table[data-feed='" + feed + "']");
    if (!table || !table.tBodies[0]) return;
    var tbody = table.tBodies[0];
    while (tbody.rows.length > 1) tbody.deleteRow(tbody.rows.length - 1);

    var columns = COLUMNS[feed] || [];
    var numeric = NUMERIC[feed] || [];
    rows.forEach(function (row) {
      if (!row || typeof row !== "object") return;
      var tr = document.createElement("tr");
      columns.forEach(function (col) {
        var td = document.createElement("td");
        var value = row[col];
        if (col === "period") {
          td.textContent = formatPeriod(row);
          td.className = "period";
        } else if (col === "result" && value !== undefined && value !== null) {
          td.textContent = RESULT_SCORE[String(value)] || String(value);
        } else if (col === "rating" || col === "std") {
          td.textContent = value === null || value === undefined || value === "" ? "" : Number(value).toFixed(2);
        } else if (col === "name" && feed === "players") {
          var link = document.createElement("a");
          link.href = "player.html?id=" + encodeURIComponent(row.player_id);
          link.textContent = value === null || value === undefined ? "" : String(value);
          td.appendChild(link);
        } else if (col === "name" && feed === "tournaments") {
          var tourLink = document.createElement("a");
          tourLink.href = "tournament.html?id=" + encodeURIComponent(row.tournament_id);
          tourLink.textContent = value === null || value === undefined ? "" : String(value);
          td.appendChild(tourLink);
        } else {
          td.textContent = value === null || value === undefined ? "" : String(value);
        }
        if (numeric.indexOf(col) >= 0) td.className = "num";
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
  }

  function number(value) {
    var n = parseFloat(value);
    return isNaN(n) ? 0 : n;
  }

  // 赛事从新到旧
  function sortRows(feed, rows) {
    var list = rows.slice();
    if (feed === "tournaments") {
      list.sort(function (a, b) {
        var sa = String((a && (a.start_date || a.startDate || a.end_date || a.endDate || a.period)) || "").slice(0, 10);
        var sb = String((b && (b.start_date || b.startDate || b.end_date || b.endDate || b.period)) || "").slice(0, 10);
        if (sa !== sb) return sa < sb ? 1 : -1;
        var ea = String((a && (a.end_date || a.endDate)) || "").slice(0, 10);
        var eb = String((b && (b.end_date || b.endDate)) || "").slice(0, 10);
        if (ea !== eb) return ea < eb ? 1 : -1;
        return ((b && b.tournament_id) || 0) - ((a && a.tournament_id) || 0);
      });
    }
    return list;
  }

  /* ---------- 棋手详情页 ---------- */

  function one(value) {
    return value === null || value === undefined || value === "" ? "-" : Number(value).toFixed(2);
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function metaRow(parent, label, value, tail) {
    var p = el("p");
    p.appendChild(el("b", "", label + "："));
    p.appendChild(document.createTextNode(value));
    if (tail) p.appendChild(tail);
    parent.appendChild(p);
    return p;
  }

  function renderPlayerMeta(data) {
    var box = document.getElementById("playerMeta");
    if (!box) return;
    box.innerHTML = "";
    metaRow(box, "名次", data.rank ? "第 " + data.rank + " 名" : "-");
    metaRow(box, "等级分", one(data.rating) + "（标准差 " + one(data.std) + "）");

    // 战绩：每一项都锁成一段，换行只发生在逗号之后，不会把“胜 5”拆成两行
    var record = el("p");
    record.appendChild(el("b", "", "战绩："));
    var parts = [data.tournaments + " 个赛事", data.games + " 个对局",
      "胜 " + data.wins, "和 " + data.draws, "负 " + data.losses];
    if (data.byes) parts.push("轮空 " + data.byes);
    if (data.self_skips) parts.push("弃权 " + data.self_skips);
    if (data.opp_skips) parts.push("对手弃权 " + data.opp_skips);
    if (data.double_skips) parts.push("双弃 " + data.double_skips);
    if (data.score_rate !== null && data.score_rate !== undefined) {
      parts.push("得分率 " + Number(data.score_rate).toFixed(1) + "%");
    }
    parts.forEach(function (text, index) {
      record.appendChild(el("span", "nowrap",
        text + (index < parts.length - 1 ? "，" : "")));
    });
    box.appendChild(record);
  }

  function svgNode(tag, attrs, text) {
    var node = document.createElementNS(SVGNS, tag);
    for (var key in attrs) {
      if (Object.prototype.hasOwnProperty.call(attrs, key)) node.setAttribute(key, attrs[key]);
    }
    if (text !== undefined) node.textContent = text;
    return node;
  }

  // 等级分走势：折线 + ± 偏差（RD）阴影带，配色与参考站点一致
  function drawChart(history) {
    var box = document.getElementById("chart");
    if (!box) return;
    box.innerHTML = "";
    if (!history || history.length === 0) return;

    var width = box.clientWidth || 560;
    var height = window.innerWidth <= 640 ? 185 : 300;
    var pad = { left: 48, right: 14, top: 24, bottom: 24 };
    var innerW = width - pad.left - pad.right;
    var innerH = height - pad.top - pad.bottom;

    var points = history.map(function (row) {
      var std = row.length > 2 ? Number(row[2]) : 0;
      return {
        t: Date.parse(String(row[0]).slice(0, 10)) || 0,
        v: Number(row[1]),
        std: isNaN(std) ? 0 : std
      };
    });
    var tMin = points[0].t, tMax = points[points.length - 1].t;

    var values = points.map(function (p) { return p.v; });
    var curveMin = Math.min.apply(null, values);
    var curveMax = Math.max.apply(null, values);
    var bandMin = Math.min.apply(null, points.map(function (p) { return p.v - p.std; }));
    var bandMax = Math.max.apply(null, points.map(function (p) { return p.v + p.std; }));

    // 纵轴范围覆盖标准差带，早期不确定度大时呈喇叭形
    var vMin, vMax;
    if (bandMax > bandMin) {
      vMin = bandMin;
      vMax = bandMax;
    } else {
      vMin = curveMin;
      vMax = curveMax;
    }
    if (vMax - vMin < 40) {
      var mid = (vMax + vMin) / 2;
      vMin = mid - 20;
      vMax = mid + 20;
    }
    var span = vMax - vMin;
    vMin -= span * 0.05;
    vMax += span * 0.05;

    function xOf(t) {
      if (tMax === tMin) return pad.left + innerW / 2;
      return pad.left + ((t - tMin) / (tMax - tMin)) * innerW;
    }
    function yOf(v) {
      return pad.top + (1 - (v - vMin) / (vMax - vMin)) * innerH;
    }

    var svg = svgNode("svg", {
      width: width,
      height: height,
      viewBox: "0 0 " + width + " " + height,
      role: "img"
    });

    var clipId = "chart-clip";
    var defs = svgNode("defs");
    var clip = svgNode("clipPath", { id: clipId });
    clip.appendChild(svgNode("rect", {
      x: pad.left, y: pad.top, width: innerW, height: innerH
    }));
    defs.appendChild(clip);
    svg.appendChild(defs);

    // 横向网格与纵轴刻度
    for (var i = 0; i <= 3; i++) {
      var value = vMin + ((vMax - vMin) * i) / 3;
      var y = yOf(value);
      svg.appendChild(svgNode("line", {
        x1: pad.left, y1: y, x2: pad.left + innerW, y2: y,
        stroke: "#dfe6ea", "stroke-width": 1
      }));
      svg.appendChild(svgNode("text", {
        x: pad.left - 6, y: y + 4, "text-anchor": "end",
        "font-size": 11, fill: "#6f7b83"
      }, Math.round(value)));
    }

    // 横轴日期（按像素宽度避让，防止 YYYY-MM-DD 标签重叠）
    var labelW = 74;
    var lastIdx = history.length - 1;
    var ticks = [0];
    if (lastIdx > 0) {
      var x0 = xOf(points[0].t);
      var xLast = xOf(points[lastIdx].t);
      if (xLast - x0 < labelW * 2 + 12) {
        ticks = [lastIdx];
      } else {
        var midIdx = Math.floor(lastIdx / 2);
        var xMid = xOf(points[midIdx].t);
        if (midIdx > 0 && midIdx < lastIdx && (xMid - labelW / 2 - 8 > x0 + labelW) && (xMid + labelW / 2 + 8 < xLast - labelW)) {
          ticks = [0, midIdx, lastIdx];
        } else {
          ticks = [0, lastIdx];
        }
      }
    }
    ticks.forEach(function (index) {
      var p = points[index];
      var anchor = ticks.length === 1 ? "middle"
        : index === 0 ? "start"
        : index === lastIdx ? "end" : "middle";
      svg.appendChild(svgNode("text", {
        x: xOf(p.t), y: height - 6,
        "text-anchor": anchor, "font-size": 11, fill: "#6f7b83"
      }, String(history[index][0]).slice(0, 10)));
    });

    // 标准差带：等级分 ± std
    var hasBand = points.some(function (p) { return p.std > 0; });
    if (hasBand) {
      var upper = points.map(function (p, index) {
        return (index === 0 ? "M" : "L") + xOf(p.t).toFixed(1) + " " + yOf(p.v + p.std).toFixed(1);
      }).join(" ");
      var lower = points.slice().reverse().map(function (p) {
        return "L" + xOf(p.t).toFixed(1) + " " + yOf(p.v - p.std).toFixed(1);
      }).join(" ");
      svg.appendChild(svgNode("path", {
        d: upper + " " + lower + " Z",
        fill: "rgba(255,127,14,0.18)",
        stroke: "rgba(255,127,14,0.4)",
        "stroke-width": 1,
        "clip-path": "url(#" + clipId + ")"
      }));
    }

    var path = points.map(function (p, index) {
      return (index === 0 ? "M" : "L") + xOf(p.t).toFixed(1) + " " + yOf(p.v).toFixed(1);
    }).join(" ");
    svg.appendChild(svgNode("path", {
      d: path, fill: "none", stroke: "#ff7f0e", "stroke-width": 1.6,
      "stroke-linejoin": "round", "stroke-linecap": "round",
      "clip-path": "url(#" + clipId + ")"
    }));

    // 点/悬浮看这一点的日期、等级分与偏差（提示框用浏览器自带的，不自己画）
    var dotR = 2.4;
    var dots = [];
    points.forEach(function (p) {
      var dot = svgNode("circle", {
        cx: xOf(p.t).toFixed(1), cy: yOf(p.v).toFixed(1), r: dotR,
        fill: "#ff7f0e", stroke: "#fff", "stroke-width": 1,
        "clip-path": "url(#" + clipId + ")"
      });
      svg.appendChild(dot);
      dots.push(dot);
    });

    var guide = svgNode("line", {
      x1: 0, y1: pad.top, x2: 0, y2: pad.top + innerH,
      stroke: "rgba(255,127,14,0.55)", "stroke-width": 1,
      "stroke-dasharray": "3 3", visibility: "hidden"
    });
    svg.insertBefore(guide, dots[0]);

    var current = -1;

    var tip = el("div", "chart-tip");
    tip.style.display = "none";
    box.appendChild(tip);

    // 浮动提示：日期、等级分、偏差，半透明底，位置贴着当前点
    function placeTip(index) {
      var point = points[index];
      tip.innerHTML = "";
      tip.appendChild(el("b", "", String(history[index][0]).slice(0, 10)));
      tip.appendChild(el("span", "", "等级分 " + point.v.toFixed(2)));
      tip.appendChild(el("span", "", "标准差 " + point.std.toFixed(2)));
      tip.style.display = "block";
      var tw = tip.offsetWidth;
      var th = tip.offsetHeight;
      var left = xOf(point.t) - tw / 2;
      left = Math.max(2, Math.min(left, width - tw - 2));
      var top = yOf(point.v) - th - 12;
      if (top < 2) top = yOf(point.v) + 12;
      tip.style.left = left + "px";
      tip.style.top = top + "px";
    }

    function highlight(index, on) {
      var dot = dots[index];
      if (!dot) return;
      dot.setAttribute("r", on ? dotR + 2 : dotR);
      dot.setAttribute("stroke-width", on ? 2 : 1);
    }

    function show(index) {
      if (current === index) return;
      if (current >= 0) highlight(current, false);
      current = index;
      highlight(index, true);
      var cx = xOf(points[index].t).toFixed(1);
      guide.setAttribute("x1", cx);
      guide.setAttribute("x2", cx);
      guide.setAttribute("visibility", "visible");
      placeTip(index);
    }

    function clear() {
      if (current >= 0) highlight(current, false);
      current = -1;
      guide.setAttribute("visibility", "hidden");
      tip.style.display = "none";
    }

    // 每个点给一块命中区域，按相邻点的中点为界，鼠标与手指都容易点中
    points.forEach(function (p, index) {
      var left = index === 0 ? pad.left : (xOf(points[index - 1].t) + xOf(p.t)) / 2;
      var right = index === points.length - 1
        ? pad.left + innerW
        : (xOf(p.t) + xOf(points[index + 1].t)) / 2;
      var hit = svgNode("rect", {
        x: left.toFixed(1), y: pad.top,
        width: Math.max(right - left, 5).toFixed(1), height: innerH,
        fill: "transparent"
      });
      hit.style.cursor = "pointer";
      hit.addEventListener("mouseenter", function () { show(index); });
      hit.addEventListener("click", function () { show(index); });
      hit.addEventListener("touchstart", function () { show(index); }, { passive: true });
      svg.appendChild(hit);
    });
    svg.addEventListener("mouseleave", clear);
    box.addEventListener("mouseleave", clear);

    // 图例
    var legendX = Math.max(width - 158, pad.left + 4);
    svg.appendChild(svgNode("rect", {
      x: legendX, y: 5, width: 12, height: 10,
      fill: "rgba(255,127,14,0.18)", stroke: "rgba(255,127,14,0.4)", "stroke-width": 1
    }));
    svg.appendChild(svgNode("text", {
      x: legendX + 17, y: 14, "font-size": 11, fill: "#6f7b83"
    }, "± 标准差"));
    svg.appendChild(svgNode("line", {
      x1: legendX + 78, y1: 10, x2: legendX + 92, y2: 10,
      stroke: "#ff7f0e", "stroke-width": 1.6
    }));
    svg.appendChild(svgNode("text", {
      x: legendX + 97, y: 14, "font-size": 11, fill: "#6f7b83"
    }, "等级分"));

    box.appendChild(svg);
  }

  // 表格里的日期用月-日，年份在赛事名和赛事日期行里已经有了
  function short_date(value) {
    var text = String(value || "");
    return text.length >= 10 ? text.slice(5, 10) : text;
  }

  // 该赛事实际用到的日期范围
  function dates_of_group(group) {
    var list = [];
    (group.games || []).forEach(function (game) {
      if (game.date && list.indexOf(game.date) < 0) list.push(game.date);
    });
    if (!list.length) return group.end_date || "";
    list.sort();
    var first = list[0];
    var last = list[list.length - 1];
    if (first === last) return first;
    if (first.slice(0, 4) === last.slice(0, 4)) {
      return first + " 至 " + last.slice(5);
    }
    return first + " 至 " + last;
  }

  function renderPlayerGames(data) {
    var table = document.querySelector("table.player-games");
    if (!table || !table.tBodies[0]) return;
    var tbody = table.tBodies[0];
    tbody.innerHTML = "";

    (data.results || []).forEach(function (group) {
      var head = el("tr");
      var th = el("th");
      th.colSpan = 7;
      // 赛事名点进该赛事第 1 轮
      var tourLink = el("a", "", group.tournament);
      tourLink.href = tournamentUrl(group.tournament_id, 1);
      th.appendChild(tourLink);
      head.appendChild(th);
      tbody.appendChild(head);

      var span = dates_of_group(group);
      var info = el("tr");
      info.appendChild(el("th", "second", "日期"));
      var dateCell = el("td", "num", span);
      dateCell.colSpan = 4;
      info.appendChild(dateCell);
      info.appendChild(el("th", "second", "等级分"));
      info.appendChild(el("td", "num", one(group.rating)));
      tbody.appendChild(info);

      var titles = el("tr");
      ["日期", "轮次", "规则", "先后", "结果", "对手", "等级分"].forEach(function (label) {
        titles.appendChild(el("th", "", label));
      });
      tbody.appendChild(titles);

      var sortedGames = (group.games || []).slice().sort(function (a, b) {
        var ra = Number(a.round) || 0;
        var rb = Number(b.round) || 0;
        if (rb !== ra) return rb - ra;
        return (Number(a.board) || 0) - (Number(b.board) || 0);
      });
      sortedGames.forEach(function (game) {
        var tr = el("tr");
        var day = el("td", "date", short_date(game.date));
        day.title = game.date;
        tr.appendChild(day);
        var rnd = el("td", "rnd");
        // 「第N轮」点进该赛事第 N 轮
        var roundLink = el("a", "", "第" + game.round + "轮");
        roundLink.href = tournamentUrl(group.tournament_id, game.round);
        rnd.appendChild(roundLink);
        rnd.appendChild(document.createTextNode("\u00a0第" + game.board + "台"));
        tr.appendChild(rnd);
        tr.appendChild(el("td", "rule", game.rule || ""));
        tr.appendChild(el("td", "cnum", game.color));
        var resTd = el("td", game["class"]);
        if (game.kind !== "bye" && game.game_id !== null && game.game_id !== undefined) {
          var resLink = el("a", "score-link", game.result);
          resLink.href = "game.html?id=" + encodeURIComponent(game.game_id);
          resTd.appendChild(resLink);
        } else {
          resTd.textContent = game.result;
        }
        tr.appendChild(resTd);
        var opp = el("td");
        if (game.opponent_id) {
          var link = el("a", "", game.opponent);
          link.href = "player.html?id=" + encodeURIComponent(game.opponent_id);
          opp.appendChild(link);
        } else {
          opp.textContent = game.opponent || "";
        }
        tr.appendChild(opp);
        tr.appendChild(el("td", "num", game.opponent_rating === null || game.opponent_rating === undefined
          ? "" : one(game.opponent_rating)));
        tbody.appendChild(tr);
      });
    });
  }

  function initPlayer() {
    var match = /[?&]id=(\d+)/.exec(window.location.search);
    var id = match ? match[1] : "";
    var heading = document.getElementById("playerName");
    if (!id) {
      if (heading) heading.textContent = "未找到棋手";
      return Promise.resolve();
    }
    return fetch(DATA_BASE + "player/" + id + ".json")
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        if (!data || !data.name) throw new Error("empty");
        document.title = data.name;
        if (heading) heading.textContent = data.name;
        renderPlayerMeta(data);

        drawChart(data.history);
        renderPlayerGames(data);
        var timer = null;
        window.addEventListener("resize", function () {
          if (timer) clearTimeout(timer);
          timer = setTimeout(function () { drawChart(data.history); }, 150);
        });
        return data;
      })
      .catch(function () {
        if (heading) heading.textContent = "未找到该棋手";
      });
  }

  /* ---------- 赛事对局页 ---------- */

  function playerCell(name, id, no) {
    var td = el("td");
    if (name === "轮空") {
      td.className = "skip";
      td.textContent = name;
      return td;
    }
    if (no !== null && no !== undefined && no !== "") {
      td.appendChild(el("span", "player-no", String(no)));
    }
    if (id) {
      var link = el("a", "", name);
      link.href = "player.html?id=" + encodeURIComponent(id);
      td.appendChild(link);
    } else {
      td.appendChild(document.createTextNode(name || ""));
    }
    return td;
  }

  function renderTournamentMeta(data) {
    var box = document.getElementById("tourMeta");
    if (!box) return;
    box.innerHTML = "";
    metaRow(box, "日期", formatPeriod(data));
    if (data.team_matches && data.team_matches.length) {
      metaRow(box, "规模", data.players + " 人，" + data.team_matches.length + " 场团体赛（" + data.game_count + " 个对局）");
    } else {
      metaRow(box, "规模", data.players + " 人，" + data.game_count + " 个对局");
    }
  }

  // 该赛事有哪些轮次（升序，去重）
  function tournamentRounds(data) {
    var seen = {};
    var list = [];
    (data.games || []).forEach(function (game) {
      var round = Number(game.round);
      if (!isNaN(round) && !seen[round]) {
        seen[round] = true;
        list.push(round);
      }
    });
    list.sort(function (a, b) { return a - b; });
    var out = [];
    var rs = data && data.round_standings;
    if (rs && rs.pre) out.push("pre");
    if (rs && rs.draw) out.push("draw");
    list.forEach(function (r) { out.push(String(r)); });
    return out;
  }

  function roundFromUrl() {
    var match = /[?&]round=([^&]+)/.exec(window.location.search);
    return match ? decodeURIComponent(match[1]) : null;
  }

  function tournamentUrl(id, round) {
    return "tournament.html?id=" + encodeURIComponent(id) + "&round=" + round;
  }

  function renderTeamMatches(data, round) {
    var table = document.querySelector("table.tour-games");
    if (!table || !table.tBodies[0]) return;
    var tbody = table.tBodies[0];
    if (tbody.rows[0] && tbody.rows[0].cells.length >= 9) {
      tbody.rows[0].cells[3].textContent = "左方";
      tbody.rows[0].cells[5].textContent = "右方";
      tbody.rows[0].cells[6].textContent = "左方胜率";
      tbody.rows[0].cells[8].textContent = "右方胜率";
    }
    while (tbody.rows.length > 1) tbody.deleteRow(tbody.rows.length - 1);

    (data.team_matches || []).forEach(function (tm) {
      if (round !== null && Number(tm.round) !== round) return;

      // 团体对抗汇总行（沿用原有表格列：日期 | 轮次 | 规则 | 队伍A | 局分 | 队伍B | 胜% | 平% | 负%）
      var tr = el("tr");
      var day = el("td", "date", short_date(tm.date));
      day.title = tm.date;
      tr.appendChild(day);
      tr.appendChild(el("td", "rnd", "第" + tm.round + "轮 第" + tm.match_board + "台"));
      tr.appendChild(el("td", "rule", tm.rule || ""));
      var ta = el("td", "");
      ta.style.fontWeight = "600";
      if (tm.team_a_no !== null && tm.team_a_no !== undefined && tm.team_a_no !== "") {
        ta.appendChild(el("span", "player-no", String(tm.team_a_no)));
      }
      ta.appendChild(document.createTextNode(tm.team_a_name || ""));
      tr.appendChild(ta);
      var sc = el("td", "score", tm.score_a + "-" + tm.score_b);
      sc.style.fontWeight = "700";
      tr.appendChild(sc);
      var tb = el("td", "");
      tb.style.fontWeight = "600";
      if (tm.team_b_no !== null && tm.team_b_no !== undefined && tm.team_b_no !== "") {
        tb.appendChild(el("span", "player-no", String(tm.team_b_no)));
      }
      tb.appendChild(document.createTextNode(tm.team_b_name || ""));
      tr.appendChild(tb);
      tr.appendChild(el("td", "prob", tm.p_win != null ? Number(tm.p_win).toFixed(1) + "%" : ""));
      tr.appendChild(el("td", "prob", tm.p_draw != null ? Number(tm.p_draw).toFixed(1) + "%" : ""));
      tr.appendChild(el("td", "prob", tm.p_loss != null ? Number(tm.p_loss).toFixed(1) + "%" : ""));
      tbody.appendChild(tr);

      if (tm.score_probs && tm.score_probs.length) {
        var spTr = el("tr", "score-probs-row");
        var spTd = el("td", "");
        spTd.colSpan = 9;
        spTd.style.padding = "0";
        var spTable = document.createElement("table");
        spTable.className = "score-probs-table";
        spTable.style.width = "100%";
        spTable.style.borderCollapse = "collapse";
        spTable.style.margin = "0";
        spTable.style.fontSize = "12px";
        spTable.style.textAlign = "center";
        spTable.style.color = "#000";
        var headRow = document.createElement("tr");
        var valRow = document.createElement("tr");
        var hLabel = el("td", "", "局分");
        hLabel.style.padding = "3px 6px";
        hLabel.style.background = "#f5f5f5";
        hLabel.style.color = "#000";
        hLabel.style.fontWeight = "600";
        hLabel.style.border = "1px solid #ddd";
        headRow.appendChild(hLabel);
        var vLabel = el("td", "", "概率");
        vLabel.style.padding = "3px 6px";
        vLabel.style.color = "#000";
        vLabel.style.fontWeight = "600";
        vLabel.style.border = "1px solid #ddd";
        valRow.appendChild(vLabel);
        tm.score_probs.forEach(function (sp) {
          var th = el("td", "", sp.score);
          th.style.padding = "3px 6px";
          th.style.background = "#f5f5f5";
          th.style.color = "#000";
          th.style.fontWeight = "600";
          th.style.border = "1px solid #ddd";
          headRow.appendChild(th);
          var td = el("td", "", Number(sp.prob).toFixed(1) + "%");
          td.style.padding = "3px 6px";
          td.style.color = "#000";
          td.style.border = "1px solid #ddd";
          valRow.appendChild(td);
        });
        spTable.appendChild(headRow);
        spTable.appendChild(valRow);
        spTd.appendChild(spTable);
        spTr.appendChild(spTd);
        tbody.appendChild(spTr);
      }

      var FLIP_SCORE = {
        "1:0": "0:1",
        "0:1": "1:0",
        "+:-": "-:+",
        "-:+": "+:-"
      };
      (tm.boards || []).forEach(function (b) {
        var bTr = el("tr");
        bTr.appendChild(el("td", "date", ""));
        bTr.appendChild(el("td", "rnd", "第" + b.board_no + "台"));
        bTr.appendChild(el("td", "rule", ""));

        var aIsFirst = b.team_a_side !== "second";
        var leftName = aIsFirst ? (b.first || "—") : (b.second || "—");
        var leftId = aIsFirst ? b.first_id : b.second_id;
        var rightName = aIsFirst ? (b.second || "—") : (b.first || "—");
        var rightId = aIsFirst ? b.second_id : b.first_id;

        var leftTd = playerCell(leftName, leftId);
        if (aIsFirst && b.first) {
          var starL = el("span", "", "* ");
          starL.style.color = "#c0392b";
          starL.style.fontWeight = "700";
          leftTd.insertBefore(starL, leftTd.firstChild);
        }
        bTr.appendChild(leftTd);

        var scoreTd = el("td", "score");
        var rawScore = RESULT_SCORE[String(b.result)] || String(b.result || "--");
        var scoreText = aIsFirst ? rawScore : (FLIP_SCORE[rawScore] || rawScore);
        if (b.game_id !== null && b.game_id !== undefined) {
          var scoreLink = el("a", "score-link", scoreText);
          scoreLink.href = "game.html?id=" + encodeURIComponent(b.game_id);
          scoreTd.appendChild(scoreLink);
        } else {
          scoreTd.textContent = scoreText;
        }
        bTr.appendChild(scoreTd);

        var rightTd = playerCell(rightName, rightId);
        if (!aIsFirst && b.first) {
          var starR = el("span", "", "* ");
          starR.style.color = "#c0392b";
          starR.style.fontWeight = "700";
          rightTd.insertBefore(starR, rightTd.firstChild);
        }
        bTr.appendChild(rightTd);

        var pLeft = aIsFirst ? b.p_first : b.p_second;
        var pRight = aIsFirst ? b.p_second : b.p_first;
        bTr.appendChild(el("td", "prob", pLeft != null ? Number(pLeft).toFixed(1) + "%" : ""));
        bTr.appendChild(el("td", "prob", b.p_draw != null ? Number(b.p_draw).toFixed(1) + "%" : ""));
        bTr.appendChild(el("td", "prob", pRight != null ? Number(pRight).toFixed(1) + "%" : ""));
        tbody.appendChild(bTr);
      });
    });
  }

  function renderTournamentGames(data, round) {
    if (data.team_matches && data.team_matches.length) {
      renderTeamMatches(data, round);
      return;
    }

    var table = document.querySelector("table.tour-games");
    if (round === "pre" || round === "draw") {
      if (table) table.style.display = "none";
      renderRoundStandings(data, round);
      return;
    }
    if (table) table.style.display = "";
    if (!table || !table.tBodies[0]) return;
    var tbody = table.tBodies[0];
    // 表头是 tbody 的第一行，只清数据行
    while (tbody.rows.length > 1) tbody.deleteRow(tbody.rows.length - 1);
    var roundNum = round !== null ? Number(round) : null;
    (data.games || []).forEach(function (game) {
      // 选了轮次就只画这一轮的台次
      if (roundNum !== null && Number(game.round) !== roundNum) return;
      var tr = el("tr");
      var day = el("td", "date", short_date(game.date));
      day.title = game.date;
      tr.appendChild(day);
      tr.appendChild(el("td", "rnd", "第" + game.round + "轮 第" + game.board + "台"));
      tr.appendChild(el("td", "rule", game.rule || ""));
      tr.appendChild(playerCell(game.first, game.first_id, game.first_no));
      // 轮空也照库里填的记分显示（一般是 +:-），与其它台次一致
      var scoreTd = el("td", "score");
      var scoreText = RESULT_SCORE[String(game.result)] || String(game.result);
      var bye = game.first === "轮空" || game.second === "轮空";
      if (!bye && game.game_id !== null && game.game_id !== undefined) {
        var scoreLink = el("a", "score-link", scoreText);
        scoreLink.href = "game.html?id=" + encodeURIComponent(game.game_id);
        scoreTd.appendChild(scoreLink);
      } else {
        scoreTd.textContent = scoreText;
      }
      tr.appendChild(scoreTd);
      tr.appendChild(playerCell(game.second, game.second_id, game.second_no));
      tr.appendChild(el("td", "prob", game.p_first != null ? Number(game.p_first).toFixed(1) + "%" : ""));
      tr.appendChild(el("td", "prob", game.p_draw != null ? Number(game.p_draw).toFixed(1) + "%" : ""));
      tr.appendChild(el("td", "prob", game.p_second != null ? Number(game.p_second).toFixed(1) + "%" : ""));
      tbody.appendChild(tr);
    });
    renderRoundStandings(data, round);
  }

  function renderRoundStandings(data, round) {
    var wrap = document.getElementById("roundStandingsWrap");
    if (!wrap) return;
    var rs = data && data.round_standings;
    var rows = (rs && round !== null && rs[String(round)]) ? rs[String(round)] : null;
    if (!rows || !rows.length) {
      wrap.style.display = "none";
      return;
    }
    var isRR = !!(data && data.is_round_robin);
    var tbRules = (data && data.tiebreak_rules && data.tiebreak_rules.length)
      ? data.tiebreak_rules
      : (isRR ? ["sb", "wins"] : ["bh", "mbh", "wins"]);
    var tbLabels = {
      bh: "对手分",
      bh1: "对手分去1",
      bh2: "对手分去2",
      mbh: "中间对手分",
      sb: "小分",
      wins: "胜局数",
      h2h: "直胜"
    };
    var titleEl = document.getElementById("standingsTitle");
    if (titleEl) {
      if (round === "pre") {
        titleEl.textContent = "抽签前预测";
      } else if (round === "draw") {
        titleEl.textContent = "首轮前预测";
      } else {
        titleEl.textContent = "第" + round + "轮后积分与夺冠概率";
      }
    }
    var table = wrap.querySelector("table.tour-standings");
    if (!table || !table.tBodies[0]) return;
    var tbody = table.tBodies[0];
    while (tbody.rows.length > 0) tbody.deleteRow(tbody.rows.length - 1);

    var hasChamp = rows.some(function (r) { return r.champ_prob != null; });
    var headTr = el("tr");
    var headers = ["名次", "姓名", "积分"];
    tbRules.forEach(function (k) { headers.push(tbLabels[k] || k); });
    if (hasChamp) headers.push("夺冠概率");
    headers.forEach(function (h) {
      var th = document.createElement("th");
      th.textContent = h;
      headTr.appendChild(th);
    });
    tbody.appendChild(headTr);

    rows.forEach(function (r) {
      var tr = el("tr");
      tr.appendChild(el("td", "num", String(r.rank)));
      tr.appendChild(playerCell(r.name || "", r.player_id, r.player_no));
      tr.appendChild(el("td", "num", String(r.pts)));
      tbRules.forEach(function (k) {
        var val = r[k];
        tr.appendChild(el("td", "num", val != null ? String(val) : ""));
      });
      if (hasChamp) {
        tr.appendChild(el("td", "prob", Number(r.champ_prob).toFixed(2) + "%"));
      }
      tbody.appendChild(tr);
    });
    wrap.style.display = "block";
  }

  // 轮次选择：< [第N轮 ▾] / 共 X 轮 >，没有「全部」
  function setupRoundPicker(data, id) {
    var select = document.getElementById("roundSelect");
    var prev = document.getElementById("roundPrev");
    var next = document.getElementById("roundNext");
    var total = document.getElementById("roundTotal");
    var rounds = tournamentRounds(data);

    if (!select || !rounds.length) {
      renderTournamentGames(data, null);
      return;
    }

    select.innerHTML = "";
    var realRoundCount = 0;
    rounds.forEach(function (round) {
      var option = document.createElement("option");
      option.value = String(round);
      if (round === "pre") {
        option.textContent = "抽签前预测";
      } else if (round === "draw") {
        option.textContent = "首轮前预测";
      } else {
        option.textContent = "第" + round + "轮";
        realRoundCount++;
      }
      select.appendChild(option);
    });
    if (total) total.textContent = "/ 共 " + realRoundCount + " 轮";

    function syncNav() {
      var index = rounds.indexOf(String(select.value));
      if (prev) prev.disabled = index <= 0;
      if (next) next.disabled = index < 0 || index >= rounds.length - 1;
    }

    // push 为 true 时把这一轮写进地址栏（浏览器前进/后退可用）
    function goTo(round, push) {
      var index = rounds.indexOf(String(round));
      if (index < 0) return;
      select.value = String(rounds[index]);
      if (push && window.history && window.history.pushState) {
        window.history.pushState({ round: rounds[index] }, "", tournamentUrl(id, rounds[index]));
      }
      renderTournamentGames(data, rounds[index]);
      syncNav();
    }

    var wanted = roundFromUrl();
    var defaultRound = rounds.indexOf("1") >= 0 ? "1" : rounds[0];
    var current = rounds.indexOf(wanted) >= 0 ? wanted : defaultRound;
    // 地址栏没带轮次（或带了不存在的轮次）时补成实际显示的那一轮
    if (wanted !== current && window.history && window.history.replaceState) {
      window.history.replaceState({ round: current }, "", tournamentUrl(id, current));
    }
    goTo(current, false);

    select.addEventListener("change", function () {
      goTo(String(select.value), true);
    });

    function step(delta) {
      var index = rounds.indexOf(String(select.value));
      if (index < 0) return;
      goTo(rounds[index + delta], true);
    }

    if (prev) prev.addEventListener("click", function () { step(-1); });
    if (next) next.addEventListener("click", function () { step(1); });

    // 浏览器前进/后退时跟着地址栏上的轮次走
    window.addEventListener("popstate", function () {
      var back = roundFromUrl();
      goTo(rounds.indexOf(back) >= 0 ? back : defaultRound, false);
    });
  }

  function initTournament() {
    var match = /[?&]id=(\d+)/.exec(window.location.search);
    var id = match ? match[1] : "";
    var heading = document.getElementById("tourName");
    if (!id) {
      if (heading) heading.textContent = "未找到赛事";
      return Promise.resolve();
    }
    return fetch(DATA_BASE + "tournament/" + id + ".json")
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        if (!data || !data.name) throw new Error("empty");
        document.title = data.name;
        if (heading) heading.textContent = data.name;
        renderTournamentMeta(data);
        setupRoundPicker(data, id);
        return data;
      })
      .catch(function () {
        if (heading) heading.textContent = "未找到该赛事";
      });
  }

  /* ---------- 赛事列表的年份选择器 ---------- */

  function season_year(row) {
    var start = String(row.start_date || row.startDate || row.period || "").slice(0, 4);
    if (/^\d{4}$/.test(start)) return start;
    var end = String(row.end_date || row.endDate || "").slice(0, 4);
    return /^\d{4}$/.test(end) ? end : "";
  }

  // 数据里出现过的年份，从新到旧
  function tournamentYears(rows) {
    var seen = {};
    var list = [];
    rows.forEach(function (row) {
      var year = season_year(row || {});
      if (year && !seen[year]) {
        seen[year] = 1;
        list.push(year);
      }
    });
    return list.sort(function (a, b) { return a < b ? 1 : -1; });
  }

  function yearFromUrl() {
    var match = /[?&]year=(\d{4})/.exec(window.location.search);
    return match ? match[1] : null;
  }

  function yearUrl(year) {
    return "index.html?year=" + encodeURIComponent(year);
  }

  // 年份选择：< [2026年 ▾] / 共 X 年 >，只看某一年，没有「全部」
  function setupYearPicker(rows) {
    var select = document.getElementById("yearSelect");
    var prev = document.getElementById("yearPrev");
    var next = document.getElementById("yearNext");
    var years = tournamentYears(rows);

    if (!select || !years.length) {
      render("tournaments", sortRows("tournaments", rows));
      return;
    }

    select.innerHTML = "";
    years.forEach(function (year) {
      var option = document.createElement("option");
      option.value = year;
      option.textContent = year + "年";
      select.appendChild(option);
    });

    function syncNav() {
      var index = years.indexOf(select.value);
      if (prev) prev.disabled = index <= 0;
      if (next) next.disabled = index < 0 || index >= years.length - 1;
    }

    function goTo(year, push) {
      var index = years.indexOf(String(year));
      if (index < 0) return;
      var current = years[index];
      select.value = current;
      if (push && window.history && window.history.pushState) {
        window.history.pushState({ year: current }, "", yearUrl(current));
      }
      var list = rows.filter(function (row) { return season_year(row || {}) === current; });
      render("tournaments", sortRows("tournaments", list));
      syncNav();
    }

    var wanted = yearFromUrl();
    var current = years.indexOf(wanted) >= 0 ? wanted : years[0];
    // 地址栏没带年份（或带了没有的年份）时补成实际显示的那一年
    if (wanted !== current && window.history && window.history.replaceState) {
      window.history.replaceState({ year: current }, "", yearUrl(current));
    }
    goTo(current, false);

    select.addEventListener("change", function () {
      goTo(select.value, true);
    });

    function step(delta) {
      var index = years.indexOf(select.value);
      if (index < 0) return;
      goTo(years[index + delta], true);
    }

    if (prev) prev.addEventListener("click", function () { step(-1); });
    if (next) next.addEventListener("click", function () { step(1); });

    // 浏览器前进/后退时跟着地址栏上的年份走
    window.addEventListener("popstate", function () {
      var back = yearFromUrl();
      goTo(years.indexOf(back) >= 0 ? back : years[0], false);
    });
  }

  function setupPlayersPager(rows) {
    var sorted = sortRows("players", rows);
    var pageSize = 100;
    var totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
    var table = document.querySelector("table[data-feed='players']");
    var wrap = table ? table.closest(".table-wrap") : null;
    if (!wrap || !wrap.parentNode) {
      render("players", sorted.slice(0, pageSize));
      return;
    }

    function pageFromUrl() {
      var m = /[?&]page=(\d+)/.exec(window.location.search);
      var p = m ? Number(m[1]) : 1;
      if (isNaN(p) || p < 1) return 1;
      if (p > totalPages) return totalPages;
      return p;
    }

    function buildPagerBar() {
      var bar = document.createElement("div");
      bar.className = "round-pick";
      var prevBtn = el("button", "round-nav", "<");
      prevBtn.type = "button";
      var select = document.createElement("select");
      for (var p = 1; p <= totalPages; p++) {
        var sIdx = (p - 1) * pageSize + 1;
        var eIdx = Math.min(p * pageSize, sorted.length);
        var opt = document.createElement("option");
        opt.value = String(p);
        opt.textContent = "第 " + p + " 页 (" + sIdx + "-" + eIdx + ")";
        select.appendChild(opt);
      }
      var totalSpan = el("span", "round-total", "/ 共 " + totalPages + " 页（" + sorted.length + " 人）");
      var nextBtn = el("button", "round-nav", ">");
      nextBtn.type = "button";
      bar.appendChild(prevBtn);
      bar.appendChild(select);
      bar.appendChild(totalSpan);
      bar.appendChild(nextBtn);
      return { bar: bar, prevBtn: prevBtn, select: select, nextBtn: nextBtn };
    }

    var topPager = buildPagerBar();
    wrap.parentNode.insertBefore(topPager.bar, wrap);

    var currentPage = pageFromUrl();

    function goTo(page, push) {
      currentPage = Math.max(1, Math.min(totalPages, page));
      var start = (currentPage - 1) * pageSize;
      render("players", sorted.slice(start, start + pageSize));
      topPager.select.value = String(currentPage);
      topPager.prevBtn.disabled = currentPage <= 1;
      topPager.nextBtn.disabled = currentPage >= totalPages;
      if (push && window.history && window.history.pushState) {
        var url = "players.html?page=" + currentPage;
        window.history.pushState({ page: currentPage }, "", url);
      }
    }

    topPager.prevBtn.addEventListener("click", function () {
      if (currentPage > 1) {
        goTo(currentPage - 1, true);
        window.scrollTo(0, 0);
      }
    });
    topPager.nextBtn.addEventListener("click", function () {
      if (currentPage < totalPages) {
        goTo(currentPage + 1, true);
        window.scrollTo(0, 0);
      }
    });
    topPager.select.addEventListener("change", function () {
      goTo(Number(topPager.select.value), true);
      window.scrollTo(0, 0);
    });

    window.addEventListener("popstate", function () {
      goTo(pageFromUrl(), false);
    });

    goTo(currentPage, false);
  }

  function init() {
    if (document.querySelector("[data-player-page]")) return initPlayer();
    if (document.querySelector("[data-tournament-page]")) return initTournament();
    var feed = getFeed();
    if (!feed) return Promise.resolve();
    return load(feed).then(function (rows) {
      if (feed === "tournaments") {
        setupYearPicker(rows);
      } else if (feed === "players") {
        setupPlayersPager(rows);
      } else {
        render(feed, sortRows(feed, rows));
      }
      return rows;
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
