// ---------------------------------------------------------------
// CendurOFF – společné víceúrovňové přibližování (+3 / + / − / −3), v3.6
// Používá Atlas NAVI, Atlas Planner i Roadbook NAVI.
//
//   CendurZoom.bind(map, { in1, out1, in3, out3 }, { min, max, after })
//     in1/out1/in3/out3 – tlačítka (element nebo id), chybějící se přeskočí
//     min/max           – meze přiblížení (výchozí 3 a 19)
//     after(z)          – zavolá se po změně (Atlas: znovu posadit šipku při sledování)
//
// Rychlé opakované klepnutí se sčítá (+3 +3 = +6) – počítá se od cílové úrovně
// právě běžící animace, ne od té staré.
// ---------------------------------------------------------------
(function(){
  // Leaflet během animace přiblížení další změnu ignoruje → cíl si držíme sami a po
  // doběhnutí animace ho případně dorovnáme
  function target(map){ return map._czBusy ? map._czTarget : map.getZoom(); }
  function apply(map, opt){
    const z = map._czTarget;
    if(z === map.getZoom()){ map._czBusy = false; return; }
    map._czBusy = true;
    clearTimeout(map._czTimer);
    const done = () => {
      clearTimeout(map._czTimer);
      map.off('zoomend', done);
      map._czBusy = false;
      if(typeof opt.after === 'function') opt.after(map.getZoom());
      if(map._czTarget !== map.getZoom()) apply(map, opt);
    };
    map.on('zoomend', done);
    map._czTimer = setTimeout(done, 900);   // pojistka, kdyby zoomend nepřišel
    // při sledování polohy (after) bez animace – šipka se hned vrátí na své místo
    map.setZoom(z, typeof opt.after === 'function' ? { animate:false } : undefined);
  }
  function by(map, d, opt){
    opt = opt || {};
    const min = opt.min != null ? opt.min : 3;
    const max = opt.max != null ? opt.max : 19;
    map._czTarget = Math.max(min, Math.min(max, Math.round(target(map)) + d));
    if(!map._czBusy) apply(map, opt);
    return map._czTarget;
  }
  // v3.9.1: SPOLEČNÉ klepnutí pro tlačítka na mapě (všechny stránky) – reaguje už na zvednutí
  // prstu nad tlačítkem, i když prst (v rukavici) při klepnutí trochu sjede; prohlížeč by takové
  // klepnutí jako „click“ zahodil. touch-action:none – prohlížeč dotyk nesmí vzít jako posun.
  //   CendurZoom.tap(el, fn)  – fn(e); opt.longMs + opt.onLong = podržení (např. nabídka mapy)
  function tap(el, fn, o){
    if(!el || el.dataset.czTap) return;
    el.dataset.czTap = '1';
    o = o || {};
    el.style.touchAction = 'none';
    let down = false, firedAt = 0, longT = null, longDone = false;
    el.addEventListener('pointerdown', () => {
      down = true; longDone = false;
      clearTimeout(longT);
      if(o.onLong) longT = setTimeout(() => { longDone = true; down = false; o.onLong(); }, o.longMs || 550);
    });
    el.addEventListener('pointercancel', () => { down = false; clearTimeout(longT); });
    el.addEventListener('pointerup', e => {
      clearTimeout(longT);
      if(!down) return;
      down = false;
      e.preventDefault();
      firedAt = Date.now();
      fn(e);
    });
    el.addEventListener('contextmenu', e => { if(o.onLong){ e.preventDefault(); clearTimeout(longT); down = false; longDone = true; o.onLong(); } });
    el.addEventListener('click', e => {
      e.preventDefault(); e.stopPropagation();
      if(longDone){ longDone = false; return; }
      if(Date.now() - firedAt < 700) return;      // už obslouženo přes pointerup
      fn(e);                                      // klávesnice, myš bez pointer událostí
    });
  }
  function bind(map, buttons, opt){
    const get = b => typeof b === 'string' ? document.getElementById(b) : b;
    [['in3', 3], ['in1', 1], ['out1', -1], ['out3', -3]].forEach(([k, d]) => {
      const el = get(buttons[k]);
      if(!el || el.dataset.czBound) return;
      el.dataset.czBound = '1';
      tap(el, () => {
        const m = typeof map === 'function' ? map() : map;
        if(m) by(m, d, typeof opt === 'function' ? opt() : opt);
      });
    });
  }
  window.CendurZoom = { target, by, bind, tap };
})();
