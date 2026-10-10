CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
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

CREATE INDEX IF NOT EXISTS idx_routes_owner ON routes(owner_id);
CREATE INDEX IF NOT EXISTS idx_photos_route ON photos(route_id);
