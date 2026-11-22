// 连珠对局库 · 首页渲染
// DOM 结构与 sport.dev 的 createMatchCard / 首页列表保持一致
(function () {
  var html = document.documentElement;

  // 接口前缀：本地为空（同源 express）；Pages 版由构建脚本注入云函数地址
  var API = String(window.RENJU_API || '').replace(/\/+$/, '');
  // 数据库直连：CloudBase PG 的 REST 基址 + Publishable Key（页面直接读库，不走静态文件）
  var DB = String(window.RENJU_DB || '').replace(/\/+$/, '');
  var DB_KEY = String(window.RENJU_KEY || '');
  // 静态数据目录（留作后备：DB 没配时读构建时导出的 JSON）
  var DATA = String(window.RENJU_DATA || '').replace(/\/+$/, '');
  // 棋谱详情页前缀：没配置就不把卡片做成链接（避免线上点到 404）
  var GAME_BASE = String(window.RENJU_GAME_BASE || '').replace(/\/+$/, '');

  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };

  var STR = {
    zh: {
      title: '连珠对局库', sr: '连珠对局库', all: '全部',
      schedule: '赛程', results: '赛果',
      round: function (n) { return '第' + n + '轮'; },
      board: function (n) { return '第' + n + '台'; },
      noSchedule: '暂无赛程',
      noResults: '暂无赛果',
      locale: 'zh-CN',
      docTitle: '连珠对局库',
      search: '搜索棋手、赛事、开局…',
      searchLabel: '搜索',
      more: '加载更早的赛事'
    },
    en: {
      title: 'Renju Games', sr: 'Renju games', all: 'All',
      schedule: 'Schedule', results: 'Results',
      round: function (n) { return 'Round ' + n; },
      board: function (n) { return 'Board ' + n; },
      noSchedule: 'No scheduled games',
      noResults: 'No results',
      locale: 'en-US',
      docTitle: 'Renju Games',
      search: 'Search players, tournaments, openings…',
      searchLabel: 'Search',
      more: 'Load earlier tournaments'
    }
  };

  var state = {
    lang: localStorage.getItem('renju.lang') === 'en' ? 'en' : 'zh',
    scope: 'past'
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
  function scoreHTML(v) {
    if (v === 1) return '1<span class="mc-dash">–</span>0';
    if (v === 0) return '0<span class="mc-dash">–</span>1';
    if (v === 0.5) return '½<span class="mc-dash">–</span>½';
    return '—';
  }

  var DIVIDER = '<div class="upcoming-match-divider"></div>';

  // 棋手名跟随当前语言：中文用本名（汉字/假名），英文用拉丁转写
  function playerName(g, side) {
    var zh = g[side + '_zh'];
    if (state.lang === 'zh' && zh) return zh;
    return g[side] || '';
  }

  function cardHTML(g, tour) {
    var rd = g.round ? T().round(g.round) : '';
    // 按轮次分组时，卡片的抬头只写台次；没有台次才退回「赛事 + 轮次」
    var label = g.board != null ? T().board(g.board) : [tour, rd].filter(Boolean).join(' ');
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
              '<div class="mc-c">' +
                '<span class="mc-score">' + scoreHTML(Number(g.black_result)) + '</span>' +
              '</div>' +
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

  // 一组（一轮）的抬头：轮次 · 2026年11月16日 星期一 08:30
  function groupHead(grp) {
    var parts = [];
    if (grp.round != null) parts.push(T().round(grp.round));
    var d = dayLabel(grp.start_date);
    if (d) parts.push(d);
    if (grp.start_time) parts.push(grp.start_time);
    return parts.filter(Boolean).join(' · ') || grp.tournament || '';
  }

  function feedHTML(groups) {
    if (!groups.length) {
      // 赛程为空就留白，不写「暂无赛程」；赛果为空才给一句提示
      if (state.scope === 'future') return '';
      return groupHTML(todayLabel(), emptyHTML(T().noResults));
    }
    // 同一天同一时间的多个赛事并到同一张卡片里，避免连着出现两条一样的抬头
    var buckets = [];
    groups.forEach(function (grp) {
      var label = groupHead(grp);
      var rows = grp.rows.map(function (g) { return cardHTML(g, grp.tournament); });
      var last = buckets[buckets.length - 1];
      if (last && last.label === label) last.rows = last.rows.concat(rows);
      else buckets.push({ label: label, rows: rows });
    });
    return buckets.map(function (b) {
      return groupHTML(b.label, b.rows.join(DIVIDER));
    }).join('');
  }

  // ── 渲染 ───────────────────────────────────────────────
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

    var tabs = document.getElementById('filter-tabs');
    if (tabs) tabs.innerHTML = '<a class="main-tab active" href="#" data-tab="all">' + esc(T().all) + '</a>';

    var extra = document.getElementById('results-tabs');
    if (extra) extra.innerHTML = '';
  }

  var TOURS_PER_PAGE = 7;
  var feedCache = {};        // scope -> { groups, hasMore }

  function moreHTML() {
    return '<div class="upcoming-show-more-wrap">' +
      '<button type="button" class="btn-outline upcoming-show-more-btn" data-more="1">' +
      esc(T().more) + '</button></div>';
  }

  function renderList() {
    var list = document.getElementById('today-matches');
    if (!list) return;
    var c = feedCache[state.scope];
    if (!c) { list.innerHTML = ''; return; }
    var out = feedHTML(c.groups);
    if (c.hasMore) out += moreHTML();
    list.innerHTML = out;
  }

  // ── 读库（CloudBase PG REST）─────────────────────────────
  var RESULT_SCORE = { B: 1, W: 0, D: 0.5, '+': 1, '-': 0 };

  function dbGet(path) {
    return fetch(DB + path, {
      headers: { apikey: DB_KEY, Authorization: 'Bearer ' + DB_KEY }
    }).then(function (r) {
      if (!r.ok) throw new Error('DB ' + r.status + ' ' + path);
      return r.json();
    });
  }

  // 棋手一次取全（46 人），对局按「轮次倒序、台次正序」取回后在本地分组
  function feedFromDb(scope) {
    if (scope === 'future') return Promise.resolve({ groups: [], hasMore: false });
    return Promise.all([
      dbGet('/players?select=id,name&limit=1000'),
      dbGet('/renju_matches?select=id,round_no,board_no,black_id,white_id,result,match_time' +
        '&order=round_no.desc,board_no.asc&limit=2000')
    ]).then(function (res) {
      var names = {};
      (res[0] || []).forEach(function (p) { names[p.id] = p.name; });

      var groups = [];
      var byRound = {};
      (res[1] || []).forEach(function (m) {
        var grp = byRound[m.round_no];
        if (!grp) {
          var t = shanghai(m.match_time) || {};
          grp = byRound[m.round_no] = {
            round: m.round_no,
            start_date: t.date || '',
            start_time: t.time || '',
            total: 0,
            rows: []
          };
          groups.push(grp);
        }
        var score = RESULT_SCORE[m.result];
        grp.rows.push({
          id: m.id,
          board: m.board_no,
          round: m.round_no,
          black_result: score === undefined ? null : score,
          black: names[m.black_id] || '',
          black_zh: names[m.black_id] || '',
          white: names[m.white_id] || '',
          white_zh: names[m.white_id] || ''
        });
        grp.total = grp.rows.length;
      });

      return { groups: groups, hasMore: false };
    });
  }

  // append=true：接着上一批赛事往下取（每页 TOURS_PER_PAGE 个赛事，赛事内全量）
  function loadFeed(append) {
    var scope = state.scope;

    // 有 DB 就直接读库：一次全量，不分页
    if (DB) {
      if (append) return Promise.resolve();
      return feedFromDb(scope)
        .then(function (d) {
          feedCache[scope] = d;
          if (state.scope === scope) renderList();
          html.classList.add('app-ready');
        })
        .catch(function (err) {
          console.error(err);
          html.classList.add('app-failed');
        });
    }

    var loaded = (append && feedCache[scope]) ? feedCache[scope].groups.length : 0;
    var url = DATA
      ? DATA + '/' + (scope === 'future' ? 'future' : 'past') + '/' + loaded + '.json'
      : API + '/api/feed?tours=' + TOURS_PER_PAGE + '&offset=' + loaded +
        '&scope=' + (scope === 'future' ? 'future' : 'past');

    return fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var prev = (append && feedCache[scope]) ? feedCache[scope].groups : [];
        feedCache[scope] = { groups: prev.concat(d.groups || []), hasMore: !!d.hasMore };
        if (state.scope === scope) renderList();
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
    if (!feedCache[scope]) loadFeed(false);
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

  // 折叠块开关
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.mpg-acc-h');
    if (!btn) return;
    var acc = btn.closest('.mpg-acc');
    if (!acc) return;
    var open = acc.classList.toggle('is-open');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  // 「加载更早的赛事」：往下再接一页赛事
  document.addEventListener('click', function (e) {
    var more = e.target.closest('[data-more]');
    if (!more) return;
    e.preventDefault();
    more.disabled = true;
    loadFeed(true);
  });

  // ── 启动 ───────────────────────────────────────────────
  html.lang = state.lang === 'en' ? 'en' : 'zh-CN';
  var savedTheme = localStorage.getItem('renju.theme');
  if (savedTheme) html.setAttribute('data-theme', savedTheme);

  renderHead();
  renderDialogLabels();

  // 顶部标签栏：只有一个「全部」
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

  loadFeed(false);
})();
