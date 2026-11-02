(function(){
// ===============================================================
// CendurOFF – Roadbook planner (roadbook-planner.html), v2.0
//
// Samostatná stránka: trasy jen ČTE (/api/routes), roadbook ukládá do vlastní
// tabulky (/api/roadbooks/:id). Atlas ani Plánovač neovlivňuje.
// ===============================================================
const RB = window.CendurRB;
const API_URL = window.CENDUROFF_API_URL || 'https://cenduroff-web.up.railway.app';
const LAST_KEY = 'cenduroff.rb.lastRoute';
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
function busy(text){ $('rb-busy-text').textContent = text || 'Pracuji…'; $('rb-busy').classList.add('open'); }
function unbusy(){ $('rb-busy').classList.remove('open'); }
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

// Hlavička: stránka není v menu (zatím schovaná), jen přepíšeme název u loga
(function patchHeader(){
  const sub = document.querySelector('header.topbar .brand-sub');
  if(sub) sub.textContent = 'Roadbook planner';
})();

// ---------------------------------------------------------------
// Mapa
// ---------------------------------------------------------------
const map = L.map('rb-map', { zoomControl:true }).setView([49.8711, 17.8756], 12);
const baseLayers = {
  osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:19, attribution:'© OpenStreetMap contributors' }),
  topo: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { maxZoom:19, maxNativeZoom:17, attribution:'© OpenStreetMap contributors, SRTM | © OpenTopoMap (CC-BY-SA)' }),
  cyclosm: L.tileLayer('https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png', { maxZoom:19, maxNativeZoom:20, attribution:'© OpenStreetMap contributors, CyclOSM' }),
  sat: L.layerGroup([
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom:19, attribution:'Tiles © Esri' }),
    L.tileLayer('https://ags.cuzk.gov.cz/arcgis1/rest/services/ORTOFOTO_WM/MapServer/tile/{z}/{y}/{x}', { maxZoom:19, maxNativeZoom:20, attribution:'Ortofoto © ČÚZK' })
  ])
};
let currentBase = (()=>{ try{ return localStorage.getItem(SHARED_BASE_KEY); }catch(e){ return null; } })();
if(!baseLayers[currentBase]) currentBase = 'cyclosm';
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

