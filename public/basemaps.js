// ---------------------------------------------------------------
// CendurOFF – podkladové mapy (v3.8), společné pro Atlas, GPX planner a Roadbook planner
//   osm  = OpenStreetMap standard (výchozí)
//   mapy = turistická mapa Mapy.com (REST API, klíč níže)
//   sat  = satelit: v ČR letecké snímky ČÚZK, pod nimi Esri (vidět za hranicemi)
// v3.9: klepnutí na tlačítko přepíná mezi „mapou“ (OSM nebo Mapy.com – vybírá se v nabídce
// po podržení tlačítka) a satelitem. Volba se pamatuje (stejný klíč v prohlížeči
// na všech stránkách). Když dlaždice Mapy.com nejdou (špatný klíč, došly kredity, výpadek),
// mapa se sama přepne na OpenStreetMap, aby nezůstala šedá.
// ---------------------------------------------------------------
(function(){
  const MAPY_KEY = 'n4wfb3viWHe2NhkIAEa3qhWcSj7YbJR3IQpz-1B3wsg';
  const STORE = 'baseMap', STORE_STREET = 'baseStreet';
  const ORDER = ['osm', 'mapy', 'sat'];
  const NAMES = { osm:'OpenStreetMap', mapy:'Turistická (Mapy.com)', sat:'Satelit' };
  // v4.38: vlastní kreslené ikony (emoji vypadaly na každém zařízení jinak)
  const SVG_MAP = '<svg class="bm-ico" viewBox="0 0 28 28" aria-hidden="true">' +
    '<path d="M3.5 7.2 10 4.5l8 2.8 6.5-2.7v16.2L18 23.5l-8-2.8-6.5 2.7z" fill="#FBF8EE" stroke="#1E2A1E" stroke-width="1.8" stroke-linejoin="round"/>' +
    '<path d="M10 4.5v16.2M18 7.3v16.2" stroke="#1E2A1E" stroke-width="1.5"/>' +
    '<path d="M10 4.5l8 2.8v16.2l-8-2.8z" fill="#4F7048" fill-opacity="0.28"/>' +
    '<path d="M5.5 17.5c2.5-1 3.5-4 6.5-4.2s3.5 2.4 6.2 1.6 3-4 4.3-5.4" fill="none" stroke="#A8572E" stroke-width="1.8" stroke-linecap="round" stroke-dasharray="0.1 3.1"/>' +
    '</svg>';
  const SVG_SAT = '<svg class="bm-ico" viewBox="0 0 28 28" aria-hidden="true">' +
    '<g transform="rotate(-38 14 14)">' +
    '<rect x="-0.5" y="9.5" width="10" height="8.5" rx="1.2" fill="#4F7048" stroke="#1E2A1E" stroke-width="1.6"/>' +
    '<rect x="18.5" y="9.5" width="10" height="8.5" rx="1.2" fill="#4F7048" stroke="#1E2A1E" stroke-width="1.6"/>' +
    '<path d="M4.5 9.5v8.5M23.5 9.5v8.5M-0.5 13.75h10M18.5 13.75h10" stroke="#FBF8EE" stroke-width="1" stroke-opacity="0.85"/>' +
    '<path d="M9.5 13.75h1.6M16.9 13.75h1.6" stroke="#1E2A1E" stroke-width="1.6"/>' +
    '<rect x="10.8" y="8.6" width="6.4" height="10.3" rx="1.6" fill="#C79A3E" stroke="#1E2A1E" stroke-width="1.6"/>' +
    '<path d="M14 18.9v2.4" stroke="#1E2A1E" stroke-width="1.6" stroke-linecap="round"/>' +
    '<path d="M11.4 23.6a3.6 3.6 0 0 1 5.2 0" fill="none" stroke="#A8572E" stroke-width="1.6" stroke-linecap="round"/>' +
    '</g></svg>';
  const ICONS = { osm:SVG_MAP, mapy:SVG_MAP, sat:SVG_SAT };

  function get(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
  function put(k, v){ try{ localStorage.setItem(k, v); }catch(e){} }
  function loadStreet(){ return get(STORE_STREET) === 'mapy' ? 'mapy' : 'osm'; }
  function load(){
    const k = get(STORE);
    return k === 'sat' ? 'sat' : (k === 'mapy' || k === 'osm') ? k : loadStreet();
  }
  function save(k){ put(STORE, k); if(k !== 'sat') put(STORE_STREET, k); }

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
      osm: osmLayer(),
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
      street(){ return current === 'sat' ? loadStreet() : current; },
      other(){ return current === 'sat' ? api.street() : 'sat'; },
      icon(){ return ICONS[api.other()]; },              // tlačítko ukazuje, NA CO se přepne
      title(){ return 'Přepnout na: ' + NAMES[api.other()]; },
      set(k){
        if(!layers[k] || k === current) return;
        map.removeLayer(layers[current]);
        current = k; save(k); show(k);
        if(api._sync) api._sync();
        if(opt.onChange) opt.onChange(k);
      },
      // v3.9: volba mapy (OSM / Mapy.com / Satelit) jako první část nabídky vrstev
      renderMenu(menu){
        if(!menu || menu.querySelector('.base-opts')) return;
        const box = document.createElement('div');
        box.className = 'base-opts';
        box.innerHTML = ORDER.map(k => '<button type="button" class="layer-opt" data-base="' + k + '" role="menuitemradio"><span class="layer-radio"></span>' + NAMES[k] + '</button>').join('');
        const title = menu.querySelector('.layer-menu-title');
        if(title) title.after(box); else menu.prepend(box);
        const sync = () => box.querySelectorAll('[data-base]').forEach(b => {
          const on = b.dataset.base === current;
          b.classList.toggle('active', on); b.setAttribute('aria-checked', String(on));
        });
        box.addEventListener('click', e => {
          const b = e.target.closest('[data-base]'); if(!b) return;
          api.set(b.dataset.base); sync();
          menu.classList.remove('open');
          say('Mapa: ' + NAMES[current]);
        });
        sync();
        api._menuSync = sync;
      },
      toggle(){ api.set(api.other()); say('Mapa: ' + NAMES[current]); },
      // tlačítko: klepnutí = přepnout; podržení (nebo pravé tlačítko) = opt.onMenu (benzínky, CHKO)
      bindButton(btn, onMenu){
        if(!btn) return;
        const sync = () => { btn.innerHTML = api.icon(); btn.title = api.title() + (onMenu ? ' · podržením výběr mapy, benzínky, CHKO' : ''); };
        sync();
        // společné klepnutí (public/zoom.js): klepnutí = přepnout, podržení = nabídka
        const doToggle = () => { api.toggle(); sync(); if(api._menuSync) api._menuSync(); };
        if(window.CendurZoom && window.CendurZoom.tap) window.CendurZoom.tap(btn, doToggle, { onLong: onMenu });
        else btn.addEventListener('click', e => { e.stopPropagation(); doToggle(); });
        api._sync = sync;
      }
    };
    return api;
  }

  window.CendurMaps = { attach, MAPY_KEY, ORDER, NAMES };
})();
