// ---------------------------------------------------------------
// CendurOFF – bezpečnostní pomocné funkce (v4.58)
//
//  - CORS jen pro naše weby (a Origin kontrola u zápisů – ochrana proti CSRF)
//  - kontrola fotek: jen skutečné obrázky (podle obsahu, ne podle toho, co tvrdí klient)
//  - limit pro nepřihlášené na mapová data (po vyčerpání se ukáže přihlášení)
//
// Další povolené adresy webu jdou přidat v Railway proměnnou CORS_ORIGINS
// (adresy oddělené čárkou, např. https://nova-domena.cz,https://app.example.com).
// ---------------------------------------------------------------

const DEFAULT_ORIGINS = [
  'https://cenduroff.cz',
  'https://www.cenduroff.cz',
  'https://casari704.github.io'
];
const LOCAL_RE = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

function originList(env) {
  const extra = String((env && env.CORS_ORIGINS) || '').split(',').map(s => s.trim().replace(/\/+$/, '')).filter(Boolean);
  return DEFAULT_ORIGINS.concat(extra);
}

// bez hlavičky Origin (server-server, curl, aplikace bez Origin) = povoleno; s Origin jen ze seznamu
function isAllowedOrigin(origin, list) {
  if (!origin) return true;
  const o = String(origin).replace(/\/+$/, '');
  return list.includes(o) || LOCAL_RE.test(o);
}

function corsOptions(list, onBlocked) {
  return {
    origin(origin, cb) {
      const ok = isAllowedOrigin(origin, list);
      if (!ok && onBlocked) onBlocked(origin);
      cb(null, ok);
    },
    credentials: true
  };
}

// zápisy (POST/PUT/PATCH/DELETE) z cizího webu server vůbec nevykoná
function originGuard(list, onBlocked) {
  return function (req, res, next) {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
    const origin = req.headers.origin;
    if (isAllowedOrigin(origin, list)) return next();
    if (onBlocked) onBlocked(origin);
    res.status(403).json({ error: 'Požadavek z nepovolené adresy.' });
  };
}

// ---------- fotky ----------
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// pozná typ obrázku podle prvních bajtů; neznámé = null
function detectImageType(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf[0] === 0x89 && buf.toString('latin1', 1, 4) === 'PNG') return 'image/png';
  if (buf.toString('latin1', 0, 3) === 'GIF') return 'image/gif';
  if (buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

// bezpečná fotka v databázi: data:image/…;base64,… a nic jiného (starší záznamy se kontrolují při čtení)
const SAFE_DATA_URL = /^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/;
function isSafeDataUrl(s) { return typeof s === 'string' && SAFE_DATA_URL.test(s); }

// ---------- limit pro nepřihlášené ----------
// isLoggedIn(req) → true/false; přihlášený projde bez omezení. Počítá se podle IP adresy.
function anonLimiter({ windowMs, max, isLoggedIn }) {
  const hits = new Map();   // ip -> { n, reset }
  return function (req, res, next) {
    if (isLoggedIn(req)) return next();
    const ip = req.ip || (req.socket && req.socket.remoteAddress) || 'neznama';
    const now = Date.now();
    let h = hits.get(ip);
    if (!h || now >= h.reset) { h = { n: 0, reset: now + windowMs }; hits.set(ip, h); }
    h.n++;
    if (hits.size > 20000) { for (const [k, v] of hits) if (now >= v.reset) hits.delete(k); }
    if (h.n > max) {
      res.set('Retry-After', String(Math.ceil((h.reset - now) / 1000)));
      return res.status(429).json({
        error: 'Pro další mapová data se přihlas – je to zdarma, jen pro členy.',
        needsLogin: true
      });
    }
    next();
  };
}

module.exports = {
  originList, isAllowedOrigin, corsOptions, originGuard,
  IMAGE_TYPES, detectImageType, isSafeDataUrl, SAFE_DATA_URL,
  anonLimiter
};