function drawRoute(){
  if(routeLine) map.removeLayer(routeLine);
  if(routeHit) map.removeLayer(routeHit);
  const ll = R.lat.map((la, i) => [la, R.lon[i]]);
  routeLine = L.polyline(ll, { color:'#4F7048', weight:6, opacity:.95 }).addTo(map);
  // širší neviditelná čára pro snadné klikání
  routeHit = L.polyline(ll, { color:'#000', weight:22, opacity:0, bubblingMouseEvents:false }).addTo(map);
  routeHit.on('click', e => { if(canEdit) addAt(e.latlng); });
  map.fitBounds(routeLine.getBounds(), { padding:[30, 30] });
}
map.on('click', e => {
  if(!addMode || !R) return;
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
  if(!list.length){ $('rb-rows').innerHTML = '<div class="rb-empty">' + (filter === 'all' ? 'Roadbook je prázdný.' : 'Nic takového tu není.') + '</div>'; return; }
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
function markDirty(){ dirty = true; renderStatus(); }

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
  else if(status === 'ready'){ el.className = 'rb-badge ready'; el.textContent = 'ROADBOOK READY'; }
  else { el.className = 'rb-badge draft'; el.textContent = 'ROADBOOK NOT READY'; }
  $('rb-info').textContent = RB.fmtKm(R ? R.total : 0) + ' km' + (dirty ? ' · neuložené změny' : '');
  $('rb-ready').textContent = status === 'ready' ? 'Vrátit na NOT ready' : 'Označit READY';
  ['rb-save','rb-ready','rb-regen','rb-add'].forEach(id => { $(id).hidden = !canEdit; });
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
    rbSummary[route.id] = { route_id: route.id, status: r.status, stale: false };
    fillRouteSelect(); renderStatus();
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
window.addEventListener('beforeunload', e => { if(dirty && canEdit){ e.preventDefault(); e.returnValue = ''; } });

// ---------------------------------------------------------------
// Generování
// ---------------------------------------------------------------
async function generateFresh(opts){
  busy('Hledám zatáčky…');
  try{
    const r = await RB.generate(route.points, { minAngle: settings.minAngle, useOsm: opts.useOsm !== false, onProgress: t => { $('rb-busy-text').textContent = t; } });
    if(r.osmError) toast('OpenStreetMap teď neodpovídá – roadbook je jen ze zatáček GPX. Zkus „Vygenerovat znovu“ později.', 6500);
    r.items.osmFailed = !!r.osmError && opts.useOsm !== false;
    return r.items;
  } finally { unbusy(); }
}
$('rb-regen').addEventListener('click', () => {
  if(!route) return toast('Nejdřív vyber trasu.');
  $('rb-minangle').value = String(settings.minAngle || 30);
  openModal('rb-regen-overlay');
});
async function regenerate(keep){
  closeModal('rb-regen-overlay');
  settings.minAngle = Number($('rb-minangle').value) || 30;
  const fresh = await generateFresh({ useOsm: $('rb-useosm').checked });
  // když OpenStreetMap neodpoví, stávající instrukce jen posuneme na trasu (ať se neztratí křižovatky)
  items = keep ? (fresh.osmFailed ? RB.reproject(R, items) : RB.remap(R, items, fresh)) : fresh;
  selId = null; markDirty(); renderAll();
  const rev = RB.visible(items).filter(i => i.review).length;
  toast('Roadbook vygenerován' + (keep ? ' – tvoje úpravy zůstaly' : '') + (rev ? '. Ke kontrole: ' + rev : '') + '.', 4500);
}
$('rb-regen-keep').addEventListener('click', () => regenerate(true));
$('rb-regen-fresh').addEventListener('click', () => { if(confirm('Opravdu zahodit všechny ruční úpravy a začít od nuly?')) regenerate(false); });

// ---------------------------------------------------------------
// Otevření trasy
// ---------------------------------------------------------------
function statusText(id){
  const s = rbSummary[id];
  if(!s) return '';
  return s.status === 'ready' ? ' · READY' : ' · NOT ready';
}
function fillRouteSelect(){
  const sel = $('rb-route'), cur = route ? String(route.id) : sel.value;
  const mine = currentUser ? routes.filter(r => r.owner_id === currentUser.id) : [];
  const others = routes.filter(r => !currentUser || r.owner_id !== currentUser.id);
  const opt = r => '<option value="' + r.id + '">' + esc(r.name) + ' (' + (+r.distance_km).toFixed(1).replace('.', ',') + ' km)' + statusText(r.id) + '</option>';
  sel.innerHTML = '<option value="">— vyber trasu —</option>' +
    (mine.length ? '<optgroup label="Moje trasy">' + mine.map(opt).join('') + '</optgroup>' : '') +
    (others.length ? '<optgroup label="' + (currentUser && currentUser.role === 'admin' ? 'Ostatní trasy (admin)' : 'Ostatní trasy (jen pro čtení)') + '">' + others.map(opt).join('') + '</optgroup>' : '');
  sel.value = cur || '';
}
$('rb-route').addEventListener('change', e => {
  const id = Number(e.target.value);
  if(!id) return;
  if(dirty && canEdit && !confirm('Máš neuložené změny roadbooku. Opravdu otevřít jinou trasu?')){ e.target.value = route ? String(route.id) : ''; return; }
  openRoute(id);
});

async function openRoute(id){
  const r = routes.find(x => x.id === id);
  if(!r){ toast('Trasa nenalezena.'); return; }
  route = r; selId = null; dirty = false;
  try{ localStorage.setItem(LAST_KEY, String(id)); }catch(e){}
  try{ history.replaceState(null, '', location.pathname + '?trasa=' + id); }catch(e){}
  try{ R = RB.prepareRoute(r.points); }catch(e){ toast(e.message); return; }
  drawRoute();
  let res = null;
  try{ busy('Načítám roadbook…'); res = await api('/api/roadbooks/' + id); }
  catch(e){ toast('Roadbook se nepodařilo načíst: ' + e.message, 5000); res = { roadbook: null, can_edit: false }; }
  finally{ unbusy(); }
  canEdit = !!res.can_edit;
  if(res.roadbook){
    saved = true;
    status = res.roadbook.status;
    settings = Object.assign({ minAngle: 30 }, (res.roadbook.data && res.roadbook.data.settings) || {});
    items = ((res.roadbook.data && res.roadbook.data.items) || []).map(x => Object.assign({ sides: [], icons: [] }, x));
    if(res.roadbook.stale){
      if(canEdit){
        toast('Trasa se od uložení roadbooku změnila – přegeneruji a zachovám tvoje úpravy…', 5000);
        const fresh = await generateFresh({ useOsm: true });
        items = fresh.osmFailed ? RB.reproject(R, items) : RB.remap(R, items, fresh);
        status = 'draft'; dirty = true;
        const rev = RB.visible(items).filter(i => i.review).length;
        toast('Roadbook přepočítán podle nové trasy' + (rev ? ' – zkontroluj ' + rev + ' označených míst' : '') + '. Nezapomeň uložit.', 7000);
      } else {
        toast('Trasa se od uložení roadbooku změnila – roadbook čeká na kontrolu autorem.', 5000);
      }
    } else {
      RB.recompute(R, items);
    }
  } else {
    saved = false; status = 'draft'; settings = { minAngle: 30 };
    items = await generateFresh({ useOsm: true });
    dirty = canEdit;
    if(canEdit) toast('Roadbook byl vygenerován automaticky. Dolaď ho a ulož.', 5000);
  }
  renderAll();
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
(async function boot(){
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
  const params = new URLSearchParams(location.search);
  let id = Number(params.get('trasa'));
  if(!id){ try{ id = Number(localStorage.getItem(LAST_KEY)); }catch(e){} }
  if(id && routes.some(r => r.id === id)){ $('rb-route').value = String(id); openRoute(id); }
})();

})();
