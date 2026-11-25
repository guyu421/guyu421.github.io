(function () {
  var legendEl = document.getElementById("modelLegend");
  var wrapEl = document.getElementById("modelChartWrap");
  if (!legendEl || !wrapEl) return;

  var SERIES = [
    { key: "all", label: "全部预测", color: "#2f6fcd" },
    { key: "p50", label: "≥50%", color: "#d96b27" },
    { key: "p60", label: "≥60%", color: "#2d9d6f" },
    { key: "p70", label: "≥70%", color: "#dfa61d" },
    { key: "p80", label: "≥80%", color: "#d4699e" },
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

  renderLegend();
  fetch("data/model_eval.json")
    .then(function (r) { return r.json(); })
    .then(renderChart)
    .catch(function () {
      wrapEl.textContent = "加载评估数据失败";
    });
})();
