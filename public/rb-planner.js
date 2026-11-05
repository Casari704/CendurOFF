(function(){
// ===============================================================
// CendurOFF – Roadbook planner (roadbook-planner.html), v2.1
//
// Samostatná stránka: trasy jen ČTE (/api/routes), roadbook ukládá do vlastní
// tabulky (/api/roadbooks/:id). Atlas ani Plánovač neovlivňuje.
// ===============================================================
// v2.1: výběr trasy z mapy, rozpracované roadbooky v paměti, obrácení směru,
//       dotaz před stažením OSM s průběhem a zrušením, uložená OSM data v prohlížeči
const RB = window.CendurRB;
const API_URL = window.CENDUROFF_API_URL || 'https://cenduroff-web.up.railway.app';
const LAST_KEY = 'cenduroff.rb.lastRoute';   // jen pro informaci, trasa se po otevření stránky vybírá na mapě
const SHARED_BASE_KEY = 'baseMap';

// ---------------------------------------------------------------
// Pomocné
// ---------------------------------------------------------------
function toast(msg, ms){
  const t = document.getElementById('toast');
  t.textContent = msg; t.style.display = 'block';
  clearTimeout(toast._h); toast._h = setTimeout(()=>{ t.style.display = 'none'; }, ms || 3200);
}
window.toast = window.toast || toast;
async function api(url, options){
  const o = Object.assign({ credentials:'include' }, options);
  let t = null; try{ t = localStorage.getItem('cenduroff.token'); }catch(e){}
  if(t) o.headers = Object.assign({}, o.headers, { Authorization:'Bearer ' + t });
  const res = await fetch(API_URL + url, o);
  let data = null, isJson = false;
  try{ data = await res.json(); isJson = true; }catch(e){}
  if(!res.ok) throw new Error((data && data.error) || 'Něco se pokazilo.');
  if(!isJson) throw new Error('Server neodpověděl správně (zkus to prosím za chvíli).');
  return data;
}
const $ = id => document.getElementById(id);
const esc = RB.esc;
let busyCancel = null;
function busy(text, onCancel){
  $('rb-busy-text').textContent = text || 'Pracuji…';
  busyCancel = onCancel || null;
  $('rb-busy-cancel').hidden = !onCancel;
  $('rb-busy').classList.add('open');
}
function unbusy(){ $('rb-busy').classList.remove('open'); busyCancel = null; }
$('rb-busy-cancel').addEventListener('click', () => { if(busyCancel) busyCancel(); });
// nabídka „Nástroje ▾“
(function moreMenu(){
  const btn = $('rb-more-btn'), list = $('rb-more-list');
  const set = open => { list.hidden = !open; btn.setAttribute('aria-expanded', open ? 'true' : 'false'); };
  btn.addEventListener('click', e => { e.stopPropagation(); set(list.hidden); });
  list.addEventListener('click', () => set(false));
  document.addEventListener('click', e => { if(!list.hidden && !list.contains(e.target)) set(false); });
  document.addEventListener('keydown', e => { if(e.key === 'Escape') set(false); });
})();
function openModal(id){ $(id).classList.add('open'); }
function closeModal(id){ $(id).classList.remove('open'); }
document.querySelectorAll('.modal-overlay').forEach(ov => {
  ov.addEventListener('click', e => { if(e.target === ov || e.target.closest('[data-close]')) ov.classList.remove('open'); });
});

// ---------------------------------------------------------------
// Stav
// ---------------------------------------------------------------
let currentUser = null;
let routes = [];              // seznam tras z /api/routes
let rbSummary = {};           // route_id -> { status, stale, ... }
let route = null;             // otevřená trasa
let R = null;                 // připravená geometrie trasy (RB.prepareRoute)
let items = [];               // instrukce roadbooku (včetně smazaných automatických)
let selId = null;
let dirty = false;
let canEdit = false;
let status = 'draft';         // uložený / nastavovaný stav
let saved = false;            // existuje roadbook v DB?
let settings = { minAngle: 30 };
let filter = 'all';
let addMode = false;
let pickMode = true;          // výběr trasy na mapě
const sessions = new Map();   // route_id -> rozpracovaný stav (přepnutí na jinou trasu nic neztratí)
const DRAFT_PREFIX = 'cenduroff.rb.draft.';


// ---------------------------------------------------------------
// Mapa
// ---------------------------------------------------------------
const map = L.map('rb-map', { zoomControl:true }).setView([49.8711, 17.8756], 12);
const baseLayers = {
  osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:19, attribution:'© OpenStreetMap contributors' }),
  topo: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { maxZoom:19, maxNativeZoom:17, attribution:'© OpenStreetMap contributors, SRTM | © OpenTopoMap (CC-BY-SA)' }),
  sat: L.layerGroup([
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom:19, attribution:'Tiles © Esri' }),
    L.tileLayer('https://ags.cuzk.gov.cz/arcgis1/rest/services/ORTOFOTO_WM/MapServer/tile/{z}/{y}/{x}', { maxZoom:19, maxNativeZoom:20, attribution:'Ortofoto © ČÚZK' })
  ])
};
let currentBase = (()=>{ try{ return localStorage.getItem(SHARED_BASE_KEY); }catch(e){ return null; } })();
if(!baseLayers[currentBase]) currentBase = 'osm';
baseLayers[currentBase].addTo(map);
$('rb-base').value = currentBase;
$('rb-base').addEventListener('change', e => {
  const k = e.target.value;
  if(!baseLayers[k] || k === currentBase) return;
  map.removeLayer(baseLayers[currentBase]); currentBase = k; baseLayers[k].addTo(map);
  try{ localStorage.setItem(SHARED_BASE_KEY, k); }catch(err){}
});

let routeLine = null, routeHit = null;
const markerLayer = L.layerGroup().addTo(map);
const markers = new Map();

function drawRoute(fit){
  if(routeLine) map.removeLayer(routeLine);
  if(routeHit) map.removeLayer(routeHit);
  const ll = R.lat.map((la, i) => [la, R.lon[i]]);
  routeLine = L.polyline(ll, { color:'#4F7048', weight:6, opacity:.95 }).addTo(map);
  // širší neviditelná čára pro snadné klikání
  routeHit = L.polyline(ll, { color:'#000', weight:22, opacity:0, bubblingMouseEvents:false }).addTo(map);
  routeHit.on('click', e => { if(canEdit && !pickMode) addAt(e.latlng); });
  if(fit !== false) map.fitBounds(routeLine.getBounds(), { padding:[30, 30] });
}
map.on('click', e => {
  if(!addMode || !R || pickMode) return;
  addAt(e.latlng);
});
$('rb-add').addEventListener('click', () => {
  if(!R) return toast('Nejdřív vyber trasu.');
  if(!canEdit) return toast('Roadbook téhle trasy upravovat nemůžeš.');
  addMode = !addMode;
  document.body.classList.toggle('rb-adding', addMode);
  $('rb-add').textContent = addMode ? 'Klikni na místo na trase…' : '+ Přidat instrukci';
});

