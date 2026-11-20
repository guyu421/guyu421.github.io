/**
 * 生成 2025 年中国足球超级联赛（id = 9）SQL 并支持直接写入 Supabase。
 *
 * 用法：
 *   node scripts/sync-2025-csl.mjs --sql supabase/csl-2025.sql
 *   SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/sync-2025-csl.mjs
 */

import fs from 'node:fs';
import path from 'node:path';

const TOURNAMENT_ID = 9;
const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  'https://cqhktfwogmffcorwfrxm.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const TEAM_ZH = {
  'Shanghai Port FC': '上海海港',
  'Shanghai Shenhua FC': '上海申花',
  'Chengdu Rongcheng': '成都蓉城',
  'Beijing Guoan': '北京国安',
  'Shandong Taishan': '山东泰山',
  'Tianjin Jinmen Tiger': '天津津门虎',
  'Zhejiang Professional FC': '浙江队',
  'Yunnan Yukun': '云南玉昆',
  'Qingdao West Coast': '青岛西海岸',
  Henan: '河南队',
  'Dalian Yingbo': '大连英博',
  'Shenzhen Xinpengcheng': '深圳新鹏城',
  'Wuhan Three Towns': '武汉三镇',
  'Qingdao Hainiu': '青岛海牛',
  'Meizhou Hakka': '梅州客家',
  'Changchun Yatai': '长春亚泰',
};

const STANDINGS_ZONES = [
  {
    fromRank: 1,
    toRank: 1,
    bgColor: '#ffe4e6',
    cutoffBefore: true,
    cutoffLabel: '亚冠精英正赛',
    cutoffColor: '#f43f5e',
    cutoffLineColor: '#fda4af',
  },
  {
    fromRank: 2,
    toRank: 2,
    bgColor: '#fff1f2',
    cutoffBefore: true,
    cutoffLabel: '亚冠精英小组赛',
    cutoffColor: '#f43f5e',
    cutoffLineColor: '#fda4af',
  },
  {
    fromRank: 15,
    toRank: 16,
    bgColor: '#f1f5f9',
    cutoffBefore: true,
    cutoffLabel: '降级',
    cutoffColor: '#64748b',
    cutoffLineColor: '#cbd5e1',
  },
];

const RULES_TEXT =
  '积分排名规则\n1.每队胜一场得3分，平一场得1分，负一场得0分\n2.联赛结束，积分多的队名次靠前\n3.如果两队或两队以上积分相等，依下列顺序排列名次\na)相互战绩（依次比较相互对战积分，相互对战净胜球，相互对战总进球）\nb)总净胜球\nc)总进球数\nd)公平竞赛积分（每张黄牌减1分、每张红牌减3分，两黄变红按照1张红牌计算）\ne)抽签\n注：只有相关球队比赛全部结束后，才比较胜负关系。';

