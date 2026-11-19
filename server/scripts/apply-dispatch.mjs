import crypto from 'node:crypto';
import { hashPassword } from '../src/auth.mjs';
import { db } from '../src/db.mjs';

const action = process.env.DISPATCH_ACTION;

if (action === 'register-user') {
  const username = String(process.env.PAYLOAD_USERNAME || '').trim();
  const password = String(process.env.PAYLOAD_PASSWORD || '');

  if (username.length < 2 || password.length < 6) {
    throw new Error('Invalid username or password');
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (!existing) {
    db.prepare(
      'INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)',
    ).run(crypto.randomUUID(), username, hashPassword(password), new Date().toISOString());
    console.log(`Registered user: ${username}`);
  } else {
    console.log(`User already exists: ${username}`);
  }
} else if (action === 'add-comment') {
  const articleId = Number(process.env.PAYLOAD_ARTICLE_ID);
  const username = String(process.env.PAYLOAD_USERNAME || '').trim();
  const content = String(process.env.PAYLOAD_CONTENT || '').trim();

  if (!Number.isInteger(articleId) || articleId <= 0 || !username || !content) {
    throw new Error('Invalid comment payload');
  }

  let user = db.prepare('SELECT id, username FROM users WHERE username = ?').get(username);
  if (!user) {
    const newId = crypto.randomUUID();
    db.prepare(
      'INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)',
    ).run(newId, username, hashPassword(crypto.randomUUID()), new Date().toISOString());
    user = { id: newId, username };
  }

  db.prepare(
    'INSERT INTO comments (article_id, user_id, username, content, created_at) VALUES (?, ?, ?, ?, ?)',
  ).run(articleId, user.id, user.username, content, new Date().toISOString());

  console.log(`Added comment on article #${articleId} by ${username}`);
} else {
  throw new Error(`Unsupported action: ${action}`);
}
