(function () {
  "use strict";

  var RESULT_SCORE = {
    "1": "1:0",
    "0": "0:1",
    "0.5": "\u00bd:\u00bd",
    "+-": "+:-",
    "-+": "-:+",
    "--": "-:-"
  };

  function parseCoord(token) {
    if (!token) return null;
    var m = /^([a-oA-O])(\d{1,2})$/.exec(token.trim());
    if (!m) return null;
    var col = m[1].toLowerCase().charCodeAt(0) - 97; // a=0 .. o=14
    var rowNum = parseInt(m[2], 10);                 // 1 .. 15 (bottom to top)
    if (col < 0 || col > 14 || rowNum < 1 || rowNum > 15) return null;
    return { col: col, row: 15 - rowNum, label: token.trim().toLowerCase() };
  }

  function parseMoves(movesStr) {
    if (!movesStr) return [];
    return String(movesStr)
      .trim()
      .split(/\s+/)
      .map(parseCoord)
      .filter(function (x) { return x !== null; });
  }

  function drawBoard(canvas, moves, step) {
    var dpr = window.devicePixelRatio || 1;
    var cssSize = Math.min(480, Math.max(300, canvas.parentElement.clientWidth - 16));
    canvas.style.width = cssSize + "px";
    canvas.style.height = cssSize + "px";
    canvas.width = Math.round(cssSize * dpr);
    canvas.height = Math.round(cssSize * dpr);

    var ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var pad = Math.round(cssSize * 0.068);
    var gridSize = cssSize - pad * 2;
    var cell = gridSize / 14;

    // Board background
    ctx.fillStyle = "#e6c280";
    ctx.fillRect(0, 0, cssSize, cssSize);
    ctx.strokeStyle = "#8a6730";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(0.75, 0.75, cssSize - 1.5, cssSize - 1.5);

    // Grid lines
    ctx.strokeStyle = "#3e2e16";
    ctx.lineWidth = 1;
    for (var i = 0; i < 15; i++) {
      var pos = pad + i * cell;
      ctx.beginPath();
      ctx.moveTo(pad, pos);
      ctx.lineTo(pad + gridSize, pos);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(pos, pad);
      ctx.lineTo(pos, pad + gridSize);
      ctx.stroke();
    }

    // Star points (d4, l4, h8, d12, l12)
    var stars = [[3, 3], [11, 3], [7, 7], [3, 11], [11, 11]];
    ctx.fillStyle = "#3e2e16";
    stars.forEach(function (pt) {
      ctx.beginPath();
      ctx.arc(pad + pt[0] * cell, pad + pt[1] * cell, Math.max(2.5, cell * 0.11), 0, Math.PI * 2);
      ctx.fill();
    });

    // Coordinates (a-o, 1-15)
    ctx.fillStyle = "#4b381b";
    var coordFont = Math.max(10, Math.round(cell * 0.36));
    ctx.font = coordFont + "px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (var c = 0; c < 15; c++) {
      var letter = String.fromCharCode(97 + c);
      var x = pad + c * cell;
      ctx.fillText(letter, x, pad + gridSize + pad * 0.52);
    }
    ctx.textAlign = "right";
    for (var r = 0; r < 15; r++) {
      var num = String(15 - r);
      var y = pad + r * cell;
      ctx.fillText(num, pad - pad * 0.3, y);
    }

    // Stones up to current step
    var radius = cell * 0.45;
    for (var m = 0; m < step; m++) {
      var mv = moves[m];
      var cx = pad + mv.col * cell;
      var cy = pad + mv.row * cell;
      var isBlack = m % 2 === 0;
      var isLast = m === step - 1;

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = isBlack ? "#181818" : "#fdfdfd";
      ctx.fill();
      ctx.lineWidth = isLast ? 2 : 1;
      ctx.strokeStyle = isLast ? "#dc2626" : (isBlack ? "#000000" : "#555555");
      ctx.stroke();

      // Move number (last move highlighted in red)
      var numStr = String(m + 1);
      var numFont = Math.max(9, Math.round(radius * (numStr.length >= 3 ? 0.78 : 0.95)));
      ctx.font = "bold " + numFont + "px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (isLast) {
        ctx.fillStyle = isBlack ? "#ff4d4f" : "#dc2626";
      } else {
        ctx.fillStyle = isBlack ? "#ffffff" : "#111111";
      }
      ctx.fillText(numStr, cx, cy + 0.5);
      ctx.restore();
    }
  }

  function renderMeta(data) {
    var title = document.getElementById("gameTitle");
    if (title) {
      title.textContent = (data.first || "") + " vs " + (data.second || "");
    }
    document.title = (data.first || "") + " vs " + (data.second || "") + " - 对局详情";

    var box = document.getElementById("gameMeta");
    if (!box) return;
    box.innerHTML = "";

    function addRow(label, htmlContent) {
      var div = document.createElement("div");
      div.className = "meta-line";
      var strong = document.createElement("strong");
      strong.textContent = label + "：";
      div.appendChild(strong);
      var span = document.createElement("span");
      span.innerHTML = htmlContent;
      div.appendChild(span);
      box.appendChild(div);
    }

    var tourHtml = data.tournament_id
      ? '<a href="tournament.html?id=' + encodeURIComponent(data.tournament_id) + '">' + escapeHtml(data.tournament || "") + "</a>"
      : escapeHtml(data.tournament || "");
    var roundHtml = data.tournament_id
      ? '<a href="tournament.html?id=' + encodeURIComponent(data.tournament_id) + "&round=" + encodeURIComponent(data.round) + '">第' + data.round + "轮</a>"
      : "第" + data.round + "轮";
    addRow("赛事", tourHtml + " · " + roundHtml + " 第" + data.board + "台");
    addRow("日期", escapeHtml(data.date || ""));
    addRow("规则", escapeHtml(data.rule || ""));

    var firstHtml = data.first_id
      ? '<a href="player.html?id=' + encodeURIComponent(data.first_id) + '">' + escapeHtml(data.first || "") + "</a>"
      : escapeHtml(data.first || "");
    var secondHtml = data.second_id && data.second !== "轮空"
      ? '<a href="player.html?id=' + encodeURIComponent(data.second_id) + '">' + escapeHtml(data.second || "") + "</a>"
      : escapeHtml(data.second || "");
    var scoreStr = RESULT_SCORE[String(data.result)] || String(data.result || "");
    addRow("对阵与结果", firstHtml + " &nbsp;<strong>" + escapeHtml(scoreStr) + "</strong>&nbsp; " + secondHtml);

    if (data.p_first != null && data.p_draw != null && data.p_second != null) {
      addRow(
        "赛前预测",
        "假先胜 " + Number(data.p_first).toFixed(1) + "% · 和棋 " +
          Number(data.p_draw).toFixed(1) + "% · 假后胜 " +
          Number(data.p_second).toFixed(1) + "%"
      );
    }

    addRow("交换序列", escapeHtml(data.swap ? String(data.swap) : "未记录"));
    addRow("五手打点", escapeHtml(data["5a"] ? String(data["5a"]) : "未记录"));
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function init() {
    var m = /[?&]id=([^&]+)/.exec(window.location.search);
    var id = m ? decodeURIComponent(m[1]) : "";
    if (!id) {
      document.getElementById("gameTitle").textContent = "未找到对局";
      return;
    }

    fetch("data/game/" + encodeURIComponent(id) + ".json")
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        renderMeta(data);

        var moves = parseMoves(data.moves);
        var total = moves.length;
        var step = total;

        var canvas = document.getElementById("renjuBoard");
        var stepInfo = document.getElementById("stepInfo");
        var btnFirst = document.getElementById("btnFirst");
        var btnPrev = document.getElementById("btnPrev");
        var btnNext = document.getElementById("btnNext");
        var btnLast = document.getElementById("btnLast");

        function update() {
          drawBoard(canvas, moves, step);
          if (stepInfo) stepInfo.textContent = step + " / " + total;
          if (btnFirst) btnFirst.disabled = step <= 0;
          if (btnPrev) btnPrev.disabled = step <= 0;
          if (btnNext) btnNext.disabled = step >= total;
          if (btnLast) btnLast.disabled = step >= total;
        }

        if (btnFirst) btnFirst.addEventListener("click", function () { step = 0; update(); });
        if (btnPrev) btnPrev.addEventListener("click", function () { if (step > 0) { step--; update(); } });
        if (btnNext) btnNext.addEventListener("click", function () { if (step < total) { step++; update(); } });
        if (btnLast) btnLast.addEventListener("click", function () { step = total; update(); });

        document.addEventListener("keydown", function (e) {
          if (e.key === "ArrowLeft" && step > 0) { step--; update(); }
          else if (e.key === "ArrowRight" && step < total) { step++; update(); }
          else if (e.key === "Home") { step = 0; update(); }
          else if (e.key === "End") { step = total; update(); }
        });

        window.addEventListener("resize", update);
        update();
      })
      .catch(function () {
        document.getElementById("gameTitle").textContent = "未找到该对局";
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
