(function () {
  var legendEl = document.getElementById("modelLegend");
  var wrapEl = document.getElementById("modelChartWrap");
  var metricsEl = document.getElementById("modelMetrics");
  var calWrapEl = document.getElementById("calChartWrap");
  if (!legendEl || !wrapEl) return;

  var SERIES = [
    { key: "all", label: "全部预测", color: "#2f6fcd" },
    { key: "p50", label: "置信度≥50%", color: "#d96b27" },
    { key: "p60", label: "置信度≥60%", color: "#2d9d6f" },
    { key: "p70", label: "置信度≥70%", color: "#dfa61d" },
    { key: "p80", label: "置信度≥80%", color: "#d4699e" },
  ];

  function renderLegend() {
    legendEl.innerHTML = SERIES.map(function (s) {
      return (
        '<span class="model-legend-item">' +
        '<span class="model-legend-line" style="background:' + s.color + ';"></span>' +
        '<span>' + s.label + "</span>" +
        "</span>"
      );
    }).join("");
  }

  function formatDateLabel(iso) {
    if (!iso) return "";
    var parts = iso.split("-");
    if (parts.length !== 3) return iso;
    return parts[0].slice(2) + "/" + Number(parts[1]) + "/" + Number(parts[2]);
  }

  function renderChart(data) {
    var pts = (data && data.points) || [];
    if (!pts.length) {
      wrapEl.textContent = "暂无评估数据";
      return;
    }

    var W = 820;
    var H = 340;
    var padL = 48;
    var padR = 20;
    var padT = 16;
    var padB = 34;
    var plotW = W - padL - padR;
    var plotH = H - padT - padB;

    var yMin = 40;
    var yMax = 100;
    var yTicks = [40, 50, 60, 70, 80, 90, 100];

    function xAt(i) {
      if (pts.length === 1) return padL + plotW / 2;
      return padL + (i / (pts.length - 1)) * plotW;
    }

    function yAt(v) {
      var clamped = Math.max(yMin, Math.min(yMax, v));
      return padT + ((yMax - clamped) / (yMax - yMin)) * plotH;
    }

    var svg = [];
    svg.push('<svg class="model-svg" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="预测准确率折线图">');

    // Gridlines & Y labels
    yTicks.forEach(function (yv) {
      var yy = yAt(yv).toFixed(1);
      svg.push('<line x1="' + padL + '" y1="' + yy + '" x2="' + (W - padR) + '" y2="' + yy + '" stroke="#e6eaee" stroke-width="1" />');
      svg.push('<text x="' + (padL - 8) + '" y="' + (Number(yy) + 4) + '" text-anchor="end" fill="#6b7782" font-size="11">' + yv + "%</text>");
    });

    // X-axis date ticks (start, mid, end)
    var xIndices = [0, Math.floor((pts.length - 1) / 2), pts.length - 1];
    xIndices.forEach(function (idx, k) {
      var xx = xAt(idx).toFixed(1);
      var anchor = k === 0 ? "start" : k === xIndices.length - 1 ? "end" : "middle";
      svg.push('<text x="' + xx + '" y="' + (H - 10) + '" text-anchor="' + anchor + '" fill="#6b7782" font-size="11">' + formatDateLabel(pts[idx].date) + "</text>");
    });

    // Series polylines + end dot
    SERIES.forEach(function (s) {
      var coords = [];
      var lastPt = null;
      pts.forEach(function (pt, idx) {
        var val = pt[s.key];
        if (val != null) {
          var cx = xAt(idx).toFixed(1);
          var cy = yAt(val).toFixed(1);
          coords.push(cx + "," + cy);
          lastPt = { x: cx, y: cy };
        }
      });
      if (coords.length) {
        svg.push('<polyline fill="none" stroke="' + s.color + '" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" points="' + coords.join(" ") + '" />');
        if (lastPt) {
          svg.push('<circle cx="' + lastPt.x + '" cy="' + lastPt.y + '" r="3.8" fill="' + s.color + '" />');
        }
      }
    });

    // Hover crosshair & hit layer
    svg.push('<line id="hoverLine" x1="0" y1="' + padT + '" x2="0" y2="' + (H - padB) + '" stroke="#9aa5b1" stroke-width="1" stroke-dasharray="3,3" style="display:none;" />');
    svg.push('<rect id="hoverOverlay" x="' + padL + '" y="' + padT + '" width="' + plotW + '" height="' + plotH + '" fill="transparent" />');
    svg.push("</svg>");
    svg.push('<div id="modelTooltip" class="model-tooltip" style="display:none;"></div>');

    wrapEl.innerHTML = svg.join("");

    var overlay = document.getElementById("hoverOverlay");
    var hoverLine = document.getElementById("hoverLine");
    var tooltip = document.getElementById("modelTooltip");
    var svgEl = wrapEl.querySelector("svg");

    overlay.addEventListener("mousemove", function (e) {
      var rect = svgEl.getBoundingClientRect();
      var relX = ((e.clientX - rect.left) / rect.width) * W;
      var frac = Math.max(0, Math.min(1, (relX - padL) / plotW));
      var idx = Math.round(frac * (pts.length - 1));
      var pt = pts[idx];
      var xx = xAt(idx).toFixed(1);
      hoverLine.setAttribute("x1", xx);
      hoverLine.setAttribute("x2", xx);
      hoverLine.style.display = "block";

      var lines = ['<div class="model-tt-date">' + pt.date + "</div>"];
      SERIES.forEach(function (s) {
        var val = pt[s.key];
        var ok = pt[s.key + "_ok"];
        var tot = pt[s.key + "_n"];
        if (val != null) {
          lines.push(
            '<div class="model-tt-row">' +
            '<span class="model-tt-dot" style="background:' + s.color + ';"></span>' +
            "<span>" + s.label + ": <strong>" + val.toFixed(2) + "%</strong> (" + ok + "/" + tot + ")</span>" +
            "</div>"
          );
        }
      });
      tooltip.innerHTML = lines.join("");
      tooltip.style.display = "block";
      var leftPct = (Number(xx) / W) * 100;
      tooltip.style.left = (leftPct > 65 ? leftPct - 24 : leftPct + 2) + "%";
    });

    overlay.addEventListener("mouseleave", function () {
      hoverLine.style.display = "none";
      tooltip.style.display = "none";
    });
  }

  function renderMetrics(data) {
    if (!metricsEl || !data || !data.metrics) return;
    var m = data.metrics;
    var allAcc = data.summary && data.summary.all ? data.summary.all.accuracy : null;
    var cards = [
      { label: "对数损失 (Log Loss)", value: m.logloss != null ? m.logloss.toFixed(4) : "-" },
      { label: "布里尔分数 (Brier Score)", value: m.brier != null ? m.brier.toFixed(4) : "-" },
      { label: "期望校准误差 (ECE)", value: m.ece != null ? m.ece.toFixed(2) + "%" : "-" },
      { label: "全部预测准确率", value: allAcc != null ? allAcc.toFixed(2) + "%" : "-" },
    ];
    metricsEl.innerHTML = cards.map(function (c) {
      return (
        '<div class="model-metric-card">' +
        '<div class="model-metric-label">' + c.label + "</div>" +
        '<div class="model-metric-value">' + c.value + "</div>" +
        "</div>"
      );
    }).join("");
  }

  function renderCalibration(data) {
    if (!calWrapEl) return;
    var cal = (data && data.calibration) || {};
    var calSeries = [
      { key: "first", label: "假先胜", color: "#2f6fcd" },
      { key: "draw", label: "和棋", color: "#2d9d6f" },
      { key: "second", label: "假后胜", color: "#d96b27" },
    ];
    var eceMap = (data && data.metrics && data.metrics.ece_by_class) || {};
    var hasAny = calSeries.some(function (s) { return (cal[s.key] || []).length > 0; });
    if (!hasAny) {
      calWrapEl.textContent = "暂无校准数据";
      return;
    }

    var W = 820;
    var H = 320;
    var padL = 48;
    var padR = 24;
    var padT = 16;
    var padB = 34;
    var plotW = W - padL - padR;
    var plotH = H - padT - padB;
    var vMin = 0;
    var vMax = 100;
    var ticks = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

    function xVal(v) {
      var c = Math.max(vMin, Math.min(vMax, v));
      return padL + ((c - vMin) / (vMax - vMin)) * plotW;
    }

    function yVal(v) {
      var c = Math.max(vMin, Math.min(vMax, v));
      return padT + ((vMax - c) / (vMax - vMin)) * plotH;
    }

    var svg = [];
    svg.push('<svg class="model-svg" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="概率校准曲线图">');

    ticks.forEach(function (tv) {
      var yy = yVal(tv).toFixed(1);
      var xx = xVal(tv).toFixed(1);
      svg.push('<line x1="' + padL + '" y1="' + yy + '" x2="' + (W - padR) + '" y2="' + yy + '" stroke="#e6eaee" stroke-width="1" />');
      svg.push('<text x="' + (padL - 8) + '" y="' + (Number(yy) + 4) + '" text-anchor="end" fill="#6b7782" font-size="11">' + tv + "%</text>");
      svg.push('<text x="' + xx + '" y="' + (H - 10) + '" text-anchor="middle" fill="#6b7782" font-size="11">' + tv + "%</text>");
    });

    // Perfect calibration diagonal y = x
    svg.push(
      '<line x1="' + xVal(vMin).toFixed(1) + '" y1="' + yVal(vMin).toFixed(1) +
      '" x2="' + xVal(vMax).toFixed(1) + '" y2="' + yVal(vMax).toFixed(1) +
      '" stroke="#9aa5b1" stroke-width="1.5" stroke-dasharray="5,5" />'
    );

    var dotMeta = [];
    calSeries.forEach(function (s) {
      var bins = cal[s.key] || [];
      if (!bins.length) return;
      var pts = bins.map(function (b) {
        return xVal(b.mean_p).toFixed(1) + "," + yVal(b.actual).toFixed(1);
      });
      svg.push('<polyline fill="none" stroke="' + s.color + '" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" points="' + pts.join(" ") + '" />');
      bins.forEach(function (b) {
        var cx = xVal(b.mean_p).toFixed(1);
        var cy = yVal(b.actual).toFixed(1);
        var dIdx = dotMeta.length;
        dotMeta.push({ series: s, bin: b, cx: cx });
        svg.push('<circle class="cal-dot" data-idx="' + dIdx + '" cx="' + cx + '" cy="' + cy + '" r="4.2" fill="' + s.color + '" stroke="#ffffff" stroke-width="1.3" style="cursor:pointer;" />');
      });
    });

    svg.push("</svg>");
    svg.push('<div id="calTooltip" class="model-tooltip" style="display:none;"></div>');
    calWrapEl.innerHTML = svg.join("");

    var calTip = document.getElementById("calTooltip");
    var calSvg = calWrapEl.querySelector("svg");
    calSvg.querySelectorAll(".cal-dot").forEach(function (dot) {
      dot.addEventListener("mouseenter", function () {
        var meta = dotMeta[Number(dot.getAttribute("data-idx"))];
        var b = meta.bin;
        var s = meta.series;
        var eceStr = eceMap[s.key] != null ? " (ECE " + eceMap[s.key].toFixed(2) + "%)" : "";
        calTip.innerHTML =
          '<div class="model-tt-date">' + s.label + eceStr + " · [" + b.lo + "%, " + b.hi + "%) · " + b.n + " 局</div>" +
          '<div class="model-tt-row">预测均值: <strong>' + b.mean_p.toFixed(2) + "%</strong></div>" +
          '<div class="model-tt-row">实际占比: <strong>' + b.actual.toFixed(2) + "%</strong></div>";
        calTip.style.display = "block";
        var leftPct = (Number(meta.cx) / W) * 100;
        calTip.style.left = (leftPct > 65 ? leftPct - 28 : leftPct + 2) + "%";
      });
      dot.addEventListener("mouseleave", function () {
        calTip.style.display = "none";
      });
    });
  }

  renderLegend();
  fetch("data/model_eval.json")
    .then(function (r) { return r.json(); })
    .then(function (data) {
      renderMetrics(data);
      renderChart(data);
      renderCalibration(data);
    })
    .catch(function () {
      wrapEl.textContent = "加载评估数据失败";
    });
})();
