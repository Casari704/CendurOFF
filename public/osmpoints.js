// ---------------------------------------------------------------
// Brody a závory na mapě – sdílený modul pro Atlas i GPX planner (v4.35)
// - dvě zaškrtávátka v nabídce 🗺 (Brody, Závory), nastavení společné pro obě stránky
// - data z OpenStreetMap po blocích 1° × 0,5° (~ 70 × 55 km) z našeho serveru (ten je drží 30 dní),
//   v prohlížeči se blok uloží na 14 dní → podruhé i bez signálu
// - v4.39: ukazují se od přiblížení 10 jako benzínky; do přiblížení 12 jen jako tečky (rychlé i při tisících bodů)
// ---------------------------------------------------------------
(function(){
  const authInit = o => (window.CendurAuthInit ? window.CendurAuthInit(o) : (o || {}));
  const MIN_ZOOM = 10, ICON_ZOOM = 13, MAX_BLOCKS = 12, KEEP_DAYS = 14;
  const DOT = { f:'#1E88E5', b:'#C62828' };
  const KINDS = {
    f: { key:'fordsOn', id:'ford-toggle', label:'Brody', cls:'osm-ford',
         svg:'<svg viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M2 15c2 0 2-1.5 4-1.5S8 15 10 15s2-1.5 4-1.5 2 1.5 4 1.5 2-1.5 4-1.5V16c-2 0-2 1.5-4 1.5S16 16 14 16s-2 1.5-4 1.5S8 16 6 16s-2 1.5-4 1.5zm0 4c2 0 2-1.5 4-1.5S8 19 10 19s2-1.5 4-1.5 2 1.5 4 1.5 2-1.5 4-1.5V20c-2 0-2 1.5-4 1.5S16 20 14 20s-2 1.5-4 1.5S8 20 6 20s-2 1.5-4 1.5zM7 4h10l-2 8H9z"/></svg>' },
    b: { key:'barriersOn', id:'barrier-toggle', label:'Závory', cls:'osm-barrier',
         svg:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="9" width="20" height="6" rx="1.5" fill="#fff"/><path d="M6 9h3l-3 6H3zm7 0h3l-3 6h-3zm7 0h2v2l-2 4h-3z" fill="#C62828"/></svg>' }
  };
  const BARRIER_NAMES = { gate:'Brána', lift_gate:'Závora', swing_gate:'Otočná závora', chain:'Řetěz přes cestu', bar:'Tyč přes cestu',
    log:'Kmen přes cestu', jersey_barrier:'Betonová zábrana', block:'Betonové bloky', kissing_gate:'Průchod jen pro pěší',
    stile:'Přelez jen pro pěší', 'full-height_turnstile':'Turniket' };
  const ACCESS = { private:'soukromá cesta', no:'zákaz vjezdu', permissive:'průjezd povolen', yes:'průjezd povolen', forestry:'jen lesní provoz',
    agricultural:'jen zemědělský provoz', destination:'jen dopravní obsluha', delivery:'jen zásobování', customers:'jen zákazníci' };

  let map = null, layer = null, canvas = null, mode = '';
  const on = {}, btn = {};
  Object.keys(KINDS).forEach(k => { try{ on[k] = localStorage.getItem(KINDS[k].key) === '1'; }catch(e){ on[k] = false; } });
  const cells = new Map();     // blok -> [[id, lat, lon, typ, a, b], …]
  const loading = new Set();
  const markers = new Map();   // id -> marker
  let retryTimer = null, hintShown = false, failShown = false;

  function say(msg, ms){ if(typeof window.toast === 'function') window.toast(msg, ms); }
  function esc(s){ return String(s||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function anyOn(){ return on.f || on.b; }

  function makeMarker(it){
    const [, lat, lon, typ, a, b] = it, K = KINDS[typ];
    const icon = L.divIcon({ className:'osm-marker', html:`<div class="osm-ico ${K.cls}">${K.svg}</div>`, iconSize:[22,22], iconAnchor:[11,11], popupAnchor:[0,-10] });
    const m = mode === 'dot'
      ? L.circleMarker([lat, lon], { renderer: canvas, radius: 4, color:'#fff', weight: 1.5, fillColor: DOT[typ], fillOpacity: 1 })
      : L.marker([lat, lon], { icon, keyboard:false, zIndexOffset:-500 });
    let title, extra = [];
    if(typ === 'f'){ title = 'Brod'; if(a) extra.push(a); }
    else { title = BARRIER_NAMES[a] || 'Zábrana na cestě'; if(b) extra.push(ACCESS[b] ? ACCESS[b][0].toUpperCase() + ACCESS[b].slice(1) : 'Přístup: ' + b); }
    m.bindTooltip(esc(title), { direction:'top', offset:[0,-10], className:'trail-tip' });
    m.bindPopup(`<div class="fuel-popup"><b>${esc(title)}</b>${extra.map(e=>`<div>${esc(e)}</div>`).join('')}</div>`);
    return m;
  }

  function cellsInView(){
    const b = map.getBounds().pad(0.1), out = [];
    const x0 = Math.floor(b.getWest()), x1 = Math.floor(b.getEast());
    const y0 = Math.floor(b.getSouth()*2), y1 = Math.floor(b.getNorth()*2);
    for(let x=x0;x<=x1;x++) for(let y=y0;y<=y1;y++) out.push(x + '_' + y);
    return out;
  }

  async function load(list){
    const R = window.CendurRegion;
    const need = [];
    for(const c of list){
      if(cells.has(c) || loading.has(c)) continue;
      loading.add(c);
      const saved = R && R.idbGet ? await R.idbGet('osmblk:' + c) : null;
      if(saved && saved.data && Date.now() - saved.t < KEEP_DAYS * 86400000){ cells.set(c, saved.data); loading.delete(c); }
      else need.push({ c, saved });
    }
    if(!need.length){ update(); return; }
    update();
    const api = (R && R.API) ? R.API() : (window.CENDUROFF_API_URL || 'https://api.cenduroff.cz');
    for(let i = 0; i < need.length; i += 4){
      const part = need.slice(i, i + 4);
      try{
        const res = await fetch(api + '/api/osm/blocks?ids=' + part.map(p => p.c).join(','), authInit());
        if(res.status === 429 && window.CendurLoginNeeded) window.CendurLoginNeeded(res);
        if(!res.ok) throw new Error('server ' + res.status);
        const j = await res.json();
        part.forEach(p => {
          const data = j.blocks && j.blocks[p.c];
          if(data){ cells.set(p.c, data); if(R && R.idbSet) R.idbSet('osmblk:' + p.c, { t: Date.now(), data }); }
          else if(p.saved && p.saved.data) cells.set(p.c, p.saved.data);   // starší kopie je lepší než nic
        });
        if(j.pending && j.pending.length){ clearTimeout(retryTimer); retryTimer = setTimeout(update, 15000); }
      }catch(e){
        part.forEach(p => { if(p.saved && p.saved.data) cells.set(p.c, p.saved.data); });
        if(!failShown){ failShown = true; say('Brody a závory se teď nepodařilo načíst – zkusím to znovu.', 3500); }
        clearTimeout(retryTimer); retryTimer = setTimeout(update, 30000);
      }finally{ part.forEach(p => loading.delete(p.c)); }
      update();
    }
  }

  function update(){
    if(!map) return;
    if(!layer) layer = L.layerGroup();
    const visible = anyOn() && map.getZoom() >= MIN_ZOOM;
    const want_mode = map.getZoom() >= ICON_ZOOM ? 'icon' : 'dot';
    if(want_mode !== mode){ markers.forEach(m => layer.removeLayer(m)); markers.clear(); mode = want_mode; }
    if(visible && !map.hasLayer(layer)) layer.addTo(map);
    if(!visible && map.hasLayer(layer)) map.removeLayer(layer);
    const want = new Set();
    if(visible){
      const list = cellsInView();
      if(list.length <= MAX_BLOCKS){
        const missing = list.filter(c => !cells.has(c) && !loading.has(c));
        if(missing.length) load(missing);
        const b = map.getBounds().pad(0.3);
        list.forEach(c => (cells.get(c) || []).forEach(it => {
          if(!on[it[3]] || !b.contains([it[1], it[2]])) return;
          want.add(it[0]);
          if(!markers.has(it[0])){ const m = makeMarker(it); markers.set(it[0], m); m.addTo(layer); }
        }));
      }
    }
    markers.forEach((m, id) => { if(!want.has(id) && !m.isPopupOpen()){ layer.removeLayer(m); markers.delete(id); } });
  }

  function sync(){
    Object.keys(KINDS).forEach(k => { if(btn[k]){ btn[k].classList.toggle('active', on[k]); btn[k].setAttribute('aria-checked', String(on[k])); } });
  }
  function addToggles(menu){
    if(!menu || menu.querySelector('#ford-toggle')) return;
    if(!menu.querySelector('.layer-menu-sep')) menu.insertAdjacentHTML('beforeend', '<div class="layer-menu-title layer-menu-sep">Na mapě zobrazit</div>');
    Object.keys(KINDS).forEach(k => {
      const K = KINDS[k];
      menu.insertAdjacentHTML('beforeend', `<button type="button" class="layer-opt layer-toggle" id="${K.id}" role="menuitemcheckbox" aria-checked="false"><span class="layer-check"></span><span>${K.label}</span></button>`);
      btn[k] = menu.querySelector('#' + K.id);
      btn[k].addEventListener('click', e => {
        e.stopPropagation();   // nabídka zůstane otevřená
        on[k] = !on[k];
        try{ localStorage.setItem(K.key, on[k] ? '1' : '0'); }catch(err){}
        sync(); update();
        const name = k === 'f' ? 'Brody' : 'Závory';
        if(on[k] && map && map.getZoom() < MIN_ZOOM && !hintShown){ hintShown = true; say(name + ' se ukážou po přiblížení mapy.'); }
        else say(name + (on[k] ? ' zobrazeny.' : ' skryty.'), 1800);
      });
    });
    sync();
  }

  window.CendurOsmPoints = {
    attach(m, menu){
      addToggles(menu);
      if(!m || map === m) return;
      map = m;
      canvas = L.canvas({ padding: 0.3 });
      map.on('moveend', update);
      setTimeout(update, 500);
    }
  };
})();
