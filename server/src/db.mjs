import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const dataDir = path.resolve(import.meta.dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'saiyuan.db');
export const db = new DatabaseSync(dbPath);

db.exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    content_json TEXT NOT NULL,
    category TEXT NOT NULL,
    category_label TEXT NOT NULL,
    cover_image TEXT,
    author_name TEXT NOT NULL,
    author_role TEXT NOT NULL,
    published_at TEXT NOT NULL,
    read_time_minutes INTEGER NOT NULL DEFAULT 2,
    views INTEGER NOT NULL DEFAULT 0,
    is_featured INTEGER NOT NULL DEFAULT 0,
    is_breaking INTEGER NOT NULL DEFAULT 0,
    source_url TEXT,
    tags_json TEXT NOT NULL DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    username TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// Ensure cover_image column exists on older databases
const columns = db.prepare('PRAGMA table_info(articles)').all();
if (!columns.some((col) => col.name === 'cover_image')) {
  db.exec('ALTER TABLE articles ADD COLUMN cover_image TEXT');
}

const ARTICLE_1_COVER =
  'https://mmbiz.qpic.cn/sz_mmbiz_jpg/SymLFibibgwnnZXphdUS4BOibmTYmbibzhMAIsu9icKRibNSNf38ka998Pib5Lnom3FNRnu1MiaAcajFYZPVLsc1ia6r4RiaE0ggyznIVnJSg60B8LgCg/0?wx_fmt=jpeg';

