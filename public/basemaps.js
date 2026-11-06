// ---------------------------------------------------------------
// CendurOFF – podkladové mapy (v3.8), společné pro Atlas, Atlas Planner a Roadbook planner
//   mapy = turistická mapa Mapy.com (REST API, klíč níže)
//   sat  = satelit: v ČR letecké snímky ČÚZK, pod nimi Esri (vidět za hranicemi)
// Klepnutí na tlačítko přepíná mezi těmi dvěma. Volba se pamatuje (stejný klíč v prohlížeči
// na všech stránkách). Když dlaždice Mapy.com nejdou (špatný klíč, došly kredity, výpadek),
// mapa se sama přepne na OpenStreetMap, aby nezůstala šedá.
// ---------------------------------------------------------------
(function(){
  const MAPY_KEY = 'n4wfb3viWHe2NhkIAEa3qhWcSj7YbJR3IQpz-1B3wsg';
  const STORE = 'baseMap';
  const ORDER = ['mapy', 'sat'];
  const NAMES = { mapy:'Turistická (Mapy.com)', sat:'Satelit' };
  const ICONS = { mapy:'🗺', sat:'🛰' };

  function load(){
    let k = null; try{ k = localStorage.getItem(STORE); }catch(e){}
    return k === 'sat' ? 'sat' : 'mapy';     // staré volby (osm, topo) → Mapy.com
  }
  function save(k){ try{ localStorage.setItem(STORE, k); }catch(e){} }

  function osmLayer(){
    return L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:19, attribution:'© OpenStreetMap contributors' });
  }
  function satLayer(){
    return L.layerGroup([
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom:19, attribution:'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics' }),
      L.tileLayer('https://ags.cuzk.gov.cz/arcgis1/rest/services/ORTOFOTO_WM/MapServer/tile/{z}/{y}/{x}', { maxZoom:19, maxNativeZoom:20, attribution:'Ortofoto © ČÚZK' })
    ]);
  }
  // Mapy.com turistická; na displejích s vysokým rozlišením ostřejší (retina) dlaždice
  function mapyLayer(onFail){
    const size = (window.devicePixelRatio || 1) > 1.4 ? '256@2x' : '256';
    const tiles = L.tileLayer('https://api.mapy.com/v1/maptiles/outdoor/' + size + '/{z}/{x}/{y}?apikey=' + MAPY_KEY, {
      minZoom:0, maxZoom:19, maxNativeZoom:18, tileSize:256,
      attribution:'<a href="https://api.mapy.com/copyright" target="_blank" rel="noopener">© Seznam.cz a.s. a další</a>'
    });
    const group = L.layerGroup([tiles]);
    let ok = 0, bad = 0, failed = false;
    tiles.on('tileload', () => { ok++; });
    tiles.on('tileerror', () => {
      bad++;
      if(!failed && ok === 0 && bad >= 6){
        failed = true;
        group.removeLayer(tiles);
        group.addLayer(osmLayer());
        if(onFail) onFail();
      }
    });
    return group;
  }
  // logo Mapy.com (podmínka použití API) – vidět jen u jejich mapy
  const LogoCtl = L.Control.extend({
    options:{ position:'bottomleft' },
    onAdd(){
      const a = L.DomUtil.create('a', 'mapy-logo');
      a.href = 'https://mapy.com/'; a.target = '_blank'; a.rel = 'noopener';
      a.innerHTML = '<img src="https://api.mapy.com/img/api/logo.svg" alt="Mapy.com" width="100" height="25">';
      L.DomEvent.disableClickPropagation(a);
      return a;
    }
  });

  // map = Leaflet mapa; opt.onChange(k) po přepnutí; opt.toast(text) pro hlášky
  function attach(map, opt){
    opt = opt || {};
    const say = t => { if(opt.toast) opt.toast(t); };
    const layers = {
      mapy: mapyLayer(() => say('Mapy.com teď nejdou – zobrazuji OpenStreetMap.')),
      sat: satLayer()
    };
    const logo = new LogoCtl();
    let current = load();
    function show(k){
      layers[k].addTo(map);
      if(k === 'mapy') logo.addTo(map); else logo.remove();
    }
    show(current);
    const api = {
      get current(){ return current; },
      names: NAMES,
      other(){ return current === 'mapy' ? 'sat' : 'mapy'; },
      icon(){ return ICONS[api.other()]; },              // tlačítko ukazuje, NA CO se přepne
      title(){ return 'Přepnout na: ' + NAMES[api.other()]; },
      set(k){
        if(!layers[k] || k === current) return;
        map.removeLayer(layers[current]);
        current = k; save(k); show(k);
        if(opt.onChange) opt.onChange(k);
      },
      toggle(){ api.set(api.other()); say('Mapa: ' + NAMES[current]); },
      // tlačítko: klepnutí = přepnout; podržení (nebo pravé tlačítko) = opt.onMenu (benzínky, CHKO)
      bindButton(btn, onMenu){
        if(!btn) return;
        const sync = () => { btn.textContent = api.icon(); btn.title = api.title() + (onMenu ? ' · podržením další vrstvy (benzínky, CHKO)' : ''); };
        sync();
        let t = null, long = false;
        const start = () => { long = false; clearTimeout(t); if(onMenu) t = setTimeout(() => { long = true; onMenu(); }, 550); };
        const stop = () => clearTimeout(t);
        btn.addEventListener('pointerdown', start);
        ['pointerup','pointerleave','pointercancel'].forEach(ev => btn.addEventListener(ev, stop));
        btn.addEventListener('contextmenu', e => { e.preventDefault(); if(onMenu){ long = true; onMenu(); } });
        btn.addEventListener('click', e => {
          e.stopPropagation();
          if(long){ long = false; return; }
          api.toggle(); sync();
        });
        api._sync = sync;
      }
    };
    return api;
  }

  window.CendurMaps = { attach, MAPY_KEY, ORDER, NAMES };
})();
