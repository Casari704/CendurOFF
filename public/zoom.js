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
  function bind(map, buttons, opt){
    const get = b => typeof b === 'string' ? document.getElementById(b) : b;
    [['in3', 3], ['in1', 1], ['out1', -1], ['out3', -3]].forEach(([k, d]) => {
      const el = get(buttons[k]);
      if(!el || el.dataset.czBound) return;
      el.dataset.czBound = '1';
      el.addEventListener('click', e => {
        e.preventDefault();
        const m = typeof map === 'function' ? map() : map;
        if(m) by(m, d, typeof opt === 'function' ? opt() : opt);
      });
    });
  }
  window.CendurZoom = { target, by, bind };
})();
