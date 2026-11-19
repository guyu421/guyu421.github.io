/**
 * 同步 2026-27 赛季欧洲五大联赛（英超、西甲、意甲、德甲、法甲）赛程、实时比分与队标到 Supabase 数据库。
 *
 * 用法：
 *   1. 写入数据库（需设置环境变量 SUPABASE_SERVICE_ROLE_KEY）：
 *      SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/sync-top5-leagues.mjs
 *   2. 导出 SQL 文件（可在 Supabase Dashboard -> SQL Editor 中直接执行）：
 *      node scripts/sync-top5-leagues.mjs --sql supabase/top5-leagues.sql
 */

import fs from 'node:fs';
import path from 'node:path';

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  'https://cqhktfwogmffcorwfrxm.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const LEAGUES = [
  {
    id: 4,
    code: 'eng.1',
    name: '2026-27赛季英格兰足球超级联赛',
    totalRounds: 38,
    qualifyCount: 4,
    qualifyLabel: '欧冠',
    tiebreakers: ['gd', 'gf', 'h2h_points'],
    rulesText:
      '积分排名规则\n1.每队胜一场得3分，平一场得1分，负一场得0分\n2.联赛结束，积分多的队名次靠前\n3.如果两队或两队以上积分相等，依下列顺序排列名次\na)总净胜球\nb)总进球数\nc)相互战绩（依次比较相互对战积分、相互对战客场进球数）\nd)附加赛（仅在涉及冠军归属、降级或欧战资格时进行）',
    standingsZones: [
      {
        fromRank: 1,
        toRank: 4,
        bgColor: '#ffe4e6',
        cutoffBefore: true,
        cutoffLabel: '欧冠',
        cutoffColor: '#f43f5e',
        cutoffLineColor: '#fda4af',
      },
      {
        fromRank: 5,
        toRank: 5,
        bgColor: '#fff1f2',
        cutoffBefore: true,
        cutoffLabel: '欧联',
        cutoffColor: '#f43f5e',
        cutoffLineColor: '#fda4af',
      },
      {
        fromRank: 18,
        toRank: 20,
        bgColor: '#f1f5f9',
        cutoffBefore: true,
        cutoffLabel: '降级',
        cutoffColor: '#64748b',
        cutoffLineColor: '#cbd5e1',
      },
    ],
  },
  {
    id: 5,
    code: 'esp.1',
    name: '2026-27赛季西班牙足球甲级联赛',
    totalRounds: 38,
    qualifyCount: 4,
    qualifyLabel: '欧冠',
    tiebreakers: ['h2h_points', 'h2h_gd', 'gd', 'gf'],
    rulesText:
      '积分排名规则\n1.每队胜一场得3分，平一场得1分，负一场得0分\n2.联赛结束，积分多的队名次靠前\n3.如果两队或两队以上积分相等，依下列顺序排列名次\na)相互战绩（依次比较相互对战积分、相互对战净胜球）\nb)总净胜球\nc)总进球数\nd)公平竞赛积分（每张黄牌减1分、每张红牌减3分，两黄变红按照减2分计算）',
    standingsZones: [
      {
        fromRank: 1,
        toRank: 4,
        bgColor: '#ffe4e6',
        cutoffBefore: true,
        cutoffLabel: '欧冠',
        cutoffColor: '#f43f5e',
        cutoffLineColor: '#fda4af',
      },
      {
        fromRank: 5,
        toRank: 5,
        bgColor: '#fff1f2',
        cutoffBefore: true,
        cutoffLabel: '欧联',
        cutoffColor: '#f43f5e',
        cutoffLineColor: '#fda4af',
      },
      {
        fromRank: 6,
        toRank: 6,
        bgColor: '#fff7ed',
        cutoffBefore: true,
        cutoffLabel: '欧协联附加赛',
        cutoffColor: '#ea580c',
        cutoffLineColor: '#fdba74',
      },
      {
        fromRank: 18,
        toRank: 20,
        bgColor: '#f1f5f9',
        cutoffBefore: true,
        cutoffLabel: '降级',
        cutoffColor: '#64748b',
        cutoffLineColor: '#cbd5e1',
      },
    ],
  },
  {
    id: 6,
    code: 'ita.1',
    name: '2026-27赛季意大利足球甲级联赛',
    totalRounds: 38,
    qualifyCount: 4,
    qualifyLabel: '欧冠',
    tiebreakers: ['h2h_points', 'h2h_gd', 'gd', 'gf'],
    rulesText:
      '积分排名规则\n1.每队胜一场得3分，平一场得1分，负一场得0分\n2.联赛结束，积分多的队名次靠前\n3.如果两队或两队以上积分相等，依下列顺序排列名次\na)相互战绩（依次比较相互对战积分、相互对战净胜球）\nb)总净胜球\nc)总进球数\nd)抽签',
    standingsZones: [
      {
        fromRank: 1,
        toRank: 4,
        bgColor: '#ffe4e6',
        cutoffBefore: true,
        cutoffLabel: '欧冠',
        cutoffColor: '#f43f5e',
        cutoffLineColor: '#fda4af',
      },
      {
        fromRank: 5,
        toRank: 5,
        bgColor: '#fff1f2',
        cutoffBefore: true,
        cutoffLabel: '欧联',
        cutoffColor: '#f43f5e',
        cutoffLineColor: '#fda4af',
      },
      {
        fromRank: 6,
        toRank: 6,
        bgColor: '#fff7ed',
        cutoffBefore: true,
        cutoffLabel: '欧协联附加赛',
        cutoffColor: '#ea580c',
        cutoffLineColor: '#fdba74',
      },
      {
        fromRank: 18,
        toRank: 20,
        bgColor: '#f1f5f9',
        cutoffBefore: true,
        cutoffLabel: '降级',
        cutoffColor: '#64748b',
        cutoffLineColor: '#cbd5e1',
      },
    ],
  },
  {
    id: 7,
    code: 'ger.1',
    name: '2026-27赛季德国足球甲级联赛',
    totalRounds: 34,
    qualifyCount: 4,
    qualifyLabel: '欧冠',
    tiebreakers: ['gd', 'gf', 'h2h_points'],
    rulesText:
      '积分排名规则\n1.每队胜一场得3分，平一场得1分，负一场得0分\n2.联赛结束，积分多的队名次靠前\n3.如果两队或两队以上积分相等，依下列顺序排列名次\na)总净胜球\nb)总进球数\nc)相互战绩（依次比较相互对战积分、相互对战净胜球、相互对战客场进球）\nd)总客场进球数\ne)附加赛',
    standingsZones: [
      {
        fromRank: 1,
        toRank: 4,
        bgColor: '#ffe4e6',
        cutoffBefore: true,
        cutoffLabel: '欧冠',
        cutoffColor: '#f43f5e',
        cutoffLineColor: '#fda4af',
      },
      {
        fromRank: 5,
        toRank: 5,
        bgColor: '#fff1f2',
        cutoffBefore: true,
        cutoffLabel: '欧联',
        cutoffColor: '#f43f5e',
        cutoffLineColor: '#fda4af',
      },
      {
        fromRank: 6,
        toRank: 6,
        bgColor: '#fff7ed',
        cutoffBefore: true,
        cutoffLabel: '欧协联附加赛',
        cutoffColor: '#ea580c',
        cutoffLineColor: '#fdba74',
      },
      {
        fromRank: 16,
        toRank: 16,
        bgColor: '#f8fafc',
        cutoffBefore: true,
        cutoffLabel: '降级附加赛',
        cutoffColor: '#64748b',
        cutoffLineColor: '#cbd5e1',
      },
      {
        fromRank: 17,
        toRank: 18,
        bgColor: '#f1f5f9',
        cutoffBefore: true,
        cutoffLabel: '降级',
        cutoffColor: '#64748b',
        cutoffLineColor: '#cbd5e1',
      },
    ],
  },
  {
    id: 8,
    code: 'fra.1',
    name: '2026-27赛季法国足球甲级联赛',
    totalRounds: 34,
    qualifyCount: 4,
    qualifyLabel: '欧冠',
    tiebreakers: ['gd', 'gf', 'h2h_points'],
    rulesText:
      '积分排名规则\n1.每队胜一场得3分，平一场得1分，负一场得0分\n2.联赛结束，积分多的队名次靠前\n3.如果两队或两队以上积分相等，依下列顺序排列名次\na)总净胜球\nb)相互战绩（依次比较相互对战积分、相互对战净胜球、相互对战进球数）\nc)总进球数\nd)公平竞赛积分（每张黄牌减1分、每张红牌减3分，两黄变红按照1张红牌计算）',
    standingsZones: [
      {
        fromRank: 1,
        toRank: 3,
        bgColor: '#ffe4e6',
        cutoffBefore: true,
        cutoffLabel: '欧冠',
        cutoffColor: '#f43f5e',
        cutoffLineColor: '#fda4af',
      },
      {
        fromRank: 4,
        toRank: 4,
        bgColor: '#fff1f2',
        cutoffBefore: true,
        cutoffLabel: '欧冠资格赛',
        cutoffColor: '#f43f5e',
        cutoffLineColor: '#fda4af',
      },
      {
        fromRank: 5,
        toRank: 5,
        bgColor: '#fff1f2',
        cutoffBefore: true,
        cutoffLabel: '欧联',
        cutoffColor: '#f43f5e',
        cutoffLineColor: '#fda4af',
      },
      {
        fromRank: 6,
        toRank: 6,
        bgColor: '#fff7ed',
        cutoffBefore: true,
        cutoffLabel: '欧协联附加赛',
        cutoffColor: '#ea580c',
        cutoffLineColor: '#fdba74',
      },
      {
        fromRank: 16,
        toRank: 16,
        bgColor: '#f8fafc',
        cutoffBefore: true,
        cutoffLabel: '降级附加赛',
        cutoffColor: '#64748b',
        cutoffLineColor: '#cbd5e1',
      },
      {
        fromRank: 17,
        toRank: 18,
        bgColor: '#f1f5f9',
        cutoffBefore: true,
        cutoffLabel: '降级',
        cutoffColor: '#64748b',
        cutoffLineColor: '#cbd5e1',
      },
    ],
  },
];

