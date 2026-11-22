(function () {
  var DB = String(window.RENJU_DB || '').replace(/\/+$/, '');
  var DB_KEY = String(window.RENJU_KEY || '');

  var STR = {
    zh: {
      all: '全部',
      renjuSport: '五子棋',
      footballSport: '足球',
      eng1: '英超',
      schedule: '赛程',
      results: '赛果',
      search: '搜索赛事、球队…',
      round: function (n) { return '第' + n + '轮'; },
      board: function (n) { return '第' + n + '台'; },
      live: '进行中',
      forfeit: '弃权',
      noResults: '暂无赛果',
      more: '加载更多',
      back: '返回列表',
      topScore: '最可能比分',
      outcomeTitle: '胜平负概率',
      homeWin: '主胜',
      draw: '平局',
      awayWin: '客胜',
      matrixTitle: '比分矩阵 (0–9)',
      lastUpdated: '上次更新：',
      loadFail: '数据加载失败，请刷新重试。',
      locale: 'zh-CN'
    },
    en: {
      all: 'All',
      renjuSport: 'Renju',
      footballSport: 'Football',
      eng1: 'Premier League',
      schedule: 'Schedule',
      results: 'Results',
      search: 'Search matches, teams…',
      round: function (n) { return 'Round ' + n; },
      board: function (n) { return 'Board ' + n; },
      live: 'Live',
      forfeit: 'Forfeit',
      noResults: 'No results',
      more: 'Load more',
      back: 'Back',
      topScore: 'Likeliest Score',
      outcomeTitle: 'Match Outcome',
      homeWin: 'Home',
      draw: 'Draw',
      awayWin: 'Away',
      matrixTitle: 'Score Matrix (0–9)',
      lastUpdated: 'Last updated: ',
      loadFail: 'Failed to load data.',
      locale: 'en-US'
    }
  };

  function dbGet(path) {
    return fetch(DB + path, {
      headers: { apikey: DB_KEY, Authorization: 'Bearer ' + DB_KEY }
    }).then(function (r) {
      if (!r.ok) throw new Error('DB ' + r.status);
      return r.json();
    });
  }

  function toBeijingSlot(iso) {
    var ms = Date.parse(iso || '');
    if (!Number.isFinite(ms)) return null;
    var bj = new Date(ms + 8 * 3600 * 1000);
    return {
      date: bj.toISOString().slice(0, 10),
      time: bj.toISOString().slice(11, 16),
      ts: ms
    };
  }

  function formatDay(ymd, lang) {
    if (!ymd) return '';
    var p = ymd.split('-');
    var dt = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    return new Intl.DateTimeFormat(STR[lang].locale, {
      year: 'numeric', month: 'long', day: 'numeric', weekday: 'long', timeZone: 'UTC'
    }).format(dt);
  }

  function buildRenjuGroups(tours, players, matches) {
    var tourMap = {}, playerMap = {};
    (tours || []).forEach(function (t) { tourMap[t.id] = t.name; });
    (players || []).forEach(function (p) { playerMap[p.id] = p.name; });

    var groups = [], byKey = {};
    (matches || []).forEach(function (m) {
      var slot = toBeijingSlot(m.match_time);
      var key = m.tournament_id + '#' + m.round_no + '#' + (slot ? slot.date : '');
      if (!byKey[key]) {
        byKey[key] = {
          sport: 'renju',
          tournament: tourMap[m.tournament_id] || '',
          start_date: slot ? slot.date : '',
          start_time: slot ? slot.time : '',
          ts: slot ? slot.ts : 0,
          rows: []
        };
        groups.push(byKey[key]);
      }
      byKey[key].rows.push({
        id: m.id,
        round: m.round_no,
        board: m.board_no,
        black: playerMap[m.black_id] || '',
        white: playerMap[m.white_id] || '',
        result: m.result,
        bf: !!m.black_forfeit,
        wf: !!m.white_forfeit
      });
    });
    groups.forEach(function (g) { g.rows.sort(function (a, b) { return a.board - b.board; }); });
    return groups;
  }

  function buildFootballGroups(teams, matches, byId) {
    var teamMap = {};
    (teams || []).forEach(function (t) { teamMap[t.id] = t; });

    var groups = [], bySlot = {};
    (matches || []).forEach(function (m) {
      var slot = toBeijingSlot(m.match_time);
      if (!slot) return;
      var key = slot.date + ' ' + slot.time + ' ' + m.league;
      if (!bySlot[key]) {
        bySlot[key] = {
          sport: 'football',
          league: m.league,
          start_date: slot.date,
          start_time: slot.time,
          ts: slot.ts,
          rows: []
        };
        groups.push(bySlot[key]);
      }
      var h = teamMap[m.home_team_id] || {};
      var a = teamMap[m.away_team_id] || {};
      var row = {
        id: m.id,
        status: m.status,
        league: m.league,
        round: m.round_no,
        home: h.name || '', home_zh: h.name_zh || '', home_logo: h.logo || '',
        away: a.name || '', away_zh: a.name_zh || '', away_logo: a.logo || '',
        home_score: m.home_score == null ? null : Number(m.home_score),
        away_score: m.away_score == null ? null : Number(m.away_score)
      };
      byId[m.id] = row;
      bySlot[key].rows.push(row);
    });
    groups.forEach(function (g) { g.rows.sort(function (a, b) { return a.id - b.id; }); });
    return groups;
  }

  var app = Vue.createApp({
    data: function () {
      var initFuture = new URLSearchParams(location.search).get('view') === 'schedule';
      return {
        lang: localStorage.getItem('renju.lang') === 'en' ? 'en' : 'zh',
        sport: 'all',
        scope: initFuture ? 'future' : 'past',
        search: '',
        limit: 8,
        loading: true,
        loadError: false,
        store: { renju: [], football: [] },
        lockedPredictions: {},
        footballById: {},
        updatedAt: '',
        activeMatchId: null
      };
    },
    computed: {
      T: function () { return STR[this.lang]; },
      visibleGroups: function () {
        var self = this;
        var out = [];
        if (self.sport !== 'football') out = out.concat(self.store.renju);
        if (self.sport !== 'renju') out = out.concat(self.store.football);

        var isFuture = self.scope === 'future';
        out = out.filter(function (g) {
          if (g.sport === 'football') {
            var hasMatch = g.rows.some(function (r) {
              return isFuture ? r.status !== 'post' : r.status === 'post';
            });
            return hasMatch;
          }
          var hasFuture = g.rows.some(function (r) { return !r.result; });
          return isFuture ? hasFuture : !hasFuture;
        });

        out.sort(function (a, b) { return isFuture ? (a.ts - b.ts) : (b.ts - a.ts); });

        var q = String(self.search || '').trim().toLowerCase();
        var buckets = [], byLabel = {};
        out.slice(0, self.limit).forEach(function (g) {
          var label = [formatDay(g.start_date, self.lang), g.start_time].filter(Boolean).join(' ');
          var items = [];
          g.rows.forEach(function (r) {
            if (g.sport === 'football') {
              if (isFuture ? r.status === 'post' : r.status !== 'post') return;
              var hn = self.lang === 'zh' ? (r.home_zh || r.home) : r.home;
              var an = self.lang === 'zh' ? (r.away_zh || r.away) : r.away;
              if (q && (hn + ' ' + an + ' ' + r.home + ' ' + r.away).toLowerCase().indexOf(q) === -1) return;
              var pred = self.lockedPredictions[r.id] || null;
              var p = pred ? pred.probabilities_1x2 : null;
              var hFav = p ? (p.home_win >= p.away_win && p.home_win >= p.draw) : false;
              var aFav = p ? (p.away_win > p.home_win && p.away_win >= p.draw) : false;
              var dFav = p ? (p.draw > p.home_win && p.draw > p.away_win) : false;
              var played = r.status === 'post' || (r.status === 'in' && r.home_score != null);
              items.push({
                key: 'fb-' + r.id,
                sport: 'football',
                row: r,
                pred: pred,
                hFav: hFav,
                aFav: aFav,
                dFav: dFav,
                homeName: hn,
                awayName: an,
                scoreText: played ? (r.home_score + ' – ' + r.away_score) : '—',
                metaLabel: [self.T.eng1, r.round ? self.T.round(r.round) : '', r.status === 'in' ? self.T.live : ''].filter(Boolean).join(' ')
              });
            } else {
              if (q && (g.tournament + ' ' + r.black + ' ' + r.white).toLowerCase().indexOf(q) === -1) return;
              var scoreTxt = '—';
              if (r.bf || r.wf) {
                scoreTxt = (r.bf ? '–' : '+') + ' : ' + (r.wf ? '–' : '+');
              } else if (r.result === 'B') scoreTxt = '1 : 0';
              else if (r.result === 'W') scoreTxt = '0 : 1';
              else if (r.result === 'D') scoreTxt = '½ : ½';
              items.push({
                key: 'rj-' + r.id,
                sport: 'renju',
                row: r,
                scoreText: scoreTxt,
                metaLabel: [g.tournament, r.round ? self.T.round(r.round) : '', r.board ? self.T.board(r.board) : ''].filter(Boolean).join(' ')
              });
            }
          });
          if (!items.length) return;
          if (!byLabel[label]) {
            byLabel[label] = { label: label || g.tournament || '', items: [] };
            buckets.push(byLabel[label]);
          }
          byLabel[label].items = byLabel[label].items.concat(items);
        });
        return buckets;
      },
      hasMore: function () {
        var total = 0;
        if (this.sport !== 'football') total += this.store.renju.length;
        if (this.sport !== 'renju') total += this.store.football.length;
        return this.limit < total;
      },
      activeDetail: function () {
        if (!this.activeMatchId) return null;
        var g = this.footballById[this.activeMatchId];
        var pred = this.lockedPredictions[this.activeMatchId];
        if (!g || !pred) return null;
        var played = g.status === 'post' || (g.status === 'in' && g.home_score != null);
        var cols = (pred.score_matrix && pred.score_matrix[0]) ? pred.score_matrix[0].length : 0;
        var matrixCols = [];
        for (var i = 0; i < cols; i++) matrixCols.push(i);
        return {
          match: g,
          pred: pred,
          homeName: this.lang === 'zh' ? (g.home_zh || g.home) : g.home,
          awayName: this.lang === 'zh' ? (g.away_zh || g.away) : g.away,
          scoreText: played ? (g.home_score + ' – ' + g.away_score) : '—',
          metaLabel: [this.T.eng1, g.round ? this.T.round(g.round) : ''].filter(Boolean).join(' '),
          top1: (pred.top_scorelines || [])[0] || null,
          matrixCols: matrixCols
        };
      }
    },
    methods: {
      toggleLang: function () {
        this.lang = this.lang === 'zh' ? 'en' : 'zh';
        localStorage.setItem('renju.lang', this.lang);
      },
      toggleDark: function () {
        this.$q.dark.toggle();
        localStorage.setItem('renju.dark', this.$q.dark.isActive ? '1' : '0');
      },
      openDetail: function (matchId, push) {
        this.activeMatchId = matchId;
        window.scrollTo(0, 0);
        if (push) {
          var u = new URL(location.href);
          u.searchParams.set('match', String(matchId));
          history.pushState({ matchId: matchId }, '', u.toString());
        }
      },
      closeDetail: function (push) {
        this.activeMatchId = null;
        if (push) {
          var u = new URL(location.href);
          u.searchParams.delete('match');
          history.pushState({}, '', u.toString());
        }
      }
    },
    mounted: function () {
      var self = this;
      if (localStorage.getItem('renju.dark') === '1') {
        self.$q.dark.set(true);
      }
      window.addEventListener('popstate', function () {
        var mid = new URLSearchParams(location.search).get('match');
        self.activeMatchId = mid ? Number(mid) : null;
      });

      if (!DB) { self.loading = false; return; }
      Promise.all([
        dbGet('/tournaments?select=id,name&limit=100'),
        dbGet('/players?select=id,name&limit=2000'),
        dbGet('/renju_matches?select=id,tournament_id,round_no,board_no,black_id,white_id,result,black_forfeit,white_forfeit,match_time&order=round_no.desc,board_no.asc&limit=5000'),
        dbGet('/football_teams?select=id,name,name_zh,logo&limit=200'),
        dbGet('/football_matches?select=id,league,round_no,match_time,status,home_team_id,away_team_id,home_score,away_score&order=match_time.desc&limit=3000'),
        dbGet('/football_predictions?select=match_id,xg_home,xg_away,p_home,p_draw,p_away,top_scorelines,score_matrix,locked_at&limit=3000').catch(function () { return []; })
      ]).then(function (res) {
        var locked = {};
        var maxMs = 0;
        (res[5] || []).forEach(function (r) {
          if (r.locked_at) {
            var ms = Date.parse(r.locked_at);
            if (ms > maxMs) maxMs = ms;
          }
          locked[r.match_id] = {
            expected_goals: { home: Number(r.xg_home), away: Number(r.xg_away) },
            probabilities_1x2: { home_win: Number(r.p_home), draw: Number(r.p_draw), away_win: Number(r.p_away) },
            top_scorelines: r.top_scorelines || [],
            score_matrix: r.score_matrix || []
          };
        });
        self.lockedPredictions = locked;
        var tsMs = maxMs || Date.now();
        self.updatedAt = new Date(tsMs + 8 * 3600 * 1000).toISOString().slice(0, 16).replace('T', ' ');

        var byId = {};
        self.store = {
          renju: buildRenjuGroups(res[0], res[1], res[2]),
          football: buildFootballGroups(res[3], res[4], byId)
        };
        self.footballById = byId;

        var initMid = new URLSearchParams(location.search).get('match');
        if (initMid && byId[initMid] && locked[initMid]) {
          self.activeMatchId = Number(initMid);
        }
        self.loading = false;
      }).catch(function (err) {
        console.error(err);
        self.loadError = true;
        self.loading = false;
      });
    }
  });

  app.use(Quasar);
  app.mount('#q-app');
})();
