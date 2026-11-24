(function () {
  "use strict";

  var COLUMNS = {
    games: ["date", "tournament", "rule", "round", "board", "first", "result", "second"],
    tournaments: ["period", "name", "players", "games"],
    players: ["name", "tournaments", "games"]
  };

  var NUMERIC = {
    games: ["round", "board"],
    tournaments: ["players", "games"],
    players: ["tournaments", "games"]
  };

  var RESULT_SCORE = {
    "1": "1:0",
    "0": "0:1",
    "0.5": "½:½",
    "+-": "+:-",
    "-+": "-:+",
    "-:-": "-:-"
  };

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

  function init() {
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
