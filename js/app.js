(function () {
  "use strict";

  var config = window.RENJU_CONFIG || {};
  var base = String(config.apiBaseUrl || "").replace(/\/+$/, "");
  var token = String(config.token || "");

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

  function endpointFor(feed) {
    var ep = (config.endpoints || {})[feed];
    if (!base || !ep) return "";
    return base + "/" + String(ep).replace(/^\/+/, "");
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
    var url = endpointFor(feed);
    if (url) {
      var headers = { Accept: "application/json" };
      if (token) headers.Authorization = "Bearer " + token;
      return fetch(url, { headers: headers })
        .then(function (res) {
          if (!res.ok) throw new Error("HTTP " + res.status);
          return res.json();
        })
        .then(normalize)
        .catch(function () { return []; });
    }
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

  // 赛事日期范围来自 renju_prematch.date 的最小/最大值；
  // 接口未返回时用对局数据现算。
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

  function init() {
    var feed = getFeed();
    if (!feed) return;
    load(feed).then(function (rows) {
      var prepared = feed === "tournaments" ? withPeriods(rows) : Promise.resolve(rows);
      return prepared.then(function (list) { render(feed, list); });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