function toZh(name) {
  return TEAM_ZH[name] || name;
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

function sqlStr(val) {
  return `'${String(val).replace(/'/g, "''")}'`;
}

async function main() {
  const stData = await fetchJson(
    'https://site.api.espn.com/apis/v2/sports/soccer/chn.1/standings?season=2025',
  );
  const entries = stData.children?.[0]?.standings?.entries ?? [];
  const teams = entries.map((e) => ({
    espnId: String(e.team.id),
    name: toZh(e.team.displayName),
    logoUrl: e.team.logos?.[0]?.href || '',
  }));

  const eventMap = new Map();
  for (let i = 0; i < teams.length; i += 6) {
    const batch = teams.slice(i, i + 6);
    await Promise.all(
      batch.map(async (t) => {
        const sch = await fetchJson(
          `https://site.api.espn.com/apis/site/v2/sports/soccer/chn.1/teams/${t.espnId}/schedule?season=2025`,
        );
        for (const ev of sch.events || []) {
          const comp = ev.competitions?.[0];
          const home = comp?.competitors?.find((c) => c.homeAway === 'home');
          const away = comp?.competitors?.find((c) => c.homeAway === 'away');
          if (!home || !away) continue;
          const hs = home.score?.value ?? Number(home.score);
          const as = away.score?.value ?? Number(away.score);
          eventMap.set(String(ev.id), {
            matchTime: ev.date,
            homeTeam: toZh(home.team?.displayName || ''),
            awayTeam: toZh(away.team?.displayName || ''),
            homeScore: Number.isFinite(Number(hs)) ? Number(hs) : null,
            awayScore: Number.isFinite(Number(as)) ? Number(as) : null,
          });
        }
      }),
    );
  }

  const sorted = [...eventMap.values()].sort(
    (a, b) => new Date(a.matchTime).getTime() - new Date(b.matchTime).getTime(),
  );
  const perRound = Math.max(1, Math.floor(teams.length / 2));
  const matches = sorted.map((m, idx) => ({
    tournament_id: TOURNAMENT_ID,
    round_no: Math.min(30, Math.floor(idx / perRound) + 1),
    match_time: m.matchTime,
    home_team: m.homeTeam,
    away_team: m.awayTeam,
    home_score: m.homeScore,
    away_score: m.awayScore,
  }));

  const eventDate = matches[0]?.match_time?.slice(0, 10) || '2025-02-22';
  console.log(`[Fetched] 2025 CSL: ${teams.length} teams, ${matches.length} matches, start ${eventDate}`);

  const sqlArgIdx = process.argv.indexOf('--sql');
  if (sqlArgIdx !== -1) {
    const outPath = path.resolve(process.argv[sqlArgIdx + 1] || 'supabase/csl-2025.sql');
    const lines = [
      '-- 2025年中国足球超级联赛 SQL（由 scripts/sync-2025-csl.mjs 生成）',
      '',
      'insert into public.tournaments (',
      '  id, name, sport, win_points, draw_points, loss_points, tiebreakers, qualify_count, qualify_label, logo_url, standings_zones, total_rounds, event_date, rules_text',
      ') values (',
      `  ${TOURNAMENT_ID}, '2025年中国足球超级联赛', 'football', 3, 1, 0, '["h2h_points","h2h_gd","h2h_gf","gd","gf"]'::jsonb, 2, '降级', 'https://cqhktfwogmffcorwfrxm.supabase.co/storage/v1/object/public/media/leagues/csl.png', ${sqlStr(
        JSON.stringify(STANDINGS_ZONES),
      )}::jsonb, 30, ${sqlStr(eventDate)}, ${sqlStr(RULES_TEXT)}`,
      ') on conflict (id) do update set',
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
      'insert into public.football_teams (tournament_id, team_name, logo_url) values',
      teams
        .map((t) => `  (${TOURNAMENT_ID}, ${sqlStr(t.name)}, ${sqlStr(t.logoUrl)})`)
        .join(',\n'),
      'on conflict (tournament_id, team_name) do update set logo_url = excluded.logo_url;',
      '',
      `delete from public.football_matches where tournament_id = ${TOURNAMENT_ID};`,
      '',
      'insert into public.football_matches (tournament_id, round_no, match_time, home_team, away_team, home_score, away_score) values',
      matches
        .map(
          (m) =>
            `  (${m.tournament_id}, ${m.round_no}, ${sqlStr(m.match_time)}, ${sqlStr(
              m.home_team,
            )}, ${sqlStr(m.away_team)}, ${m.home_score === null ? 'null' : m.home_score}, ${
              m.away_score === null ? 'null' : m.away_score
            })`,
        )
        .join(',\n') + ';',
      '',
      "select setval(pg_get_serial_sequence('public.football_matches', 'id'), coalesce((select max(id) from public.football_matches), 1), true);",
    ];
    fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
    console.log(`SQL written to ${outPath}`);
    return;
  }

  if (!SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable.');
  }
  const req = async (endpoint, method, body) => {
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
    if (!res.ok) throw new Error(`${method} ${endpoint} ${res.status}: ${await res.text()}`);
  };
  await req('tournaments?on_conflict=id', 'POST', [
    {
      id: TOURNAMENT_ID,
      name: '2025年中国足球超级联赛',
      sport: 'football',
      win_points: 3,
      draw_points: 1,
      loss_points: 0,
      tiebreakers: ['h2h_points', 'h2h_gd', 'h2h_gf', 'gd', 'gf'],
      qualify_count: 2,
      qualify_label: '降级',
      logo_url:
        'https://cqhktfwogmffcorwfrxm.supabase.co/storage/v1/object/public/media/leagues/csl.png',
      standings_zones: STANDINGS_ZONES,
      total_rounds: 30,
      event_date: eventDate,
      rules_text: RULES_TEXT,
    },
  ]);
  await req(
    'football_teams?on_conflict=tournament_id,team_name',
    'POST',
    teams.map((t) => ({ tournament_id: TOURNAMENT_ID, team_name: t.name, logo_url: t.logoUrl })),
  );
  await req(`football_matches?tournament_id=eq.${TOURNAMENT_ID}`, 'DELETE');
  await req('football_matches', 'POST', matches);
  console.log('Synced 2025 CSL to Supabase!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