const ARTICLE_1_BLOCKS = [
  {
    type: 'image',
    src: 'https://mmbiz.qpic.cn/sz_mmbiz_png/SymLFibibgwnkGibOCg81QL5HV8pRSHO0eicONlVl2wDNm9xmbInibXP7hgx8gOQibzicibIH0FoEYK5mEiav4MQa2SZUWKPiaAQiad9L5p3A6lmY6tDAI/640?wx_fmt=png&from=appmsg',
  },
  '11月16日上午，“山海杯”2026年全国五子棋业余棋王争霸赛线下总决赛在浙江省杭州市淳安县枫树岭镇下姜村落下帷幕。经过激烈争夺，赵云获得公开组冠军；肖卢卡获得U12组冠军；陈颢琮获得U8组冠军。',
  {
    type: 'image',
    src: 'https://mmbiz.qpic.cn/sz_mmbiz_png/SymLFibibgwnmLyamnibicic1Ys4C3RmZYVoaBn9qNr6p4cwlRseibHFib4sicyFG5VkwQhVfWS4N7f4FEpPibNrVgXqSiaZibKBpZz6WoL4lvOibjUbBqE/640?wx_fmt=png&from=appmsg',
  },
  {
    type: 'image',
    src: 'https://mmbiz.qpic.cn/mmbiz_png/SymLFibibgwnlcqlwEiaKap4GxfrmES39YDsQcUvqY1yTPpD5JSYJ21YhQmu3xpMb9kQyzCnXgkQJhibaBJmPkiaZD3IzGP9doibJtBwliam5Td79w/640?wx_fmt=png&from=appmsg',
  },
  '杭州千岛湖山海文旅发展有限公司总经理唐晋观为U8组9-16名颁奖',
  {
    type: 'image',
    src: 'https://mmbiz.qpic.cn/mmbiz_png/SymLFibibgwnkDsrjaDbgLYOZ2NberL2ibaSibPfTZiaiadl9iasmNqCjLN3cPfvpEaOsVOEbFy8qu9aSMJ0pvgibne6wDHFMAyoUdZtgdB2Z8HiagLE/640?wx_fmt=png&from=appmsg',
  },
  '中国棋院杭州分院智力运动管理处副处长马天越为U8组4-8名颁奖',
  {
    type: 'image',
    src: 'https://mmbiz.qpic.cn/sz_mmbiz_png/SymLFibibgwnlV04SPjrzeFsrQTpzPiaPn4jMw8fq56d69tnUH86IKRqbp4FibDicHcadIKb2PJPqLv0Q2AUNNhoQrhXlgSMvMZql8JUmNhicXLmc/640?wx_fmt=png&from=appmsg',
  },
  '国家体育总局棋牌运动管理中心国际跳棋和五子棋部竞赛主管叶畅为U8组1-3名颁奖',
  {
    type: 'image',
    src: 'https://mmbiz.qpic.cn/sz_mmbiz_png/SymLFibibgwnnWlYWzFRhrpzeZ482lCI8iaPH8Fe4rYNVRhnhaFnAzPJENZdYIELvO6jk2E82Kt1z6fEuRqpFdNfrG4evSujTd1ibiche22UAwuk/640?wx_fmt=png&from=appmsg',
  },
  '杭州千岛湖山海文旅发展有限公司总经理唐晋观为U12组9-16名颁奖',
  {
    type: 'image',
    src: 'https://mmbiz.qpic.cn/sz_mmbiz_png/SymLFibibgwnm2vdyz996rTGtqhgELtgxY8fofMn20F2qE03g9ayQJejiadCrfL96kZibz8MiboaKvJhWtnHWwmag7ibBgozKRW4K778SFazGbA0A/640?wx_fmt=png&from=appmsg',
  },
  '国家体育总局棋牌运动管理中心国际跳棋和五子棋部竞赛主管叶畅为U12组4-8名颁奖',
  {
    type: 'image',
    src: 'https://mmbiz.qpic.cn/mmbiz_png/SymLFibibgwnl8Xz1FHFgo2uIRdYEmRvMoAE6IeuAhXpvcVyggq7uMSfahJbxLrAhviaBzX27GV0ibiaxECaJqpOomqRkoBJJ6qO7JczCvhjaBpM/640?wx_fmt=png&from=appmsg',
  },
  '中国棋院杭州分院智力运动管理处副处长马天越为U12组1-3名颁奖',
  {
    type: 'image',
    src: 'https://mmbiz.qpic.cn/sz_mmbiz_png/SymLFibibgwnniaMBQsg31iclvBu5akHPxN541ZRDiaY47AtB6wgFOKX2cZ3kGnpUDKLAprHib7Mf0VxupicVZ3cyQSLDoduichuI6gx2BILjPuayxk/640?wx_fmt=png&from=appmsg',
  },
  '千岛湖大下姜文旅客厅/雷迪森维嘉酒店总经理张政为公开组9-16名颁奖',
  {
    type: 'image',
    src: 'https://mmbiz.qpic.cn/sz_mmbiz_png/SymLFibibgwnnD6sA8EoKI5uO3FIQVgNqBBfyykFtldkl9ib3ppx4OrTJqyyyCybpEhb6zNJPtPKUH8mKssVUmXARAEQQVyMUlmvvJ4IKxY3sA/640?wx_fmt=png&from=appmsg',
  },
  '国家体育总局棋牌运动管理中心国际跳棋和五子棋部竞赛主管叶畅为公开组 4-8名颁奖',
  {
    type: 'image',
    src: 'https://mmbiz.qpic.cn/sz_mmbiz_png/SymLFibibgwnkOJOmP5xv1TJ1BiaJOANJDSCFeLNpfqZzdylzNHm4USqWvxhvbvPibRcbh2BOmqq9siclp9Tn103XBhwXu7nHGUQO8TrlBjttztY/640?wx_fmt=png&from=appmsg',
  },
  '中国棋院杭州分院智力运动管理处副处长马天越为公开组1-3名颁奖',
  '本次赛事为全国业余五子棋爱好者提供了切磋交流的平台，也让五子棋在基层的普及与推广多了一次集中的展示。棋盘上的胜负已经写定，棋手之间的交流仍在延续。',
  '本次比赛由浙江日报报业集团、中国棋院杭州分院主办，浙江省智力运动管理中心、浙江省棋类协会、杭州市体育局支持，杭州千岛湖山海文旅发展有限公司冠名，杭州市淳安县文化和广电旅游体育局、杭州市淳安县枫树岭镇人民政府、杭州市棋类协会、杭州弈战数字技术有限公司承办，浙数文化科技集团股份有限公司协办。',
  {
    type: 'image',
    src: 'https://mmbiz.qpic.cn/sz_mmbiz_png/SymLFibibgwnkDKAbLezDPP5jBm5tyOcOF5h1SuehECWlPIvqZ1jD2GNd6g8x5lSacvVmYUWhpLa5ah90nx1qTIruhffmicSwQ5JIxU04qCN90/640?wx_fmt=png&from=appmsg',
  },
  {
    type: 'image',
    src: 'https://mmbiz.qpic.cn/sz_mmbiz_png/SymLFibibgwnn0s7WeUia6Bho4YapENB5289bMllVE43oOQYKg9iaJw37ybgTd26ucv22btIXzeeeqFqA8PTSE9uxQHVKGwUCvX2m2CCAYjDOA0/640?wx_fmt=png&from=appmsg',
  },
  {
    type: 'image',
    src: 'https://mmbiz.qpic.cn/mmbiz_png/SymLFibibgwnnAeTlibXGcsV89D8icw4xGIxHYyXlOXlS3ibIbcicU1j4HiasMibMl7uLEYeuKzYsXl2zzqRe1HrNGehzpNGNk8XskQOHLQMaQahiarc/640?wx_fmt=png&from=appmsg',
  },
  '附件1：“山海杯”2026年全国五子棋业余棋王争霸赛线下总决赛公开组棋谱（1-8台）.pdf',
  '附件2：“山海杯”2026年全国五子棋业余棋王争霸赛线下总决赛成绩册.pdf',
  {
    type: 'image',
    src: 'https://mmbiz.qpic.cn/sz_mmbiz_jpg/SymLFibibgwnm51GVLwXOicu6alJdTAN75hDPjKQU8bHPgzCl8XribCxNTHSRHBtl2wryeRrQAMcIFmK1lbvjbolWvmc9lCIH3V8jHQLSUe8D0M/640?wx_fmt=jpeg&from=appmsg',
  },
];

const countRow = db.prepare('SELECT COUNT(*) AS count FROM articles').get();
if (countRow.count === 0) {
  db.prepare(`
    INSERT INTO articles (
      title, summary, content_json, category, category_label, cover_image,
      author_name, author_role, published_at, read_time_minutes,
      views, is_featured, is_breaking, source_url, tags_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    '“山海杯”2026年全国五子棋业余棋王争霸赛线下总决赛圆满落幕',
    ARTICLE_1_BLOCKS[1],
    JSON.stringify(ARTICLE_1_BLOCKS),
    'renju',
    '五子棋',
    ARTICLE_1_COVER,
    '中国五子棋',
    '微信公众号',
    '2026-11-16T15:11:00+08:00',
    2,
    0,
    1,
    0,
    'https://mp.weixin.qq.com/s/mBFNXCGsgNZNfNSnORpjEg',
    JSON.stringify(['中国五子棋', '山海杯', '业余棋王争霸赛']),
  );
} else {
  // Sync article 1 with cover image and rich image+text blocks if needed
  db.prepare(
    'UPDATE articles SET cover_image = ?, content_json = ? WHERE id = 1',
  ).run(ARTICLE_1_COVER, JSON.stringify(ARTICLE_1_BLOCKS));
}
