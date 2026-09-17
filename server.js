const path = require('path');
const express = require('express');
const cors = require('cors'); // <--- PŘIDÁNO CORS
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { Pool } = require('pg');

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret-change-me';
const MAX_PHOTO_BYTES = 3 * 1024 * 1024; // 3 MB per photo
const MAX_PHOTOS_PER_ROUTE = 3;

if (!process.env.DATABASE_URL) {
  console.error('Chybí proměnná prostředí DATABASE_URL. Přidej do Railway projektu PostgreSQL plugin.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('sslmode=require')
    ? { rejectUnauthorized: false }
    : (process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false)
});

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  is_approved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS routes (
  id SERIAL PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  points JSONB NOT NULL,
  distance_km REAL NOT NULL,
  elev_gain_m REAL NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS photos (
  id SERIAL PRIMARY KEY,
  route_id INTEGER NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  data_url TEXT NOT NULL,
  is_main BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_routes_owner ON routes(owner_id);
CREATE INDEX IF NOT EXISTS idx_photos_route ON photos(route_id);
`;

async function initDb() {
  await pool.query(SCHEMA_SQL);

  // Bezpečná migrace pro už běžící databázi, která sloupec is_approved ještě nemá:
  // přidá ho a všechny DOSAVADNÍ účty rovnou označí za schválené, ať nikoho
  // stávajícího tahle změna neodhlásí / nezablokuje.
  const col = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_approved'`
  );
  if (col.rows.length === 0) {
    await pool.query(`ALTER TABLE users ADD COLUMN is_approved BOOLEAN NOT NULL DEFAULT false`);
    await pool.query(`UPDATE users SET is_approved = true`);
    console.log('Migrace: sloupec is_approved přidán, stávající účty byly automaticky schváleny.');
  }

  console.log('Databázové schéma je připravené.');
}

const app = express();

// ---------------------------------------------------------------
// NASTAVENÍ CORS (POVOLENÍ PRO VERCEL FRONTEND)
// ---------------------------------------------------------------
app.use(cors({
  origin: true, // Povolí požadavky ze všech domén (Vercel, localhost atd.)
  credentials: true // DŮLEŽITÉ: Umožňuje předávání cookies mezi Vercelem a Railway
}));

app.use(express.json({ limit: '8mb' })); // GPX body dorazí jako JSON pole bodů
app.use(cookieParser());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PHOTO_BYTES + 1024 }
});

// ---------------------------------------------------------------
// Pomocné funkce
// ---------------------------------------------------------------
function haversine(a, b) {
  const R = 6371000, toRad = d => d * Math.PI / 180;
  const dLat = toRad(b[0] - a[0]), dLon = toRad(b[1] - a[1]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function computeStats(points) {
  let dist = 0, gain = 0;
  for (let i = 1; i < points.length; i++) {
    dist += haversine(points[i - 1], points[i]);
    const d = (points[i][2] || 0) - (points[i - 1][2] || 0);
    if (d > 0) gain += d;
  }
  return { distanceKm: dist / 1000, elevGainM: gain };
}

function signToken(user) {
  return jwt.sign({ id: user.id, username: user.username, displayName: user.display_name }, JWT_SECRET, { expiresIn: '30d' });
}

function setAuthCookie(res, token) {
  // UPRAVENO: pro komunikaci Vercel (Frontend) -> Railway (Backend)
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'none', // Důležité pro cross-site cookies mezi různými doménami
    secure: true,    // Musí být true, pokud je sameSite 'none'
    maxAge: 30 * 24 * 60 * 60 * 1000
  });
}