const TEAM_ZH = {
  // 英超
  Arsenal: '阿森纳',
  'Brighton & Hove Albion': '布莱顿',
  'Manchester City': '曼城',
  Liverpool: '利物浦',
  Chelsea: '切尔西',
  Everton: '埃弗顿',
  'AFC Bournemouth': '伯恩茅斯',
  Brentford: '布伦特福德',
  'Leeds United': '利兹联',
  'Aston Villa': '阿斯顿维拉',
  'Tottenham Hotspur': '热刺',
  'Newcastle United': '纽卡斯尔联',
  'Hull City': '赫尔城',
  'Ipswich Town': '伊普斯威奇',
  Fulham: '富勒姆',
  'Nottingham Forest': '诺丁汉森林',
  'Coventry City': '考文垂',
  'Manchester United': '曼联',
  Sunderland: '桑德兰',
  'Crystal Palace': '水晶宫',
  // 西甲
  Barcelona: '巴塞罗那',
  'Real Madrid': '皇家马德里',
  'Atlético Madrid': '马德里竞技',
  'Real Betis': '皇家贝蒂斯',
  'Real Sociedad': '皇家社会',
  Sevilla: '塞维利亚',
  'Athletic Club': '毕尔巴鄂竞技',
  Villarreal: '比利亚雷亚尔',
  Deportivo: '拉科鲁尼亚',
  'Racing Santander': '桑坦德竞技',
  'Celta Vigo': '塞尔塔',
  Alavés: '阿拉维斯',
  Espanyol: '西班牙人',
  'Rayo Vallecano': '巴列卡诺',
  Getafe: '赫塔费',
  Osasuna: '奥萨苏纳',
  Levante: '莱万特',
  Elche: '埃尔切',
  Valencia: '瓦伦西亚',
  Málaga: '马拉加',
  // 意甲
  Lazio: '拉齐奥',
  Internazionale: '国际米兰',
  'AS Roma': '罗马',
  'AC Milan': 'AC米兰',
  Como: '科莫',
  Frosinone: '弗罗西诺内',
  Juventus: '尤文图斯',
  Bologna: '博洛尼亚',
  Cagliari: '卡利亚里',
  Napoli: '那不勒斯',
  Torino: '都灵',
  Atalanta: '亚特兰大',
  Genoa: '热那亚',
  Lecce: '莱切',
  Fiorentina: '佛罗伦萨',
  Parma: '帕尔马',
  Sassuolo: '萨索洛',
  Monza: '蒙扎',
  Venezia: '威尼斯',
  Udinese: '乌迪内斯',
  // 德甲
  'Bayern Munich': '拜仁慕尼黑',
  'Borussia Dortmund': '多特蒙德',
  'SC Freiburg': '弗赖堡',
  'RB Leipzig': 'RB莱比锡',
  'Bayer Leverkusen': '勒沃库森',
  'Werder Bremen': '云达不莱梅',
  'SV Elversberg': '埃尔弗斯贝格',
  'VfB Stuttgart': '斯图加特',
  'TSG Hoffenheim': '霍芬海姆',
  'Eintracht Frankfurt': '法兰克福',
  'Hamburg SV': '汉堡',
  Mainz: '美因茨',
  'SC Paderborn 07': '帕德博恩',
  'FC Augsburg': '奥格斯堡',
  'FC Cologne': '科隆',
  '1. FC Union Berlin': '柏林联合',
  'Schalke 04': '沙尔克04',
  'Borussia Mönchengladbach': '门兴格拉德巴赫',
  // 法甲
  'Paris Saint-Germain': '巴黎圣日耳曼',
  Lille: '里尔',
  'Paris FC': '巴黎FC',
  Marseille: '马赛',
  Lyon: '里昂',
  Nice: '尼斯',
  'AS Monaco': '摩纳哥',
  'Stade Rennais': '雷恩',
  Brest: '布雷斯特',
  Lorient: '洛里昂',
  Lens: '朗斯',
  Toulouse: '图卢兹',
  Strasbourg: '斯特拉斯堡',
  'AJ Auxerre': '欧塞尔',
  'Le Mans': '勒芒',
  Angers: '昂热',
  Troyes: '特鲁瓦',
  'Le Havre AC': '勒阿弗尔',
};

