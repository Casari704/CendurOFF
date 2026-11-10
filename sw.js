// ---------------------------------------------------------------
// CendurOFF – service worker (v2.5): offline režim aplikace
//
//  - stránky a skripty: VŽDY nejdřív z webu (máš-li signál, máš novou verzi); když web
//    neodpoví, použije se uložená kopie → aplikace se otevře i bez dat
//  - mapové dlaždice: uloží se ty, které sis prohlédl (ne hromadné stahování), max ~4000 kusů
//  - API serveru (Railway) se neukládá – data tras pro offline ukládá Roadbook NAVI samo
//
// Při každém vydání nové verze webu zvyš VERSION – telefonům se pak ukáže
// „Je dostupná nová verze – Obnovit“.
// ---------------------------------------------------------------
const VERSION = '4.0.1';
const APP_CACHE = 'cenduroff-app-' + VERSION;
const CDN_CACHE = 'cenduroff-cdn-v1';
const TILE_CACHE = 'cenduroff-tiles-v1';
const TILE_MAX = 4000;
const NET_TIMEOUT_MS = 4000;

const CORE = [
  './', 'index.html', 'planovac.html', 'merch.html', 'faq.html', 'nastaveni.html', 'admin.html',
  'roadbook-planner.html', 'roadbook-navi.html', 'manifest.webmanifest',
  'public/style.css', 'public/planner.css', 'public/merch.css', 'public/faq.css', 'public/settings.css', 'public/rb.css',
  'public/config.js', 'public/header.js', 'public/pwa.js', 'public/app.js', 'public/planner.js',
  'public/planner-profile.js', 'public/regiondata.js', 'public/fuel.js', 'public/chko.js',
  'public/rb-core.js', 'public/rb-planner.js', 'public/rb-navi.js', 'public/ride-stats.js', 'public/sound.js', 'public/settings.js', 'public/zoom.js', 'public/basemaps.js', 'public/gps.js',
  'public/img/pms-logo.png', 'public/img/gps-arrow.png', 'public/img/icon-locate.png',
  'public/img/icon-192.png', 'public/img/icon-512.png', 'public/img/cenduroff-logo.png'
];
const TILE_HOSTS = /(^|\.)tile\.openstreetmap\.org$|tile\.opentopomap\.org$|server\.arcgisonline\.com$|ags\.cuzk\.gov\.cz$/;
const CDN_HOSTS = /cdnjs\.cloudflare\.com$|fonts\.googleapis\.com$|fonts\.gstatic\.com$/;

self.addEventListener('install', e => {
  // jednotlivě (a bez pádu), ať jeden chybějící soubor nezastaví celou instalaci
  e.waitUntil(caches.open(APP_CACHE).then(c => Promise.all(CORE.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => null)))));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('cenduroff-app-') && k !== APP_CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('message', e => { if(e.data === 'skipWaiting') self.skipWaiting(); });

function timeout(ms){ return new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)); }

// stránky a skripty: síť → jinak uložená kopie (dotaz ?v=… se při hledání v cache ignoruje)
async function networkFirst(req){
  const cache = await caches.open(APP_CACHE);
  try{
    const res = await Promise.race([fetch(req), timeout(NET_TIMEOUT_MS)]);
    if(res && res.ok) cache.put(req, res.clone()).catch(() => {});
    return res;
  }catch(err){
    const hit = await cache.match(req, { ignoreSearch: true });
    if(hit) return hit;
    if(req.mode === 'navigate'){ const idx = await cache.match('index.html'); if(idx) return idx; }
    throw err;
  }
}
// knihovny a písma: uložená kopie hned, na pozadí se obnoví
async function staleWhileRevalidate(req, cacheName){
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  const net = fetch(req).then(res => { if(res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()).catch(() => {}); return res; }).catch(() => null);
  return hit || (await net) || Response.error();
}
// dlaždice: uložená kopie, jinak síť (a uložit); občas promazat nejstarší
let tilePuts = 0;
async function tile(req){
  const cache = await caches.open(TILE_CACHE);
  const hit = await cache.match(req);
  if(hit) return hit;
  try{
    const res = await fetch(req);
    if(res && (res.ok || res.type === 'opaque')){
      cache.put(req, res.clone()).catch(() => {});
      if(++tilePuts % 200 === 0) trimTiles(cache);
    }
    return res;
  }catch(err){ return Response.error(); }
}
async function trimTiles(cache){
  const keys = await cache.keys();
  if(keys.length > TILE_MAX) await Promise.all(keys.slice(0, keys.length - TILE_MAX).map(k => cache.delete(k)));
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);
  if(url.origin === self.location.origin){
    if(url.pathname.endsWith('/sw.js')) return;
    e.respondWith(networkFirst(req));
    return;
  }
  if(TILE_HOSTS.test(url.hostname)){ e.respondWith(tile(req)); return; }
  if(CDN_HOSTS.test(url.hostname)){ e.respondWith(staleWhileRevalidate(req, CDN_CACHE)); return; }
  // ostatní (API serveru, OpenStreetMap Overpass, BRouter…) jdou rovnou na síť
});