function markerIcon(it, on){
  const cls = 'rb-mk' + (on ? ' on' : '') + (it.review ? ' review' : '') + (it.kind ? ' kind' : '');
  const z = on ? 34 : 26;
  const txt = it.kind === 'start' ? 'S' : it.kind === 'finish' ? 'C' : it.n;
  return L.divIcon({ className:'', html:'<div class="' + cls + '">' + txt + '</div>', iconSize:[z, z], iconAnchor:[z/2, z/2] });
}
function drawMarkers(){
  markerLayer.clearLayers(); markers.clear();
  RB.visible(items).forEach(it => {
    const m = L.marker([it.lat, it.lon], { icon: markerIcon(it, it.id === selId), draggable: canEdit && !it.kind, zIndexOffset: it.id === selId ? 1000 : 0, keyboard:false });
    m.on('click', () => select(it.id, false));
    m.on('dragend', () => {
      const p = m.getLatLng(), pr = RB.project(R, p.lat, p.lng);
      const q = RB.pointAt(R, pr.s);
      it.s = pr.s; it.lat = +q[0].toFixed(6); it.lon = +q[1].toFixed(6);
      touch(it); RB.recompute(R, items);
      renderAll();
    });
    m.bindTooltip(esc(RB.label(it)), { direction:'top', offset:[0, -12] });
    m.addTo(markerLayer); markers.set(it.id, m);
  });
}

function addAt(latlng){
  const p = RB.project(R, latlng.lat, latlng.lng);
  if(p.dist > 60){ toast('Klikni blíž k trase.'); return; }
  const q = RB.pointAt(R, p.s);
  const it = { id: RB.uid(), s: p.s, lat: +q[0].toFixed(6), lon: +q[1].toFixed(6), exit: 0, sides: [], round: false, icons: [], danger: 0, road: null,
    note: '', sub: '', src: 'manual', edited: true, review: false, deleted: false };
  items.push(it); RB.recompute(R, items);
  addMode = false; document.body.classList.remove('rb-adding'); $('rb-add').textContent = '+ Přidat instrukci';
  markDirty(); select(it.id, false); renderAll();
}

// ---------------------------------------------------------------
// Seznam příkazů
// ---------------------------------------------------------------
document.querySelectorAll('#rb-filters button').forEach(b => b.addEventListener('click', () => {
  filter = b.dataset.f;
  document.querySelectorAll('#rb-filters button').forEach(x => x.classList.toggle('on', x === b));
  renderList();
}));
function tagOf(it){
  if(it.review) return '<span class="tag review">KONTROLA</span>';
  if(it.src === 'manual') return '<span class="tag manual">RUČNĚ</span>';
  if(it.edited) return '<span class="tag edited">UPRAVENO</span>';
  return '<span class="tag">AUTO</span>';
}
function renderList(){
  const vis = RB.visible(items);
  const nRev = vis.filter(i => i.review).length, nMan = vis.filter(i => i.src === 'manual' || i.edited).length;
  $('rb-count').textContent = '(' + vis.length + ')';
  const fb = document.querySelectorAll('#rb-filters button');
  fb[1].textContent = 'Ke kontrole (' + nRev + ')';
  fb[2].textContent = 'Ruční / upravené (' + nMan + ')';
  const list = vis.filter(it => filter === 'all' || (filter === 'review' ? it.review : (it.src === 'manual' || it.edited)));
  if(!R){ return; }
  if(!list.length){
    $('rb-rows').innerHTML = '<div class="rb-empty">' + (filter === 'all' ? 'Roadbook zatím není vygenerovaný.' + (canEdit ? '<br><br><button class="btn-rb go" type="button" id="rb-empty-gen">Vygenerovat roadbook</button>' : '') : 'Nic takového tu není.') + '</div>';
    const eg = $('rb-empty-gen'); if(eg) eg.addEventListener('click', async () => { const c = await askGenerate('new'); if(c) await runGenerate(c, false, false); });
    return;
  }
  $('rb-rows').innerHTML = list.map(it => '<button type="button" class="rb-row' + (it.id === selId ? ' on' : '') + '" data-id="' + it.id + '">' +
    '<span class="n">#' + it.n + '</span><span class="km">' + RB.fmtKm(it.s) + '</span>' + RB.tulipSVG(it, 42) +
    '<span class="tx"><b>' + (it.danger ? RB.DANGER[it.danger].mark + ' ' : '') + esc(RB.label(it)) + '</b><span>' + esc(RB.subLabel(it)) + '</span></span>' +
    tagOf(it) + '</button>').join('');
  $('rb-rows').querySelectorAll('.rb-row').forEach(b => b.addEventListener('click', () => select(b.dataset.id, true)));
}

function select(id, pan){
  selId = id;
  const it = items.find(x => x.id === id);
  if(it && pan) map.panTo([it.lat, it.lon]);
  renderList(); drawMarkers(); renderEditor();
  const row = $('rb-rows').querySelector('.rb-row.on');
  if(row && !pan) row.scrollIntoView({ block:'nearest' });
}

// ---------------------------------------------------------------
// Editor instrukce
// ---------------------------------------------------------------
function touch(it){ if(it.src === 'auto') it.edited = true; markDirty(); }
function markDirty(){ dirty = true; renderStatus(); saveDraftSoon(); }
// neuložený roadbook se průběžně ukládá i do prohlížeče (přežije zavření stránky)
let draftTimer = null;
function saveDraftSoon(){
  clearTimeout(draftTimer);
  draftTimer = setTimeout(saveDraftNow, 800);
}
function saveDraftNow(){
  if(!route || !canEdit) return;
  try{
    if(dirty) localStorage.setItem(DRAFT_PREFIX + route.id, JSON.stringify({ t: Date.now(), items: cleanItems(), settings, status }));
    else localStorage.removeItem(DRAFT_PREFIX + route.id);
  }catch(e){}
}
function hasDraft(id){ try{ return !!localStorage.getItem(DRAFT_PREFIX + id); }catch(e){ return false; } }
function readDraft(id){ try{ return JSON.parse(localStorage.getItem(DRAFT_PREFIX + id) || 'null'); }catch(e){ return null; } }

