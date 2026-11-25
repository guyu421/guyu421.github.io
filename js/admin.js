(function () {
  var TOKEN_KEY = "renju_admin_gh_token";
  var REPO_KEY = "renju_admin_gh_repo";
  var BRANCH_KEY = "renju_admin_gh_branch";

  var ghRepoEl = document.getElementById("ghRepo");
  var ghBranchEl = document.getElementById("ghBranch");
  var ghTokenEl = document.getElementById("ghToken");
  var saveTokenBtn = document.getElementById("saveTokenBtn");
  var tokenStatusEl = document.getElementById("tokenStatus");
  var tournamentSelectEl = document.getElementById("tournamentSelect");
  var loadTournamentBtn = document.getElementById("loadTournamentBtn");
  var newTemplateBtn = document.getElementById("newTemplateBtn");
  var cmdTemplateBtn = document.getElementById("cmdTemplateBtn");
  var txtEditorEl = document.getElementById("txtEditor");
  var lineStatsEl = document.getElementById("lineStats");
  var previewBtn = document.getElementById("previewBtn");
  var submitGithubBtn = document.getElementById("submitGithubBtn");
  var downloadTxtBtn = document.getElementById("downloadTxtBtn");
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
    var savedRepo = localStorage.getItem(REPO_KEY);
    var savedBranch = localStorage.getItem(BRANCH_KEY);
    var savedToken = localStorage.getItem(TOKEN_KEY);
    if (savedRepo) ghRepoEl.value = savedRepo;
    if (savedBranch) ghBranchEl.value = savedBranch;
    if (savedToken) {
      ghTokenEl.value = savedToken;
      tokenStatusEl.textContent = "已保存本地 Token";
    }
  }

  saveTokenBtn.addEventListener("click", function () {
    localStorage.setItem(REPO_KEY, ghRepoEl.value.trim());
    localStorage.setItem(BRANCH_KEY, ghBranchEl.value.trim() || "main");
    var tok = ghTokenEl.value.trim();
    if (tok) {
      localStorage.setItem(TOKEN_KEY, tok);
      tokenStatusEl.textContent = "已保存";
    } else {
      localStorage.removeItem(TOKEN_KEY);
      tokenStatusEl.textContent = "已清除";
    }
  });

  function loadCatalogs() {
    fetch("data/players.json")
      .then(function (r) { return r.json(); })
      .then(function (rows) {
        playersByName = {};
        playersById = {};
        rows.forEach(function (p) {
          var nm = String(p.name).trim();
          playersByName[nm] = p.player_id;
          playersById[String(p.player_id)] = nm;
        });
      })
      .catch(function () {});

    fetch("data/tournaments.json")
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
    lines.push("规则: " + defaultRule);
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
    roster.forEach(function (p, idx) {
      lines.push((p.no !== 9999 ? p.no : idx + 1) + " " + p.name);
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
            lines.push(g.board + " " + g.first + " + 轮空");
          } else {
            var resStr = g.result;
            if (g.result === "1") resStr = "1 - 0";
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
    fetch("data/tournament/" + tid + ".json")
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
      "赛事: 2026年示例锦标赛-公开组",
      "规则: 塔拉山口-10",
      "",
      "[棋手]",
      "1 张三",
      "2 135",
      "3 王五",
      "",
      "[第1轮 2026-11-25]",
      "1 张三 1 - 0 #2 swap=+--+- 5a=g9 moves=h8 h9 g10 g8 i10",
      "2 王五 + 轮空",
      "",
    ].join("\n");
    updateLineStats();
    setStatus("已填入新建赛事模板。", false);
  });

  cmdTemplateBtn.addEventListener("click", function () {
    txtEditorEl.value = [
      "# 单条/批量修改指令示例（取消注释后使用）",
      "# SET game 4990 result=平 swap=+--+- 5a=8 moves=h8 h9 g10 g8",
      "# DEL game 4990",
      "# RENAME tournament 57 新赛事名称",
      "# RENAME player 619 新姓名",
      "# MERGE player 619 -> 579",
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
        if (!mPl) {
          errors.push("第 " + lineNo + " 行棋手格式错误: " + line);
        } else {
          roster.push({ no: Number(mPl[1]), name: mPl[2].trim() });
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

        var mBye = rest.match(/^(\d+)\s+(.+?)\s+(?:\+\s+)?轮空$/);
        if (mBye) {
          matches.push({
            round: curRound, date: curDate, board: Number(mBye[1]),
            first: mBye[2].trim(), second: "轮空", result: "+-", extra: ""
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
        var mTok = rest.match(/^(\d+)\s+(.+?)\s+(\S+)\s+(.+?)$/);
        if (mTok) {
          matches.push({
            round: curRound, date: curDate, board: Number(mTok[1]),
            first: mTok[2].trim(), second: mTok[4].trim(), result: mTok[3], extra: extraStr
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
      rosterNoToToken[p.no] = p.name;
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
        if (playersById[pid]) return { label: playersById[pid] + " (ID:" + pid + ")", badge: "" };
        return { label: "ID:" + pid, badge: ' <span class="admin-badge">无此ID</span>' };
      }
      if (playersByName[s] != null) {
        return { label: s + " (ID:" + playersByName[s] + ")", badge: "" };
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
      if (playersByName[nm] == null) newPlayers[nm] = true;
    });

    var html = "";
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

  function toBase64Utf8(str) {
    var bytes = new TextEncoder().encode(str);
    var bin = "";
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  submitGithubBtn.addEventListener("click", function () {
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
    var token = ghTokenEl.value.trim() || localStorage.getItem(TOKEN_KEY) || "";
    var repo = ghRepoEl.value.trim() || "guyu421/guyu421.github.io";
    var branch = ghBranchEl.value.trim() || "main";
    if (!token) {
      setStatus("请先填写并保存 GitHub Token (需要 repo contents write 权限)，或点击「下载 .txt」在本地运行 <code>python tools/apply_txt.py</code>。", true);
      return;
    }

    var ts = new Date().toISOString().replace(/[:.]/g, "-");
    var filePath = "db/edits/edit_" + ts + ".txt";
    var apiUrl = "https://api.github.com/repos/" + repo + "/contents/" + filePath;

    submitGithubBtn.disabled = true;
    setStatus("正在提交到 GitHub (" + escHtml(filePath) + ") ...", false);

    fetch(apiUrl, {
      method: "PUT",
      headers: {
        "Authorization": "Bearer " + token,
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: "Admin txt edit: " + (parsed.tName || ts),
        content: toBase64Utf8(text + "\n"),
        branch: branch
      })
    })
      .then(function (resp) {
        return resp.json().then(function (data) {
          if (!resp.ok) throw new Error(data.message || ("HTTP " + resp.status));
          return data;
        });
      })
      .then(function (data) {
        var commitUrl = (data.commit && data.commit.html_url) || ("https://github.com/" + repo);
        var actionsUrl = "https://github.com/" + repo + "/actions";
        setStatus(
          '提交成功！GitHub Actions 将自动更新数据库、重训模型并导出页面。<br>' +
          '<a href="' + escHtml(commitUrl) + '" target="_blank" rel="noopener">查看本次 Commit</a> | ' +
          '<a href="' + escHtml(actionsUrl) + '" target="_blank" rel="noopener">查看 Actions 同步进度</a>',
          false
        );
      })
      .catch(function (err) {
        setStatus("提交失败: " + escHtml(err.message), true);
      })
      .finally(function () {
        submitGithubBtn.disabled = false;
      });
  });

  downloadTxtBtn.addEventListener("click", function () {
    var text = txtEditorEl.value || "";
    var blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "renju_edit_" + new Date().toISOString().slice(0, 10) + ".txt";
    a.click();
    URL.revokeObjectURL(a.href);
  });

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
