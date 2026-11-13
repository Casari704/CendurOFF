// CendurOFF – šipky směru jízdy na linii trasy (v4.10)
//   const a = CendurArrows.attach(map, latlngs, { spacing: 90, size: 14, fill: '#fff', stroke: '#2F4A2A' });
//   a.remove()  – odebrat;  a.setLatLngs(ll) – jiná trasa
// Šipky jsou v pevných rozestupech na obrazovce (px), takže při přiblížení i oddálení vypadají stejně.
// Kreslí se jen v zobrazené části mapy (+ okraj) – i dlouhá trasa je rychlá.
(function(){
  if(!window.L) return;
  const PANE = 'cendurArrows';

  function icon(deg, o){
    const s = o.size;
    return L.divIcon({
      className: 'cendur-arrow',
      html: '<svg width="' + s + '" height="' + s + '" viewBox="0 0 16 16" style="display:block;transform:rotate(' + deg.toFixed(0) + 'deg)" aria-hidden="true">' +
            '<path d="M8 1.5 L14.2 13.8 L8 10.4 L1.8 13.8 Z" fill="' + o.fill + '" stroke="' + o.stroke + '" stroke-width="1.6" stroke-linejoin="round"/></svg>',
      iconSize: [s, s], iconAnchor: [s / 2, s / 2]
    });
  }

  function attach(map, latlngs, opts){
    const o = Object.assign({ spacing: 90, size: 14, fill: '#ffffff', stroke: '#2F4A2A', max: 400 }, opts || {});
    if(!map.getPane(PANE)){
      const p = map.createPane(PANE);
      p.style.zIndex = 450;            // nad linií trasy (400), pod značkami (600)
      p.style.pointerEvents = 'none';
    }
    const group = L.layerGroup().addTo(map);
    let ll = [], cacheZoom = null, pts = null, timer = null;

    function project(){
      const z = map.getZoom();
      if(cacheZoom === z && pts) return pts;
      cacheZoom = z;
      pts = ll.map(p => map.project(p, z));
      return pts;
    }
    function redraw(){
      timer = null;
      group.clearLayers();
      if(ll.length < 2 || !map._loaded) return;
      const P = project(), z = map.getZoom();
      const b = map.getPixelBounds();
      const pad = 60;
      const minX = b.min.x - pad, minY = b.min.y - pad, maxX = b.max.x + pad, maxY = b.max.y + pad;
      let carry = o.spacing / 2, n = 0;
      for(let i = 0; i < P.length - 1 && n < o.max; i++){
        const a = P[i], c = P[i + 1];
        const dx = c.x - a.x, dy = c.y - a.y, len = Math.hypot(dx, dy);
        if(len === 0) continue;
        // celý úsek mimo obrazovku → jen posunout počítadlo
        if((a.x < minX && c.x < minX) || (a.x > maxX && c.x > maxX) || (a.y < minY && c.y < minY) || (a.y > maxY && c.y > maxY)){
          carry = (carry - len) % o.spacing; if(carry < 0) carry += o.spacing;
          continue;
        }
        const deg = Math.atan2(dx, -dy) * 180 / Math.PI;
        let d = carry;
        while(d <= len && n < o.max){
          const x = a.x + dx * d / len, y = a.y + dy * d / len;
          if(x >= minX && x <= maxX && y >= minY && y <= maxY){
            L.marker(map.unproject(L.point(x, y), z), { icon: icon(deg, o), pane: PANE, interactive: false, keyboard: false }).addTo(group);
            n++;
          }
          d += o.spacing;
        }
        carry = d - len;
      }
    }
    function schedule(){ if(!timer) timer = setTimeout(redraw, 60); }
    map.on('zoomend moveend resize', schedule);

    const api = {
      setLatLngs(x){ ll = (x || []).map(p => L.latLng(p)); cacheZoom = null; pts = null; schedule(); return api; },
      redraw(){ cacheZoom = null; pts = null; redraw(); return api; },
      remove(){ map.off('zoomend moveend resize', schedule); if(timer) clearTimeout(timer); group.remove(); }
    };
    api.setLatLngs(latlngs);
    return api;
  }

  window.CendurArrows = { attach };
})();
