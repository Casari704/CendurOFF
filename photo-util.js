// Společné ověření fotek poslaných jako data URL (články, místa, akce) – v4.72
const { detectImageType } = require('./security');
const DATA_URL = /^data:image\/(jpeg|png|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$/;
const MAX_PHOTO_BYTES = 1500000;

// vrací { bufs:[{type,buf}] } nebo { error }
function decodePhotos(list) {
  const bufs = [];
  for (const d of list) {
    const m = DATA_URL.exec(String(d));
    if (!m) return { error: 'Fotka není platný obrázek.' };
    const buf = Buffer.from(m[2], 'base64');
    const type = detectImageType(buf);
    if (!type) return { error: 'Fotka není platný obrázek.' };
    if (buf.length > MAX_PHOTO_BYTES) return { error: 'Fotka je příliš velká (nejvýš 1,5 MB).' };
    bufs.push({ type, buf });
  }
  return { bufs };
}

// Úprava fotek existujícího záznamu: zachová jen `keep` (pole id), přidá nové.
// table = post_photos / place_photos, col = post_id / place_id. Vrací chybu (text) nebo null.
async function syncPhotos(pool, table, col, id, body, max) {
  const ex = (await pool.query(`SELECT id FROM ${table} WHERE ${col} = $1`, [id])).rows.map(r => r.id);
  const keep = Array.isArray(body.keep) ? ex.filter(x => body.keep.map(Number).includes(x)) : ex;
  const add = Array.isArray(body.photos) ? body.photos : [];
  if (keep.length + add.length > max) return 'Nejvýš ' + max + ' fotek.';
  const dec = decodePhotos(add);
  if (dec.error) return dec.error;
  const drop = ex.filter(x => !keep.includes(x));
  if (drop.length) await pool.query(`DELETE FROM ${table} WHERE ${col} = $1 AND id = ANY($2::int[])`, [id, drop]);
  let pos = (await pool.query(`SELECT COALESCE(MAX(pos), -1) + 1 AS n FROM ${table} WHERE ${col} = $1`, [id])).rows[0].n;
  for (const b of dec.bufs) await pool.query(`INSERT INTO ${table} (${col}, pos, mime, data) VALUES ($1,$2,$3,$4)`, [id, pos++, b.type, b.buf]);
  return null;
}

module.exports = { decodePhotos, syncPhotos, MAX_PHOTO_BYTES };
