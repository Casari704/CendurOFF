// ---------------------------------------------------------------
// CendurOFF – hledání cesty z bodu A do bodu B (v4.59)
//   CendurRouting.find(a, b, mode) → Promise<[[lat, lon, výška|null], …]>
//   a, b = { lat, lng };  mode = 'teren' (foot_hiking – značené stezky) | 'silnice' (car_short)
// Mapy.com (REST routing); při výpadku nebo vyčerpání limitu 10 minut OpenStreetMap (BRouter).
// V Atlasu se výšky nehledají (šetří kredity); plánovač má vlastní kopii s výškami.
// ---------------------------------------------------------------
(function(){
  const MAPY_API = 'https://api.mapy.com/v1';
  const BROUTER_URL = 'https://brouter.de/brouter';
  const MAPY_TYPES = { teren:'foot_hiking', mix:'bike_mountain', silnice:'car_short' };
  let mapyDown = 0;   // do kdy Mapy.com nepoužívat
  const profileCache = {};

  function mapyKey(){ return (window.CendurMaps && window.CendurMaps.MAPY_KEY) || ''; }

  async function fetchJson(url, opt){
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25000);
    let res, text = '';
    try{
      res = await fetch(url, Object.assign({ signal: ctrl.signal }, opt || {}));
      text = await res.text();
    }catch(e){
      throw new Error(e && e.name === 'AbortError' ? 'timeout' : (e.message || String(e)));
    }finally{ clearTimeout(timer); }
    let data = null; try{ data = JSON.parse(text); }catch(e){}
    return { res, text, data };
  }

  async function viaMapy(a, b, mode){
    const type = MAPY_TYPES[mode] || 'foot_hiking';
    const url = MAPY_API + '/routing/route?start=' + a.lng.toFixed(6) + ',' + a.lat.toFixed(6) +
      '&end=' + b.lng.toFixed(6) + ',' + b.lat.toFixed(6) +
      '&routeType=' + type + '&format=geojson&lang=cs&apikey=' + encodeURIComponent(mapyKey());
    const { res, data } = await fetchJson(url);
    if(!res.ok){
      const code = data && Array.isArray(data.detail) && data.detail[0] && data.detail[0].errorCode;
      if(res.status === 404 && code === 7) throw new Error('position not mapped');
      if(res.status === 404 && code === 9) throw new Error('island');
      const err = new Error('Mapy.com ' + res.status); err.mapyDown = res.status !== 404 && res.status !== 422; throw err;
    }
    const coords = data && data.geometry && data.geometry.geometry && data.geometry.geometry.coordinates;
    if(!coords || coords.length < 2) throw new Error('prázdná trasa');
    return coords.map(c => [c[1], c[0], null]);
  }

  async function profileId(mode, force){
    const key = mode;
    if(!force && profileCache[key]) return profileCache[key];
    if(!window.CendurBRouterProfile) throw new Error('Chybí profil OSM plánovače.');
    const text = window.CendurBRouterProfile(mode, true);
    const { res, data } = await fetchJson(BROUTER_URL + '/profile', { method:'POST', headers:{ 'Content-Type':'text/plain' }, body:text });
    if(!res.ok || !data || !data.profileid) throw new Error('Profil plánovače: ' + ((data && data.error) || res.status));
    profileCache[key] = data.profileid;
    return data.profileid;
  }

  async function viaOsm(a, b, mode, retried){
    const profile = await profileId(mode, !!retried);
    const url = BROUTER_URL + '?lonlats=' + a.lng.toFixed(6) + ',' + a.lat.toFixed(6) + '|' + b.lng.toFixed(6) + ',' + b.lat.toFixed(6) +
      '&profile=' + encodeURIComponent(profile) + '&alternativeidx=0&format=geojson';
    const { res, text, data } = await fetchJson(url);
    if(!res.ok){
      if(!retried && /profile/i.test(text)) return viaOsm(a, b, mode, true);
      throw new Error(String(text).trim() || ('HTTP ' + res.status));
    }
    const coords = data && data.features && data.features[0] && data.features[0].geometry && data.features[0].geometry.coordinates;
    if(!coords || coords.length < 2) throw new Error('prázdná trasa');
    return coords.map(c => [c[1], c[0], c.length > 2 && c[2] != null ? Number(c[2]) : null]);
  }

  async function find(a, b, mode){
    mode = MAPY_TYPES[mode] ? mode : 'teren';
    if(Date.now() > mapyDown && mapyKey()){
      try{ return await viaMapy(a, b, mode); }
      catch(e){
        if(!e.mapyDown && !/Failed to fetch|NetworkError|Load failed|timeout/i.test(e.message)) throw e;
        mapyDown = Date.now() + 10 * 60000;
      }
    }
    return viaOsm(a, b, mode);
  }

  window.CendurRouting = { find, MAPY_TYPES };
})();
