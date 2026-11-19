import crypto from 'node:crypto';
import cors from 'cors';
import express from 'express';
import { hashPassword, requireAuth, signToken, verifyPassword } from './auth.mjs';
import { db } from './db.mjs';

const app = express();
const PORT = Number(process.env.PORT || 8080);

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
app.use(express.json());

function mapArticle(row) {
  return {
    id: String(row.id),
    slug: String(row.id),
    title: row.title,
    summary: row.summary,
    content: JSON.parse(row.content_json),
    category: row.category,
    categoryLabel: row.category_label,
    coverImage: row.cover_image || undefined,
    author: {
      id: 'author',
      name: row.author_name,
      role: row.author_role,
    },
    publishedAt: row.published_at,
    readTimeMinutes: row.read_time_minutes,
    views: row.views,
    isFeatured: Boolean(row.is_featured),
    isBreaking: Boolean(row.is_breaking),
    sourceUrl: row.source_url || undefined,
    tags: JSON.parse(row.tags_json),
  };
}

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// Auth routes
app.post('/api/auth/register', (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');

  if (username.length < 2 || username.length > 24) {
    res.status(400).json({ error: '用户名长度需在 2-24 个字符之间' });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: '密码长度至少为 6 位' });
    return;
  }

  const existing = db
    .prepare('SELECT id FROM users WHERE username = ?')
    .get(username);
  if (existing) {
    res.status(409).json({ error: '该用户名已被注册' });
    return;
  }

  const id = crypto.randomUUID();
  const passwordHash = hashPassword(password);
  const createdAt = new Date().toISOString();

  db.prepare(
    'INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)',
  ).run(id, username, passwordHash, createdAt);

  const user = { id, username };
  const token = signToken(user);
  res.status(201).json({ token, user });
});

app.post('/api/auth/login', (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');

  const row = db
    .prepare('SELECT id, username, password_hash FROM users WHERE username = ?')
    .get(username);

  if (!row || !verifyPassword(password, row.password_hash)) {
    res.status(401).json({ error: '用户名或密码错误' });
    return;
  }

  const user = { id: row.id, username: row.username };
  const token = signToken(user);
  res.json({ token, user });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// News routes
app.get('/api/news', (req, res) => {
  const category = String(req.query.category || 'all');
  const search = String(req.query.search || '').trim().toLowerCase();
  const limit = req.query.limit ? Number(req.query.limit) : undefined;

  let sql = 'SELECT * FROM articles WHERE 1=1';
  const params = [];

  if (category && category !== 'all') {
    sql += ' AND category = ?';
    params.push(category);
  }

  sql += ' ORDER BY id DESC';

  const rows = db.prepare(sql).all(...params).map(mapArticle);
  const filtered = search
    ? rows.filter(
        (item) =>
          item.title.toLowerCase().includes(search) ||
          item.summary.toLowerCase().includes(search) ||
          item.tags.some((t) => t.toLowerCase().includes(search)),
      )
    : rows;

  res.json(typeof limit === 'number' ? filtered.slice(0, limit) : filtered);
});

app.get('/api/news/:id', (req, res) => {
  const articleId = Number(req.params.id);
  if (!Number.isInteger(articleId) || articleId <= 0) {
    res.status(404).json(null);
    return;
  }

  const row = db.prepare('SELECT * FROM articles WHERE id = ?').get(articleId);
  if (!row) {
    res.status(404).json(null);
    return;
  }

  db.prepare('UPDATE articles SET views = views + 1 WHERE id = ?').run(articleId);
  const updated = db.prepare('SELECT * FROM articles WHERE id = ?').get(articleId);
  res.json(mapArticle(updated));
});

app.get('/api/news/:id/related', (req, res) => {
  const articleId = Number(req.params.id);
  const category = String(req.query.category || 'renju');
  const limit = Number(req.query.limit || 3);

  const rows = db
    .prepare(
      'SELECT * FROM articles WHERE id != ? AND category = ? ORDER BY id DESC LIMIT ?',
    )
    .all(articleId, category, limit);

  res.json(rows.map(mapArticle));
});

// Comments routes
app.get('/api/news/:id/comments', (req, res) => {
  const articleId = Number(req.params.id);
  if (!Number.isInteger(articleId) || articleId <= 0) {
    res.json([]);
    return;
  }

  const rows = db
    .prepare(
      'SELECT id, article_id AS articleId, user_id AS userId, username, content, created_at AS createdAt FROM comments WHERE article_id = ? ORDER BY id DESC',
    )
    .all(articleId);

  res.json(rows);
});

app.post('/api/news/:id/comments', requireAuth, (req, res) => {
  const articleId = Number(req.params.id);
  const content = String(req.body?.content || '').trim();

  if (!Number.isInteger(articleId) || articleId <= 0) {
    res.status(404).json({ error: '文章不存在' });
    return;
  }
  const article = db.prepare('SELECT id FROM articles WHERE id = ?').get(articleId);
  if (!article) {
    res.status(404).json({ error: '文章不存在' });
    return;
  }
  if (!content || content.length > 500) {
    res.status(400).json({ error: '评论内容需在 1-500 字之间' });
    return;
  }

  const createdAt = new Date().toISOString();
  const result = db
    .prepare(
      'INSERT INTO comments (article_id, user_id, username, content, created_at) VALUES (?, ?, ?, ?, ?)',
    )
    .run(articleId, req.user.id, req.user.username, content, createdAt);

  res.status(201).json({
    id: Number(result.lastInsertRowid),
    articleId,
    userId: req.user.id,
    username: req.user.username,
    content,
    createdAt,
  });
});

app.delete('/api/comments/:commentId', requireAuth, (req, res) => {
  const commentId = Number(req.params.commentId);
  const row = db
    .prepare('SELECT id, user_id FROM comments WHERE id = ?')
    .get(commentId);

  if (!row) {
    res.status(404).json({ error: '评论不存在' });
    return;
  }
  if (row.user_id !== req.user.id) {
    res.status(403).json({ error: '无权删除他人评论' });
    return;
  }

  db.prepare('DELETE FROM comments WHERE id = ?').run(commentId);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Saiyuan API server listening on http://localhost:${PORT}`);
});
