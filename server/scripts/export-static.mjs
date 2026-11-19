import fs from 'node:fs';
import path from 'node:path';
import { db } from '../src/db.mjs';

const outDir = path.resolve(import.meta.dirname, '..', '..', 'public', 'static-api');
const newsDir = path.join(outDir, 'news');
const commentsDir = path.join(outDir, 'comments');

fs.mkdirSync(newsDir, { recursive: true });
fs.mkdirSync(commentsDir, { recursive: true });

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

const articles = db.prepare('SELECT * FROM articles ORDER BY id DESC').all().map(mapArticle);
fs.writeFileSync(path.join(outDir, 'news.json'), JSON.stringify(articles, null, 2));

for (const article of articles) {
  fs.writeFileSync(
    path.join(newsDir, `${article.id}.json`),
    JSON.stringify(article, null, 2),
  );

  const comments = db
    .prepare(
      'SELECT id, article_id AS articleId, user_id AS userId, username, content, created_at AS createdAt FROM comments WHERE article_id = ? ORDER BY id DESC',
    )
    .all(Number(article.id));

  fs.writeFileSync(
    path.join(commentsDir, `${article.id}.json`),
    JSON.stringify(comments, null, 2),
  );
}

console.log(`Exported ${articles.length} articles to public/static-api/`);
