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

// Seed initial article if table is empty
const countRow = db.prepare('SELECT COUNT(*) AS count FROM articles').get();
if (countRow.count === 0) {
  const paragraphs = [
    '11月16日上午，“山海杯”2026年全国五子棋业余棋王争霸赛线下总决赛在浙江省杭州市淳安县枫树岭镇下姜村落下帷幕。经过激烈争夺，赵云获得公开组冠军；肖卢卡获得U12组冠军；陈颢琮获得U8组冠军。',
    '杭州千岛湖山海文旅发展有限公司总经理唐晋观为U8组9-16名颁奖',
    '中国棋院杭州分院智力运动管理处副处长马天越为U8组4-8名颁奖',
    '国家体育总局棋牌运动管理中心国际跳棋和五子棋部竞赛主管叶畅为U8组1-3名颁奖',
    '杭州千岛湖山海文旅发展有限公司总经理唐晋观为U12组9-16名颁奖',
    '国家体育总局棋牌运动管理中心国际跳棋和五子棋部竞赛主管叶畅为U12组4-8名颁奖',
    '中国棋院杭州分院智力运动管理处副处长马天越为U12组1-3名颁奖',
    '千岛湖大下姜文旅客厅/雷迪森维嘉酒店总经理张政为公开组9-16名颁奖',
    '国家体育总局棋牌运动管理中心国际跳棋和五子棋部竞赛主管叶畅为公开组 4-8名颁奖',
    '中国棋院杭州分院智力运动管理处副处长马天越为公开组1-3名颁奖',
    '本次赛事为全国业余五子棋爱好者提供了切磋交流的平台，也让五子棋在基层的普及与推广多了一次集中的展示。棋盘上的胜负已经写定，棋手之间的交流仍在延续。',
    '本次比赛由浙江日报报业集团、中国棋院杭州分院主办，浙江省智力运动管理中心、浙江省棋类协会、杭州市体育局支持，杭州千岛湖山海文旅发展有限公司冠名，杭州市淳安县文化和广电旅游体育局、杭州市淳安县枫树岭镇人民政府、杭州市棋类协会、杭州弈战数字技术有限公司承办，浙数文化科技集团股份有限公司协办。',
    '附件1：“山海杯”2026年全国五子棋业余棋王争霸赛线下总决赛公开组棋谱（1-8台）.pdf',
    '附件2：“山海杯”2026年全国五子棋业余棋王争霸赛线下总决赛成绩册.pdf',
  ];

  db.prepare(`
    INSERT INTO articles (
      title, summary, content_json, category, category_label,
      author_name, author_role, published_at, read_time_minutes,
      views, is_featured, is_breaking, source_url, tags_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    '“山海杯”2026年全国五子棋业余棋王争霸赛线下总决赛圆满落幕',
    paragraphs[0],
    JSON.stringify(paragraphs),
    'renju',
    '五子棋',
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
}