function toZh(name) {
  return TEAM_ZH[name] || name;
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  return res.json();
}

async function fetchLeaguePayload(league) {
  const [standingsData, scoreboardData] = await Promise.all([
    fetchJson(
      `https://site.api.espn.com/apis/v2/sports/soccer/${league.code}/standings?season=2026`,
    ),
    fetchJson(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/${league.code}/scoreboard`,
    ),
  ]);

  const entries = standingsData.children?.[0]?.standings?.entries ?? [];
  const teamRows = entries.map((e) => ({
    espnId: String(e.team.id),
    name: toZh(e.team.displayName),
    logoUrl: e.team.logos?.[0]?.href || '',
  }));

  const leagueLogoUrl = scoreboardData.leagues?.[0]?.logos?.[0]?.href || '';

  const eventMap = new Map();
  const ingestEvents = (events) => {
    for (const ev of events || []) {
      const comp = ev.competitions?.[0];
      const home = comp?.competitors?.find((c) => c.homeAway === 'home');
      const away = comp?.competitors?.find((c) => c.homeAway === 'away');
      if (!home || !away) continue;

      const state = comp?.status?.type?.state;
      const isFinishedOrLive = state === 'post' || state === 'in';
      const rawHomeScore =
        home.score?.value ?? (typeof home.score === 'string' ? Number(home.score) : null);
      const rawAwayScore =
        away.score?.value ?? (typeof away.score === 'string' ? Number(away.score) : null);

      eventMap.set(String(ev.id), {
        espnEventId: String(ev.id),
        matchTime: ev.date,
        homeTeam: toZh(home.team?.displayName || ''),
        awayTeam: toZh(away.team?.displayName || ''),
        homeScore:
          isFinishedOrLive && Number.isFinite(Number(rawHomeScore))
            ? Number(rawHomeScore)
            : null,
        awayScore:
          isFinishedOrLive && Number.isFinite(Number(rawAwayScore))
            ? Number(rawAwayScore)
            : null,
      });
    }
  };

  // Fetch past + future schedule for all teams in parallel batches
  const batchSize = 6;
  for (let i = 0; i < teamRows.length; i += batchSize) {
    const batch = teamRows.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (t) => {
        const [past, fut] = await Promise.all([
          fetchJson(
            `https://site.api.espn.com/apis/site/v2/sports/soccer/${league.code}/teams/${t.espnId}/schedule?season=2026`,
          ),
          fetchJson(
            `https://site.api.espn.com/apis/site/v2/sports/soccer/${league.code}/teams/${t.espnId}/schedule?season=2026&fixture=true`,
          ),
        ]);
        ingestEvents(past.events);
        ingestEvents(fut.events);
      }),
    );
  }

  // Overlay latest live/recent scoreboard events
  ingestEvents(scoreboardData.events);

  const sortedEvents = [...eventMap.values()].sort(
    (a, b) => new Date(a.matchTime).getTime() - new Date(b.matchTime).getTime(),
  );
  const perRound = Math.max(1, Math.floor(teamRows.length / 2));
  const matches = sortedEvents.map((m, idx) => ({
    tournamentId: league.id,
    roundNo: Math.min(league.totalRounds, Math.floor(idx / perRound) + 1),
    matchTime: m.matchTime,
    homeTeam: m.homeTeam,
    awayTeam: m.awayTeam,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
  }));

  const eventDate = matches[0]?.matchTime?.slice(0, 10) || '2026-08-15';

  return {
    league,
    leagueLogoUrl,
    eventDate,
    teams: teamRows.map((t) => ({
      tournament_id: league.id,
      team_name: t.name,
      logo_url: t.logoUrl,
    })),
    matches,
  };
}

