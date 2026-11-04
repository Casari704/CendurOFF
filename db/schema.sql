CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  is_approved BOOLEAN NOT NULL DEFAULT false,
  role TEXT NOT NULL DEFAULT 'user',   -- 'user' nebo 'admin'
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  gpx_updated_at TIMESTAMPTZ,
  route_type TEXT NOT NULL DEFAULT 'offroad'
);

CREATE TABLE IF NOT EXISTS photos (
  id SERIAL PRIMARY KEY,
  route_id INTEGER NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  data_url TEXT NOT NULL,
  is_main BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ratings (
  route_id INTEGER NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stars SMALLINT NOT NULL CHECK (stars BETWEEN 1 AND 5),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (route_id, user_id)
);

-- Textové recenze: jedna recenze na uživatele a trasu (opakované uložení = úprava té stávající).
CREATE TABLE IF NOT EXISTS reviews (
  id SERIAL PRIMARY KEY,
  route_id INTEGER NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (route_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_routes_owner ON routes(owner_id);
CREATE INDEX IF NOT EXISTS idx_photos_route ON photos(route_id);
CREATE INDEX IF NOT EXISTS idx_reviews_route ON reviews(route_id);

-- Roadbook (v2.0): jeden roadbook na trasu. Zakládá ho sám server (roadbook-api.js),
-- stávající tabulky se nemění. route_fp = md5 bodů trasy v okamžiku uložení
-- (když se GPX trasy později změní, roadbook se hlásí jako NOT ready).
CREATE TABLE IF NOT EXISTS roadbooks (
  id SERIAL PRIMARY KEY,
  route_id INTEGER NOT NULL UNIQUE REFERENCES routes(id) ON DELETE CASCADE,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft',   -- 'draft' (NOT ready) / 'ready'
  data JSONB NOT NULL,
  route_fp TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- v2.5: smazané trasy zůstávají v archivu (vidí je jen admin), viz admin-api.js
ALTER TABLE routes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE routes ADD COLUMN IF NOT EXISTS deleted_by INTEGER;

-- v2.5: projetí tras (aspoň 20 % trasy, nejvýš 1× za 24 h na uživatele a trasu)
CREATE TABLE IF NOT EXISTS route_rides (
  id SERIAL PRIMARY KEY,
  route_id INTEGER NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  coverage REAL,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_route_rides_route ON route_rides(route_id, created_at);
CREATE INDEX IF NOT EXISTS idx_route_rides_user ON route_rides(user_id, route_id, created_at);

-- v2.9: poslední přihlášení / aktivita uživatele
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