function tulipEditorSVG(it){
  const g = RB.tulipGeom(it.exit, it.sides, it.round);
  const pos = a => [50 + Math.sin(a * Math.PI/180) * (a === it.exit ? 40 : 36), 50 - Math.cos(a * Math.PI/180) * (a === it.exit ? 40 : 36)];
  let h = '<svg id="rb-tulip" viewBox="0 0 100 100" role="img" aria-label="Tulipán – táhni konce ramen">';
  h += '<circle cx="50" cy="50" r="40" fill="none" stroke="#EEE" stroke-width="1"/>';
  if(g.side) h += '<path d="' + g.side + '" stroke="#8F8F8F" stroke-width="6" stroke-linecap="round" fill="none"/>';
  h += '<path d="' + g.main + '" stroke="#111" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>';
  h += '<path d="' + g.head + '" fill="#111" stroke="#111" stroke-width="3" stroke-linejoin="round"/><circle cx="50" cy="90" r="7" fill="#111"/>';
  if(canEdit && !it.kind){
    (it.sides || []).forEach((a, k) => { const p = [50 + Math.sin(a*Math.PI/180)*36, 50 - Math.cos(a*Math.PI/180)*36];
      h += '<circle class="hdl" data-h="s' + k + '" cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="7" fill="#fff" stroke="#8F8F8F" stroke-width="3"/>'; });
    const e = pos(it.exit);
    h += '<circle class="hdl" data-h="e" cx="' + e[0].toFixed(1) + '" cy="' + e[1].toFixed(1) + '" r="8" fill="#FFF1C2" stroke="#F5B700" stroke-width="3" stroke-dasharray="3 2"/>';
  }
  return h + '</svg>';
}

function renderEditor(){
  const it = items.find(x => x.id === selId && !x.deleted);
  $('rb-ed-empty').hidden = !!it;
  $('rb-ed').hidden = !it;
  if(!it){ $('rb-ed').innerHTML = ''; return; }
  const vis = RB.visible(items); const v = vis.find(x => x.id === it.id) || it;
  const tplKey = it.kind ? null : (RB.TEMPLATES.find(t => !!t[4] === !!it.round && t[3].length === (it.sides||[]).length && t[3].every((a, i) => a === it.sides[i]) && (t[2] == null || t[2] === it.exit)) || [null])[0];
  let h = '';
  if(!canEdit) h += '<div class="rb-readonly">Jen pro čtení – roadbook téhle trasy může upravovat její autor (nebo admin).</div>';
  h += '<div class="rb-ed-head"><h2>' + (it.kind === 'start' ? 'Start' : it.kind === 'finish' ? 'Cíl' : 'Instrukce #' + v.n) + '</h2><span>km ' + RB.fmtKm(it.s) + ' · CAP ' + (it.cap || 0) + '°</span></div>';
  h += '<fieldset' + (canEdit ? '' : ' disabled') + '>';
  if(!it.kind){
    h += '<div class="rb-tulip-box">' + tulipEditorSVG(it) + '<div style="display:flex;flex-direction:column;gap:8px">' +
      '<div style="font-size:0.78rem;font-weight:600;color:#444;line-height:1.3">Táhni žlutý konec šipky (výjezd) nebo šedé konce odboček.</div>' +
      '<div class="rb-angle"><button class="rb-sm" type="button" data-a="-5" aria-label="Výjezd o 5° vlevo">−5°</button><output>' + (it.exit > 0 ? '+' : it.exit < 0 ? '−' : '') + Math.abs(it.exit) + '°</output><button class="rb-sm" type="button" data-a="5" aria-label="Výjezd o 5° vpravo">+5°</button></div>' +
      '<b style="text-transform:uppercase;font-size:0.9rem">' + esc(RB.dirName(it.exit, it.round)) + '</b></div></div>';
    h += '<div class="rb-sec"><div class="t">ODBOČKY <small>(ostatní cesty v křižovatce)</small></div><div class="rb-sides">' +
      (it.sides || []).map((a, k) => '<button type="button" data-rs="' + k + '" title="Odebrat">' + (a > 0 ? '+' : '') + a + '° ×</button>').join('') +
      '<button type="button" id="rb-add-side">+ odbočka</button></div></div>';
    h += '<div class="rb-sec"><div class="t">ŠABLONA KŘIŽOVATKY</div><div class="rb-grid t4">' +
      RB.TEMPLATES.map(t => '<button type="button" class="rb-tpl' + (tplKey === t[0] ? ' on' : '') + '" data-tpl="' + t[0] + '">' +
        RB.tulipSVG({ exit: t[2] == null ? it.exit : t[2], sides: t[3], round: !!t[4] }, 38) + '<span>' + esc(t[1]) + '</span></button>').join('') + '</div></div>';
  }
  h += '<div class="rb-sec"><div class="t">IKONY <small>(lze vybrat víc)</small></div><div class="rb-grid t6">' +
    RB.ICON_ORDER.map(k => { const on = (it.icons || []).includes(k);
      return '<button type="button" class="rb-ico' + (on ? ' on' : '') + '" data-ic="' + k + '" title="' + esc(RB.ICONS[k].name) + '" aria-label="' + esc(RB.ICONS[k].name) + '" aria-pressed="' + on + '">' + RB.iconSVG(k, 26, '#111') + '</button>'; }).join('') + '</div></div>';
  h += '<div class="rb-sec"><div class="t">NEBEZPEČÍ</div><div class="rb-seg">' +
    RB.DANGER.map((d, k) => '<button type="button" data-dg="' + k + '" class="' + ((it.danger || 0) === k ? 'on' + (k === 0 ? ' none' : '') : '') + '">' + (d.mark || 'Žádné') + '</button>').join('') + '</div></div>';
  h += '<div class="rb-sec"><label for="rb-road-sel">TYP CESTY ZA INSTRUKCÍ</label><select id="rb-road-sel"><option value="">— neurčeno —</option>' +
    RB.ROAD_ORDER.map(k => '<option value="' + k + '"' + (it.road === k ? ' selected' : '') + '>' + esc(RB.ROADS[k].name) + '</option>').join('') + '</select></div>';
  h += '<div class="rb-sec"><label for="rb-note">TEXT INSTRUKCE</label><input type="text" id="rb-note" maxlength="60" value="' + esc(it.note || '') + '" placeholder="' + esc(RB.label(Object.assign({}, it, { note:'' }))) + '">' +
    '<label for="rb-sub">DOPLŇUJÍCÍ POZNÁMKA</label><input type="text" id="rb-sub" maxlength="120" value="' + esc(it.sub || '') + '" placeholder="' + esc(RB.subLabel(Object.assign({}, it, { sub:'' })) || 'např. kamenitý sjezd, držet se vlevo') + '"></div>';
  h += '<label class="rb-check"><input type="checkbox" id="rb-review"' + (it.review ? ' checked' : '') + '> Ke kontrole</label>';
  h += '<div class="rb-ed-foot">' + (it.kind ? '<span></span>' : '<button class="btn-rb warn" id="rb-del" type="button">Smazat instrukci</button>') +
    '<span style="font-size:0.78rem;color:#555;align-self:center">' + (it.src === 'manual' ? 'přidáno ručně' : it.edited ? 'automaticky, upraveno' : 'automaticky') + '</span></div>';
  h += '</fieldset>';
  $('rb-ed').innerHTML = h;
  bindEditor(it);
}