function sqlStr(val) {
  return `'${String(val).replace(/'/g, "''")}'`;
}

function generateSql(payloads) {
  const lines = [
    '-- 2026-27 赛季欧洲五大联赛自动同步 SQL（由 scripts/sync-top5-leagues.mjs 生成）',
    '',
    'insert into public.tournaments (',
    '  id, name, sport, win_points, draw_points, loss_points, tiebreakers, qualify_count, qualify_label, logo_url, standings_zones, total_rounds, event_date, rules_text',
    ') values',
  ];

  const tValues = payloads.map(({ league, leagueLogoUrl, eventDate }) => {
    return `  (${league.id}, ${sqlStr(league.name)}, 'football', 3, 1, 0, ${sqlStr(
      JSON.stringify(league.tiebreakers),
    )}::jsonb, ${league.qualifyCount}, ${sqlStr(league.qualifyLabel)}, ${sqlStr(
      leagueLogoUrl,
    )}, ${sqlStr(JSON.stringify(league.standingsZones))}::jsonb, ${
      league.totalRounds
    }, ${sqlStr(eventDate)}, ${sqlStr(league.rulesText)})`;
  });
  lines.push(tValues.join(',\n'));
  lines.push(
    'on conflict (id) do update set',
    '  name = excluded.name,',
    '  sport = excluded.sport,',
    '  tiebreakers = excluded.tiebreakers,',
    '  qualify_count = excluded.qualify_count,',
    '  qualify_label = excluded.qualify_label,',
    '  logo_url = excluded.logo_url,',
    '  standings_zones = excluded.standings_zones,',
    '  total_rounds = excluded.total_rounds,',
    '  event_date = excluded.event_date,',
    '  rules_text = excluded.rules_text;',
    '',
    "select setval(pg_get_serial_sequence('public.tournaments', 'id'), coalesce((select max(id) from public.tournaments), 1), true);",
    '',
  );

  // Teams
  lines.push(
    'insert into public.football_teams (tournament_id, team_name, logo_url) values',
  );
  const teamValues = payloads.flatMap((p) =>
    p.teams.map(
      (t) => `  (${t.tournament_id}, ${sqlStr(t.team_name)}, ${sqlStr(t.logo_url)})`,
    ),
  );
  lines.push(teamValues.join(',\n'));
  lines.push(
    'on conflict (tournament_id, team_name) do update set logo_url = excluded.logo_url;',
    '',
  );

  // Matches
  const ids = payloads.map((p) => p.league.id).join(', ');
  lines.push(`delete from public.football_matches where tournament_id in (${ids});`, '');
  lines.push(
    'insert into public.football_matches (tournament_id, round_no, match_time, home_team, away_team, home_score, away_score) values',
  );
  const matchValues = payloads.flatMap((p) =>
    p.matches.map(
      (m) =>
        `  (${m.tournamentId}, ${m.roundNo}, ${sqlStr(m.matchTime)}, ${sqlStr(
          m.homeTeam,
        )}, ${sqlStr(m.awayTeam)}, ${m.homeScore === null ? 'null' : m.homeScore}, ${
          m.awayScore === null ? 'null' : m.awayScore
        })`,
    ),
  );
  lines.push(matchValues.join(',\n') + ';', '');
  lines.push(
    "select setval(pg_get_serial_sequence('public.football_matches', 'id'), coalesce((select max(id) from public.football_matches), 1), true);",
  );

  return lines.join('\n');
}

