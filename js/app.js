(function () {
  "use strict";

  var COLUMNS = {
    tournaments: ["period", "name", "players", "games"],
    players: ["rank", "name", "rating", "rd", "tournaments", "games"]
  };

  var NUMERIC = {
    tournaments: ["players", "games"],
    players: ["rank", "rating", "rd", "tournaments", "games"]
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
    return fetch("data/" + feed + ".json")
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
        } else if (col === "rating" || col === "rd") {
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
        var pa = formatPeriod(a || {});
        var pb = formatPeriod(b || {});
        if (pa !== pb) return pa < pb ? 1 : -1;
        return 0;
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
    metaRow(box, "等级分", one(data.rating) + "（偏差 " + one(data.rd) + "）");

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
  // gamesByTour：该棋手每个赛事的全部对局，用于点的悬浮详情
  function drawChart(history, gamesByTour) {
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
      var rd = row.length > 2 ? Number(row[2]) : 0;
      return {
        t: Date.parse(String(row[0]).slice(0, 10)) || 0,
        v: Number(row[1]),
        rd: isNaN(rd) ? 0 : rd
      };
    });
    var tMin = points[0].t, tMax = points[points.length - 1].t;

    var values = points.map(function (p) { return p.v; });
    var curveMin = Math.min.apply(null, values);
    var curveMax = Math.max.apply(null, values);
    var bandMin = Math.min.apply(null, points.map(function (p) { return p.v - p.rd; }));
    var bandMax = Math.max.apply(null, points.map(function (p) { return p.v + p.rd; }));

    // 纵轴范围覆盖偏差带，早期不确定度大时呈喇叭形
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

    // 横轴日期
    var ticks = history.length > 1 ? [0, Math.floor((history.length - 1) / 2), history.length - 1] : [0];
    ticks.forEach(function (index) {
      var p = points[index];
      var anchor = index === 0 && ticks.length > 1 ? "start"
        : index === ticks[ticks.length - 1] ? "end" : "middle";
      svg.appendChild(svgNode("text", {
        x: xOf(p.t), y: height - 6,
        "text-anchor": anchor, "font-size": 11, fill: "#6f7b83"
      }, String(history[index][0]).slice(0, 7)));
    });

    // 偏差带：等级分 ± RD
    var hasBand = points.some(function (p) { return p.rd > 0; });
    if (hasBand) {
      var upper = points.map(function (p, index) {
        return (index === 0 ? "M" : "L") + xOf(p.t).toFixed(1) + " " + yOf(p.v + p.rd).toFixed(1);
      }).join(" ");
      var lower = points.slice().reverse().map(function (p) {
        return "L" + xOf(p.t).toFixed(1) + " " + yOf(p.v - p.rd).toFixed(1);
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

    // 悬浮/点按查看该期详情：日期、等级分与偏差、当日各局的轮次与台次
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

    var tip = el("div", "chart-tip");
    tip.style.display = "none";
    var current = -1;

    function repaint(index, on) {
      var dot = dots[index];
      if (!dot) return;
      dot.setAttribute("r", on ? dotR + 2 : dotR);
      dot.setAttribute("stroke-width", on ? 2 : 1);
    }

    function hideTip() {
      tip.style.display = "none";
      guide.setAttribute("visibility", "hidden");
      if (current >= 0) repaint(current, false);
      current = -1;
    }

    function showTip(index) {
      if (current === index) return;
      if (current >= 0) repaint(current, false);
      current = index;

      var p = points[index];
      var date = String(history[index][0]).slice(0, 10);
      var tourId = history[index][3];
      tip.innerHTML = "";
      tip.appendChild(el("p", "tip-date", date));
      tip.appendChild(el("p", "tip-value",
        "等级分 " + p.v.toFixed(2) + "　偏差 " + p.rd.toFixed(2)));

      // 一个节点代表整个赛事，悬浮框里列出他在这个赛事打过的全部轮次
      var rows = (gamesByTour && gamesByTour[tourId]) || [];
      if (!rows.length) {
        tip.appendChild(el("p", "tip-game", "该赛事没有计入等级分的对局"));
      } else if (rows[0].tournament) {
        tip.appendChild(el("p", "tip-tour", rows[0].tournament));
      }
      rows.forEach(function (game) {
        var line = el("p", "tip-game");
        line.appendChild(el("span", "tip-meta",
          short_date(game.date) + " 第" + game.round + "轮 第" + game.board + "台"));
        line.appendChild(document.createTextNode(
          "　" + game.color + " " + game.result + " " + game.opponent));
        tip.appendChild(line);
      });

      tip.style.display = "block";

      var w = tip.offsetWidth;
      var h = tip.offsetHeight;
      var cx = xOf(p.t);
      var cy = yOf(p.v);
      tip.style.left = Math.min(Math.max(cx - w / 2, 2), Math.max(width - w - 2, 2)) + "px";
      var top = cy - h - 12;
      tip.style.top = (top < 2 ? cy + 14 : top) + "px";

      repaint(index, true);
      guide.setAttribute("x1", cx.toFixed(1));
      guide.setAttribute("x2", cx.toFixed(1));
      guide.setAttribute("visibility", "visible");
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
      hit.addEventListener("mouseenter", function () { showTip(index); });
      hit.addEventListener("click", function () { showTip(index); });
      hit.addEventListener("touchstart", function () { showTip(index); }, { passive: true });
      svg.appendChild(hit);
    });
    svg.addEventListener("mouseleave", hideTip);
    box.addEventListener("mouseleave", hideTip);

    // 图例
    var legendX = Math.max(width - 158, pad.left + 4);
    svg.appendChild(svgNode("rect", {
      x: legendX, y: 5, width: 12, height: 10,
      fill: "rgba(255,127,14,0.18)", stroke: "rgba(255,127,14,0.4)", "stroke-width": 1
    }));
    svg.appendChild(svgNode("text", {
      x: legendX + 17, y: 14, "font-size": 11, fill: "#6f7b83"
    }, "± 偏差"));
    svg.appendChild(svgNode("line", {
      x1: legendX + 78, y1: 10, x2: legendX + 92, y2: 10,
      stroke: "#ff7f0e", "stroke-width": 1.6
    }));
    svg.appendChild(svgNode("text", {
      x: legendX + 97, y: 14, "font-size": 11, fill: "#6f7b83"
    }, "等级分"));

    box.appendChild(svg);
    box.appendChild(tip);
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

    // 六列宽度：日期、轮次（含台次）、先后、结果、对手、等级分
    var oldGroup = table.querySelector("colgroup");
    if (oldGroup) table.removeChild(oldGroup);
    var colgroup = document.createElement("colgroup");
    [15, 18, 11, 15, 22, 19].forEach(function (share) {
      var col = document.createElement("col");
      col.style.width = share + "%";
      colgroup.appendChild(col);
    });
    table.insertBefore(colgroup, table.tBodies[0]);

    (data.results || []).forEach(function (group) {
      var head = el("tr");
      var th = el("th", "", group.tournament);
      th.colSpan = 6;
      head.appendChild(th);
      tbody.appendChild(head);

      var span = dates_of_group(group);
      var info = el("tr");
      info.appendChild(el("th", "second", "日期"));
      var dateCell = el("td", "num", span);
      dateCell.colSpan = 3;
      info.appendChild(dateCell);
      info.appendChild(el("th", "second", "等级分"));
      info.appendChild(el("td", "num", one(group.rating)));
      tbody.appendChild(info);

      var titles = el("tr");
      ["日期", "轮次", "先后", "结果", "对手", "等级分"].forEach(function (label) {
        titles.appendChild(el("th", "", label));
      });
      tbody.appendChild(titles);

      (group.games || []).forEach(function (game) {
        var tr = el("tr");
        var day = el("td", "date", short_date(game.date));
        day.title = game.date;
        tr.appendChild(day);
        // 轮次列后面带上这局用的规则
        var rnd = el("td", "rnd", "第" + game.round + "轮 第" + game.board + "台");
        if (game.rule) rnd.appendChild(el("span", "sub", game.rule));
        tr.appendChild(rnd);
        tr.appendChild(el("td", "cnum", game.color));
        tr.appendChild(el("td", game["class"], game.result));
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
    return fetch("data/player/" + id + ".json")
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        if (!data || !data.name) throw new Error("empty");
        document.title = data.name;
        if (heading) heading.textContent = data.name;
        renderPlayerMeta(data);

        // 按赛事归拢对局，曲线的每个节点对应一个赛事，悬浮框列出该赛事全部轮次
        var byTour = {};
        (data.results || []).forEach(function (group) {
          var list = byTour[group.tournament_id] || (byTour[group.tournament_id] = []);
          (group.games || []).forEach(function (game) {
            var row = {};
            for (var key in game) {
              if (Object.prototype.hasOwnProperty.call(game, key)) row[key] = game[key];
            }
            row.tournament = group.tournament;
            row.tournament_id = group.tournament_id;
            list.push(row);
          });
        });
        Object.keys(byTour).forEach(function (id) {
          byTour[id].sort(function (a, b) {
            if (a.date !== b.date) return a.date < b.date ? -1 : 1;
            return a.round - b.round || a.board - b.board;
          });
        });

        drawChart(data.history, byTour);
        renderPlayerGames(data);
        var timer = null;
        window.addEventListener("resize", function () {
          if (timer) clearTimeout(timer);
          timer = setTimeout(function () { drawChart(data.history, byTour); }, 150);
        });
        return data;
      })
      .catch(function () {
        if (heading) heading.textContent = "未找到该棋手";
      });
  }

  /* ---------- 赛事对局页 ---------- */

  function playerCell(name, id) {
    var td = el("td");
    if (name === "轮空") {
      td.className = "skip";
      td.textContent = name;
      return td;
    }
    if (id) {
      var link = el("a", "", name);
      link.href = "player.html?id=" + encodeURIComponent(id);
      td.appendChild(link);
    } else {
      td.textContent = name || "";
    }
    return td;
  }

  function renderTournamentMeta(data) {
    var box = document.getElementById("tourMeta");
    if (!box) return;
    box.innerHTML = "";
    metaRow(box, "日期", formatPeriod(data));
    metaRow(box, "规模", data.players + " 人，" + data.game_count + " 个对局");
  }

  function renderTournamentGames(data) {
    var table = document.querySelector("table.tour-games");
    if (!table || !table.tBodies[0]) return;
    var tbody = table.tBodies[0];
    // 表头是 tbody 的第一行，只清数据行
    while (tbody.rows.length > 1) tbody.deleteRow(tbody.rows.length - 1);
    (data.games || []).forEach(function (game) {
      var tr = el("tr");
      var day = el("td", "date", short_date(game.date));
      day.title = game.date;
      tr.appendChild(day);
      tr.appendChild(el("td", "rnd", "第" + game.round + "轮 第" + game.board + "台"));
      tr.appendChild(el("td", "rule", game.rule || ""));
      tr.appendChild(playerCell(game.first, game.first_id));
      tr.appendChild(el("td", "score", RESULT_SCORE[String(game.result)] || String(game.result)));
      tr.appendChild(playerCell(game.second, game.second_id));
      tbody.appendChild(tr);
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
    return fetch("data/tournament/" + id + ".json")
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        if (!data || !data.name) throw new Error("empty");
        document.title = data.name;
        if (heading) heading.textContent = data.name;
        renderTournamentMeta(data);
        renderTournamentGames(data);
        return data;
      })
      .catch(function () {
        if (heading) heading.textContent = "未找到该赛事";
      });
  }

  function init() {
    if (document.querySelector("[data-player-page]")) return initPlayer();
    if (document.querySelector("[data-tournament-page]")) return initTournament();
    var feed = getFeed();
    if (!feed) return Promise.resolve();
    return load(feed).then(function (rows) { return render(feed, sortRows(feed, rows)); });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