function refreshAfterEdit(it, keepEditor){
  touch(it);
  renderList(); drawMarkers();
  if(!keepEditor) renderEditor();
}

function bindEditor(it){
  const ed = $('rb-ed');
  ed.querySelectorAll('[data-a]').forEach(b => b.addEventListener('click', () => {
    it.exit = Math.max(-180, Math.min(180, it.exit + Number(b.dataset.a))); refreshAfterEdit(it);
  }));
  ed.querySelectorAll('[data-rs]').forEach(b => b.addEventListener('click', () => {
    it.sides = it.sides.slice(); it.sides.splice(Number(b.dataset.rs), 1); refreshAfterEdit(it);
  }));
  const addSide = $('rb-add-side');
  if(addSide) addSide.addEventListener('click', () => {
    const cand = [-90, 90, 0, -45, 45, -135, 135];
    const a = cand.find(c => Math.abs(RB.angleDiff(c, it.exit)) > 25 && !(it.sides || []).some(x => Math.abs(RB.angleDiff(x, c)) < 25));
    it.sides = (it.sides || []).concat([a == null ? -90 : a]); refreshAfterEdit(it);
  });
  ed.querySelectorAll('[data-tpl]').forEach(b => b.addEventListener('click', () => {
    const t = RB.TEMPLATES.find(x => x[0] === b.dataset.tpl);
    it.sides = t[3].slice(); it.round = !!t[4]; if(t[2] != null) it.exit = t[2];
    refreshAfterEdit(it);
  }));
  ed.querySelectorAll('[data-ic]').forEach(b => b.addEventListener('click', () => {
    const k = b.dataset.ic; it.icons = (it.icons || []).slice();
    const i = it.icons.indexOf(k); if(i >= 0) it.icons.splice(i, 1); else it.icons.push(k);
    refreshAfterEdit(it);
  }));
  ed.querySelectorAll('[data-dg]').forEach(b => b.addEventListener('click', () => { it.danger = Number(b.dataset.dg); refreshAfterEdit(it); }));
  const road = $('rb-road-sel'); if(road) road.addEventListener('change', () => { it.road = road.value || null; refreshAfterEdit(it, true); });
  const note = $('rb-note'); if(note) note.addEventListener('input', () => { it.note = note.value; refreshAfterEdit(it, true); });
  const sub = $('rb-sub'); if(sub) sub.addEventListener('input', () => { it.sub = sub.value; refreshAfterEdit(it, true); });
  const rev = $('rb-review'); if(rev) rev.addEventListener('change', () => { it.review = rev.checked; refreshAfterEdit(it, true); });
  const del = $('rb-del'); if(del) del.addEventListener('click', () => {
    if(it.src === 'manual') items = items.filter(x => x !== it);
    else { it.deleted = true; }        // automatickou instrukci si pamatujeme jako smazanou, ať se po přegenerování nevrátí
    markDirty(); selId = null; renderAll();
  });
  // tažení ramen tulipánu
  const svg = $('rb-tulip');
  if(svg && canEdit && !it.kind){
    let drag = null;
    const angleFrom = ev => {
      const r = svg.getBoundingClientRect();
      const x = (ev.clientX - r.left) / r.width * 100 - 50, y = (ev.clientY - r.top) / r.height * 100 - 50;
      return Math.round(Math.atan2(x, -y) * 180 / Math.PI / 5) * 5;
    };
    svg.addEventListener('pointerdown', ev => {
      const h = ev.target.closest && ev.target.closest('.hdl');
      if(!h) return;
      drag = h.dataset.h; svg.setPointerCapture(ev.pointerId); ev.preventDefault();
    });
    svg.addEventListener('pointermove', ev => {
      if(!drag) return;
      let a = angleFrom(ev);
      if(a === -180) a = 180;
      if(drag === 'e'){
        // u vracáku drž stranu, ze které se táhne
        it.exit = a;
      } else {
        const k = Number(drag.slice(1)); it.sides = it.sides.slice(); it.sides[k] = a;
      }
      touch(it);
      const box = svg.parentNode; const tmp = document.createElement('div'); tmp.innerHTML = tulipEditorSVG(it);
      // překreslit jen tvar (ne celé SVG), ať tažení nepřeruší capture
      svg.innerHTML = tmp.firstChild.innerHTML;
      const out = $('rb-ed').querySelector('.rb-angle output'); if(out) out.textContent = (it.exit > 0 ? '+' : it.exit < 0 ? '−' : '') + Math.abs(it.exit) + '°';
    });
    const end = () => { if(!drag) return; drag = null; renderList(); drawMarkers(); renderEditor(); };
    svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end);
  }
}

// ---------------------------------------------------------------
// Stav roadbooku, uložení
// ---------------------------------------------------------------
function renderStatus(){
  const el = $('rb-status');
  if(!route){ el.className = 'rb-badge none'; el.textContent = '—'; $('rb-info').textContent = ''; return; }
  if(!saved){ el.className = 'rb-badge unsaved'; el.textContent = 'NEULOŽENO'; }
  else {
    // To check: některá místa čekají na kontrolu (po změně GPX nebo ručně označená)
    const st = items.some(it => it.review && !it.deleted) ? 'check' : (status === 'ready' ? 'ready' : 'draft');
    el.className = 'rb-badge ' + RB.STATES[st].css; el.textContent = 'ROADBOOK ' + RB.STATES[st].badge;
  }
  $('rb-info').textContent = RB.fmtKm(R ? R.total : 0) + ' km' + (dirty ? ' · neuložené změny' : '');
  $('rb-ready').textContent = status === 'ready' ? 'Vrátit na rozpracovaný' : 'Označit READY';
  ['rb-save','rb-ready','rb-regen','rb-reverse'].forEach(id => { $(id).hidden = !canEdit; });
  $('rb-more-btn').disabled = !route;
  $('rb-add').hidden = !canEdit || pickMode;
  $('rb-reverse').textContent = settings.reversed ? '⇄ Směr: obrácený' : '⇄ Obrátit směr';
  $('rb-save').disabled = !dirty && saved;
  $('rb-navi-link').href = 'roadbook-navi.html' + (route ? '?trasa=' + route.id : '');
}

