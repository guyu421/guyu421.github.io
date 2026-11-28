(function () {
  var DATA_BASE = (location.hostname === "renjuonline.top" || location.hostname === "www.renjuonline.top" || location.hostname === "66-42-93-24.sslip.io" || location.hostname === "66.42.93.24" || location.hostname === "localhost" || location.hostname === "127.0.0.1") ? "data/" : "https://66-42-93-24.sslip.io/data/";
  var API_BASE = (location.hostname === "renjuonline.top" || location.hostname === "www.renjuonline.top" || location.hostname === "66-42-93-24.sslip.io" || location.hostname === "66.42.93.24" || location.hostname === "localhost" || location.hostname === "127.0.0.1") ? "api/" : "https://66-42-93-24.sslip.io/api/";
  var API_TOKEN_KEY = "renju_admin_api_token";

  var apiTokenEl = document.getElementById("apiToken");
  var saveApiTokenBtn = document.getElementById("saveApiTokenBtn");
  var apiTokenStatusEl = document.getElementById("apiTokenStatus");
  var tournamentSelectEl = document.getElementById("tournamentSelect");
  var loadTournamentBtn = document.getElementById("loadTournamentBtn");
  var newTemplateBtn = document.getElementById("newTemplateBtn");
  var cmdTemplateBtn = document.getElementById("cmdTemplateBtn");
  var txtEditorEl = document.getElementById("txtEditor");
  var lineStatsEl = document.getElementById("lineStats");
  var previewBtn = document.getElementById("previewBtn");
  var submitServerBtn = document.getElementById("submitServerBtn");
  var downloadTxtBtn = document.getElementById("downloadTxtBtn");
  var downloadDbBtn = document.getElementById("downloadDbBtn");
  var clearBtn = document.getElementById("clearBtn");
  var statusBoxEl = document.getElementById("statusBox");
  var previewBoxEl = document.getElementById("previewBox");

  var playersByName = {};
  var playersById = {};
  var tournamentsList = [];

  function setStatus(msg, isError) {
    statusBoxEl.style.display = "block";
    statusBoxEl.className = "admin-status " + (isError ? "is-error" : "is-ok");
    statusBoxEl.innerHTML = msg;
  }

  function escHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function updateLineStats() {
    var val = txtEditorEl.value || "";
    var lines = val ? val.split(/\r?\n/).length : 0;
    lineStatsEl.textContent = lines + " 行 / " + val.length + " 字符";
  }

  function initConfig() {
    var savedApiToken = localStorage.getItem(API_TOKEN_KEY);
    if (savedApiToken && apiTokenEl) {
      apiTokenEl.value = savedApiToken;
      if (apiTokenStatusEl) apiTokenStatusEl.textContent = "已保存服务器 Token";
    }
  }

  if (saveApiTokenBtn && apiTokenEl) {
    saveApiTokenBtn.addEventListener("click", function () {
      var val = apiTokenEl.value.trim();
      if (val) {
        localStorage.setItem(API_TOKEN_KEY, val);
        if (apiTokenStatusEl) apiTokenStatusEl.textContent = "已保存服务器 Token";
      } else {
        localStorage.removeItem(API_TOKEN_KEY);
        if (apiTokenStatusEl) apiTokenStatusEl.textContent = "已清除服务器 Token";
      }
    });
  }

  function loadCatalogs() {
    fetch(DATA_BASE + "players.json")
      .then(function (r) { return r.json(); })
      .then(function (rows) {
        playersByName = {};
        playersById = {};
        (rows || []).forEach(function (p) {
          var nm = String(p.name).trim();
          if (!playersByName[nm]) playersByName[nm] = [];
          playersByName[nm].push(p);
          playersById[String(p.player_id)] = p;
        });
      })
      .catch(function () {});

    fetch(DATA_BASE + "tournaments.json")
      .then(function (r) { return r.json(); })
      .then(function (rows) {
        tournamentsList = rows || [];
        var html = '<option value="">-- 选择赛事 (' + tournamentsList.length + '项) --</option>';
        tournamentsList.forEach(function (t) {
          html += '<option value="' + t.tournament_id + '">#' + t.tournament_id + " " + escHtml(t.name) + " (" + (t.start_date || "") + ")</option>";
        });
        tournamentSelectEl.innerHTML = html;
      })
      .catch(function () {});
  }

  function formatTournamentToTxt(tData) {
    var games = tData.games || [];
    var defaultRule = games.length ? (games[0].rule || "塔拉山口-10") : "塔拉山口-10";
    var lines = [];
    lines.push("赛事ID: " + tData.tournament_id);
    lines.push("赛事: " + tData.name);
    lines.push("日期: " + (tData.start_date || ""));
    lines.push("规则: " + defaultRule);
    lines.push("总轮数: " + (tData.total_rounds != null ? tData.total_rounds : ""));
    lines.push("单循环: " + (tData.is_round_robin ? "是" : "否"));
    var tb = (tData.tiebreak_rules && tData.tiebreak_rules.length)
      ? tData.tiebreak_rules
      : (tData.is_round_robin ? ["sb", "wins"] : ["bh", "mbh", "wins"]);
    lines.push("破同分: " + tb.join(","));
    lines.push("夺冠概率: " + (tData.calc_champ_prob ? "是" : "否"));
    lines.push("");

    // Collect roster sorted by player_no
    var rosterMap = {};
    games.forEach(function (g) {
      if (g.first && g.first !== "轮空") {
        rosterMap[g.first] = g.first_no != null ? g.first_no : 9999;
      }
      if (g.second && g.second !== "轮空") {
        rosterMap[g.second] = g.second_no != null ? g.second_no : 9999;
      }
    });
    var roster = Object.keys(rosterMap).map(function (nm) {
      return { name: nm, no: rosterMap[nm] };
    });
    roster.sort(function (a, b) {
      return a.no - b.no || a.name.localeCompare(b.name);
    });
    lines.push("[棋手]");
    roster.forEach(function (p) {
      // 没有参赛编号的赛事，只写姓名，不编造编号
      lines.push(p.no !== 9999 ? (p.no + " " + p.name) : p.name);
    });
    lines.push("");

    // Group by round
    var byRound = {};
    games.forEach(function (g) {
      var rnd = g.round;
      if (!byRound[rnd]) byRound[rnd] = [];
      byRound[rnd].push(g);
    });
    Object.keys(byRound)
      .map(Number)
      .sort(function (a, b) { return a - b; })
      .forEach(function (rnd) {
        var rGames = byRound[rnd].slice().sort(function (a, b) { return a.board - b.board; });
        var dt = rGames[0].date || "";
        lines.push("[第" + rnd + "轮 " + dt + "]");
        rGames.forEach(function (g) {
          if (!g.second || g.second === "轮空") {
            lines.push(g.board + " " + g.first + " +- 轮空");
          } else {
            var resStr = g.result;
            if (g.result === "" || g.result === null || g.result === undefined) resStr = "vs";
            else if (g.result === "1") resStr = "1 - 0";
            else if (g.result === "0") resStr = "0 - 1";
            else if (g.result === "0.5") resStr = "0.5 - 0.5";
            var extra = [];
            if (g.rule && g.rule !== defaultRule) extra.push("rule=" + g.rule);
            if (g["5a"]) extra.push("5a=" + g["5a"]);
            if (g.swap) extra.push("swap=" + g.swap);
            lines.push(
              g.board + " " + g.first + " " + resStr + " " + g.second +
              (extra.length ? " " + extra.join(" ") : "")
            );
          }
        });
        lines.push("");
      });
    return lines.join("\n");
  }

  loadTournamentBtn.addEventListener("click", function () {
    var tid = tournamentSelectEl.value;
    if (!tid) {
      setStatus("请先选择一个赛事。", true);
      return;
    }
    fetch(DATA_BASE + "tournament/" + tid + ".json")
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (data) {
        txtEditorEl.value = formatTournamentToTxt(data);
        updateLineStats();
        setStatus("已加载赛事 #" + tid + "《" + escHtml(data.name) + "》到编辑框。", false);
      })
      .catch(function (err) {
        setStatus("加载失败: " + escHtml(err.message), true);
      });
  });

  newTemplateBtn.addEventListener("click", function () {
    txtEditorEl.value = [
      "# 新建赛事模板（若填 赛事ID: 则为覆盖更新；留空则自动分配新赛事ID）",
      "# 棋手可直接写姓名、数据库编号(如 135 或 id:135) 或 #参赛编号(如 #1)",
      "# [棋手] 行可不写参赛编号（只写姓名），或整段删掉 [棋手]：则该赛事无编号，不做夺冠概率计算",
      "赛事: 2026年示例锦标赛-公开组",
      "日期: 2026-11-25",
      "规则: 塔拉山口-10",
      "总轮数: 7",
      "单循环: 否",
      "破同分: bh,mbh,wins",
      "夺冠概率: 否",
      "",
      "[棋手]",
      "1 张三",
      "2 135",
      "3 王五",
      "",
      "[第1轮 2026-11-25]",
      "1 张三 1 - 0 #2 swap=+--+- 5a=g9 moves=h8 h9 g10 g8 i10",
      "2 王五 +- 轮空",
      "",
    ].join("\n");
    updateLineStats();
    setStatus("已填入新建赛事模板。", false);
  });

  cmdTemplateBtn.addEventListener("click", function () {
    txtEditorEl.value = [
      "# 共通指令示例（对象均支持 game/tournament/player 或 对局/赛事/选手）",
      "# SET game 4990 result=平 swap=+--+- 5a=8 moves=h8 h9 g10 g8",
      "# SET tournament 57 name=新赛事名称 start_date=2026-11-25 total_rounds=7 is_round_robin=false tiebreak_rules=bh,mbh,wins calc_champ_prob=true",
      "# SET player 619 name=新姓名",
      "# RENAME tournament 57 新赛事名称",
      "# RENAME player 619 新姓名",
      "# DEL game 4990",
      "# DEL tournament 57",
      "# DEL player 619",
      "# MERGE player 619 -> 579",
      "# MERGE tournament 58 -> 57",
      "",
    ].join("\n");
    updateLineStats();
    setStatus("已填入指令模板。", false);
  });

  function parseTxtPreview(text) {
    var lines = text.split(/\r?\n/);
    var tName = "";
    var tId = "";
    var defaultRule = "塔拉山口-10";
    var section = "";
    var curRound = 0;
    var curDate = "";
    var roster = [];
    var matches = [];
    var commands = [];
    var errors = [];

    lines.forEach(function (raw, idx) {
      var lineNo = idx + 1;
      var line = raw.trim();
      if (!line || line.startsWith("#")) return;
      if (/^(SET|DEL|RENAME|MERGE)\s+/i.test(line)) {
        commands.push({ lineNo: lineNo, cmd: line });
        return;
      }
      if (/^赛事ID[:：]/.test(line)) {
        tId = line.replace(/^赛事ID[:：]\s*/, "").trim();
        return;
      }
      if (/^赛事[:：]/.test(line)) {
        tName = line.replace(/^赛事[:：]\s*/, "").trim();
        return;
      }
      if (/^规则[:：]/.test(line)) {
        defaultRule = line.replace(/^规则[:：]\s*/, "").trim();
        return;
      }
      if (/^(日期|开始日期|单循环|破同分|夺冠概率)[:：]/.test(line)) {
        return;
      }
      if (line === "[棋手]") {
        section = "players";
        return;
      }
      var mRnd = line.match(/^\[第(\d+)轮\s+(\d{4}-\d{2}-\d{2})\]$/);
      if (mRnd) {
        section = "round";
        curRound = Number(mRnd[1]);
        curDate = mRnd[2];
        return;
      }
      if (section === "players") {
        var mPl = line.match(/^(\d+)\s+(.+)$/);
        if (mPl) {
          roster.push({ no: Number(mPl[1]), name: mPl[2].trim() });
        } else {
          // 没有参赛编号：整行即棋手（姓名 / 数据库ID / 带 * 新建重名）
          roster.push({ no: null, name: line });
        }
        return;
      }
      if (section === "round") {
        var kv = {};
        var rest = line;
        var kvRe = /\s+(5a|swap|rule|moves)=(.+?)(?=\s+(?:5a|swap|rule|moves)=|$)/gi;
        var firstKv = kvRe.exec(rest);
        if (firstKv) {
          var tail = rest.slice(firstKv.index);
          rest = rest.slice(0, firstKv.index).trim();
          kvRe.lastIndex = 0;
          var km;
          while ((km = kvRe.exec(tail)) !== null) {
            kv[km[1].toLowerCase()] = km[2].trim();
          }
        }
        var extraParts = [];
        if (kv.swap) extraParts.push("交换:" + kv.swap);
        if (kv["5a"]) extraParts.push("5a:" + kv["5a"]);
        if (kv.moves) extraParts.push(kv.moves.split(/\s+/).length + "手");
        var extraStr = extraParts.join(" ");

        var mBye = rest.match(/^(\d+)\s+(.+?)\s*(?:[+-]{1,2}\s+|vs\s+)?轮空(?:\s+.*)?$/i);
        if (mBye) {
          matches.push({
            round: curRound, date: curDate, board: Number(mBye[1]),
            first: mBye[2].trim().replace(/[+-]+$/, "").trim(), second: "轮空", result: "+-", extra: ""
          });
          return;
        }
        var mPending = rest.match(/^(\d+)\s+(.+?)\s+(?:vs|\?\s*[-:]\s*\?|-:-|\?|未赛)\s+(.+?)$/i);
        if (mPending) {
          matches.push({
            round: curRound, date: curDate, board: Number(mPending[1]),
            first: mPending[2].trim(), second: mPending[3].trim(), result: "vs", extra: extraStr
          });
          return;
        }
        var mDash = rest.match(/^(\d+)\s+(.+?)\s+(1|0|0\.5|½|\.5|\+|-)\s*[-:]\s*(1|0|0\.5|½|\.5|\+|-)\s+(.+?)$/);
        if (mDash) {
          matches.push({
            round: curRound, date: curDate, board: Number(mDash[1]),
            first: mDash[2].trim(), second: mDash[5].trim(), result: mDash[3] + "-" + mDash[4], extra: extraStr
          });
          return;
        }
        var mTok = rest.match(/^(\d+)\s+(.+?)\s*(\+-|-\+|--|1-0|0-1|0\.5-0\.5|½-½|1:0|0:1|0\.5:0\.5|\s(?:0\.5|½|\.5|1|0|胜|负|和|平|\+|-))\s+(.+?)$/);
        if (mTok) {
          matches.push({
            round: curRound, date: curDate, board: Number(mTok[1]),
            first: mTok[2].trim(), second: mTok[4].trim(), result: mTok[3].trim(), extra: extraStr
          });
          return;
        }
        errors.push("第 " + lineNo + " 行对局格式错误: " + line);
        return;
      }
      errors.push("第 " + lineNo + " 行未知语法: " + line);
    });

    return {
      tId: tId, tName: tName, defaultRule: defaultRule,
      roster: roster, matches: matches, commands: commands, errors: errors
    };
  }

  function collectDuplicateNames(parsedObj) {
    var seen = {};
    parsedObj.roster.forEach(function (p) { if (p.name) seen[p.name.trim()] = true; });
    parsedObj.matches.forEach(function (m) {
      if (m.first && m.first !== "轮空") seen[m.first.trim()] = true;
      if (m.second && m.second !== "轮空") seen[m.second.trim()] = true;
    });
    var duplicates = [];
    Object.keys(seen).forEach(function (nm) {
      if (!nm || /^#\d+$/.test(nm) || /^(?:id:)?\d+$/i.test(nm) || nm.endsWith("*")) return;
      var exact = playersByName[nm] || [];
      if (exact.length > 1) {
        duplicates.push({ name: nm, candidates: exact });
      }
    });
    return duplicates;
  }

  function replacePlayerTokenInEditor(oldName, replacement) {
    var lines = (txtEditorEl.value || "").split(/\r?\n/);
    var sec = null;
    var escRe = oldName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    var tokRe = new RegExp("(^|\\s)" + escRe + "(?=$|\\s|\\+-|-\\+|--)", "g");
    var out = lines.map(function (raw) {
      var trimmed = raw.trim();
      if (!trimmed || trimmed.charAt(0) === "#") return raw;
      if (trimmed === "[棋手]") { sec = "players"; return raw; }
      if (/^\[第\d+轮\s+\d{4}-\d{2}-\d{2}\]$/.test(trimmed)) { sec = "round"; return raw; }
      if (sec === "players") {
        var mPl = raw.match(/^(\s*\d+\s+)(.+?)(\s*)$/);
        if (mPl && mPl[2].trim() === oldName) return mPl[1] + replacement + mPl[3];
      } else if (sec === "round") {
        return raw.replace(tokRe, function (match, p1) { return p1 + replacement; });
      }
      return raw;
    });
    txtEditorEl.value = out.join("\n");
  }

  previewBoxEl.addEventListener("click", function (ev) {
    var pickBtn = ev.target.closest ? ev.target.closest(".admin-pick-btn") : null;
    if (pickBtn) {
      var nm = pickBtn.getAttribute("data-name");
      var rep = pickBtn.getAttribute("data-rep");
      if (nm && rep) {
        replacePlayerTokenInEditor(nm, rep);
        previewBtn.click();
      }
    }
  });

  previewBtn.addEventListener("click", function () {
    var parsed = parseTxtPreview(txtEditorEl.value || "");
    if (parsed.errors.length) {
      setStatus("解析发现 " + parsed.errors.length + " 处错误:<br>" + parsed.errors.map(escHtml).join("<br>"), true);
    } else {
      setStatus(
        "解析成功：" +
        (parsed.tName ? ("赛事《" + escHtml(parsed.tName) + "》" + (parsed.tId ? " (覆盖 #" + escHtml(parsed.tId) + ")" : " (新建)")) : "") +
        " | 对局 " + parsed.matches.length + " 盘 | 指令 " + parsed.commands.length + " 条",
        false
      );
    }

    var rosterNoToToken = {};
    parsed.roster.forEach(function (p) {
      if (p.no != null) rosterNoToToken[p.no] = p.name;
    });

    function resolvePreviewPlayer(tok) {
      if (!tok || tok === "轮空") return { label: "轮空", badge: "" };
      var s = tok.trim();
      if (/^#\d+$/.test(s)) {
        var rno = Number(s.slice(1));
        if (rosterNoToToken[rno]) return resolvePreviewPlayer(rosterNoToToken[rno]);
        return { label: s, badge: ' <span class="admin-badge">缺参赛号</span>' };
      }
      var mId = s.match(/^(?:id:)?(\d+)$/i);
      if (mId) {
        var pid = mId[1];
        if (playersById[pid]) return { label: playersById[pid].name + " (ID:" + pid + ")", badge: "" };
        return { label: "ID:" + pid, badge: ' <span class="admin-badge">无此ID</span>' };
      }
      if (s.endsWith("*")) {
        return { label: s, badge: ' <span class="admin-badge">新·重名</span>' };
      }
      var exactList = playersByName[s] || [];
      if (exactList.length > 1) {
        return { label: s, badge: ' <span class="admin-badge">重名(' + exactList.length + '人·待选)</span>' };
      }
      if (exactList.length === 1) {
        return { label: s + " (ID:" + exactList[0].player_id + ")", badge: "" };
      }
      return { label: s, badge: ' <span class="admin-badge">新</span>' };
    }

    var newPlayers = {};
    var seenNames = {};
    parsed.roster.forEach(function (p) { seenNames[p.name] = true; });
    parsed.matches.forEach(function (m) {
      if (m.first && m.first !== "轮空") seenNames[m.first] = true;
      if (m.second && m.second !== "轮空") seenNames[m.second] = true;
    });
    Object.keys(seenNames).forEach(function (nm) {
      if (/^#\d+$/.test(nm) || /^(?:id:)?\d+$/i.test(nm)) return;
      if (nm.endsWith("*") || !(playersByName[nm] && playersByName[nm].length)) newPlayers[nm] = true;
    });

    var dupNames = collectDuplicateNames(parsed);
    var html = "";
    if (dupNames.length) {
      html += '<div class="admin-disambig">';
      html += "<p><strong>⚠ 发现重名棋手，请选择具体 ID（或设为新建重名）：</strong></p>";
      dupNames.forEach(function (item) {
        html += '<div class="admin-disambig-item"><span><strong>' + escHtml(item.name) + '</strong> 匹配到 ' + item.candidates.length + ' 位棋手：</span>';
        item.candidates.forEach(function (c) {
          var info = "ID:" + c.player_id + (c.rating != null ? " | 分:" + Math.round(c.rating) : "") + (c.games != null ? " | " + c.games + "场" : "");
          html += ' <button type="button" class="admin-pick-btn" data-name="' + escHtml(item.name) + '" data-rep="id:' + c.player_id + '">' + escHtml(c.name) + " (" + escHtml(info) + ")</button>";
        });
        html += ' <button type="button" class="admin-pick-btn" data-name="' + escHtml(item.name) + '" data-rep="' + escHtml(item.name + "*") + '">新建重名 (' + escHtml(item.name) + '*)</button>';
        html += "</div>";
      });
      html += "</div>";
    }
    var newList = Object.keys(newPlayers);
    if (newList.length) {
      html += "<p><strong>将新增棋手 (" + newList.length + " 人):</strong> " + newList.map(escHtml).join("、") + "</p>";
    }
    if (parsed.commands.length) {
      html += "<p><strong>待执行指令:</strong></p><ul>" +
        parsed.commands.map(function (c) { return "<li><code>" + escHtml(c.cmd) + "</code></li>"; }).join("") +
        "</ul>";
    }
    if (parsed.matches.length) {
      html += '<div class="table-wrap"><table><tbody><tr><th>轮次</th><th>日期</th><th>台次</th><th>假先/黑</th><th>结果</th><th>假后/白</th><th>附加</th></tr>';
      parsed.matches.slice(0, 80).forEach(function (m) {
        var fp = resolvePreviewPlayer(m.first);
        var sp = resolvePreviewPlayer(m.second);
        html += "<tr><td>" + m.round + "</td><td>" + escHtml(m.date) + "</td><td>" + m.board + "</td><td>" +
          escHtml(fp.label) + fp.badge + "</td><td>" + escHtml(m.result) + "</td><td>" + escHtml(sp.label) + sp.badge + "</td><td>" + escHtml(m.extra || "") + "</td></tr>";
      });
      if (parsed.matches.length > 80) {
        html += '<tr><td colspan="7" class="admin-muted">仅预览前 80 盘（共 ' + parsed.matches.length + " 盘）</td></tr>";
      }
      html += "</tbody></table></div>";
    }
    previewBoxEl.innerHTML = html;
    previewBoxEl.style.display = html ? "block" : "none";
  });

  if (submitServerBtn) {
    submitServerBtn.addEventListener("click", function () {
      var text = (txtEditorEl.value || "").trim();
      if (!text) {
        setStatus("编辑框为空。", true);
        return;
      }
      var parsed = parseTxtPreview(text);
      if (parsed.errors.length) {
        setStatus("存在语法错误，请先修正后再提交：<br>" + parsed.errors.map(escHtml).join("<br>"), true);
        return;
      }
      var dupSubmit = collectDuplicateNames(parsed);
      if (dupSubmit.length) {
        previewBtn.click();
        setStatus(
          "存在重名棋手（" + dupSubmit.map(function (x) { return escHtml(x.name); }).join("、") +
          "），请在下方预览区选择具体 ID 或设为新建重名（*）后再提交。",
          true
        );
        return;
      }
      var apiTok = (apiTokenEl && apiTokenEl.value.trim()) || localStorage.getItem(API_TOKEN_KEY) || "";
      if (!apiTok) {
        setStatus("请先填写并保存「服务器 API 密钥」。", true);
        return;
      }
      submitServerBtn.disabled = true;
      setStatus("正在写入服务器 PostgreSQL 数据库 ...", false);
      fetch(API_BASE + "admin/apply", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + apiTok,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ text: text })
      })
        .then(function (resp) {
          return resp.json().then(function (data) {
            if (!resp.ok) throw new Error(data.detail || ("HTTP " + resp.status));
            return data;
          });
        })
        .then(function (data) {
          var logs = (data && data.logs) || [];
          var recalcMsg = "";
          if (data && data.recalc === "started") {
            recalcMsg = "<br>服务器已在后台自动开始重算 WHR 等级分与模型评估（约 1~2 分钟完成）。";
          } else if (data && data.recalc === "already_running") {
            recalcMsg = "<br>服务器已有重算任务正在后台运行。";
          }
          setStatus("写入服务器数据库成功！<br>" + logs.map(escHtml).join("<br>") + recalcMsg, false);
          loadCatalogs();
        })
        .catch(function (err) {
          setStatus("写入服务器数据库失败: " + escHtml(err.message), true);
        })
        .finally(function () {
          submitServerBtn.disabled = false;
        });
    });
  }

  downloadTxtBtn.addEventListener("click", function () {
    var text = txtEditorEl.value || "";
    var blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "renju_edit_" + new Date().toISOString().slice(0, 10) + ".txt";
    a.click();
    URL.revokeObjectURL(a.href);
  });

  function crc32(bytes) {
    var c = 0xffffffff;
    for (var i = 0; i < bytes.length; i++) {
      c ^= bytes[i];
      for (var k = 0; k < 8; k++) {
        c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      }
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  function buildZip(entries) {
    var enc = new TextEncoder();
    var localParts = [];
    var centralParts = [];
    var offset = 0;

    entries.forEach(function (ent) {
      var nameBytes = enc.encode(ent.name);
      var data = ent.data;
      var crc = crc32(data);
      var size = data.length;

      var lh = new Uint8Array(30 + nameBytes.length);
      var lv = new DataView(lh.buffer);
      lv.setUint32(0, 0x04034b50, true);
      lv.setUint16(4, 20, true);
      lv.setUint16(6, 0x0800, true);
      lv.setUint16(8, 0, true);
      lv.setUint16(10, 0, true);
      lv.setUint16(12, 0, true);
      lv.setUint32(14, crc, true);
      lv.setUint32(18, size, true);
      lv.setUint32(22, size, true);
      lv.setUint16(26, nameBytes.length, true);
      lv.setUint16(28, 0, true);
      lh.set(nameBytes, 30);

      localParts.push(lh, data);

      var ch = new Uint8Array(46 + nameBytes.length);
      var cv = new DataView(ch.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true);
      cv.setUint16(6, 20, true);
      cv.setUint16(8, 0x0800, true);
      cv.setUint16(10, 0, true);
      cv.setUint16(12, 0, true);
      cv.setUint16(14, 0, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, size, true);
      cv.setUint32(24, size, true);
      cv.setUint16(28, nameBytes.length, true);
      cv.setUint16(30, 0, true);
      cv.setUint16(32, 0, true);
      cv.setUint16(34, 0, true);
      cv.setUint16(36, 0, true);
      cv.setUint32(38, 0, true);
      cv.setUint32(42, offset, true);
      ch.set(nameBytes, 46);

      centralParts.push(ch);
      offset += lh.length + size;
    });

    var centralLen = centralParts.reduce(function (s, p) { return s + p.length; }, 0);
    var eocd = new Uint8Array(22);
    var ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(4, 0, true);
    ev.setUint16(6, 0, true);
    ev.setUint16(8, entries.length, true);
    ev.setUint16(10, entries.length, true);
    ev.setUint32(12, centralLen, true);
    ev.setUint32(16, offset, true);
    ev.setUint16(20, 0, true);

    return new Blob(localParts.concat(centralParts, [eocd]), { type: "application/zip" });
  }

  if (downloadDbBtn) {
    downloadDbBtn.addEventListener("click", function () {
      downloadDbBtn.disabled = true;
      setStatus("正在从服务器打包下载数据库 (SQL .zip) ...", false);
      fetch(API_BASE + "admin/db.zip?t=" + Date.now())
        .then(function (r) {
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.blob();
        })
        .then(function (blob) {
          var a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = "renju_db_" + new Date().toISOString().slice(0, 10) + ".zip";
          a.click();
          URL.revokeObjectURL(a.href);
          setStatus("数据库打包下载完成。", false);
        })
        .catch(function (err) {
          setStatus("下载数据库失败: " + escHtml(err.message), true);
        })
        .finally(function () {
          downloadDbBtn.disabled = false;
        });
    });
  }

  clearBtn.addEventListener("click", function () {
    txtEditorEl.value = "";
    previewBoxEl.style.display = "none";
    statusBoxEl.style.display = "none";
    updateLineStats();
  });

  txtEditorEl.addEventListener("input", updateLineStats);

  initConfig();
  loadCatalogs();
  updateLineStats();
})();
