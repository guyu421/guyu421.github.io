// 连珠对局库 · 首页渲染
// DOM 结构与 sport.dev 的 createMatchCard / 首页列表保持一致
(function () {
  var html = document.documentElement;

  // 数据库直连：CloudBase PG 的 REST 基址 + Publishable Key（页面直接读库）
  var DB = String(window.RENJU_DB || '').replace(/\/+$/, '');
  var DB_KEY = String(window.RENJU_KEY || '');
  // 棋谱详情页前缀：没配置就不把卡片做成链接（避免线上点到 404）
  var GAME_BASE = String(window.RENJU_GAME_BASE || '').replace(/\/+$/, '');
  var POISSON_API = String(window.POISSON_API || 'https://saishi-d6gz1139g33c076b0-1304984528.ap-shanghai.app.tcloudbase.com/predict').replace(/\/+$/, '');

  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };

  var STR = {
    zh: {
      title: 'saiyuan', sr: 'saiyuan', all: '全部',
      renjuSport: '五子棋', footballSport: '足球',
      leagueAll: '全部', eng1: '英超',
      schedule: '赛程', results: '赛果',
      round: function (n) { return '第' + n + '轮'; },
      board: function (n) { return '第' + n + '台'; },
      forfeit: '弃权',
      live: '进行中',
      noSchedule: '暂无赛程',
      noResults: '暂无赛果',
      locale: 'zh-CN',
      docTitle: 'saiyuan',
      search: '搜索赛事、球队…',
      searchLabel: '搜索',
      more: '加载更早的赛事'
    },
    en: {
      title: 'saiyuan', sr: 'saiyuan', all: 'All',
      renjuSport: 'Renju', footballSport: 'Football',
      leagueAll: 'All', eng1: 'Premier League',
      schedule: 'Schedule', results: 'Results',
      round: function (n) { return 'Round ' + n; },
      board: function (n) { return 'Board ' + n; },
      forfeit: 'Forfeit',
      live: 'Live',
      noSchedule: 'No scheduled games',
      noResults: 'No results',
      locale: 'en-US',
      docTitle: 'saiyuan',
      search: 'Search matches, teams…',
      searchLabel: 'Search',
      more: 'Load earlier tournaments'
    }
  };

  var state = {
    lang: localStorage.getItem('renju.lang') === 'en' ? 'en' : 'zh',
    scope: 'past',
    sport: 'all',       // all | renju | football
    league: 'all'       // all | eng.1
  };

  function T() { return STR[state.lang]; }

  // ── 日期 ───────────────────────────────────────────────
  function parseISO(iso) {
    var p = String(iso || '').split('-').map(Number);
    if (p.length !== 3 || !p[0] || !p[1] || !p[2]) return null;
    return { y: p[0], m: p[1], d: p[2], utc: Date.UTC(p[0], p[1] - 1, p[2]) };
  }

  function fmtDate(o) {
    if (state.lang === 'en') {
      return new Date(o.utc).toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC'
      });
    }
    var wd = '日一二三四五六'.charAt(new Date(o.utc).getUTCDay());
    return o.y + '年' + o.m + '月' + o.d + '日 星期' + wd;
  }

  // 一律按「年月日 星期」显示，不用今天/明天/昨天
  function dayLabel(iso) {
    var o = parseISO(iso);
    return o ? fmtDate(o) : '';
  }

  // timestamptz → 北京时间（+08:00）的 { date, time }
  function shanghai(ts) {
    var d = new Date(ts);
    if (isNaN(d.getTime())) return null;
    var f = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai', hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
    var p = {};
    f.formatToParts(d).forEach(function (x) { p[x.type] = x.value; });
    return { date: p.year + '-' + p.month + '-' + p.day, time: p.hour + ':' + p.minute };
  }

  function todayLabel() {
    var n = new Date();
    return fmtDate({ y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate(),
      utc: Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()) });
  }

  // ── 对局卡 ─────────────────────────────────────────────
  // 正常对局按比分显示：1–0 / 0–1 / ½–½。
  // 弃权局才用成绩册的 + / - 记法（左黑右白）：白方弃权 + -、黑方弃权 - +、
  // 双方都弃权 - -。哪一方弃权在库里是 black_forfeit / white_forfeit 两个标记。
  var SIDE_SCORE = { B: ['1', '0'], W: ['0', '1'], D: ['½', '½'] };

  function resultHTML(g) {
    if (g.black_forfeit || g.white_forfeit) {
      return '<span class="mc-score mc-res" title="' + esc(T().forfeit) + '">' +
        '<i class="mc-sym">' + (g.black_forfeit ? '-' : '+') + '</i>' +
        '<i class="mc-sym">' + (g.white_forfeit ? '-' : '+') + '</i>' +
        '</span>';
    }
    var pair = SIDE_SCORE[g.result];
    if (!pair) return '<span class="mc-score">—</span>';
    return '<span class="mc-score">' + pair[0] +
      '<span class="mc-dash">–</span>' + pair[1] + '</span>';
  }

  var DIVIDER = '<div class="upcoming-match-divider"></div>';

  // 棋手名跟随当前语言：中文用本名（汉字/假名），英文用拉丁转写
  function playerName(g, side) {
    var zh = g[side + '_zh'];
    if (state.lang === 'zh' && zh) return zh;
    return g[side] || '';
  }

  function cardHTML(g, tour) {
    // 抬头：赛事 第x轮 第x台
    var rd = g.round ? T().round(g.round) : '';
    var label = [tour, rd, g.board != null ? T().board(g.board) : '']
      .filter(Boolean).join(' ');
    // 有详情页前缀才渲染成链接，否则用同款 div（线上静态站不产生 404 链接）
    var tag = GAME_BASE ? 'a' : 'div';
    var open = GAME_BASE
      ? '<a class="mc-in" href="' + esc(GAME_BASE + '/game/' + g.id) + '" data-match-page="' + g.id + '">'
      : '<div class="mc-in">';

    return '' +
      '<div class="upcoming-match-row mc-row" id="match-' + g.id + '" data-match-id="' + g.id + '">' +
        open +
          '<div class="upcoming-match-summary">' +
            '<div class="mc-meta">' +
              '<span class="mc-lead"><b class="mc-lg">' +
                '<span class="mc-lg-full">' + esc(label) + '</span>' +
                '<span class="mc-lg-code">' + esc(label) + '</span>' +
              '</b></span>' +
              '<span class="mc-end"><span class="mc-chev" aria-hidden="true"></span></span>' +
            '</div>' +
            '<div class="mc-main">' +
              '<div class="mc-side is-home">' +
                '<span class="mc-nm"><span class="mc-name">' + esc(playerName(g, 'black')) + '</span></span>' +
              '</div>' +
              '<div class="mc-c">' + resultHTML(g) + '</div>' +
              '<div class="mc-side is-away">' +
                '<span class="mc-nm"><span class="mc-name">' + esc(playerName(g, 'white')) + '</span></span>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</' + tag + '>' +
      '</div>';
  }

  function groupHTML(label, rowsHTML) {
    return '<div class="date-separator is-first">' + esc(label) + '</div>' +
      '<div class="upcoming-matches-card">' + rowsHTML + '</div>';
  }

  function emptyHTML(msg) {
    return '<div class="upcoming-match-row mc-row"><div class="upcoming-match-summary">' +
      '<div class="mc-meta"><span class="mc-lead">' + esc(msg) + '</span></div></div></div>';
  }

  // 联赛名：库里只存 ESPN 的代码（eng.1），中文名在页面上映射
  var LEAGUES = { 'eng.1': { zh: '英超', en: 'Premier League' } };

  function leagueLabel(code) {
    var l = LEAGUES[code];
    return l ? (l[state.lang] || l.zh) : String(code || '');
  }

  // 队标：库里存 ESPN 的 png 地址，加载失败就把 img 去掉，只留队名
  function crestHTML(src) {
    if (!src) return '';
    return '<img class="mc-logo" src="' + esc(src) + '" alt="" width="26" height="26"' +
      ' loading="lazy" onerror="this.remove()">';
  }

  // ── 泊松分布预测（仅预测未来赛事；开赛后固定读取云端锁定结果）────────────────
  var poissonHourly = null;   // GET /hourly
  var poissonHourlyMap = {};  // "home__away" -> prediction
  var poissonModel = null;    // GET /model-info
  var poissonTeams = {};      // lowercase team/alias -> { attack, defense }
  var lockedPredictions = {}; // match_id -> stored prediction from CloudBase PG

  var POISSON_ALIASES = {
    'man city': 'man city', 'manchester city': 'man city',
    'man utd': 'man united', 'man united': 'man united', 'manchester united': 'man united',
    'spurs': 'tottenham', 'tottenham hotspur': 'tottenham',
    'wolves': 'wolves', 'wolverhampton': 'wolves', 'wolverhampton wanderers': 'wolves',
    'newcastle united': 'newcastle', 'west ham united': 'west ham',
    'brighton & hove albion': 'brighton', 'brighton and hove albion': 'brighton',
    "nott'm forest": "nott'm forest", 'nottingham forest': "nott'm forest",
    'leeds united': 'leeds', 'leicester city': 'leicester',
    'norwich city': 'norwich', 'sheffield united': 'sheffield united',
    'luton town': 'luton', 'ipswich town': 'ipswich',
    'afc bournemouth': 'bournemouth', 'sunderland': 'sunderland'
  };

  function normTeam(name) {
    var k = String(name || '').trim().toLowerCase();
    return POISSON_ALIASES[k] || k;
  }

  function poissonPmf(k, lam) {
    var f = 1;
    for (var i = 2; i <= k; i++) f *= i;
    return Math.exp(-lam) * Math.pow(lam, k) / f;
  }

  function computePoissonLocal(homeName, awayName) {
    if (!poissonModel || !poissonModel.params) return null;
    var h = poissonTeams[normTeam(homeName)] || { attack: 0, defense: 0 };
    var a = poissonTeams[normTeam(awayName)] || { attack: 0, defense: 0 };
    var mu = poissonModel.params.mu;
    var gamma = poissonModel.params.gamma;
    var maxG = 6;
    var lamH = Math.exp(mu + gamma + h.attack + a.defense);
    var lamA = Math.exp(mu + a.attack + h.defense);
    var ph = [], pa = [], mat = [], total = 0;
    for (var k = 0; k <= maxG; k++) {
      ph.push(poissonPmf(k, lamH));
      pa.push(poissonPmf(k, lamA));
    }
    var pHome = 0, pDraw = 0, pAway = 0, pOver25 = 0, pBtts = 0, scores = [];
    for (var i = 0; i <= maxG; i++) {
      mat[i] = [];
      for (var j = 0; j <= maxG; j++) {
        var p = ph[i] * pa[j];
        mat[i][j] = p;
        total += p;
      }
    }
    for (i = 0; i <= maxG; i++) {
      for (j = 0; j <= maxG; j++) {
        var normP = mat[i][j] / total;
        mat[i][j] = normP;
        if (i > j) pHome += normP;
        else if (i === j) pDraw += normP;
        else pAway += normP;
        if (i + j >= 3) pOver25 += normP;
        if (i > 0 && j > 0) pBtts += normP;
        scores.push({ score: i + '-' + j, probability: normP });
      }
    }
    scores.sort(function (x, y) { return y.probability - x.probability; });
    return {
      expected_goals: { home: lamH, away: lamA },
      probabilities_1x2: { home_win: pHome, draw: pDraw, away_win: pAway },
      fair_odds_1x2: {
        home_win: Math.round(100 / Math.max(pHome, 1e-4)) / 100,
        draw: Math.round(100 / Math.max(pDraw, 1e-4)) / 100,
        away_win: Math.round(100 / Math.max(pAway, 1e-4)) / 100
      },
      over_under: { over_2_5: pOver25, under_2_5: 1 - pOver25 },
      btts: { yes: pBtts, no: 1 - pBtts },
      top_scorelines: scores.slice(0, 5),
      score_matrix: mat.slice(0, 5).map(function (r) { return r.slice(0, 5); }),
      from_hourly: false
    };
  }

  function getPoissonPrediction(homeName, awayName) {
    var key = normTeam(homeName) + '__' + normTeam(awayName);
    if (poissonHourlyMap[key]) return poissonHourlyMap[key];
    return computePoissonLocal(homeName, awayName);
  }

  function poissonDetailHTML(g, pred) {
    if (!pred) return '';
    var p = pred.probabilities_1x2;
    var o = pred.fair_odds_1x2 || {};
    var xg = pred.expected_goals;
    var top = (pred.top_scorelines || []).slice(0, 5);
    var mat = (pred.score_matrix || []).slice(0, 5);
    var zh = state.lang === 'zh';

    var matRows = '';
    if (mat.length) {
      matRows += '<tr><th>' + (zh ? '主\\客' : 'H\\A') + '</th>' +
        mat[0].map(function (_, j) { return '<th>' + j + '</th>'; }).join('') + '</tr>';
      for (var i = 0; i < mat.length; i++) {
        matRows += '<tr><th>' + i + '</th>' + mat[i].slice(0, 5).map(function (v) {
          var a = Math.min(0.36, v * 3.0).toFixed(2);
          return '<td style="background:hsla(142,76%,36%,' + a + ')">' + (v * 100).toFixed(1) + '%</td>';
        }).join('') + '</tr>';
      }
    }

    return '' +
      '<div class="poisson-detail" style="display:none;margin-top:10px;padding-top:10px;border-top:1px solid hsl(var(--border));font-size:12px;">' +
        '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:8px;font-variant-numeric:tabular-nums;">' +
          '<div style="padding:6px 8px;border-radius:6px;background:hsl(var(--muted));">' +
            '<div style="font-size:11px;color:hsl(var(--muted-foreground));">' + (zh ? '主胜' : 'Home') + ' · xG ' + xg.home.toFixed(2) + '</div>' +
            '<div style="font-weight:700;">' + Math.round(p.home_win * 100) + '% <span style="font-weight:400;color:hsl(var(--muted-foreground));">@' + (o.home_win || '--') + '</span></div>' +
          '</div>' +
          '<div style="padding:6px 8px;border-radius:6px;background:hsl(var(--muted));">' +
            '<div style="font-size:11px;color:hsl(var(--muted-foreground));">' + (zh ? '平局' : 'Draw') + '</div>' +
            '<div style="font-weight:700;">' + Math.round(p.draw * 100) + '% <span style="font-weight:400;color:hsl(var(--muted-foreground));">@' + (o.draw || '--') + '</span></div>' +
          '</div>' +
          '<div style="padding:6px 8px;border-radius:6px;background:hsl(var(--muted));">' +
            '<div style="font-size:11px;color:hsl(var(--muted-foreground));">' + (zh ? '客胜' : 'Away') + ' · xG ' + xg.away.toFixed(2) + '</div>' +
            '<div style="font-weight:700;">' + Math.round(p.away_win * 100) + '% <span style="font-weight:400;color:hsl(var(--muted-foreground));">@' + (o.away_win || '--') + '</span></div>' +
          '</div>' +
        '</div>' +
        '<div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:8px;color:hsl(var(--muted-foreground));font-variant-numeric:tabular-nums;">' +
          '<span>' + (zh ? '大2.5球: ' : 'Over 2.5: ') + '<b>' + ((pred.over_under && pred.over_under.over_2_5 * 100) || 0).toFixed(1) + '%</b></span>' +
          '<span>' + (zh ? '双方进球: ' : 'BTTS: ') + '<b>' + ((pred.btts && pred.btts.yes * 100) || 0).toFixed(1) + '%</b></span>' +
          '<span>' + (zh ? '最可能比分: ' : 'Top: ') + top.slice(0, 3).map(function (s) {
            return '<b>' + esc(s.score) + '</b>(' + (s.probability * 100).toFixed(0) + '%)';
          }).join(' ') + '</span>' +
        '</div>' +
        (matRows ? '<table style="width:100%;border-collapse:collapse;text-align:center;font-size:11px;font-variant-numeric:tabular-nums;">' + matRows + '</table>' : '') +
      '</div>';
  }

  // 足球：主队 比分 客队；没开赛就显示「—」（ESPN 未开赛也会给 0，得靠状态区分）
  function footballCard(g) {
    var home = state.lang === 'zh' ? (g.home_zh || g.home) : g.home;
    var away = state.lang === 'zh' ? (g.away_zh || g.away) : g.away;
    var played = g.status === 'post' || (g.status === 'in' && g.home_score != null);
    var score = played
      ? esc(g.home_score) + '<span class="mc-dash">–</span>' + esc(g.away_score)
      : '—';

    // 只预测未来的赛事（pre）；已开赛或已完赛只展示云端锁定的预测结果
    var pred = g.status === 'pre'
      ? getPoissonPrediction(g.home, g.away)
      : (lockedPredictions[g.id] || null);
    var hPctHTML = '', aPctHTML = '', drawHTML = '';
    if (pred) {
      var p = pred.probabilities_1x2;
      var pH = Math.round(p.home_win * 100);
      var pD = Math.round(p.draw * 100);
      var pA = Math.round(p.away_win * 100);
      var hFav = p.home_win >= p.away_win && p.home_win >= p.draw;
      var aFav = p.away_win > p.home_win && p.away_win >= p.draw;
      var dFav = p.draw > p.home_win && p.draw > p.away_win;
      var hCls = 'mc-pct' + (hFav ? ' is-fav is-lean ' + (pH >= 50 ? 'lean-green' : 'lean-grey') : '');
      var aCls = 'mc-pct' + (aFav ? ' is-fav is-lean ' + (pA >= 50 ? 'lean-green' : 'lean-grey') : '');
      hPctHTML = '<span class="' + hCls + '">' + pH + '%</span>';
      aPctHTML = '<span class="' + aCls + '">' + pA + '%</span>';
      var drawLabel = state.lang === 'zh' ? '平 ' + pD + '%' : 'Draw ' + pD + '%';
      drawHTML = '<span class="mc-draw' + (dFav ? ' is-fav' : '') + '">' + drawLabel + '</span>';
    }

    var label = [leagueLabel(g.league), g.round ? T().round(g.round) : '',
      g.status === 'in' ? T().live : ''].filter(Boolean).join(' ');

    return '' +
      '<div class="upcoming-match-row mc-row" id="match-' + g.id + '" data-match-id="' + g.id + '"' +
        (pred ? ' data-football-pred="1" style="cursor:pointer;"' : '') + '>' +
        '<div class="mc-in">' +
          '<div class="upcoming-match-summary">' +
            '<div class="mc-meta">' +
              '<span class="mc-lead"><b class="mc-lg">' +
                '<span class="mc-lg-full">' + esc(label) + '</span>' +
                '<span class="mc-lg-code">' + esc(label) + '</span>' +
              '</b></span>' +
              '<span class="mc-end"><span class="mc-chev" aria-hidden="true"></span></span>' +
            '</div>' +
            '<div class="mc-main">' +
              '<div class="mc-side is-home has-logo">' +
                crestHTML(g.home_logo) +
                '<span class="mc-nm"><span class="mc-name">' + esc(home) + '</span></span>' +
                hPctHTML +
              '</div>' +
              '<div class="mc-c">' +
                '<span class="mc-score">' + score + '</span>' +
                drawHTML +
              '</div>' +
              '<div class="mc-side is-away has-logo">' +
                aPctHTML +
                '<span class="mc-nm"><span class="mc-name">' + esc(away) + '</span></span>' +
                crestHTML(g.away_logo) +
              '</div>' +
            '</div>' +
          '</div>' +
          poissonDetailHTML(g, pred) +
        '</div>' +
      '</div>';
  }

  // 一组（一轮 / 一个开球时刻）的抬头：2026年11月14日 星期六 08:00
  function groupHead(grp) {
    var d = dayLabel(grp.start_date);
    if (!grp.start_time) return d || grp.tournament || '';
    return d ? d + (state.lang === 'en' ? ' · ' : ' ') + grp.start_time : grp.start_time;
  }

  function feedHTML(groups) {
    if (!groups.length) {
      // 赛程为空就留白，不写「暂无赛程」；赛果为空才给一句提示
      if (state.scope === 'future') return '';
      return groupHTML(todayLabel(), emptyHTML(T().noResults));
    }
    // 同一天的多个赛事并到同一张卡片里，避免连着出现两条一样的抬头
    var buckets = [];
    groups.forEach(function (grp) {
      var label = groupHead(grp);
      var rows = grp.rows.map(function (g) {
        return grp.sport === 'football' ? footballCard(g) : cardHTML(g, grp.tournament);
      });
      var last = buckets[buckets.length - 1];
      if (last && last.label === label) last.rows = last.rows.concat(rows);
      else buckets.push({ label: label, rows: rows });
    });
    return buckets.map(function (b) {
      return groupHTML(b.label, b.rows.join(DIVIDER));
    }).join('');
  }

  // ── 渲染 ───────────────────────────────────────────────
  function tabHTML(list, active, attr, cls) {
    return list.map(function (p) {
      return '<a class="' + (cls || 'main-tab') + (p[0] === active ? ' active' : '') + '" href="#" ' +
        attr + '="' + p[0] + '">' + esc(p[1]) + '</a>';
    }).join('');
  }

  function renderHead() {
    document.title = T().docTitle;

    var si = document.getElementById('nav-search-input');
    if (si) {
      si.placeholder = T().search;
      si.setAttribute('aria-label', T().search);
    }
    var sb = document.getElementById('mobile-search-btn');
    if (sb) sb.setAttribute('aria-label', T().searchLabel);

    var pills = document.querySelectorAll('#view-pills .view-pill');
    if (pills[0]) pills[0].textContent = T().schedule;
    if (pills[1]) pills[1].textContent = T().results;

    // 一级导航：全部 / 五子棋 / 足球
    var tabs = document.getElementById('filter-tabs');
    if (tabs) {
      tabs.innerHTML = tabHTML([
        ['all', T().all],
        ['renju', T().renjuSport],
        ['football', T().footballSport]
      ], state.sport, 'data-tab');
    }

    // 足球：下面单独一排 全部 / 英超（#sub-tab-bar，二级导航）
    var sub = document.getElementById('sub-tabs');
    var subBar = document.getElementById('sub-tab-bar');
    var showSub = state.sport === 'football';
    if (sub) {
      sub.innerHTML = showSub
        ? tabHTML([['all', T().leagueAll], ['eng.1', T().eng1]], state.league, 'data-league', 'sub-tab')
        : '';
    }
    if (subBar) subBar.hidden = !showSub;
    document.body.classList.toggle('sub-nav-visible', showSub);
  }

  // 读库结果：{ renju: [组], football: [组] }，按运动与联赛筛完再排序
  var store = null;

  function groupsForRender() {
    if (!store) return [];
    var future = state.scope === 'future';
    var now = Date.now();
    var out = [];

    if (state.sport !== 'football') out = out.concat(store.renju);
    if (state.sport !== 'renju') {
      out = out.concat(store.football.filter(function (g) {
        return state.league === 'all' || g.league === state.league;
      }));
    }

    return out
      .filter(function (g) { return future ? g.ts >= now : g.ts < now; })
      // 赛果：新的在前；赛程：最近的一场在前
      .sort(function (a, b) { return future ? a.ts - b.ts : b.ts - a.ts; });
  }

  function renderList() {
    var list = document.getElementById('today-matches');
    if (!list) return;
    if (!store) { list.innerHTML = ''; return; }
    list.innerHTML = feedHTML(groupsForRender());
  }

  // ── 读库（CloudBase PG REST）─────────────────────────────
  function dbGet(path) {
    return fetch(DB + path, {
      headers: { apikey: DB_KEY, Authorization: 'Bearer ' + DB_KEY }
    }).then(function (r) {
      if (!r.ok) throw new Error('DB ' + r.status + ' ' + path);
      return r.json();
    });
  }

  // 按轮次分组：一组 = 一轮，抬头用这一轮的开赛时间
  function renjuGroups(res) {
    var tours = {};
    (res[0] || []).forEach(function (t) { tours[t.id] = t.name; });
    var names = {};
    (res[1] || []).forEach(function (p) { names[p.id] = p.name; });

    var groups = [];
    var byRound = {};
    (res[2] || []).forEach(function (m) {
      var grp = byRound[m.round_no];
      if (!grp) {
        var t = shanghai(m.match_time) || {};
        grp = byRound[m.round_no] = {
          sport: 'renju',
          round: m.round_no,
          tournament: tours[m.tournament_id] || '',
          start_date: t.date || '',
          start_time: t.time || '',
          ts: Date.parse(m.match_time) || 0,
          total: 0,
          rows: []
        };
        groups.push(grp);
      }
      grp.rows.push({
        id: m.id,
        board: m.board_no,
        round: m.round_no,
        result: m.result || null,
        black_forfeit: !!m.black_forfeit,
        white_forfeit: !!m.white_forfeit,
        black: names[m.black_id] || '',
        black_zh: names[m.black_id] || '',
        white: names[m.white_id] || '',
        white_zh: names[m.white_id] || ''
      });
      grp.total = grp.rows.length;
    });
    return groups;
  }

  // 按「同一天同一开球时刻」分组：一组 = 一个时段
  function footballGroups(res) {
    var teams = {};
    (res[0] || []).forEach(function (t) { teams[t.id] = t; });

    var groups = [];
    var bySlot = {};
    (res[1] || []).forEach(function (m) {
      var t = shanghai(m.match_time);
      if (!t) return;
      var key = t.date + ' ' + t.time + ' ' + m.league;
      var grp = bySlot[key];
      if (!grp) {
        grp = bySlot[key] = {
          sport: 'football',
          league: m.league,
          start_date: t.date,
          start_time: t.time,
          ts: Date.parse(m.match_time) || 0,
          rows: []
        };
        groups.push(grp);
      }
      var h = teams[m.home_team_id] || {};
      var a = teams[m.away_team_id] || {};
      grp.rows.push({
        id: m.id,
        status: m.status,
        league: m.league,
        round: m.round_no,
        home: h.name || '', home_zh: h.name_zh || '', home_logo: h.logo || '',
        away: a.name || '', away_zh: a.name_zh || '', away_logo: a.logo || '',
        home_score: m.home_score == null ? null : Number(m.home_score),
        away_score: m.away_score == null ? null : Number(m.away_score)
      });
    });
    // 同一时段内：已结束的在前，按 id 稳定排序
    groups.forEach(function (g) { g.rows.sort(function (x, y) { return x.id - y.id; }); });
    return groups;
  }

  function fetchPoissonData() {
    if (!POISSON_API) return Promise.resolve();
    var getJson = function (u) {
      return fetch(u).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
    };
    return Promise.all([
      getJson(POISSON_API + '/hourly'),
      getJson(POISSON_API + '/model-info'),
      getJson(POISSON_API + '/teams')
    ]).then(function (pRes) {
      var h = pRes[0], m = pRes[1], t = pRes[2];
      if (h && Array.isArray(h.matches)) {
        poissonHourly = h;
        poissonHourlyMap = {};
        h.matches.forEach(function (pm) {
          if (!pm.match) return;
          var key = normTeam(pm.match.home_team) + '__' + normTeam(pm.match.away_team);
          poissonHourlyMap[key] = pm;
        });
      }
      if (m) poissonModel = m;
      if (t && Array.isArray(t.teams)) {
        poissonTeams = {};
        t.teams.forEach(function (tm) {
          poissonTeams[normTeam(tm.team)] = { attack: tm.attack, defense: tm.defense };
        });
      }
    });
  }

  function loadFeed() {
    if (!DB) return Promise.resolve();
    return Promise.all([
      dbGet('/tournaments?select=id,name&limit=100'),
      dbGet('/players?select=id,name&limit=2000'),
      dbGet('/renju_matches?select=id,tournament_id,round_no,board_no,black_id,white_id,' +
        'result,black_forfeit,white_forfeit,match_time' +
        '&order=round_no.desc,board_no.asc&limit=5000'),
      dbGet('/football_teams?select=id,name,name_zh,logo&limit=200'),
      dbGet('/football_matches?select=id,league,round_no,match_time,status,' +
        'home_team_id,away_team_id,home_score,away_score&order=match_time.desc&limit=3000'),
      dbGet('/football_predictions?select=match_id,xg_home,xg_away,p_home,p_draw,p_away,' +
        'over_2_5,btts_yes,top_scorelines,score_matrix&limit=3000').catch(function () { return []; }),
      fetchPoissonData()
    ])
      .then(function (res) {
        lockedPredictions = {};
        (res[5] || []).forEach(function (r) {
          lockedPredictions[r.match_id] = {
            expected_goals: { home: Number(r.xg_home), away: Number(r.xg_away) },
            probabilities_1x2: { home_win: Number(r.p_home), draw: Number(r.p_draw), away_win: Number(r.p_away) },
            fair_odds_1x2: {
              home_win: Math.round(100 / Math.max(Number(r.p_home), 1e-4)) / 100,
              draw: Math.round(100 / Math.max(Number(r.p_draw), 1e-4)) / 100,
              away_win: Math.round(100 / Math.max(Number(r.p_away), 1e-4)) / 100
            },
            over_under: { over_2_5: Number(r.over_2_5 || 0), under_2_5: 1 - Number(r.over_2_5 || 0) },
            btts: { yes: Number(r.btts_yes || 0), no: 1 - Number(r.btts_yes || 0) },
            top_scorelines: r.top_scorelines || [],
            score_matrix: r.score_matrix || [],
            locked: true
          };
        });
        store = {
          renju: renjuGroups(res),
          football: footballGroups([res[3], res[4]])
        };
        renderList();
        var upd = document.getElementById('footer-updated');
        if (upd) {
          var ts = (poissonHourly && poissonHourly.hour_slot) ? poissonHourly.hour_slot : '';
          if (!ts) {
            var now = new Date(Date.now() + 8 * 3600 * 1000);
            ts = now.toISOString().slice(0, 16).replace('T', ' ');
          }
          upd.textContent = (state.lang === 'zh' ? ' · 上次更新：' : ' · Last updated: ') + ts;
        }
        html.classList.add('app-ready');
      })
      .catch(function (err) {
        console.error(err);
        html.classList.add('app-failed');
      });
  }

  function setScope(scope) {
    if (state.scope === scope) return;
    state.scope = scope;
    document.querySelectorAll('#view-pills .view-pill').forEach(function (el) {
      el.classList.toggle('active', el.getAttribute('data-view') === (scope === 'future' ? 'schedule' : 'results'));
    });
    renderList();
    if (!store) loadFeed();
    history.replaceState(null, '', scope === 'future' ? '?view=schedule' : '?view=results');
  }

  // ── 语言 / 主题 ────────────────────────────────────────
  var THEMES = [
    ['', '默认', 'Default'],
    ['light-white', '白色', 'White'],
    ['light-catppuccin-latte', 'Catppuccin Latte', 'Catppuccin Latte'],
    ['light-flexoki', 'Flexoki', 'Flexoki'],
    ['light-lupine', 'Lupine', 'Lupine'],
    ['light-rose-pine-dawn', 'Rosé Pine Dawn', 'Rosé Pine Dawn'],
    ['dark-catppuccin-mocha', 'Catppuccin Mocha', 'Catppuccin Mocha'],
    ['dark-gruvbox', 'Gruvbox', 'Gruvbox'],
    ['dark-kanagawa', 'Kanagawa', 'Kanagawa'],
    ['dark-matte-black', 'Matte Black', 'Matte Black'],
    ['dark-tokyo-night', 'Tokyo Night', 'Tokyo Night']
  ];

  var DIALOG_STR = {
    zh: { language: '语言', theme: '主题', country: '常用国家', timezone: '时区', save: '保存', selCountry: '选择国家…', selTime: '选择时区…' },
    en: { language: 'Language', theme: 'Theme', country: 'Home Country', timezone: 'Timezone', save: 'Save', selCountry: 'Select country…', selTime: 'Select timezone…' }
  };

  function renderThemeOptions() {
    var themeSelect = document.getElementById('theme-select');
    if (!themeSelect) return;
    var idx = state.lang === 'en' ? 2 : 1;
    themeSelect.innerHTML = THEMES.map(function (t) {
      return '<option value="' + t[0] + '">' + esc(t[idx]) + '</option>';
    }).join('');
    themeSelect.value = localStorage.getItem('renju.theme') || '';
  }

  function renderDialogLabels() {
    var d = DIALOG_STR[state.lang];
    var set = function (sel, text) { var e = document.querySelector(sel); if (e) e.textContent = text; };
    var ph = function (sel, text) { var e = document.querySelector(sel); if (e) e.placeholder = text; };
    set('label[for="language-select"]', d.language);
    set('label[for="theme-select"]', d.theme);
    set('label[for="country-input"]', d.country);
    set('label[for="timezone-input"]', d.timezone);
    set('#ui-save-button', d.save);
    ph('#country-input', d.selCountry);
    ph('#timezone-input', d.selTime);
    renderThemeOptions();
  }

  function applyLang(next) {
    state.lang = next;
    localStorage.setItem('renju.lang', next);
    html.lang = next === 'en' ? 'en' : 'zh-CN';
    renderHead();
    renderDialogLabels();
    renderList();
  }

  function applyTheme(id) {
    localStorage.setItem('renju.theme', id || '');
    if (id) html.setAttribute('data-theme', id);
    else html.removeAttribute('data-theme');
  }

  var dialog = document.getElementById('ui-options-dialog');
  var langSelect = document.getElementById('language-select');
  var themeSelect = document.getElementById('theme-select');

  if (langSelect) {
    langSelect.innerHTML = '<option value="zh">简体中文</option><option value="en">English</option>';
    langSelect.value = state.lang;
    langSelect.addEventListener('change', function () { applyLang(langSelect.value); });
  }

  if (themeSelect) {
    themeSelect.addEventListener('change', function () { applyTheme(themeSelect.value); });
  }

  var langBtn = document.getElementById('language-button');
  if (langBtn) {
    langBtn.addEventListener('click', function () {
      if (!dialog) return;
      if (langSelect) langSelect.value = state.lang;
      if (themeSelect) themeSelect.value = localStorage.getItem('renju.theme') || '';
      dialog.showModal();
      var c = dialog.querySelector('.welcome-dialog-content');
      if (c) c.focus();
    });
  }

  var saveBtn = document.getElementById('ui-save-button');
  if (saveBtn) saveBtn.addEventListener('click', function () { if (dialog) dialog.close(); });

  if (dialog) dialog.addEventListener('click', function (e) { if (e.target === dialog) dialog.close(); });

  // ── 搜索框 ─────────────────────────────────────────────
  // 只做「点图标弹出/收起输入框」，没有任何搜索逻辑：
  // 输入、回车、清空都不发请求，也不筛选列表。
  var nav = document.querySelector('nav.top-nav');
  var searchBtn = document.getElementById('mobile-search-btn');
  var searchInput = document.getElementById('nav-search-input');
  var searchOpen = false;

  function openSearch() {
    if (!nav) return;
    nav.classList.add('mobile-search-active');
    if (searchInput) {
      searchInput.setAttribute('aria-expanded', 'true');
      searchInput.focus();
    }
    searchOpen = true;
  }

  function closeSearch(clear) {
    if (!nav) return;
    nav.classList.remove('mobile-search-active');
    if (searchInput) {
      searchInput.setAttribute('aria-expanded', 'false');
      if (clear) searchInput.value = '';
      searchInput.blur();
    }
    searchOpen = false;
  }

  if (searchBtn) {
    searchBtn.addEventListener('click', function (e) {
      e.preventDefault();
      if (searchOpen) closeSearch(true); else openSearch();
    });
  }

  if (searchInput) {
    searchInput.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); closeSearch(true); }
      if (e.key === 'Enter') { e.preventDefault(); }   // 不提交、不搜索
    });
  }

  // 点页面其它地方收起（输入框里有内容时也一并清掉）
  document.addEventListener('click', function (e) {
    if (!searchOpen) return;
    if (e.target.closest('#search-bar-container') || e.target.closest('#mobile-search-btn')) return;
    closeSearch(true);
  });

  // "/" 快捷键只管打开搜索框
  document.addEventListener('keydown', function (e) {
    if (e.key !== '/' || searchOpen) return;
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    e.preventDefault();
    openSearch();
  });

  // 赛程 / 赛果
  document.querySelectorAll('#view-pills .view-pill').forEach(function (el) {
    el.addEventListener('click', function (e) {
      e.preventDefault();
      setScope(el.getAttribute('data-view') === 'schedule' ? 'future' : 'past');
    });
  });

  // 一级导航（全部 / 五子棋 / 足球）与足球下的联赛（全部 / 英超）
  document.addEventListener('click', function (e) {
    var tab = e.target.closest('#filter-tabs [data-tab]');
    if (tab) {
      e.preventDefault();
      var next = tab.getAttribute('data-tab');
      if (next === state.sport) return;
      state.sport = next;
      state.league = 'all';
      renderHead();
      renderList();
      return;
    }
    var lg = e.target.closest('#sub-tabs [data-league]');
    if (lg) {
      e.preventDefault();
      var league = lg.getAttribute('data-league');
      if (league === state.league) return;
      state.league = league;
      renderHead();
      renderList();
    }
  });

  // 足球卡片点击展开/收起泊松预测详情
  document.addEventListener('click', function (e) {
    var card = e.target.closest('.upcoming-match-row[data-football-pred="1"]');
    if (!card) return;
    var detail = card.querySelector('.poisson-detail');
    if (!detail) return;
    var open = detail.style.display !== 'none';
    detail.style.display = open ? 'none' : 'block';
  });

  // 折叠块开关
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.mpg-acc-h');
    if (!btn) return;
    var acc = btn.closest('.mpg-acc');
    if (!acc) return;
    var open = acc.classList.toggle('is-open');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  // ── 启动 ───────────────────────────────────────────────
  html.lang = state.lang === 'en' ? 'en' : 'zh-CN';
  var savedTheme = localStorage.getItem('renju.theme');
  if (savedTheme) html.setAttribute('data-theme', savedTheme);

  renderHead();
  renderDialogLabels();

  // 顶部标签栏：全部 / 五子棋 / 足球
  var bar = document.getElementById('main-tab-bar-container');
  if (bar) bar.style.display = 'block';
  document.body.classList.add('filter-bar-visible');

  var wantFuture = new URLSearchParams(location.search).get('view') === 'schedule';
  if (wantFuture) {
    state.scope = 'future';
    document.querySelectorAll('#view-pills .view-pill').forEach(function (el) {
      el.classList.toggle('active', el.getAttribute('data-view') === 'schedule');
    });
  }

  loadFeed();
})();