function cleanItems(){
  return items.map(it => {
    const o = {};
    ['id','s','lat','lon','exit','sides','round','icons','danger','road','note','sub','src','edited','review','deleted','kind','cap'].forEach(k => { if(it[k] !== undefined) o[k] = it[k]; });
    o.s = Math.round(o.s * 10) / 10;
    return o;
  });
}
async function save(newStatus){
  if(!route || !canEdit) return false;
  const st = newStatus || status;
  try{
    busy('Ukládám roadbook…');
    const r = await api('/api/roadbooks/' + route.id, { method:'PUT', headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ status: st, data: { v: 1, settings, items: cleanItems() } }) });
    status = r.status; saved = true; dirty = false;
    const rc = items.filter(it => it.review && !it.deleted).length;
    rbSummary[route.id] = { route_id: route.id, status: r.status, stale: false, review_count: rc,
      state: rc > 0 ? 'check' : (r.status === 'ready' ? 'ready' : 'draft') };
    try{ localStorage.removeItem(DRAFT_PREFIX + route.id); }catch(e){}
    fillRouteSelect(); renderStatus(); drawAllRoutes();
    toast(st === 'ready' ? 'Uloženo – roadbook je READY.' : 'Roadbook uložen.');
    return true;
  }catch(e){ toast(e.message, 5000); return false; }
  finally{ unbusy(); }
}
$('rb-save').addEventListener('click', () => save());
$('rb-ready').addEventListener('click', async () => {
  if(status === 'ready'){ await save('draft'); return; }
  const rev = RB.visible(items).filter(i => i.review).length;
  if(rev && !confirm(rev + ' ' + (rev === 1 ? 'místo je' : 'míst je') + ' označeno „ke kontrole“. Přesto označit roadbook jako READY?')) return;
  await save('ready');
});
// rozpracovaný roadbook se ukládá do prohlížeče, takže zavření stránky o nic nepřipraví
window.addEventListener('beforeunload', () => { if(dirty) saveDraftNow(); });

// ---------------------------------------------------------------
// Generování
// ---------------------------------------------------------------
// Uložená OSM data pro trasu (IndexedDB) – stáhnou se jednou, pak je generování okamžité
function osmKey(){ return RB.routeKey(route.id, route.points); }
async function cachedOsm(){ return route ? await RB.store.get(osmKey()) : null; }

// Stažení OSM s průběhem a tlačítkem Zrušit. Vrací data, nebo null (zrušeno / chyba).
async function downloadOsmUi(){
  const ctl = new AbortController();
  const t0 = Date.now();
  let last = { chunk: 1, chunks: 1, totalBytes: 0 };
  const show = () => {
    const sec = Math.round((Date.now() - t0) / 1000);
    $('rb-busy-text').innerHTML = 'Stahuji cesty z OpenStreetMap…<br><b>dotaz ' + last.chunk + ' / ' + last.chunks + '</b> · staženo ' +
      (last.totalBytes / 1048576).toFixed(2).replace('.', ',') + ' MB · ' + sec + ' s<br><small>Server nejdřív data připraví (to trvá nejdéle), pak je teprve posílá.</small>';
  };
  busy('', () => ctl.abort());
  show();
  const tick = setInterval(show, 1000);
  try{
    const osm = await RB.downloadOsm(R, { signal: ctl.signal, onProgress: p => { last = p; show(); } });
    await RB.store.set(osmKey(), osm);
    return osm;
  }catch(e){
    if(e.name === 'AbortError') toast('Stahování zrušeno.', 3000);
    else toast('OpenStreetMap teď neodpovídá (' + e.message + '). Zkus to později přes „Vygenerovat znovu“.', 6500);
    return null;
  }finally{ clearInterval(tick); unbusy(); }
}

// Dialog „Vygenerovat roadbook“: zeptá se, jestli stahovat z OSM (s odhadem), nebo jen z GPX.
// mode: 'new' (trasa bez roadbooku), 'regen' (tlačítko), 'stale' (trasa se změnila), 'reverse'
function askGenerate(mode){
  return new Promise(async resolve => {
    const cached = await cachedOsm();
    const est = RB.estimateOsm(R);
    const intro = {
      new: 'Tahle trasa ještě nemá roadbook. Vygeneruju ho automaticky a pak ho doladíš.',
      regen: 'Roadbook se vygeneruje znovu.',
      stale: 'Trasa se od uložení roadbooku změnila. Roadbook přepočítám podle nové trasy – tvoje úpravy zůstanou, místa mimo trasu označím „ke kontrole“.',
      reverse: 'Směr trasy se obrátí (start ↔ cíl). Roadbook se vygeneruje pro nový směr; tvoje ruční úpravy zůstanou, ale označím je „ke kontrole“ (šipky v nich teď míří opačně).'
    }[mode];
    $('rb-gen-intro').textContent = intro;
    $('rb-gen-keep-box').hidden = mode !== 'regen';
    $('rb-minangle').value = String(settings.minAngle || 30);
    const osmInfo = cached
      ? 'Data z OpenStreetMap pro tuhle trasu už máš uložená v prohlížeči (' + new Date(cached.t).toLocaleDateString('cs-CZ') + ', ' + ((cached.bytes || 0) / 1048576).toFixed(2).replace('.', ',') + ' MB) – generování bude okamžité.'
      : 'Stažení z OpenStreetMap může chvíli trvat, ale roadbook bude výrazně přesnější – doplní se křižovatky s odbočkami, typ cesty, brody, závory, přejezdy a benzínky (jen ze zatáček GPX tohle nepoznám). Trasa ' + est.km.toFixed(1).replace('.', ',') + ' km = ' + est.queries + ' ' + (est.queries === 1 ? 'dotaz' : est.queries < 5 ? 'dotazy' : 'dotazů') +
        ' na server, obvykle ' + est.mbLow.toFixed(1).replace('.', ',') + '–' + est.mbHigh.toFixed(1).replace('.', ',') + ' MB, trvá to od pár vteřin po minutu (podle vytížení serveru). Stahování jde kdykoli zrušit.';
    $('rb-gen-osm').textContent = osmInfo;
    $('rb-gen-osm-btn').textContent = cached ? 'Vygenerovat (s uloženými daty OSM)' : 'Stáhnout z OSM a vygenerovat';
    $('rb-gen-redl').hidden = !cached;
    const done = v => { closeModal('rb-gen-overlay'); cleanup(); resolve(v); };
    const onOsm = () => done({ osm: cached ? 'cached' : 'download' });
    const onRedl = () => done({ osm: 'download' });
    const onGpx = () => done({ osm: 'none' });
    const onCancel = e => { if(e.target === $('rb-gen-overlay') || e.target.closest('[data-close]')) done(null); };
    function cleanup(){
      $('rb-gen-osm-btn').removeEventListener('click', onOsm);
      $('rb-gen-redl').removeEventListener('click', onRedl);
      $('rb-gen-gpx').removeEventListener('click', onGpx);
      $('rb-gen-overlay').removeEventListener('click', onCancel);
    }
    $('rb-gen-osm-btn').addEventListener('click', onOsm);
    $('rb-gen-redl').addEventListener('click', onRedl);
    $('rb-gen-gpx').addEventListener('click', onGpx);
    $('rb-gen-overlay').addEventListener('click', onCancel);
    openModal('rb-gen-overlay');
  });
}

