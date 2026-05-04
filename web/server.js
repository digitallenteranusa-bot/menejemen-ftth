const express = require('express');
const session = require('express-session');
const Database = require('better-sqlite3');
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const db = new Database(path.join(__dirname, 'data.db'));
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    data TEXT NOT NULL DEFAULT '{"projects":[]}'
  );
  CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )
`);

// Session secret persisten — tidak berubah saat restart
let sessionSecret;
const row = db.prepare('SELECT value FROM config WHERE key = ?').get('session_secret');
if (row) {
  sessionSecret = row.value;
} else {
  sessionSecret = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO config (key, value) VALUES (?, ?)').run('session_secret', sessionSecret);
}

function hashPw(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  return salt + ':' + crypto.scryptSync(pw, salt, 64).toString('hex');
}

function verifyPw(pw, stored) {
  const [salt, hash] = stored.split(':');
  return crypto.scryptSync(pw, salt, 64).toString('hex') === hash;
}

app.use(express.json({ limit: '50mb' }));
app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 }
}));

function auth(req, res, next) {
  if (req.session.uid) return next();
  res.status(401).json({ error: 'Belum login' });
}

app.get('/', (req, res) => {
  if (!req.session.uid) return res.redirect('/login.html');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username dan password wajib diisi' });
  if (password.length < 4) return res.status(400).json({ error: 'Password minimal 4 karakter' });
  try {
    const r = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run(username.trim(), hashPw(password));
    req.session.uid = r.lastInsertRowid;
    req.session.uname = username.trim();
    res.json({ ok: true });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ error: 'Username sudah digunakan' });
    res.status(500).json({ error: 'Gagal registrasi' });
  }
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const u = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!u || !verifyPw(password, u.password)) return res.status(401).json({ error: 'Username atau password salah' });
  req.session.uid = u.id;
  req.session.uname = username;
  res.json({ ok: true });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

app.get('/api/me', auth, (req, res) => {
  res.json({ username: req.session.uname });
});

app.get('/api/data', auth, (req, res) => {
  const row = db.prepare('SELECT data FROM users WHERE id = ?').get(req.session.uid);
  res.json(JSON.parse(row ? row.data : '{"projects":[]}'));
});

app.post('/api/data', auth, (req, res) => {
  db.prepare('UPDATE users SET data = ? WHERE id = ?').run(JSON.stringify(req.body), req.session.uid);
  res.json({ ok: true });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`FO Core Map berjalan di http://0.0.0.0:${PORT}`);
});
