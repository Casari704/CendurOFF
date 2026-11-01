// ---------------------------------------------------------------
// CHKO (chráněné krajinné oblasti) – vrstva přes podkladovou mapu (v1.49)
// - zapíná se zaškrtávátkem v nabídce 🗺, nastavení je společné pro Atlas i Plánovač
// - hranice se stáhnou z OpenStreetMap jednou pro celou ČR + 100 km (regiondata.js),
//   zjednoduší se na ~10 m a uloží v prohlížeči na 7 dní
// - vykreslení: červená čára po obvodu + červené šrafování uvnitř
// - čáry nejsou klikací, takže nepřekáží v klikání do mapy (plánovač)
// ---------------------------------------------------------------
(function(){
  const STORE_KEY = 'chkoOn';
  const MIN_ZOOM = 7;
  const COLOR = '#D32F2F';

  let map = null, layer = null, toggleBtn = null, renderer = null, statusEl = null;
  function status(txt){ if(statusEl) statusEl.textContent = txt ? ' · ' + txt : ''; }
  let on = (()=>{ try{ return localStorage.getItem(STORE_KEY) === '1'; }catch(e){ return false; } })();
  const drawn = new Set();   // id oblastí už na mapě
  let areas = null, loading = false, retryTimer = null;

  function say(msg, ms){ if(typeof window.toast === 'function') window.toast(msg, ms); }

  // ---- skládání okrajových cest relace do uzavřených prstenců ----
  function samePt(a, b){ return a && b && Math.abs(a[0]-b[0]) < 1e-7 && Math.abs(a[1]-b[1]) < 1e-7; }
  function joinRings(ways){
    const rest = ways.filter(w=>w.length >= 2).map(w=>w.slice());
    const rings = [];
    while(rest.length){
      let ring = rest.shift();
      let grew = true;
      while(!samePt(ring[0], ring[ring.length-1]) && grew){
        grew = false;
        for(let i=0;i<rest.length;i++){
          const w = rest[i], end = ring[ring.length-1], start = ring[0];
          if(samePt(end, w[0])){ ring = ring.concat(w.slice(1)); }
          else if(samePt(end, w[w.length-1])){ ring = ring.concat(w.slice(0, -1).reverse()); }
          else if(samePt(start, w[w.length-1])){ ring = w.slice(0, -1).concat(ring); }
          else if(samePt(start, w[0])){ ring = w.slice(1).reverse().concat(ring); }
          else continue;
          rest.splice(i, 1); grew = true; break;
        }
      }
      if(ring.length >= 4) rings.push(ring);
    }
    return rings;
  }
  // Douglas-Peucker - zjednodušení čáry (tol ve stupních, 0.0001 ≈ 10 m)
  function simplify(pts, tol){
    if(pts.length < 4) return pts;
    const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length-1] = 1;
    const stack = [[0, pts.length-1]];
    const kx = Math.cos(pts[0][0] * Math.PI/180);
    while(stack.length){
      const [i0, i1] = stack.pop();
      const ax = pts[i0][1]*kx, ay = pts[i0][0], bx = pts[i1][1]*kx, by = pts[i1][0];
      const dx = bx-ax, dy = by-ay, len2 = dx*dx + dy*dy;
      let best = -1, bestD = tol*tol;
      for(let i=i0+1;i<i1;i++){
        const px = pts[i][1]*kx, py = pts[i][0];
        let t = len2 ? ((px-ax)*dx + (py-ay)*dy) / len2 : 0; t = Math.max(0, Math.min(1, t));
        const ex = ax + t*dx - px, ey = ay + t*dy - py, d = ex*ex + ey*ey;
        if(d > bestD){ bestD = d; best = i; }
      }
      if(best > 0){ keep[best] = 1; stack.push([i0, best], [best, i1]); }
    }
    return pts.filter((p, i)=>keep[i]);
  }
  function parseElements(elements){
    const out = [];
    (elements || []).forEach(el=>{
      const t = el.tags || {};
      let outer = [], inner = [];
      if(el.type === 'relation'){
        (el.members || []).forEach(m=>{
          if(m.type !== 'way' || !m.geometry) return;
          const pts = m.geometry.map(g=>[+g.lat.toFixed(5), +g.lon.toFixed(5)]);
          (m.role === 'inner' ? inner : outer).push(pts);
        });
      } else if(el.type === 'way' && el.geometry){
        outer.push(el.geometry.map(g=>[+g.lat.toFixed(5), +g.lon.toFixed(5)]));
      }
      const rings = joinRings(outer).concat(joinRings(inner)).map(r=>simplify(r, 0.0001)).filter(r=>r.length >= 4);
      if(rings.length) out.push({ id: el.type + el.id, name: t.name || 'CHKO', rings });
    });
    return out;
  }

  // ---- vykreslení ----
  function ensureHatch(){
    const svg = renderer && renderer._container;
    if(!svg || svg.querySelector('#chko-hatch')) return;
    const NS = 'http://www.w3.org/2000/svg';
    const defs = document.createElementNS(NS, 'defs');
    defs.innerHTML = `<pattern id="chko-hatch" patternUnits="userSpaceOnUse" width="12" height="12" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="12" stroke="${COLOR}" stroke-width="2.5" stroke-opacity="0.45"/></pattern>`;
    svg.insertBefore(defs, svg.firstChild);
  }
  function draw(areas){
    if(!layer) return;
    areas.forEach(a=>{
      if(!a.rings || drawn.has(a.id)) return;
      drawn.add(a.id);
      L.polygon(a.rings, {
        renderer, pane:'chko', interactive:false,
        color:COLOR, weight:1.5, opacity:0.75,
        fillColor:'url(#chko-hatch)', fillOpacity:1, fillRule:'evenodd'
      }).addTo(layer);
    });
    ensureHatch();
  }

  // ---- načtení pro celou oblast ČR + 100 km ----
  // CHKO poznáme podle názvu nebo druhu ochrany: „CHKO …“, „Chráněná krajinná oblast …“ (i slovensky „Chránená …“)
  const CHKO_RE = '(^|[^a-z])chko([^a-z]|$)|chr[aá]n[eěé]n[aá] krajinn[aá] oblas';
  function download(){
    const R = window.CendurRegion, bbox = R.bboxStr(R.REGION);
    status('stahuji…');
    const keys = '^(name|official_name|protection_title|protection_title:cs|designation)$';
    const q = `[out:json][timeout:180];(` +
      `relation["boundary"="protected_area"][~"${keys}"~"${CHKO_RE}",i](${bbox});` +
      `way["boundary"="protected_area"][~"${keys}"~"${CHKO_RE}",i](${bbox});` +
      `relation["leisure"="nature_reserve"][~"${keys}"~"${CHKO_RE}",i](${bbox});` +
      `);out geom;`;
    return R.overpass(q).then(d=>parseElements(d.elements));
  }
  function ensureLoaded(){
    if(areas || loading) return;
    if(!window.CendurRegion){ status('chyba'); say('CHKO: chybí soubor public/regiondata.js – nahraj ho na web.', 6000); return; }
    loading = true;
    status('načítám…');
    window.CendurRegion.load('chko', download, ()=>say('Stahuji hranice CHKO pro celou ČR + 100 km (jednou za týden)…', 3500)).then(list=>{
      areas = list; loading = false;
      status(list.length ? '' : 'nic nenalezeno');
      update();
    }).catch(err=>{
      loading = false;
      status('chyba, zkusím znovu');
      say('CHKO se nepodařilo stáhnout (' + (err && err.message || 'chyba') + '). Zkusím to znovu za 30 s.', 5000);
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
    if(!areas){ ensureLoaded(); return; }
    if(visible) draw(areas);
  }

  function sync(){
    if(!toggleBtn) return;
    toggleBtn.classList.toggle('active', on);
    toggleBtn.setAttribute('aria-checked', String(on));
  }
  function addToggle(menu){
    if(!menu || menu.querySelector('#chko-toggle')) return;
    if(!menu.querySelector('.layer-menu-sep')){
      menu.insertAdjacentHTML('beforeend', '<div class="layer-menu-title layer-menu-sep">Na mapě zobrazit</div>');
    }
    menu.insertAdjacentHTML('beforeend', '<button type="button" class="layer-opt layer-toggle" id="chko-toggle" role="menuitemcheckbox" aria-checked="false"><span class="layer-check"></span><span class="chko-swatch"></span><span>CHKO (chráněné krajinné oblasti)<small class="layer-status"></small></span></button>');
    toggleBtn = menu.querySelector('#chko-toggle');
    statusEl = toggleBtn.querySelector('.layer-status');
    toggleBtn.addEventListener('click', (e)=>{
      e.stopPropagation();   // nabídka zůstane otevřená
      on = !on;
      try{ localStorage.setItem(STORE_KEY, on ? '1' : '0'); }catch(err){}
      sync();
      if(!on) status('');
      update();
      if(on && map && map.getZoom() < MIN_ZOOM) say('CHKO se ukážou po přiblížení mapy.');
      else if(areas || !on) say(on ? 'CHKO zobrazeny.' : 'CHKO skryty.', 1800);
    });
    sync();
  }

  window.CendurChko = {
    // menu = #layer-menu; volá se, jakmile existuje mapa
    attach(m, menu){
      addToggle(menu);
      if(!m || map === m) return;
      map = m;
      if(!map.getPane('chko')){
        const pane = map.createPane('chko');
        pane.style.zIndex = 350;          // nad podkladem, pod trasami
        pane.style.pointerEvents = 'none';
      }
      renderer = L.svg({ pane:'chko', padding:0.5 });
      map.on('moveend', update);
      setTimeout(update, 400);
    },
    isOn(){ return on; }
  };
})();
