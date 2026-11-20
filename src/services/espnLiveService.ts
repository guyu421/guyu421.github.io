import type { FootballMatch } from '@/types/match';

const LEAGUE_CODE_BY_ID: Record<number, string> = {
  2: 'chn.1',
  4: 'eng.1',
  5: 'esp.1',
  6: 'ita.1',
  7: 'ger.1',
  8: 'fra.1',
};

const TEAM_ZH: Record<string, string> = {
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
  'Chongqing Tonglianglong': '重庆铜梁龙',
  'Liaoning Tieren': '辽宁铁人',
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

function toZh(name: string): string {
  return TEAM_ZH[name] || name;
}

export function getEspnLeagueCode(tournamentId: number, tournamentName?: string): string | null {
  if (LEAGUE_CODE_BY_ID[tournamentId]) return LEAGUE_CODE_BY_ID[tournamentId];
  if (!tournamentName) return null;
  if (tournamentName.includes('2026') && tournamentName.includes('中超')) return 'chn.1';
  if (tournamentName.includes('2026') && tournamentName.includes('中国足球超级联赛')) return 'chn.1';
  if (tournamentName.includes('英格兰') || tournamentName.includes('英超')) return 'eng.1';
  if (tournamentName.includes('西班牙') || tournamentName.includes('西甲')) return 'esp.1';
  if (tournamentName.includes('意大利') || tournamentName.includes('意甲')) return 'ita.1';
  if (tournamentName.includes('德国') || tournamentName.includes('德甲')) return 'ger.1';
  if (tournamentName.includes('法国') || tournamentName.includes('法甲')) return 'fra.1';
  return null;
}

interface EspnScoreboardResponse {
  events?: Array<{
    date?: string;
    competitions?: Array<{
      status?: {
        displayClock?: string;
        type?: { state?: string; shortDetail?: string };
      };
      competitors?: Array<{
        homeAway?: string;
        score?: string;
        team?: { displayName?: string };
      }>;
    }>;
  }>;
}

/**
 * 拉取 ESPN 实时赛果与进行时间并覆盖到数据库赛程上（用于两次定时同步之间的实时比分展示）。
 */
export async function overlayEspnLiveScores(
  tournamentId: number,
  tournamentName: string,
  matches: FootballMatch[],
): Promise<FootballMatch[]> {
  const code = getEspnLeagueCode(tournamentId, tournamentName);
  if (!code || matches.length === 0) return matches;

  const res = await fetch(
    `https://site.api.espn.com/apis/site/v2/sports/soccer/${code}/scoreboard`,
  );
  if (!res.ok) return matches;

  const data = (await res.json()) as EspnScoreboardResponse;
  const liveByPair = new Map<
    string,
    { homeScore: number; awayScore: number; matchTime?: string; liveClock?: string }
  >();

  for (const ev of data.events ?? []) {
    const comp = ev.competitions?.[0];
    const state = comp?.status?.type?.state;
    if (state !== 'in' && state !== 'post') continue;

    const home = comp?.competitors?.find((c) => c.homeAway === 'home');
    const away = comp?.competitors?.find((c) => c.homeAway === 'away');
    if (!home || !away) continue;

    const hs = Number(home.score);
    const as = Number(away.score);
    if (!Number.isFinite(hs) || !Number.isFinite(as)) continue;

    let liveClock: string | undefined;
    if (state === 'in') {
      const shortDetail = comp?.status?.type?.shortDetail;
      const clock = comp?.status?.displayClock;
      if (shortDetail === 'HT') liveClock = '中场';
      else if (clock) liveClock = clock;
      else if (shortDetail) liveClock = shortDetail;
      else liveClock = '进行中';
    }

    const key = `${toZh(home.team?.displayName ?? '')}__${toZh(away.team?.displayName ?? '')}`;
    liveByPair.set(key, {
      homeScore: hs,
      awayScore: as,
      matchTime: ev.date,
      liveClock,
    });
  }

  if (liveByPair.size === 0) return matches;

  return matches.map((m) => {
    const live = liveByPair.get(`${m.homeTeam}__${m.awayTeam}`);
    if (!live) return m;
    return {
      ...m,
      homeScore: live.homeScore,
      awayScore: live.awayScore,
      matchTime: live.matchTime ?? m.matchTime,
      liveClock: live.liveClock,
    };
  });
}