function requireAuth(req, res, next) {
  const token = req.cookies && req.cookies.token;
  if (!token) return res.status(401).json({ error: 'Nejste přihlášen(a).' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Přihlášení vypršelo, přihlaste se prosím znovu.' });
  }
}

// ---------------------------------------------------------------
// Auth
// ---------------------------------------------------------------
app.post('/api/auth/register', async (req, res) => {
  try {
    const username = String(req.body.username || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const displayName = String(req.body.displayName || req.body.username || '').trim();
    if (!username || !password || password.length < 4) {
      return res.status(400).json({ error: 'Vyplňte jméno a heslo (min. 4 znaky).' });
    }
    const existing = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (existing.rows.length) {
      return res.status(409).json({ error: 'Toto uživatelské jméno už existuje.' });
    }
    // úplně první registrovaný účet v celé databázi se považuje za majitele projektu
    // a schvaluje se automaticky, aby nedošlo k patové situaci "nikdo nemůže schválit nikoho"
    const countResult = await pool.query('SELECT COUNT(*)::int AS n FROM users');
    const isFirstUser = countResult.rows[0].n === 0;
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, password_hash, display_name, is_approved) VALUES ($1,$2,$3,$4) RETURNING id, username, display_name, is_approved',
      [username, hash, displayName, isFirstUser]
    );
    const user = result.rows[0];
    if (!user.is_approved) {
      return res.status(201).json({
        approved: false,
        message: 'Registrace přijata. Účet teď čeká na schválení administrátorem, pak se budeš moct přihlásit.'
      });
    }
    setAuthCookie(res, signToken(user));
    res.json({ id: user.id, username: user.username, displayName: user.display_name, approved: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Registrace se nepovedla.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const username = String(req.body.username || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Účet nenalezen. Zkuste "Vytvořit účet".' });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Nesprávné heslo.' });
    if (!user.is_approved) {
      return res.status(403).json({ error: 'Účet ještě čeká na schválení administrátorem.' });
    }
    setAuthCookie(res, signToken(user));
    res.json({ id: user.id, username: user.username, displayName: user.display_name, approved: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Přihlášení se nepovedlo.' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token', { sameSite: 'none', secure: true });
  res.json({ ok: true });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ id: req.user.id, username: req.user.username, displayName: req.user.displayName });
});

// ---------------------------------------------------------------
// Trasy
// ---------------------------------------------------------------
app.get('/api/routes', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.id, r.name, r.description, r.points, r.distance_km, r.elev_gain_m, r.created_at,
              u.id AS owner_id, u.display_name AS owner_display
       FROM routes r JOIN users u ON u.id = r.owner_id
       ORDER BY r.created_at DESC`
    );
    res.json(result.rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Trasy se nepodařilo načíst.' });
  }
});

app.get('/api/routes/:id', async (req, res) => {
  try {
    const routeResult = await pool.query(
      `SELECT r.id, r.name, r.description, r.points, r.distance_km, r.elev_gain_m, r.created_at,
              u.id AS owner_id, u.display_name AS owner_display
       FROM routes r JOIN users u ON u.id = r.owner_id
       WHERE r.id = $1`,
      [req.params.id]
    );
    const route = routeResult.rows[0];
    if (!route) return res.status(404).json({ error: 'Trasa nenalezena.' });
    const photosResult = await pool.query(
      'SELECT id, data_url, is_main FROM photos WHERE route_id = $1 ORDER BY created_at ASC',
      [req.params.id]
    );
    res.json({ route, photos: photosResult.rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Trasu se nepodařilo načíst.' });
  }
});

app.post('/api/routes', requireAuth, async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const description = String(req.body.description || '').trim();
    const points = Array.isArray(req.body.points) ? req.body.points : [];
    if (!name) return res.status(400).json({ error: 'Zadejte název trasy.' });
    if (points.length < 2) return res.status(400).json({ error: 'GPX soubor neobsahuje použitelnou trasu.' });
    const clean = points
      .map(p => [Number(p[0]), Number(p[1]), p[2] == null ? null : Number(p[2])])
      .filter(p => Number.isFinite(p[0]) && Number.isFinite(p[1]));
    const stats = computeStats(clean);
    const result = await pool.query(
      `INSERT INTO routes (owner_id, name, description, points, distance_km, elev_gain_m)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, name, description, points, distance_km, elev_gain_m, created_at`,
      [req.user.id, name, description, JSON.stringify(clean), stats.distanceKm, stats.elevGainM]
    );
    const route = result.rows[0];
    route.owner_id = req.user.id;
    route.owner_display = req.user.displayName;
    res.status(201).json(route);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Trasu se nepodařilo uložit.' });
  }
});

// ---------------------------------------------------------------
// Fotky
// ---------------------------------------------------------------
app.post('/api/routes/:id/photos', requireAuth, upload.single('photo'), async (req, res) => {
  try {
    const routeResult = await pool.query('SELECT owner_id FROM routes WHERE id = $1', [req.params.id]);
    const route = routeResult.rows[0];
    if (!route) return res.status(404).json({ error: 'Trasa nenalezena.' });
    if (route.owner_id !== req.user.id) return res.status(403).json({ error: 'Fotky může přidávat jen vlastník trasy.' });
    if (!req.file) return res.status(400).json({ error: 'Nahrajte obrázek.' });
    if (req.file.size > MAX_PHOTO_BYTES) return res.status(400).json({ error: 'Obrázek je příliš velký (max 3 MB).' });

    const countResult = await pool.query('SELECT COUNT(*)::int AS n FROM photos WHERE route_id = $1', [req.params.id]);
    if (countResult.rows[0].n >= MAX_PHOTOS_PER_ROUTE) {
      return res.status(400).json({ error: 'Trasa už má maximální počet fotek (3).' });
    }
    const dataUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    const makeMain = countResult.rows[0].n === 0;
    const inserted = await pool.query(
      'INSERT INTO photos (route_id, data_url, is_main) VALUES ($1,$2,$3) RETURNING id, data_url, is_main',
      [req.params.id, dataUrl, makeMain]
    );
    res.status(201).json(inserted.rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Fotku se nepodařilo nahrát.' });
  }
});

app.patch('/api/routes/:id/photos/:photoId/main', requireAuth, async (req, res) => {
  try {
    const routeResult = await pool.query('SELECT owner_id FROM routes WHERE id = $1', [req.params.id]);
    const route = routeResult.rows[0];
    if (!route) return res.status(404).json({ error: 'Trasa nenalezena.' });
    if (route.owner_id !== req.user.id) return res.status(403).json({ error: 'Hlavní fotku může měnit jen vlastník trasy.' });
    await pool.query('UPDATE photos SET is_main = (id = $1) WHERE route_id = $2', [req.params.photoId, req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Nepodařilo se nastavit hlavní fotku.' });
  }
});

app.delete('/api/routes/:id/photos/:photoId', requireAuth, async (req, res) => {
  try {
    const routeResult = await pool.query('SELECT owner_id FROM routes WHERE id = $1', [req.params.id]);
    const route = routeResult.rows[0];
    if (!route) return res.status(404).json({ error: 'Trasa nenalezena.' });
    if (route.owner_id !== req.user.id) return res.status(403).json({ error: 'Fotky může mazat jen vlastník trasy.' });
    const photoResult = await pool.query('SELECT is_main FROM photos WHERE id = $1 AND route_id = $2', [req.params.photoId, req.params.id]);
    if (!photoResult.rows[0]) return res.status(404).json({ error: 'Fotka nenalezena.' });
    const wasMain = photoResult.rows[0].is_main;
    await pool.query('DELETE FROM photos WHERE id = $1', [req.params.photoId]);
    if (wasMain) {
      const remaining = await pool.query('SELECT id FROM photos WHERE route_id = $1 ORDER BY created_at ASC LIMIT 1', [req.params.id]);
      if (remaining.rows[0]) await pool.query('UPDATE photos SET is_main = true WHERE id = $1', [remaining.rows[0].id]);
    }
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Fotku se nepodařilo smazat.' });
  }
});

// ---------------------------------------------------------------
// Smazání trasy
// ---------------------------------------------------------------
app.delete('/api/routes/:id', requireAuth, async (req, res) => {
  try {
    const routeResult = await pool.query('SELECT owner_id FROM routes WHERE id = $1', [req.params.id]);
    const route = routeResult.rows[0];
    if (!route) return res.status(404).json({ error: 'Trasa nenalezena.' });
    if (route.owner_id !== req.user.id) return res.status(403).json({ error: 'Trasu může smazat jen vlastník.' });
    await pool.query('DELETE FROM routes WHERE id = $1', [req.params.id]); // fotky se smažou kaskádově
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Trasu se nepodařilo smazat.' });
  }
});

// ---------------------------------------------------------------
// Handlery pro API chybějící cesty & statické soubory
// ---------------------------------------------------------------
app.use('/api', (req, res) => res.status(404).json({ error: 'Neznámý endpoint.' }));

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err) {
    return res.status(400).json({ error: 'Soubor se nepodařilo zpracovat (možná je moc velký).' });
  }
  next(err);
});

initDb()
  .then(() => {
    app.listen(PORT, () => console.log(`CendurOFF backend běží na portu ${PORT}`));
  })
  .catch(err => {
    console.error('Nepodařilo se připojit k databázi:', err);
    process.exit(1);
  });
