// ---------------------------------------------------------------
// Benzínky (čerpací stanice) – sdílený modul pro Atlas i Plánovač (v1.50)
// - zapínají se zaškrtávátkem v nabídce 🗺, nastavení je společné pro obě stránky
// - data z OpenStreetMap se stáhnou JEDNOU pro celou ČR + 100 km (regiondata.js),
//   uloží se v prohlížeči na týden; na mapě se ukazují jen stanice v záběru (od přiblížení 10)
// ---------------------------------------------------------------
(function(){
  const STORE_KEY = 'fuelOn';
  const MIN_ZOOM = 10;
  const CELL = 0.1;                  // mřížka pro rychlé hledání stanic v záběru
  const SVG = '<svg viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M4 3h9a1 1 0 0 1 1 1v8h1.5a2.5 2.5 0 0 1 2.5 2.5V18a1 1 0 0 0 2 0v-6.6l-2.7-2.7a1 1 0 1 1 1.4-1.4l3 3a1 1 0 0 1 .3.7V18a3 3 0 0 1-6 0v-3.5a.5.5 0 0 0-.5-.5H14v7h1a1 1 0 1 1 0 2H2a1 1 0 1 1 0-2h1V4a1 1 0 0 1 1-1zm1.5 2v5h6V5h-6z"/></svg>';

  let map = null, layer = null, toggleBtn = null, statusEl = null;
  let on = (()=>{ try{ return localStorage.getItem(STORE_KEY) !== '0'; }catch(e){ return true; } })();
  let data = null, loading = false, retryTimer = null, hintShown = false;
  const grid = {};                   // "x_y" -> [stanice]
  const markers = new Map();         // id -> marker (jen ty, co jsou teď na mapě)
  try{ Object.keys(localStorage).filter(k=>k.startsWith('cenduroff.fuel.')).forEach(k=>localStorage.removeItem(k)); }catch(e){} // úklid ≤ v1.48

  function say(msg, ms){ if(typeof window.toast === 'function') window.toast(msg, ms); }
  function esc(s){ return String(s||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function status(txt){ if(statusEl) statusEl.textContent = txt ? ' · ' + txt : ''; }

  function icon(){
    return L.divIcon({ className:'fuel-marker', html:`<div class="fuel-ico">${SVG}</div>`, iconSize:[22,22], iconAnchor:[11,11], popupAnchor:[0,-10] });
  }
  function makeMarker(st){
    // kompaktní záznam: [id, lat, lon, název, značka, otevírací doba]
    const [, lat, lon, name, brand, hours] = st;
    const title = name || brand || 'Čerpací stanice';
    const extra = [brand && brand !== title ? brand : '', hours ? 'Otevřeno: ' + hours : ''].filter(Boolean);
    // interactive:false v plánovači by schovalo popup; klik na ikonu bod trasy nepřidá (Leaflet ho zastaví)
    const m = L.marker([lat, lon], { icon:icon(), keyboard:false, zIndexOffset:-500 });
    m.bindTooltip(esc(title), { direction:'top', offset:[0,-10], className:'trail-tip' });
    m.bindPopup(`<div class="fuel-popup"><b>⛽ ${esc(title)}</b>${extra.map(e=>`<div>${esc(e)}</div>`).join('')}</div>`);
    return m;
  }

  function download(){
    const R = window.CendurRegion;
    // 3 pruhy po sobě - menší dotazy než jeden obří
    return R.stripes(3).reduce((p, box, i)=>p.then(async acc=>{
      status('stahuji ' + (i+1) + '/3…');
      const b = R.bboxStr(box);
      const d = await R.overpass(`[out:json][timeout:120];(node["amenity"="fuel"](${b});way["amenity"="fuel"](${b}););out center tags;`);
      (d.elements || []).forEach(el=>{
        const t = el.tags || {};
        const lat = el.lat != null ? el.lat : (el.center && el.center.lat);
        const lon = el.lon != null ? el.lon : (el.center && el.center.lon);
        if(lat == null || lon == null) return;
        acc.push([el.type[0] + el.id, +lat.toFixed(6), +lon.toFixed(6), t.name || '', t.brand || t.operator || '', t.opening_hours || '']);
      });
      return acc;
    }), Promise.resolve([]));
  }
  function index(list){
    const seen = new Set();
    list.forEach(st=>{
      if(seen.has(st[0])) return; seen.add(st[0]);
      const k = Math.floor(st[2]/CELL) + '_' + Math.floor(st[1]/CELL);
      (grid[k] || (grid[k] = [])).push(st);
    });
    data = list;
  }
  function ensureLoaded(){
    if(data || loading) return;
    if(!window.CendurRegion){ status('chyba'); say('Benzínky: chybí soubor public/regiondata.js – nahraj ho na web.', 6000); return; }
    loading = true;
    status('načítám…');
    window.CendurRegion.load('fuel', download, ()=>say('Stahuji benzínky pro celou ČR + 100 km (jednou za týden, chvíli to trvá)…', 4000)).then(list=>{
      loading = false;
      index(list);
      status(list.length ? '' : 'nic nenalezeno');
      update();
    }).catch(err=>{
      loading = false;
      status('chyba, zkusím znovu');
      say('Benzínky se nepodařilo stáhnout (' + (err && err.message || 'chyba') + '). Zkusím to znovu za 30 s.', 5000);
      clearTimeout(retryTimer);
      retryTimer = setTimeout(()=>{ if(on) ensureLoaded(); }, 30000);
    });
  }
  function update(){
    if(!map) return;
    if(!layer) layer = L.layerGroup();
    const visible = on && map.getZoom() >= MIN_ZOOM;
    if(visible && !map.hasLayer(layer)) layer.addTo(map);
    if(!visible && map.hasLayer(layer)) map.removeLayer(layer);
    if(!on) return;
    if(!data){ ensureLoaded(); return; }
    if(!visible) return;
    const b = map.getBounds().pad(0.3);
    const x0 = Math.floor(b.getWest()/CELL), x1 = Math.floor(b.getEast()/CELL);
    const y0 = Math.floor(b.getSouth()/CELL), y1 = Math.floor(b.getNorth()/CELL);
    const want = new Set();
    for(let x=x0;x<=x1;x++) for(let y=y0;y<=y1;y++){
      (grid[x + '_' + y] || []).forEach(st=>{
        want.add(st[0]);
        if(!markers.has(st[0])){ const m = makeMarker(st); markers.set(st[0], m); m.addTo(layer); }
      });
    }
    markers.forEach((m, id)=>{
      if(!want.has(id) && !m.isPopupOpen()){ layer.removeLayer(m); markers.delete(id); }
    });
  }

  function sync(){
    if(!toggleBtn) return;
    toggleBtn.classList.toggle('active', on);
    toggleBtn.setAttribute('aria-checked', String(on));
  }
  function addToggle(menu){
    if(!menu || menu.querySelector('#fuel-toggle')) return;
    if(!menu.querySelector('.layer-menu-sep')) menu.insertAdjacentHTML('beforeend', '<div class="layer-menu-title layer-menu-sep">Na mapě zobrazit</div>');
    menu.insertAdjacentHTML('beforeend', '<button type="button" class="layer-opt layer-toggle" id="fuel-toggle" role="menuitemcheckbox" aria-checked="false"><span class="layer-check"></span><span>⛽ Čerpací stanice<small class="layer-status"></small></span></button>');
    toggleBtn = menu.querySelector('#fuel-toggle');
    statusEl = toggleBtn.querySelector('.layer-status');
    toggleBtn.addEventListener('click', (e)=>{
      e.stopPropagation();   // nabídka zůstane otevřená
      on = !on;
      try{ localStorage.setItem(STORE_KEY, on ? '1' : '0'); }catch(err){}
      sync();
      if(!on) status('');
      update();
      if(on && map && map.getZoom() < MIN_ZOOM && !hintShown){ hintShown = true; say('Benzínky se ukážou po přiblížení mapy.'); }
      else if(data || !on) say(on ? 'Benzínky zobrazeny.' : 'Benzínky skryty.', 1800);
    });
    sync();
  }

  window.CendurFuel = {
    attach(m, menu){
      addToggle(menu);
      if(!m || map === m) return;
      map = m;
      map.on('moveend', update);
      setTimeout(update, 400);
    }
  };
})();