async function supabaseRequest(endpoint, method, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
    method,
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase ${method} ${endpoint} failed (${res.status}): ${text}`);
  }
}

async function syncToSupabase(payloads) {
  if (!SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable.');
  }

  const tournamentRows = payloads.map(({ league, leagueLogoUrl, eventDate }) => ({
    id: league.id,
    name: league.name,
    sport: 'football',
    win_points: 3,
    draw_points: 1,
    loss_points: 0,
    tiebreakers: league.tiebreakers,
    qualify_count: league.qualifyCount,
    qualify_label: league.qualifyLabel,
    logo_url: leagueLogoUrl,
    standings_zones: league.standingsZones,
    total_rounds: league.totalRounds,
    event_date: eventDate,
    rules_text: league.rulesText,
  }));
  await supabaseRequest('tournaments?on_conflict=id', 'POST', tournamentRows);

  const teamRows = payloads.flatMap((p) => p.teams);
  await supabaseRequest(
    'football_teams?on_conflict=tournament_id,team_name',
    'POST',
    teamRows,
  );

  for (const p of payloads) {
    await supabaseRequest(
      `football_matches?tournament_id=eq.${p.league.id}`,
      'DELETE',
    );
    const chunkSize = 200;
    const rows = p.matches.map((m) => ({
      tournament_id: m.tournamentId,
      round_no: m.roundNo,
      match_time: m.matchTime,
      home_team: m.homeTeam,
      away_team: m.awayTeam,
      home_score: m.homeScore,
      away_score: m.awayScore,
    }));
    for (let i = 0; i < rows.length; i += chunkSize) {
      await supabaseRequest('football_matches', 'POST', rows.slice(i, i + chunkSize));
    }
    console.log(
      `[Synced] ${p.league.name} (${p.league.code}): ${p.teams.length} teams, ${rows.length} matches`,
    );
  }
}

async function main() {
  const sqlArgIdx = process.argv.indexOf('--sql');
  const payloads = [];
  for (const league of LEAGUES) {
    const p = await fetchLeaguePayload(league);
    console.log(
      `[Fetched] ${league.name} (${league.code}): ${p.teams.length} teams, ${p.matches.length} matches`,
    );
    payloads.push(p);
  }

  if (sqlArgIdx !== -1) {
    const outPath = process.argv[sqlArgIdx + 1] || 'supabase/top5-leagues.sql';
    const absPath = path.resolve(outPath);
    fs.writeFileSync(absPath, generateSql(payloads), 'utf8');
    console.log(`SQL written to ${absPath}`);
    return;
  }

  await syncToSupabase(payloads);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