// Vygeneruje roadbook podle volby z dialogu. keep = přenést ruční úpravy.
async function runGenerate(choice, keep, markReview){
  settings.minAngle = Number($('rb-minangle').value) || settings.minAngle || 30;
  let osm = null;
  if(choice.osm === 'cached') osm = await cachedOsm();
  else if(choice.osm === 'download'){
    osm = await downloadOsmUi();
    // zrušeno / chyba: stávající roadbook necháme být; nový (prázdný) uděláme aspoň ze zatáček GPX
    if(!osm && keep && items.length) return;
  }
  const wantedOsm = choice.osm !== 'none';
  busy('Hledám zatáčky a křižovatky…');
  let r;
  try{ r = await RB.generate(route.points, { minAngle: settings.minAngle, osm, reversed: !!settings.reversed }); }
  finally{ unbusy(); }
  const fresh = r.items;
  if(keep && items.length){
    // když OSM chybělo (zrušeno / chyba), stávající instrukce jen posuneme na trasu – ať se neztratí křižovatky
    items = (wantedOsm && !osm && !markReview) ? RB.reproject(R, items) : RB.remap(R, items, fresh, { markReview });
  } else {
    items = fresh;
  }
  selId = null; markDirty(); renderAll(); drawAllRoutes();
  const rev = RB.visible(items).filter(i => i.review).length;
  toast('Roadbook vygenerován' + (osm ? '' : ' jen ze zatáček GPX') + (keep ? ' – tvoje úpravy zůstaly' : '') + (rev ? '. Ke kontrole: ' + rev : '') + '.', 5000);
}

$('rb-regen').addEventListener('click', async () => {
  if(!route) return toast('Nejdřív vyber trasu.');
  const choice = await askGenerate('regen');
  if(!choice) return;
  const keep = document.querySelector('input[name=rb-gen-keep]:checked').value === 'keep';
  if(!keep && !confirm('Opravdu zahodit všechny ruční úpravy a začít od nuly?')) return;
  await runGenerate(choice, keep, false);
});

// obrácení směru (start ↔ cíl) – uloží se k roadbooku, NAVI pak jede opačně
$('rb-reverse').addEventListener('click', async () => {
  if(!route || !canEdit) return;
  const choice = await askGenerate('reverse');
  if(!choice) return;
  settings.reversed = !settings.reversed;
  R = RB.prepareRoute(route.points, settings.reversed);
  drawRoute(false);
  await runGenerate(choice, true, true);
  toast(settings.reversed ? 'Směr obrácen – start je teď na původním konci trasy.' : 'Směr vrácen na původní.', 4500);
});

// ---------------------------------------------------------------
// Otevření trasy
// ---------------------------------------------------------------
function statusText(id){
  const parts = [];
  const sm = rbSummary[id];
  parts.push(RB.STATES[RB.stateOf(sm)].label);
  const se = sessions.get(id);
  if((se && se.dirty) || hasDraft(id)) parts.push('rozpracováno');
  return parts.length ? ' · ' + parts.join(' · ') : '';
}
function fillRouteSelect(){
  const sel = $('rb-route'), cur = route ? String(route.id) : sel.value;
  const mine = currentUser ? routes.filter(r => r.owner_id === currentUser.id) : [];
  const others = routes.filter(r => !currentUser || r.owner_id !== currentUser.id);
  const opt = r => '<option value="' + r.id + '">' + esc(r.name) + ' (' + (+r.distance_km).toFixed(1).replace('.', ',') + ' km)' + statusText(r.id) + '</option>';
  sel.innerHTML = '<option value="">— vyber trasu (nebo klikni na mapě) —</option>' +
    (mine.length ? '<optgroup label="Moje trasy">' + mine.map(opt).join('') + '</optgroup>' : '') +
    (others.length ? '<optgroup label="' + (currentUser && currentUser.role === 'admin' ? 'Ostatní trasy (admin)' : 'Ostatní trasy (jen pro čtení)') + '">' + others.map(opt).join('') + '</optgroup>' : '');
  sel.value = cur || '';
}
$('rb-route').addEventListener('change', e => {
  const id = Number(e.target.value);
  if(id) openRoute(id);
});

