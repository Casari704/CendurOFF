// ---------------------------------------------------------------
// CendurOFF Roadbook – společné jádro pro Roadbook planner i Roadbook NAVI (v2.0)
//
//  - geometrie trasy (převzorkování, poloha na trase, směr)
//  - automatické generování roadbooku: zatáčky z GPX + křižovatky, brody, závory,
//    přejezdy a benzínky z OpenStreetMap (Overpass)
//  - přiřazení ručních úprav k nové trase (když se GPX změní)
//  - kreslení tulipánů a ikon (SVG), katalog symbolů
//
// Nic ze stávajícího webu nemění; jen čte window.CendurRegion.overpass (regiondata.js),
// pokud je načtený, jinak se na Overpass ptá samo.
// ---------------------------------------------------------------
(function(){
  const RB = {};
  const D2R = Math.PI / 180;

  // =============================================================
  // Katalog symbolů
  // =============================================================
  RB.ICONS = {
    brod:      { group:'misto', name:'Brod',          desc:'hloubka v poznámce', color:'#1E5AA8', d:'M3 15c2 0 2-1.5 4.5-1.5S10 15 12 15s2-1.5 4.5-1.5S19 15 21 15M3 19c2 0 2-1.5 4.5-1.5S10 19 12 19s2-1.5 4.5-1.5S19 19 21 19M12 3l-3.5 6a3.5 3.5 0 0 0 7 0z' },
    most:      { group:'misto', name:'Most',          desc:'most, lávka', d:'M2 16h20M4 16v4M20 16v4M2 12c4 0 6-4 10-4s6 4 10 4M7 10.5V16M12 8v8M17 10.5V16' },
    zavora:    { group:'misto', name:'Závora',        desc:'může být zavřená', d:'M4 21V6M4 9h17v4H4M9 9l-3 4M14 9l-3 4M19 9l-3 4' },
    prejezd:   { group:'misto', name:'Přejezd',       desc:'železniční přejezd', d:'M5 4l14 14M19 4L5 18M12 18v4' },
    obec:      { group:'misto', name:'Obec',          desc:'vjezd do obce', d:'M3 11l9-7 9 7M5 10v10h14V10M10 20v-6h4v6' },
    benzinka:  { group:'misto', name:'Benzínka',      desc:'čerpací stanice', d:'M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M3 21h12M4 10h10M14 8l3 3v6a1.5 1.5 0 0 0 3 0V9l-3-3' },
    vyhled:    { group:'misto', name:'Výhled',        desc:'stojí za zastávku', d:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6' },
    parkoviste:{ group:'misto', name:'Parkoviště',    desc:'místo k zastavení', d:'M5 3h14v18H5zM10 17V7h3a3 3 0 0 1 0 6h-3' },
    bivak:     { group:'misto', name:'Bivak',         desc:'nocležiště, tábořiště', d:'M2 20h20M4 20L12 5l8 15M12 20l-3.5-6M12 20l3.5-6' },
    kameni:    { group:'teren', name:'Kamení',        desc:'volné kameny, šutry', d:'M2 19l3-6 4 1 3-5 4 4 2-2 4 8z' },
    blato:     { group:'teren', name:'Bláto',         desc:'rozbahněný úsek', d:'M3 16c2-2 4-2 6 0s4 2 6 0 4-2 6 0M3 20c2-2 4-2 6 0s4 2 6 0 4-2 6 0M6 11h1M11 9h1M16 11h1' },
    pisek:     { group:'teren', name:'Písek',         desc:'hluboký písek', d:'M3 19h18M4 15h1M8 14h1M12 15h1M16 14h1M20 15h1M6 11h1M10 10h1M14 11h1M18 10h1' },
    vystup:    { group:'teren', name:'Strmý výstup',  desc:'nutná rychlost', d:'M3 20h18M3 20L20 6M20 6h-6M20 6v6' },
    sjezd:     { group:'teren', name:'Strmý sjezd',   desc:'brzdit motorem', d:'M3 20h18M4 6l16 12M20 18h-6M20 18v-6' },
    uzky:      { group:'teren', name:'Úzký průjezd',  desc:'mezi stromy, kufry', d:'M6 3v18M18 3v18M9 12h6M11 10l-2 2 2 2M13 10l2 2-2 2' },
    stromy:    { group:'teren', name:'Padlé stromy',  desc:'možná objížďka', d:'M2 18l20-7M7 16.2V21M17 12.6V21M12 9l2 3M15 7l1 4' },
    zver:      { group:'teren', name:'Zvěř',          desc:'obora, honitba', d:'M12 21c-3 0-5-2-5-5 0-2 2-4 5-4s5 2 5 4c0 3-2 5-5 5zM5 9.5h2M17 9.5h2M8.5 5.5h2M13.5 5.5h2' }
  };
  RB.ICON_ORDER = Object.keys(RB.ICONS);

  RB.ROADS = {
    asfalt:  { name:'Asfalt',        desc:'zpevněná silnice', d:'M6 13H94M6 27H94', w:3, dash:'0' },
    sotolina:{ name:'Šotolina',      desc:'štěrková cesta',   d:'M6 20H94', w:6, dash:'12 5' },
    lesni:   { name:'Lesní cesta',   desc:'lesní / polní cesta', d:'M6 20H94', w:5, dash:'0' },
    polni:   { name:'Polní cesta',   desc:'dvě koleje',       d:'M6 13H94M6 27H94', w:3, dash:'8 5' },
    pesina:  { name:'Pěšina',        desc:'singletrack',      d:'M6 20H94', w:4, dash:'2 6' },
    mimo:    { name:'Mimo cestu',    desc:'bez vyjeté stopy', d:'M6 20H94', w:4, dash:'12 5 2 5' }
  };
  RB.ROAD_ORDER = Object.keys(RB.ROADS);

  RB.DANGER = [
    { mark:'',    name:'Žádné',          desc:'' },
    { mark:'!',   name:'Pozor',          desc:'zvýšená opatrnost' },
    { mark:'!!',  name:'Nebezpečí',      desc:'výrazně zpomal' },
    { mark:'!!!', name:'Velké nebezpečí',desc:'téměř zastav' }
  ];

  // šablony křižovatek: [klíč, název, výjezd (null = ponechat), odbočky, kruhový objezd]
  RB.TEMPLATES = [
    ['dir',  'Jen směr',      null, []],
    ['odbL', 'Odbočka vlevo', 0,    [-90]],
    ['odbR', 'Odbočka vpravo',0,    [90]],
    ['TL',   'T vlevo',       -90,  [90]],
    ['TR',   'T vpravo',      90,   [-90]],
    ['YL',   'Y levá',        -35,  [35]],
    ['YR',   'Y pravá',       35,   [-35]],
    ['X',    'X křížení',     0,    [-90, 90]],
    ['kruh', 'Kruhový objezd',90,   [0, -90], true]
  ];

  RB.DIRECTIONS = [
    ['Rovně','změna do 20°',0], ['Mírně vlevo','20–60°',-40], ['Mírně vpravo','20–60°',40],
    ['Vlevo','60–110°',-90], ['Vpravo','60–110°',90], ['Ostře vlevo','110–150°',-130],
    ['Ostře vpravo','110–150°',130], ['Vracák','nad 150°, tvar U',165]
  ];

  RB.dirName = function(exit, round){
    if(round) return 'Kruhový objezd';
    const x = Math.abs(exit), s = exit < 0 ? 'vlevo' : 'vpravo';
    if(x <= 20) return 'Rovně';
    if(x <= 60) return 'Mírně ' + s;
    if(x <= 110) return s.charAt(0).toUpperCase() + s.slice(1);
    if(x <= 150) return 'Ostře ' + s;
    return 'Vracák ' + s;
  };
  // text instrukce: ruční poznámka, jinak automaticky ze směru
  RB.label = function(it){
    if(it.note && it.note.trim()) return it.note.trim();
    if(it.kind === 'start') return 'Start';
    if(it.kind === 'finish') return 'Cíl';
    return RB.dirName(it.exit || 0, it.round);
  };
  RB.subLabel = function(it){
    if(it.sub && it.sub.trim()) return it.sub.trim();
    const parts = [];
    if(it.round) parts.push('kruhový objezd');
    else if(it.sides && it.sides.length) parts.push('křižovatka');
    (it.icons || []).forEach(k=>{ if(RB.ICONS[k] && k !== 'kameni') parts.push(RB.ICONS[k].name.toLowerCase()); });
    if(it.road && RB.ROADS[it.road]) parts.push(RB.ROADS[it.road].name.toLowerCase());
    return parts.join(', ');
  };

  // =============================================================
  // Pomocné funkce
  // =============================================================
  RB.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  RB.fmtKm = m => (Math.max(0, m) / 1000).toFixed(2).replace('.', ',');
  RB.fmtDist = m => m >= 1000 ? (m/1000).toFixed(m >= 10000 ? 1 : 2).replace('.', ',') + ' km' : Math.max(0, Math.round(m/10)*10) + ' m';
  RB.angleDiff = (a, b) => ((a - b + 540) % 360) - 180;
  RB.uid = () => 'i' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
  RB.haversine = function(a, b){
    const R = 6371000, dLat = (b[0]-a[0])*D2R, dLon = (b[1]-a[1])*D2R;
    const s = Math.sin(dLat/2)**2 + Math.cos(a[0]*D2R)*Math.cos(b[0]*D2R)*Math.sin(dLon/2)**2;
    return 2*R*Math.asin(Math.sqrt(s));
  };
  RB.bearing = function(a, b){
    const y = Math.sin((b[1]-a[1])*D2R) * Math.cos(b[0]*D2R);
    const x = Math.cos(a[0]*D2R)*Math.sin(b[0]*D2R) - Math.sin(a[0]*D2R)*Math.cos(b[0]*D2R)*Math.cos((b[1]-a[1])*D2R);
    return (Math.atan2(y, x) / D2R + 360) % 360;
  };

  // =============================================================
  // Trasa: převzorkování po STEP metrech + lokální souřadnice v metrech
  // =============================================================
  const STEP = 5;
  RB.prepareRoute = function(points){
    const raw = (points || []).filter(p => p && isFinite(p[0]) && isFinite(p[1])).map(p => [+p[0], +p[1]]);
    if(raw.length < 2) throw new Error('Trasa nemá dost bodů.');
    // odstraní duplicitní body
    const pts = [raw[0]];
    for(let i = 1; i < raw.length; i++) if(RB.haversine(pts[pts.length-1], raw[i]) > 0.5) pts.push(raw[i]);
    let lat0 = 0; pts.forEach(p => lat0 += p[0]); lat0 /= pts.length;
    const kx = 111320 * Math.cos(lat0 * D2R), ky = 110540;
    // převzorkování
    const lat = [], lon = [], s = [];
    let acc = 0, carry = 0;
    lat.push(pts[0][0]); lon.push(pts[0][1]); s.push(0);
    for(let i = 1; i < pts.length; i++){
      const a = pts[i-1], b = pts[i], d = RB.haversine(a, b);
      let t = STEP - carry;
      while(t <= d){
        const f = t / d;
        lat.push(a[0] + (b[0]-a[0])*f); lon.push(a[1] + (b[1]-a[1])*f); s.push(acc + t);
        t += STEP;
      }
      carry = d - (t - STEP);
      acc += d;
    }
    if(acc - s[s.length-1] > 0.5){ lat.push(pts[pts.length-1][0]); lon.push(pts[pts.length-1][1]); s.push(acc); }
    const n = s.length, x = new Float64Array(n), y = new Float64Array(n);
    for(let i = 0; i < n; i++){ x[i] = lon[i] * kx; y[i] = lat[i] * ky; }
    // vyhlazené souřadnice (±10 m) pro počítání směru - potlačí šum nahrané GPS
    const sx = new Float64Array(n), sy = new Float64Array(n), H = 2;
    for(let i = 0; i < n; i++){
      let ax = 0, ay = 0, c = 0;
      for(let j = Math.max(0, i-H); j <= Math.min(n-1, i+H); j++){ ax += x[j]; ay += y[j]; c++; }
      sx[i] = ax / c; sy[i] = ay / c;
    }
    return { lat, lon, s, x, y, sx, sy, n, total: acc, kx, ky, step: STEP };
  };

  function idxAt(R, s){ return Math.max(0, Math.min(R.n - 1, Math.round(s / R.step))); }
  RB.pointAt = function(R, s){
    s = Math.max(0, Math.min(R.total, s));
    let i = Math.min(R.n - 2, Math.floor(s / R.step));
    while(i > 0 && R.s[i] > s) i--;
    while(i < R.n - 2 && R.s[i+1] < s) i++;
    const f = (R.s[i+1] - R.s[i]) > 0 ? (s - R.s[i]) / (R.s[i+1] - R.s[i]) : 0;
    return [R.lat[i] + (R.lat[i+1]-R.lat[i])*f, R.lon[i] + (R.lon[i+1]-R.lon[i])*f];
  };
  // směr (azimut) vyhlazené trasy mezi vzdálenostmi s0 -> s1
  RB.bearingBetween = function(R, s0, s1){
    const a = idxAt(R, s0), b = idxAt(R, s1);
    if(a === b) return null;
    return (Math.atan2(R.sx[b]-R.sx[a], R.sy[b]-R.sy[a]) / D2R + 360) % 360;
  };
  // nejbližší místo na trase; sFrom/sTo omezí hledání na úsek (pro NAVI)
  RB.project = function(R, lat, lon, sFrom, sTo){
    const px = lon * R.kx, py = lat * R.ky;
    const i0 = sFrom == null ? 0 : Math.max(0, Math.floor(sFrom / R.step) - 1);
    const i1 = sTo == null ? R.n - 1 : Math.min(R.n - 1, Math.ceil(sTo / R.step) + 1);
    let best = { dist: Infinity, s: 0, i: 0 };
    for(let i = i0; i < i1; i++){
      const ax = R.x[i], ay = R.y[i], bx = R.x[i+1], by = R.y[i+1];
      const dx = bx - ax, dy = by - ay, L2 = dx*dx + dy*dy;
      let t = L2 > 0 ? ((px-ax)*dx + (py-ay)*dy) / L2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const qx = ax + dx*t, qy = ay + dy*t, d = Math.hypot(px-qx, py-qy);
      if(d < best.dist) best = { dist: d, s: R.s[i] + (R.s[i+1]-R.s[i])*t, i };
    }
    return best;
  };

  // =============================================================
  // Zatáčky z geometrie
  // =============================================================
  function detectTurns(R, minAngle){
    const W = 25, k = Math.round(W / R.step), out = [];
    const turn = new Float64Array(R.n);
    for(let i = k; i < R.n - k; i++){
      const b1 = Math.atan2(R.sx[i]-R.sx[i-k], R.sy[i]-R.sy[i-k]) / D2R;
      const b2 = Math.atan2(R.sx[i+k]-R.sx[i], R.sy[i+k]-R.sy[i]) / D2R;
      turn[i] = RB.angleDiff(b2, b1);
    }
    // lokální maxima nad prahem, potlačení sousedů do 40 m
    const cand = [];
    for(let i = k; i < R.n - k; i++){
      const a = Math.abs(turn[i]);
      if(a < minAngle) continue;
      if(a >= Math.abs(turn[i-1]) && a >= Math.abs(turn[i+1])) cand.push(i);
    }
    cand.sort((p, q) => Math.abs(turn[q]) - Math.abs(turn[p]));
    // každá zatáčka = souvislý úsek, kde se směr mění; úhel = součet změn směru přes celý
    // oblouk (funguje pro ostré rohy, široké oblouky i vracáky, včetně strany vracáku)
    const head = new Float64Array(R.n);
    for(let j = 1; j < R.n; j++) head[j] = Math.atan2(R.sx[j]-R.sx[j-1], R.sy[j]-R.sy[j-1]) / D2R;
    const regions = [];
    cand.forEach(i => {
      if(regions.some(r => i >= r.a && i <= r.b)) return;
      const sg = Math.sign(turn[i]);
      let a = i, b = i;
      while(a > k && Math.sign(turn[a-1]) === sg && Math.abs(turn[a-1]) >= 8) a--;
      while(b < R.n - k - 1 && Math.sign(turn[b+1]) === sg && Math.abs(turn[b+1]) >= 8) b++;
      regions.push({ a, b, i });
    });
    regions.sort((p, q) => p.i - q.i).forEach(r => {
      // vrchol zatáčky = místo, kde je změněná polovina celkového úhlu
      const j0 = Math.max(2, r.a - 2), j1 = Math.min(R.n - 1, r.b + 2);
      let sum = 0;
      for(let j = j0; j <= j1; j++) sum += RB.angleDiff(head[j], head[j-1]);
      let half = 0, iMid = r.i;
      for(let j = j0; j <= j1; j++){ half += RB.angleDiff(head[j], head[j-1]); if(Math.abs(half) >= Math.abs(sum) / 2){ iMid = j; break; } }
      const s = R.s[iMid];
      if(s < 15 || R.total - s < 15) return;
      if(Math.abs(sum) < minAngle) return;
      const ex = Math.max(-180, Math.min(180, Math.round(sum / 5) * 5));
      out.push({ s, exit: ex });
    });
    return out;
  }
  function exitAngle(R, s){
    // směr před zatáčkou a za ní, bez samotného oblouku (ten úhel zkresluje)
    const bin = RB.bearingBetween(R, Math.max(0, s - 60), Math.max(0, s - 15));
    const bout = RB.bearingBetween(R, Math.min(R.total, s + 15), Math.min(R.total, s + 60));
    if(bin == null || bout == null) return 0;
    return Math.round(RB.angleDiff(bout, bin) / 5) * 5;
  }

  // =============================================================
  // OpenStreetMap (Overpass): cesty kolem trasy + body zájmu
  // =============================================================
  const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
  async function overpass(q){
    if(window.CendurRegion && typeof window.CendurRegion.overpass === 'function') return window.CendurRegion.overpass(q);
    let last = null;
    for(const url of OVERPASS){
      try{
        const res = await fetch(url, { method:'POST', headers:{ 'Content-Type':'application/x-www-form-urlencoded' }, body:'data=' + encodeURIComponent(q) });
        if(!res.ok) throw new Error('server ' + res.status);
        return await res.json();
      }catch(e){ last = e; }
    }
    throw last || new Error('Overpass nedostupný');
  }
  async function fetchOsm(R, onProgress){
    // body trasy po ~80 m, po kusech (~12 km), ať jsou dotazy malé
    const coords = [];
    for(let s = 0; s < R.total; s += 80){ const p = RB.pointAt(R, s); coords.push(p[0].toFixed(5) + ',' + p[1].toFixed(5)); }
    const last = RB.pointAt(R, R.total); coords.push(last[0].toFixed(5) + ',' + last[1].toFixed(5));
    const CH = 150, chunks = [];
    for(let i = 0; i < coords.length - 1; i += CH) chunks.push(coords.slice(i, Math.min(coords.length, i + CH + 1)));
    const nodes = new Map(), ways = new Map(), pois = new Map();
    for(let c = 0; c < chunks.length; c++){
      if(onProgress) onProgress(c + 1, chunks.length);
      const C = chunks[c].join(',');
      const q = `[out:json][timeout:90];
way["highway"](around:20,${C})->.w;
.w out body;
.w >;
out skel qt;
(node["ford"](around:25,${C});
 node["barrier"~"^(gate|lift_gate|swing_gate|chain|bar)$"](around:20,${C});
 node["railway"="level_crossing"](around:20,${C});
 node["amenity"="fuel"](around:70,${C});
 way["amenity"="fuel"](around:70,${C}););
out center tags;`;
      const d = await overpass(q);
      (d.elements || []).forEach(el => {
        if(el.type === 'way' && el.nodes && el.tags && el.tags.highway) ways.set(el.id, el);
        else if(el.type === 'node' && !el.tags) { if(!nodes.has(el.id)) nodes.set(el.id, el); }
        if(el.tags && (el.type === 'node' || el.center) && !(el.type === 'way' && el.tags.highway)){
          const lat = el.lat != null ? el.lat : el.center.lat, lon = el.lon != null ? el.lon : el.center.lon;
          pois.set(el.type + el.id, { lat, lon, tags: el.tags });
          if(el.type === 'node' && !nodes.has(el.id)) nodes.set(el.id, { id: el.id, lat, lon });
        }
      });
    }
    return { nodes, ways: Array.from(ways.values()), pois: Array.from(pois.values()) };
  }

  const ROAD_PAVED = ['motorway','motorway_link','trunk','trunk_link','primary','primary_link','secondary','secondary_link','tertiary','tertiary_link','unclassified','residential','living_street','service'];
  const UNPAVED = /gravel|dirt|ground|unpaved|compacted|fine_gravel|grass|sand|earth|mud|pebblestone|rock/;
  function roadOf(tags){
    if(!tags) return null;
    const h = tags.highway, sf = tags.surface || '';
    if(ROAD_PAVED.includes(h)) return UNPAVED.test(sf) ? 'sotolina' : 'asfalt';
    if(h === 'track'){
      const g = tags.tracktype;
      if(g === 'grade1') return UNPAVED.test(sf) ? 'sotolina' : (sf && !UNPAVED.test(sf) ? 'asfalt' : 'sotolina');
      if(g === 'grade2') return 'sotolina';
      if(g === 'grade4' || g === 'grade5') return 'polni';
      return 'lesni';
    }
    if(['path','footway','bridleway','cycleway','steps'].includes(h)) return 'pesina';
    return null;
  }
  function ignoredBranch(tags){
    if(!tags) return true;
    const h = tags.highway;
    if(['footway','steps','corridor','elevator','platform','proposed','construction'].includes(h)) return true;
    if(h === 'service' && /driveway|parking_aisle|drive-through/.test(tags.service || '')) return true;
    return false;
  }

  // křižovatky na trase: uzly OSM sdílené 3+ rameny, které leží na trase
  function findJunctions(R, osm){
    const deg = new Map(), wayAt = new Map();
    osm.ways.forEach(w => {
      const ns = w.nodes;
      ns.forEach((id, j) => {
        const end = (j === 0 || j === ns.length - 1);
        deg.set(id, (deg.get(id) || 0) + (end ? 1 : 2));
        if(!wayAt.has(id)) wayAt.set(id, []);
        wayAt.get(id).push({ w, j });
      });
    });
    const out = [];
    deg.forEach((d, id) => {
      if(d < 3) return;
      const nd = osm.nodes.get(id);
      if(!nd) return;
      const p = RB.project(R, nd.lat, nd.lon);
      if(p.dist > 12 || p.s < 20 || R.total - p.s < 20) return;
      // směry ramen ~20 m od uzlu
      const branches = [];
      wayAt.get(id).forEach(({ w, j }) => {
        [-1, 1].forEach(dir => {
          let k = j, acc = 0, prev = nd, tgt = null;
          while(true){
            k += dir;
            if(k < 0 || k >= w.nodes.length) break;
            const q = osm.nodes.get(w.nodes[k]);
            if(!q) break;
            acc += RB.haversine([prev.lat, prev.lon], [q.lat, q.lon]);
            tgt = q; prev = q;
            if(acc >= 20) break;
          }
          if(tgt && acc > 3) branches.push({ b: RB.bearing([nd.lat, nd.lon], [tgt.lat, tgt.lon]), tags: w.tags });
        });
      });
      out.push({ s: p.s, lat: nd.lat, lon: nd.lon, branches });
    });
    out.sort((a, b) => a.s - b.s);
    // dvě křižovatky těsně u sebe -> jedna
    const merged = [];
    out.forEach(j => {
      const m = merged[merged.length - 1];
      if(m && j.s - m.s < 15){ m.branches = m.branches.concat(j.branches); return; }
      merged.push(j);
    });
    return merged.map(j => {
      const bin = RB.bearingBetween(R, j.s - 30, j.s), bout = RB.bearingBetween(R, j.s, j.s + 30);
      if(bin == null || bout == null) return null;
      const exit = RB.angleDiff(bout, bin);
      let rel = j.branches.map(br => ({ a: RB.angleDiff(br.b, bin), tags: br.tags }));
      // rameno, ze kterého přijíždíme (≈180°) a rameno, kterým odjíždíme (≈ výjezd)
      const takeClosest = (target, tol) => {
        let bi = -1, bd = tol;
        rel.forEach((r, i) => { const dd = Math.abs(RB.angleDiff(r.a, target)); if(dd < bd){ bd = dd; bi = i; } });
        return bi >= 0 ? rel.splice(bi, 1)[0] : null;
      };
      takeClosest(180, 40);
      const exitBr = takeClosest(exit, 40);
      // ramena skoro ve stejném směru (dvě cesty těsně vedle sebe) spojit
      const sides = [];
      rel.filter(r => !ignoredBranch(r.tags)).forEach(r => {
        const a = Math.round(r.a / 5) * 5;
        if(Math.abs(RB.angleDiff(a, exit)) < 20) return;
        if(Math.abs(Math.abs(a) - 180) < 25) return;
        if(!sides.some(x => Math.abs(RB.angleDiff(x, a)) < 20)) sides.push(a);
      });
      return { s: j.s, exit: Math.round(exit / 5) * 5, sides, road: exitBr ? roadOf(exitBr.tags) : null };
    }).filter(j => j && j.sides.length);
  }

  // rychlé hledání nejbližší cesty OSM (pro typ cesty)
  function wayIndex(osm){
    const CELL = 0.0006, grid = new Map();
    const key = (la, lo) => Math.floor(la / CELL) + '_' + Math.floor(lo / CELL);
    osm.ways.forEach(w => {
      for(let k = 1; k < w.nodes.length; k++){
        const a = osm.nodes.get(w.nodes[k-1]), b = osm.nodes.get(w.nodes[k]);
        if(!a || !b) continue;
        const seg = { a, b, tags: w.tags };
        const la0 = Math.min(a.lat, b.lat), la1 = Math.max(a.lat, b.lat), lo0 = Math.min(a.lon, b.lon), lo1 = Math.max(a.lon, b.lon);
        for(let la = Math.floor(la0 / CELL); la <= Math.floor(la1 / CELL); la++)
          for(let lo = Math.floor(lo0 / CELL); lo <= Math.floor(lo1 / CELL); lo++){
            const kk = la + '_' + lo;
            if(!grid.has(kk)) grid.set(kk, []);
            grid.get(kk).push(seg);
          }
      }
    });
    return function nearest(lat, lon){
      const kx = 111320 * Math.cos(lat * D2R), ky = 110540;
      let best = null, bd = Infinity;
      const ci = Math.floor(lat / CELL), cj = Math.floor(lon / CELL);
      for(let a = -1; a <= 1; a++) for(let b = -1; b <= 1; b++){
        (grid.get((ci + a) + '_' + (cj + b)) || []).forEach(sg => {
          const ax = sg.a.lon*kx, ay = sg.a.lat*ky, bx = sg.b.lon*kx, by = sg.b.lat*ky, px = lon*kx, py = lat*ky;
          const dx = bx-ax, dy = by-ay, L2 = dx*dx + dy*dy;
          let t = L2 > 0 ? ((px-ax)*dx + (py-ay)*dy) / L2 : 0; t = Math.max(0, Math.min(1, t));
          const d = Math.hypot(px - (ax + dx*t), py - (ay + dy*t));
          if(d < bd){ bd = d; best = sg; }
        });
      }
      return best ? { tags: best.tags, dist: bd } : null;
    };
  }

  function poiIcon(tags){
    if(tags.ford && tags.ford !== 'no') return 'brod';
    if(tags.barrier) return 'zavora';
    if(tags.railway === 'level_crossing') return 'prejezd';
    if(tags.amenity === 'fuel') return 'benzinka';
    return null;
  }

  // =============================================================
  // Generování roadbooku
  // =============================================================
  function newItem(R, s, extra){
    const p = RB.pointAt(R, s);
    return Object.assign({
      id: RB.uid(), s, lat: +p[0].toFixed(6), lon: +p[1].toFixed(6),
      exit: 0, sides: [], round: false, icons: [], danger: 0, road: null,
      note: '', sub: '', src: 'auto', edited: false, review: false, deleted: false
    }, extra || {});
  }

  // opts: { minAngle, useOsm, onProgress(text) }
  RB.generate = async function(points, opts){
    opts = opts || {};
    const minAngle = opts.minAngle || 30;
    const R = RB.prepareRoute(points);
    let items = detectTurns(R, minAngle).map(t => newItem(R, t.s, { exit: t.exit }));
    let osmOk = false, osmError = null;
    if(opts.useOsm !== false){
      try{
        const osm = await fetchOsm(R, (i, n) => opts.onProgress && opts.onProgress('Stahuji cesty z OpenStreetMap ' + i + '/' + n + '…'));
        osmOk = true;
        if(opts.onProgress) opts.onProgress('Hledám křižovatky…');
        findJunctions(R, osm).forEach(j => {
          const near = items.find(it => Math.abs(it.s - j.s) < 30);
          if(near){
            near.sides = j.sides; near.s = j.s; near.road = j.road || near.road;
            const p = RB.pointAt(R, j.s); near.lat = +p[0].toFixed(6); near.lon = +p[1].toFixed(6);
            near.exit = exitAngle(R, j.s);
          } else {
            items.push(newItem(R, j.s, { exit: Math.abs(j.exit) <= 20 ? 0 : j.exit, sides: j.sides, road: j.road }));
          }
        });
        osm.pois.forEach(poi => {
          const ic = poiIcon(poi.tags);
          if(!ic) return;
          const p = RB.project(R, poi.lat, poi.lon);
          const lim = ic === 'benzinka' ? 80 : 25;
          if(p.dist > lim) return;
          const near = items.find(it => Math.abs(it.s - p.s) < 40);
          if(near){ if(!near.icons.includes(ic)) near.icons.push(ic); }
          else items.push(newItem(R, p.s, { exit: 0, icons: [ic] }));
        });
        // typ cesty za instrukcí
        const nearest = wayIndex(osm);
        items.forEach(it => {
          if(it.road) return;
          const q = RB.pointAt(R, Math.min(R.total, it.s + 25));
          const w = nearest(q[0], q[1]);
          it.road = w && w.dist < 15 ? roadOf(w.tags) : 'mimo';
        });
      }catch(e){ osmError = e; }
    }
    // start a cíl
    items = items.filter(it => it.s > 10 && R.total - it.s > 10);
    items.push(newItem(R, 0, { kind: 'start' }));
    items.push(newItem(R, R.total, { kind: 'finish' }));
    items.sort((a, b) => a.s - b.s);
    // instrukce blíž než 20 m od sebe sloučit
    const merged = [];
    items.forEach(it => {
      const m = merged[merged.length - 1];
      if(m && it.s - m.s < 20 && !it.kind && !m.kind){
        if(Math.abs(it.exit) > Math.abs(m.exit)) m.exit = it.exit;
        it.sides.forEach(a => { if(!m.sides.some(x => Math.abs(RB.angleDiff(x, a)) < 20)) m.sides.push(a); });
        it.icons.forEach(k => { if(!m.icons.includes(k)) m.icons.push(k); });
        m.road = m.road || it.road;
        return;
      }
      merged.push(it);
    });
    RB.recompute(R, merged);
    return { items: merged, osmOk, osmError, R };
  };

  // dopočítá CAP (kurz za instrukcí) podle polohy na trase
  RB.recompute = function(R, items){
    items.sort((a, b) => a.s - b.s);
    items.forEach(it => {
      const b = RB.bearingBetween(R, it.s, Math.min(R.total, it.s + 40));
      it.cap = b == null ? (it.cap || 0) : Math.round(b) % 360;
    });
    return items;
  };

  // Ruční úpravy ze starého roadbooku přenese na nově vygenerovaný (po změně GPX
  // nebo po „Vygenerovat znovu“). Ručně přidané a upravené instrukce zůstanou;
  // co už na trase neleží, dostane příznak „ke kontrole“. Smazané automatické
  // instrukce zůstávají potlačené.
  RB.remap = function(R, oldItems, freshItems){
    const keep = [], suppress = [];
    (oldItems || []).forEach(o => {
      if(!(o.src === 'manual' || o.edited || o.deleted)) return;
      const p = RB.project(R, o.lat, o.lon);
      const on = p.dist <= 25;
      if(o.deleted){ if(on) { const q = RB.pointAt(R, p.s); suppress.push(Object.assign({}, o, { s: p.s, lat: +q[0].toFixed(6), lon: +q[1].toFixed(6) })); } return; }
      const q = on ? RB.pointAt(R, p.s) : null;
      const it = Object.assign({}, o, { s: p.s, review: !on || !!o.review });
      if(q){ it.lat = +q[0].toFixed(6); it.lon = +q[1].toFixed(6); }
      keep.push(it);
      if(o.src === 'auto') suppress.push(it);
    });
    const kinds = new Set(keep.filter(k => k.kind).map(k => k.kind));
    const fresh = (freshItems || []).filter(f => {
      if(f.kind) return !kinds.has(f.kind);
      return !suppress.some(x => Math.abs(x.s - f.s) < 30);
    }).map(f => f.kind ? Object.assign(f, { s: f.kind === 'start' ? 0 : R.total }) : f);
    const all = keep.concat(fresh, suppress.filter(x => x.deleted));
    // start / cíl vždy na začátku / konci trasy
    all.forEach(it => { if(it.kind === 'start') it.s = 0; if(it.kind === 'finish') it.s = R.total; });
    return RB.recompute(R, all);
  };

  // Všechny instrukce jen posune na nejbližší místo nové trasy (bez přegenerování –
  // pro NAVI, které se nemá čekat na OpenStreetMap). Co na trase neleží, je „ke kontrole“.
  RB.reproject = function(R, oldItems){
    const out = (oldItems || []).map(o => {
      if(o.kind === 'start') return Object.assign({}, o, { s: 0 });
      if(o.kind === 'finish') return Object.assign({}, o, { s: R.total });
      const p = RB.project(R, o.lat, o.lon);
      return Object.assign({}, o, { s: p.s, review: p.dist > 25 || !!o.review });
    });
    return RB.recompute(R, out);
  };

  // =============================================================
  // Kreslení
  // =============================================================
  function f1(n){ return (+n).toFixed(1); }
  // geometrie tulipánu ve viewBoxu 0 0 100 100 (vjezd dole uprostřed)
  RB.tulipGeom = function(exit, sides, round){
    exit = exit || 0; sides = sides || [];
    const dir = a => [Math.sin(a*D2R), -Math.cos(a*D2R)];
    const sideD = sides.map(a => { const s = dir(a), r0 = round ? 14 : 0; return 'M' + f1(50 + s[0]*r0) + ' ' + f1(50 + s[1]*r0) + ' L' + f1(50 + s[0]*36) + ' ' + f1(50 + s[1]*36); }).join(' ');
    if(!round && Math.abs(exit) > 150){
      const sg = exit > 0 ? 1 : -1, xe = 50 + sg*30, sw = sg > 0 ? 1 : 0;
      return { side: sideD, main: 'M50 90 L50 42 A15 15 0 0 ' + sw + ' ' + xe + ' 42 L' + xe + ' 62',
        head: 'M' + (xe-8) + ' 62 L' + xe + ' 78 L' + (xe+8) + ' 62 Z', hx: xe, hy: 78 };
    }
    const d = dir(exit), ex = 50 + d[0]*40, ey = 50 + d[1]*40, px = -d[1], py = d[0], bx = ex - d[0]*13, by = ey - d[1]*13;
    const main = round
      ? 'M50 90 L50 64 M64 50 A14 14 0 1 0 36 50 A14 14 0 1 0 64 50 M' + f1(50 + d[0]*14) + ' ' + f1(50 + d[1]*14) + ' L' + f1(bx) + ' ' + f1(by)
      : 'M50 90 L50 50 L' + f1(bx) + ' ' + f1(by);
    return { side: sideD, main, hx: ex, hy: ey,
      head: 'M' + f1(bx + px*8) + ' ' + f1(by + py*8) + ' L' + f1(ex) + ' ' + f1(ey) + ' L' + f1(bx - px*8) + ' ' + f1(by - py*8) + ' Z' };
  };
  RB.tulipSVG = function(it, size, o){
    o = o || {};
    const g = RB.tulipGeom(it.exit, it.sides, it.round);
    const sw = o.thin ? 7 : 8;
    let inner = '';
    if(it.kind === 'start'){
      inner = '<circle cx="50" cy="56" r="18" fill="none" stroke="#111" stroke-width="7"/><circle cx="50" cy="56" r="6" fill="#111"/>';
    } else if(it.kind === 'finish'){
      inner = '<path d="M28 82V22M28 24h44v26H28" fill="none" stroke="#111" stroke-width="6" stroke-linejoin="round"/><path d="M28 24h11v13H28zM50 24h11v13H50zM39 37h11v13H39zM61 37h11v13H61z" fill="#111"/>';
    } else {
      inner = (g.side ? '<path d="' + g.side + '" stroke="#8F8F8F" stroke-width="' + (sw - 1) + '" stroke-linecap="round" fill="none"/>' : '') +
        '<path d="' + g.main + '" stroke="#111" stroke-width="' + sw + '" stroke-linecap="round" stroke-linejoin="round" fill="none"/>' +
        '<path d="' + g.head + '" fill="#111" stroke="#111" stroke-width="3" stroke-linejoin="round"/>' +
        '<circle cx="50" cy="90" r="7" fill="#111"/>';
    }
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 100 100" aria-hidden="true">' + inner + '</svg>';
  };
  RB.iconSVG = function(key, size, color){
    const ic = RB.ICONS[key];
    if(!ic) return '';
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" aria-hidden="true"><path d="' + ic.d + '" stroke="' + (color || ic.color || '#111') + '" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  };
  RB.roadSVG = function(key, w, h){
    const r = RB.ROADS[key];
    if(!r) return '';
    return '<svg width="' + w + '" height="' + h + '" viewBox="0 0 100 40" aria-hidden="true"><path d="' + r.d + '" stroke="#111" stroke-width="' + r.w + '" stroke-dasharray="' + r.dash + '" fill="none"/></svg>';
  };
  RB.dangerHTML = function(level, cls){
    const d = RB.DANGER[level || 0];
    return d && d.mark ? '<span class="' + (cls || 'rb-danger') + '">' + d.mark + '</span>' : '';
  };

  // viditelné instrukce (bez smazaných), s dopočtenými km a dílčími úseky
  RB.visible = function(items){
    const vis = (items || []).filter(it => !it.deleted).sort((a, b) => a.s - b.s);
    vis.forEach((it, i) => { it.n = i + 1; it.par = i ? it.s - vis[i-1].s : 0; });
    return vis;
  };

  // =============================================================
  // Tisk: A5 (stránky) nebo nekonečný pás (plotr / tiskárna štítků)
  // Čte se odspodu nahoru – start je dole, další instrukce přibývají nahoru.
  // opts: { format:'a5'|'strip', width: mm (pás), legend: bool, mono: bool }
  // =============================================================
  function usedSymbols(vis){
    const icons = new Set(), roads = new Set(), dangers = new Set(), dirs = new Set(), tpl = { side:false, round:false };
    vis.forEach(it => {
      (it.icons || []).forEach(k => icons.add(k));
      if(it.road) roads.add(it.road);
      if(it.danger) dangers.add(it.danger);
      if(it.round) tpl.round = true;
      if(it.sides && it.sides.length) tpl.side = true;
      if(!it.kind) dirs.add(RB.dirName(it.exit, false).split(' ')[0]);
    });
    return { icons, roads, dangers, tpl };
  }
  function legendHTML(vis, mono){
    const u = usedSymbols(vis), cells = [];
    const cell = (sym, name, desc) => '<div class="lg"><div class="lg-s">' + sym + '</div><b>' + RB.esc(name) + '</b><span>' + RB.esc(desc) + '</span></div>';
    cells.push(cell(RB.tulipSVG({ exit: 90, sides: [0] }, '14mm'), 'Tulipán', 'tečka = odkud přijíždíš, šipka = kam jedeš, šedé = ostatní cesty'));
    if(u.tpl.round) cells.push(cell(RB.tulipSVG({ exit: 90, sides: [0, -90], round: true }, '14mm'), 'Kruhový objezd', 'výjezd podle šipky'));
    cells.push(cell(RB.tulipSVG({ exit: 165 }, '14mm'), 'Vracák', 'otočka do tvaru U'));
    u.icons.forEach(k => cells.push(cell(RB.iconSVG(k, '11mm', mono ? '#000' : null), RB.ICONS[k].name, RB.ICONS[k].desc)));
    u.roads.forEach(k => cells.push(cell(RB.roadSVG(k, '18mm', '7mm'), RB.ROADS[k].name, RB.ROADS[k].desc)));
    Array.from(u.dangers).sort().forEach(l => cells.push(cell('<span class="dg">' + RB.DANGER[l].mark + '</span>', RB.DANGER[l].name, RB.DANGER[l].desc)));
    cells.push(cell('<span class="capb">64°</span>', 'CAP', 'kurz za instrukcí ve stupních'));
    return '<div class="legend">' + cells.join('') + '</div>';
  }
  function rowHTML(it, mono){
    const icons = (it.icons || []).map(k => RB.iconSVG(k, '1.35em', mono ? '#000' : null)).join('');
    return '<div class="row">' +
      '<div class="c-n">' + it.n + '</div>' +
      '<div class="c-km"><b>' + RB.fmtKm(it.s) + '</b><span>' + RB.fmtKm(it.par) + '</span></div>' +
      '<div class="c-t">' + RB.tulipSVG(it, '100%') + '</div>' +
      '<div class="c-x"><div class="c-l">' + RB.dangerHTML(it.danger, 'dg') + '<b>' + RB.esc(RB.label(it)) + '</b>' + icons + '</div>' +
      '<div class="c-s">' + RB.esc(RB.subLabel(it)) + '</div>' + (it.kind === 'finish' ? '' : '<div class="c-cap">' + (it.cap || 0) + '°</div>') + '</div>' +
      '</div>';
  }
  RB.printHTML = function(routeName, totalM, items, opts){
    opts = opts || {};
    const vis = RB.visible(items).map(x => Object.assign({}, x));
    const mono = !!opts.mono;
    const title = RB.esc(routeName || 'Roadbook');
    const red = mono ? '#000' : '#C8191F';
    const base = `*{box-sizing:border-box}body{margin:0;font-family:'Exo 2',Arial,sans-serif;color:#000;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .row{display:grid;border-top:0.5mm solid #000}
      .row>div{border-right:0.4mm solid #000;display:flex;align-items:center;justify-content:center;min-width:0}
      .row>div:last-child{border-right:0}
      .c-n{font-weight:800}
      .c-km{flex-direction:column;align-items:flex-start!important;justify-content:center;padding-left:1.5mm;gap:1mm}
      .c-km b{font-weight:800;line-height:1}
      .c-km span{border:0.4mm solid #000;border-radius:0.8mm;padding:0 1mm;font-weight:700}
      .c-t svg{width:88%;height:88%}
      .c-x{flex-direction:column;align-items:stretch!important;justify-content:center!important;padding:1mm 1.8mm;gap:0.6mm;position:relative}
      .c-l{display:flex;align-items:center;gap:1.2mm;flex-wrap:wrap}
      .c-l b{font-weight:800;text-transform:uppercase;line-height:1.05}
      .c-s{line-height:1.2}
      .c-cap{position:absolute;right:1.2mm;bottom:1mm;border:0.4mm solid #000;border-radius:0.8mm;padding:0 1mm;font-weight:800}
      .dg{display:inline-block;background:${red};color:#fff;font-weight:800;padding:0 1.2mm;border-radius:0.8mm}
      .capb{border:0.4mm solid #000;border-radius:0.8mm;padding:0 1.2mm;font-weight:800}
      .legend{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:2mm}
      .lg{border:0.4mm solid #000;border-radius:1mm;padding:1.5mm;display:flex;flex-direction:column;align-items:center;text-align:center;gap:0.6mm;font-size:2.8mm}
      .lg-s{height:15mm;display:flex;align-items:center;justify-content:center}
      .lg span{font-size:2.4mm;color:#222}
      .hint{font-size:2.8mm;margin:0 0 3mm}`;
    let css = '', body = '';
    if(opts.format === 'strip'){
      const W = Math.max(40, Math.min(300, +opts.width || 80)), u = W / 80;
      const rowH = 24 * u, headH = 12 * u, startH = 18 * u, pad = 3;
      const PER = 60, pages = [];
      for(let i = 0; i < vis.length; i += PER) pages.push(vis.slice(i, i + PER));
      css = base + `@page{margin:0}
        .strip{width:${W}mm;padding:${pad}mm ${2*u}mm;font-size:${3.1*u}mm;page-break-after:always;break-after:page}
        .strip:last-child{page-break-after:auto;break-after:auto}
        .row{grid-template-columns:${6*u}mm ${17*u}mm ${20*u}mm minmax(0,1fr);height:${rowH}mm}
        .rows{border-left:0.5mm solid #000;border-right:0.5mm solid #000}
        .c-n{font-size:${2.6*u}mm}.c-km b{font-size:${5*u}mm}.c-km span{font-size:${2.7*u}mm}
        .c-l b{font-size:${3.4*u}mm}.c-s{font-size:${2.7*u}mm}.c-cap{font-size:${2.8*u}mm}
        .end{border:0.6mm solid #000;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;font-weight:800}
        .end.fin{height:${headH}mm;font-size:${3.6*u}mm;letter-spacing:0.4mm}
        .end.start{height:${startH}mm;font-size:${3.2*u}mm}
        .end.start small{font-size:${2.6*u}mm;font-weight:600}
        .lgwrap{padding:2mm 0}.legend{grid-template-columns:repeat(2,minmax(0,1fr))}`;
      // každý kus pásu má vlastní délku stránky (pojmenované stránky CSS)
      const lgCount = opts.legend ? (usedSymbols(vis).icons.size + usedSymbols(vis).roads.size + usedSymbols(vis).dangers.size + 4) : 0;
      pages.forEach((pg, pi) => {
        const H = 2*pad + headH + pg.length*rowH + (pi === 0 ? startH + (opts.legend ? Math.ceil(lgCount / 2) * 26 + 6 : 0) : 0) + 2;
        css += `@page rb${pi}{size:${W}mm ${Math.ceil(H)}mm;margin:0} .strip.p${pi}{page:rb${pi};height:${Math.ceil(H)}mm;overflow:hidden}`;
      });
      body = pages.map((pg, pi) => {
        const first = pi === 0, last = pi === pages.length - 1;
        const rows = pg.slice().reverse().map(it => rowHTML(it, mono)).join('');
        return '<div class="strip p' + pi + '">' +
          (last ? '<div class="end fin">CÍL · ' + RB.fmtKm(totalM) + ' km</div>' : '<div class="end fin">pokračuje na dalším pásu ↑</div>') +
          '<div class="rows">' + rows + '</div>' +
          (first ? '<div class="end start">CENDUROFF ROADBOOK<br>' + title + '<small>START ↑ čti odspodu nahoru</small></div>' : '') +
          (first && opts.legend ? '<div class="lgwrap">' + legendHTML(vis, mono) + '</div>' : '') +
          '</div>';
      }).join('');
    } else {
      // A5: 6 instrukcí na stránku, na každé stránce čtení odspodu nahoru
      const PER = 6, pages = [];
      for(let i = 0; i < vis.length; i += PER) pages.push(vis.slice(i, i + PER));
      const N = pages.length + (opts.legend ? 1 : 0);
      css = base + `@page{size:A5 portrait;margin:8mm}
        .page{width:132mm;height:193mm;display:flex;flex-direction:column;page-break-after:always;break-after:page;font-size:3.4mm}
        .page:last-child{page-break-after:auto;break-after:auto}
        .ph{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:0.8mm solid #000;padding-bottom:1.5mm;height:15mm}
        .ph .t1{font-size:2.6mm;font-weight:800;letter-spacing:0.5mm;color:#4F7048}
        .ph .t2{font-size:4.6mm;font-weight:800;line-height:1.1}
        .ph .r{text-align:right;font-size:3mm;font-weight:600}
        .rows{flex:1;display:flex;flex-direction:column;justify-content:flex-end;border-bottom:0.8mm solid #000}
        .row{grid-template-columns:7mm 24mm 27mm minmax(0,1fr);height:28.5mm}
        .c-n{font-size:3mm}.c-km b{font-size:6.4mm}.c-km span{font-size:3.2mm}
        .c-l b{font-size:4.2mm}.c-s{font-size:3.2mm}.c-cap{font-size:3.6mm}
        .pf{display:flex;justify-content:space-between;font-size:2.6mm;padding-top:1mm;color:#333}`;
      const head = (n) => '<div class="ph"><div><div class="t1">CENDUROFF ROADBOOK</div><div class="t2">' + title + '</div></div>' +
        '<div class="r">' + RB.fmtKm(totalM) + ' km · strana ' + n + ' / ' + N + '<br>↑ čti odspodu nahoru</div></div>';
      const foot = '<div class="pf"><span>CendurOFF Roadbook</span><span>km · CAP = kurz ve stupních</span></div>';
      let n = 0;
      if(opts.legend){
        n++;
        body += '<div class="page">' + head(n) + '<div style="flex:1;padding-top:4mm"><p class="hint">Symboly použité v tomto roadbooku:</p>' + legendHTML(vis, mono) + '</div>' + foot + '</div>';
      }
      body += pages.map(pg => { n++; return '<div class="page">' + head(n) + '<div class="rows">' + pg.slice().reverse().map(it => rowHTML(it, mono)).join('') + '</div>' + foot + '</div>'; }).join('');
    }
    return '<!DOCTYPE html><html lang="cs"><head><meta charset="utf-8"><title>Roadbook – ' + title + '</title>' +
      '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Exo+2:wght@500;600;700;800&display=swap">' +
      '<style>' + css + '</style></head><body>' + body +
      '<script>window.addEventListener("load",function(){setTimeout(function(){window.print();},500);});<\/script></body></html>';
  };

  window.CendurRB = RB;
})();
