(function () {
  "use strict";

  var COLUMNS = {
    games: ["date", "tournament", "rule", "round", "board", "first", "result", "second"],
    tournaments: ["period", "name", "players", "games"],
    players: ["rank", "name", "rating", "rd", "tournaments", "games"]
  };

  var NUMERIC = {
    games: ["round", "board"],
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
    if (start && end && start !== end) return start + " 至 " + end;
    return start || end;
  }

  // 赛事日期范围来自对局数据里 date 的最小/最大值。
  function withPeriods(rows) {
    var missing = rows.some(function (row) {
      return row && !row.start_date && !row.startDate && !row.period && !row.date_range;
    });
    if (!missing) return Promise.resolve(rows);
    return load("games").then(function (games) {
      var ranges = {};
      games.forEach(function (game) {
        if (!game || !game.tournament) return;
        var date = String(game.date || "").slice(0, 10);
        if (!date) return;
        var range = ranges[game.tournament];
        if (!range) {
          ranges[game.tournament] = { start: date, end: date };
          return;
        }
        if (date < range.start) range.start = date;
        if (date > range.end) range.end = date;
      });
      rows.forEach(function (row) {
        if (!row || row.start_date || row.startDate || row.period || row.date_range) return;
        var range = ranges[row.name];
        if (range) {
          row.start_date = range.start;
          row.end_date = range.end;
        }
      });
      return rows;
    });
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
        } else if (col === "result" && value !== undefined && value !== null) {
          td.textContent = RESULT_SCORE[String(value)] || String(value);
        } else if (col === "rating" || col === "rd") {
          td.textContent = value === null || value === undefined || value === "" ? "" : Number(value).toFixed(2);
        } else if (col === "name" && feed === "players") {
          var link = document.createElement("a");
          link.href = "player.html?id=" + encodeURIComponent(row.player_id);
          link.textContent = value === null || value === undefined ? "" : String(value);
          td.appendChild(link);
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

  // 对局、赛事从新到旧；同一天内按赛事分块，同一赛事的对局连在一起，再按轮次、台次
  function sortRows(feed, rows) {
    var list = rows.slice();
    if (feed === "games") {
      list.sort(function (a, b) {
        var da = String((a && a.date) || "");
        var db = String((b && b.date) || "");
        if (da !== db) return da < db ? 1 : -1;
        var ta = number(a && a.tournament_id);
        var tb = number(b && b.tournament_id);
        if (ta !== tb) return ta - tb;
        var ra = number(a && a.round);
        var rb = number(b && b.round);
        if (ra !== rb) return rb - ra;
        return number(a && a.board) - number(b && b.board);
      });
    } else if (feed === "tournaments") {
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

  function metaRow(parent, label, value) {
    var p = el("p");
    p.appendChild(el("b", "", label + "："));
    p.appendChild(document.createTextNode(value));
    parent.appendChild(p);
  }

  function renderPlayerMeta(data) {
    var box = document.getElementById("playerMeta");
    if (!box) return;
    box.innerHTML = "";
    metaRow(box, "名次", data.rank ? "第 " + data.rank + " 名" : "-");
    metaRow(box, "等级分", one(data.rating) + "（偏差 " + one(data.rd) + "）");
    var record = data.tournaments + " 个赛事，" + data.games + " 个对局，胜 " +
      data.wins + "，和 " + data.draws + "，负 " + data.losses;
    if (data.skips) record += "，轮空或弃权 " + data.skips;
    metaRow(box, "战绩", record);
    if (data.top_rating) {
      metaRow(box, "最高等级分", one(data.top_rating) + (data.top_date ? "（" + data.top_date + "）" : ""));
    }
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

    if (points.length <= 40) {
      points.forEach(function (p) {
        svg.appendChild(svgNode("circle", {
          cx: xOf(p.t).toFixed(1), cy: yOf(p.v).toFixed(1), r: 2.4,
          fill: "#ff7f0e", stroke: "#fff", "stroke-width": 1,
          "clip-path": "url(#" + clipId + ")"
        }));
      });
    }

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
  }

  function renderPlayerGames(data) {
    var table = document.querySelector("table.player-games");
    if (!table || !table.tBodies[0]) return;
    var tbody = table.tBodies[0];
    tbody.innerHTML = "";

    // 五列宽度：轮次、先后、结果窄，对手与等级分宽
    var oldGroup = table.querySelector("colgroup");
    if (oldGroup) table.removeChild(oldGroup);
    var colgroup = document.createElement("colgroup");
    [11, 15, 14, 32, 28].forEach(function (share) {
      var col = document.createElement("col");
      col.style.width = share + "%";
      colgroup.appendChild(col);
    });
    table.insertBefore(colgroup, table.tBodies[0]);

    (data.results || []).forEach(function (group) {
      var head = el("tr");
      var th = el("th", "", group.tournament);
      th.colSpan = 5;
      head.appendChild(th);
      tbody.appendChild(head);

      var info = el("tr");
      info.appendChild(el("th", "second", "日期"));
      var dateCell = el("td", "num", group.end_date);
      dateCell.colSpan = 2;
      info.appendChild(dateCell);
      info.appendChild(el("th", "second", "等级分"));
      info.appendChild(el("td", "num", one(group.rating)));
      tbody.appendChild(info);

      var titles = el("tr");
      ["轮次", "先后", "结果", "对手", "等级分"].forEach(function (label) {
        titles.appendChild(el("th", "", label));
      });
      tbody.appendChild(titles);

      (group.games || []).forEach(function (game) {
        var tr = el("tr");
        tr.appendChild(el("td", "num", game.round));
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

  function init() {
    if (document.querySelector("[data-player-page]")) return initPlayer();
    var feed = getFeed();
    if (!feed) return Promise.resolve();
    return load(feed).then(function (rows) {
      var prepared = feed === "tournaments" ? withPeriods(rows) : Promise.resolve(rows);
      return prepared.then(function (list) { render(feed, sortRows(feed, list)); });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