// --- všechny trasy na mapě: výběr kliknutím ---
const allLayer = L.layerGroup().addTo(map);
function routeColor(id){ return RB.STATES[RB.stateOf(rbSummary[id])].color; }
function drawAllRoutes(){
  allLayer.clearLayers();
  routes.forEach(r => {
    if(!Array.isArray(r.points) || r.points.length < 2) return;
    if(route && r.id === route.id && !pickMode) return;
    const ll = r.points.filter((p, i) => i % 3 === 0 || i === r.points.length - 1).map(p => [p[0], p[1]]);
    const draft = (sessions.get(r.id) && sessions.get(r.id).dirty) || hasDraft(r.id);
    const isCur = route && r.id === route.id;
    if(pickMode){
      const line = L.polyline(ll, { color: routeColor(r.id), weight: isCur ? 7 : 5, opacity: .9, dashArray: draft ? '10 8' : null });
      const hit = L.polyline(ll, { color:'#000', weight: 18, opacity: 0, bubblingMouseEvents:false });
      const sm = rbSummary[r.id];
      const tip = '<b>' + esc(r.name) + '</b><br>' + (+r.distance_km).toFixed(1).replace('.', ',') + ' km · ' +
        'Roadbook ' + RB.STATES[RB.stateOf(sm)].label + (draft ? ' · neuloženo' : '') + (isCur ? ' · otevřená' : '');
      hit.bindTooltip(tip, { sticky: true });
      hit.on('mouseover', () => line.setStyle({ weight: 8 }));
      hit.on('mouseout', () => line.setStyle({ weight: isCur ? 7 : 5 }));
      hit.on('click', () => openRoute(r.id));
      line.addTo(allLayer); hit.addTo(allLayer);
    } else {
      // ostatní trasy jen jako slabé, neklikatelné pozadí
      L.polyline(ll, { color:'#5A5A5A', weight: 3, opacity: .28, interactive: false }).addTo(allLayer);
    }
  });
}
function setPickMode(on){
  pickMode = on;
  document.body.classList.toggle('rb-picking', on);
  $('rb-pick').textContent = on ? (route ? '✕ Zpět k roadbooku' : 'Vyber trasu na mapě') : '🗺 Vybrat jinou trasu';
  $('rb-pick').disabled = on && !route;
  $('rb-map-hint').textContent = on
    ? 'Klikni na trasu na mapě. Žlutá = Ready, červená = To check, fialová = rozpracovaný, šedá = Auto (bez uloženého roadbooku), čárkovaná = neuložené změny.'
    : 'Klikni na trasu – vloží se nová instrukce. Body instrukcí jde přetáhnout po trase.';
  $('rb-add').hidden = on || !canEdit;
  markerLayer.eachLayer(m => m.setOpacity && m.setOpacity(on ? 0.35 : 1));
  if(routeLine) routeLine.setStyle({ opacity: on ? 0.35 : .95 });
  drawAllRoutes();
  if(on && routes.length){
    const all = routes.filter(r => Array.isArray(r.points) && r.points.length > 1).map(r => L.polyline(r.points.map(p => [p[0], p[1]])).getBounds());
    if(all.length){ let b = all[0]; all.slice(1).forEach(x => b = b.extend(x)); if(!route) map.fitBounds(b, { padding:[30, 30] }); }
  }
}
$('rb-pick').addEventListener('click', () => {
  if(pickMode){ if(route){ setPickMode(false); if(routeLine) map.fitBounds(routeLine.getBounds(), { padding:[30, 30] }); } }
  else setPickMode(true);
});

function snapshot(){
  if(!route) return;
  sessions.set(route.id, { items, status, saved, dirty, settings, canEdit });
  saveDraftNow();
}

async function openRoute(id){
  const r = routes.find(x => x.id === id);
  if(!r){ toast('Trasa nenalezena.'); return; }
  if(route && route.id === id && !pickMode) return;
  if(route && route.id === id && pickMode){ setPickMode(false); return; }
  snapshot();
  route = r; selId = null;
  $('rb-route').value = String(id);
  try{ localStorage.setItem(LAST_KEY, String(id)); }catch(e){}
  try{ history.replaceState(null, '', location.pathname + '?trasa=' + id); }catch(e){}

  // 1) rozpracovaný stav z téhle návštěvy stránky – bez načítání
  const se = sessions.get(id);
  if(se){
    ({ items, status, saved, dirty, settings, canEdit } = se);
    R = RB.prepareRoute(r.points, settings.reversed);
    drawRoute(true); setPickMode(false); renderAll();
    toast('Otevřen rozpracovaný roadbook.', 2500);
    return;
  }

  // 2) roadbook ze serveru
  let res = null;
  try{ busy('Načítám roadbook…'); res = await api('/api/roadbooks/' + id); }
  catch(e){ toast('Roadbook se nepodařilo načíst: ' + e.message, 5000); res = { roadbook: null, can_edit: false }; }
  finally{ unbusy(); }
  canEdit = !!res.can_edit;
  const rb = res.roadbook;
  settings = Object.assign({ minAngle: 30, reversed: false }, (rb && rb.data && rb.data.settings) || {});
  saved = !!rb; status = rb ? rb.status : 'draft'; dirty = false;
  items = rb ? ((rb.data && rb.data.items) || []).map(x => Object.assign({ sides: [], icons: [] }, x)) : [];

  // 3) neuložený rozpracovaný roadbook z prohlížeče (z minula)
  const dr = canEdit ? readDraft(id) : null;
  const savedT = rb && rb.updated_at ? new Date(rb.updated_at).getTime() : 0;
  if(dr && dr.t > savedT && Array.isArray(dr.items)){
    items = dr.items.map(x => Object.assign({ sides: [], icons: [] }, x));
    settings = Object.assign({ minAngle: 30, reversed: false }, dr.settings || {});
    status = dr.status || status; dirty = true;
    toast('Obnoven neuložený rozpracovaný roadbook z ' + new Date(dr.t).toLocaleString('cs-CZ') + '.', 5000);
  }
  R = RB.prepareRoute(r.points, settings.reversed);
  drawRoute(true); setPickMode(false);
  if(items.length) RB.recompute(R, items);
  renderAll();

  if(rb && rb.stale && !dirty){
    if(!canEdit){ toast('Trasa se od uložení roadbooku změnila – roadbook čeká na kontrolu autorem.', 5000); return; }
    status = 'draft';
    const choice = await askGenerate('stale');
    if(choice) await runGenerate(choice, true, false);
    else { items = RB.reproject(R, items); markDirty(); renderAll(); }
    return;
  }
  if(!rb && !dirty){
    if(!canEdit){ renderAll(); return; }
    const choice = await askGenerate('new');
    if(choice) await runGenerate(choice, false, false);
    else renderAll();
  }
}

function renderAll(){ renderList(); drawMarkers(); renderEditor(); renderStatus(); }

// ---------------------------------------------------------------
// Tisk a legenda
// ---------------------------------------------------------------
document.querySelectorAll('input[name=rb-pf]').forEach(r => r.addEventListener('change', () => {
  $('rb-strip-opts').style.display = document.querySelector('input[name=rb-pf]:checked').value === 'strip' ? 'block' : 'none';
}));
$('rb-print-btn').addEventListener('click', () => { if(!route) return toast('Nejdřív vyber trasu.'); openModal('rb-print-overlay'); });
$('rb-print-go').addEventListener('click', () => {
  const fmt = document.querySelector('input[name=rb-pf]:checked').value;
  const html = RB.printHTML(route.name, R.total, items, { format: fmt, width: Number($('rb-strip-w').value), legend: $('rb-p-legend').checked, mono: $('rb-p-mono').checked });
  const w = window.open('', '_blank');
  if(!w){ toast('Prohlížeč zablokoval nové okno – povol vyskakovací okna pro tento web.', 5000); return; }
  w.document.open(); w.document.write(html); w.document.close();
  closeModal('rb-print-overlay');
});
function renderLegend(){
  const cell = (s, b, t) => '<div class="cell"><div class="s">' + s + '</div><b>' + esc(b) + '</b><span>' + esc(t) + '</span></div>';
  const sec = (title, cells) => '<div><h3>' + title + '</h3><div class="cells">' + cells.join('') + '</div></div>';
  $('rb-legend').innerHTML =
    sec('Směr', RB.DIRECTIONS.map(d => cell(RB.tulipSVG({ exit: d[2] }, 54), d[0], d[1]))) +
    sec('Křižovatky', RB.TEMPLATES.filter(t => t[0] !== 'dir').map(t => cell(RB.tulipSVG({ exit: t[2], sides: t[3], round: !!t[4] }, 54), t[1], t[4] ? 'výjezd podle šipky' : 'úhly ramen se dají doladit'))) +
    sec('Typ cesty', RB.ROAD_ORDER.map(k => cell(RB.roadSVG(k, 90, 36), RB.ROADS[k].name, RB.ROADS[k].desc))) +
    sec('Místa', RB.ICON_ORDER.filter(k => RB.ICONS[k].group === 'misto').map(k => cell(RB.iconSVG(k, 40), RB.ICONS[k].name, RB.ICONS[k].desc))) +
    sec('Terén – pozor', RB.ICON_ORDER.filter(k => RB.ICONS[k].group === 'teren').map(k => cell(RB.iconSVG(k, 40), RB.ICONS[k].name, RB.ICONS[k].desc))) +
    sec('Nebezpečí', RB.DANGER.slice(1).map(d => cell('<span class="rb-danger" style="font-size:22px">' + d.mark + '</span>', d.name, d.desc))) +
    sec('Ostatní', [cell(RB.tulipSVG({ kind:'start' }, 54), 'Start', 'začátek trasy'), cell(RB.tulipSVG({ kind:'finish' }, 54), 'Cíl', 'konec trasy'),
      cell('<span style="border:2px solid #111;border-radius:4px;padding:1px 7px;font-weight:800">64°</span>', 'CAP', 'kurz za instrukcí ve stupních')]);
}
$('rb-legend-btn').addEventListener('click', () => { renderLegend(); openModal('rb-legend-overlay'); });
document.addEventListener('keydown', e => { if(e.key === 'Escape') document.querySelectorAll('.modal-overlay.open').forEach(o => o.classList.remove('open')); });

// ---------------------------------------------------------------
// Start stránky
// ---------------------------------------------------------------
// Roadbook planner je jen pro počítač: na telefonu / tabletu bez myši ukáže hlášku
function isMobileDevice(){
  const fine = window.matchMedia && window.matchMedia('(any-pointer: fine)').matches;
  const small = Math.min(screen.width || 0, screen.height || 0) < 700;
  return !fine || small;
}
function isChromium(){
  const ud = navigator.userAgentData;
  if(ud && Array.isArray(ud.brands)) return ud.brands.some(b => /Chromium|Google Chrome|Microsoft Edge/.test(b.brand));
  return /Chrome\//.test(navigator.userAgent) && !/Firefox|FxiOS/.test(navigator.userAgent);
}
function showMobileBlock(){
  document.body.classList.remove('auth-pending');
  document.body.classList.add('rb-mobile-blocked');
  $('rb-toolbar').remove();
  $('rb-main').innerHTML = '<div class="rb-mobile-msg"><h2>Roadbook planner je jen pro počítač</h2>' +
    '<p>Plánování roadbooku potřebuje velkou obrazovku a myš, proto ho na mobilu nejde použít. Otevři ho na počítači – doporučujeme prohlížeč <b>Google Chrome</b>.</p>' +
    '<p>Na mobilu můžeš podle hotového roadbooku jet v <b>Roadbook NAVI</b>.</p>' +
    '<div class="rb-mobile-actions"><a class="btn-rb go" href="roadbook-navi.html">Otevřít Roadbook NAVI</a><a class="btn-rb" href="index.html">Zpět do Atlasu</a><a class="btn-rb" href="faq.html#rb-planner">Jak to funguje (FAQ)</a></div></div>';
}

(async function boot(){
  if(isMobileDevice()){ showMobileBlock(); try{ const u = await api('/api/auth/me'); if(window.CendurHeader) window.CendurHeader.setUser(u); }catch(e){} return; }
  if(!isChromium()){
    let off = false; try{ off = localStorage.getItem('cenduroff.rb.chromeHint') === '0'; }catch(e){}
    if(!off){
      $('rb-toolbar').insertAdjacentHTML('afterend', '<div class="rb-browser-hint" id="rb-browser-hint">Roadbook planner je odladěný pro <b>Google Chrome</b> – v jiném prohlížeči se něco nemusí chovat správně. <button type="button" class="btn-rb" id="rb-browser-hint-x">Rozumím</button></div>');
      $('rb-browser-hint-x').addEventListener('click', () => { $('rb-browser-hint').remove(); try{ localStorage.setItem('cenduroff.rb.chromeHint', '0'); }catch(e){} setTimeout(() => map.invalidateSize(), 50); });
    }
  }
  try{ currentUser = await api('/api/auth/me'); }catch(e){ currentUser = null; }
  if(!currentUser){
    let hops = [];
    try{ hops = JSON.parse(sessionStorage.getItem('rbAuthHops') || '[]').filter(t => Date.now() - t < 20000); }catch(e){}
    if(hops.length >= 2){
      try{ sessionStorage.removeItem('rbAuthHops'); }catch(e){}
      document.body.classList.remove('auth-pending');
      $('app-screen').innerHTML = '<div style="margin:auto;max-width:420px;padding:32px;text-align:center"><h2>Přihlášení se nepodařilo ověřit</h2><p>Zkus to prosím za chvíli znovu.</p><p><a href="index.html">Přejít do Atlasu</a></p></div>';
      return;
    }
    hops.push(Date.now());
    try{ sessionStorage.setItem('rbAuthHops', JSON.stringify(hops)); }catch(e){}
    location.replace('index.html?next=' + encodeURIComponent('roadbook-planner.html' + location.search));
    return;
  }
  try{ sessionStorage.removeItem('rbAuthHops'); }catch(e){}
  document.body.classList.remove('auth-pending');
  if(window.CendurHeader) window.CendurHeader.setUser(currentUser);
  setTimeout(() => map.invalidateSize(), 50);
  try{
    const [list, sums] = await Promise.all([ api('/api/routes'), api('/api/roadbooks').catch(() => []) ]);
    routes = list; rbSummary = {};
    (sums || []).forEach(s => { rbSummary[s.route_id] = s; });
  }catch(e){ toast('Trasy se nepodařilo načíst: ' + e.message, 6000); }
  fillRouteSelect();
  renderStatus();
  setPickMode(true);
  // přímý odkaz ?trasa=… otevře trasu rovnou; jinak se začíná výběrem na mapě
  const id = Number(new URLSearchParams(location.search).get('trasa'));
  if(id && routes.some(r => r.id === id)) openRoute(id);
})();

})();
