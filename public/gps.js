// ---------------------------------------------------------------
// CendurOFF – společná poloha (v4.0) pro Atlas NAVI a Roadbook NAVI
//
//  1) nepřesné polohy pryč: když telefon ztratí satelity (most, tunel, hluboké údolí), pošle
//     polohu z mobilní sítě / Wi-Fi s přesností stovek metrů – ta se zahodí, dokud byla
//     nedávno dobrá poloha z GPS (šipka zůstane na posledním dobrém místě)
//  2) nesmyslné skoky pryč: poloha, která by znamenala rychlost přes ~250 km/h, je chyba měření
//  3) dopočet při výpadku: bez polohy (déle než 2,5 s) a za jízdy se poloha dopočítává podle
//     poslední rychlosti a směru – nebo po sledované trase (setPredictor), nejvýš 30 s
//  4) zdroj: v aplikaci pro Android (od 2.16) poloha přímo z GPS čipu (CendurApp.startGps),
//     jinak z prohlížeče
//
//  const w = CendurGPS.watch(onFix, onError, { predict:true, onStatus })
//    onFix(pos)  – pos jako Geolocation Position ({ coords:{latitude, longitude, accuracy, speed,
//                  heading}, timestamp }) + pos.predicted (dopočtená) + pos.weak (nepřesná)
//    onStatus(s) – s = { state:'ok'|'weak'|'predict'|'lost'|'wait', accuracy, age, native }
//    w.setPredictor(fn) – fn(lastPos, metrů) → { lat, lon, heading } | null (po trase)
//    w.stop()
// ---------------------------------------------------------------
(function(){
  const ACC_GOOD = 35;          // m – přesnější poloha je „dobrá“
  const ACC_WEAK_MAX = 2000;    // m – horší se nebere nikdy
  const WEAK_GRACE_MS = 25000;  // tak dlouho po poslední dobré poloze se nepřesné zahazují
  const MAX_SPEED = 70;         // m/s (~250 km/h) – rychlejší „přesun“ je chyba měření
  const JUMP_RESYNC = 3;        // tolikrát po sobě stejně „odskočená“ poloha = skutečná změna
  const PREDICT_AFTER_MS = 2500, PREDICT_MAX_MS = 30000, PREDICT_MIN_SPEED = 2;  // m/s
  const LOST_MS = 30000;

  const subs = new Set();
  let browserWatch = null, nativeOn = false, timer = null;
  let last = null;              // poslední přijatá poloha {lat, lon, acc, speed, heading, t}
  let lastGoodAt = 0, jumpCount = 0, jumpRef = null, lastStatus = '';

  function hav(a, b){
    const R = 6371000, toR = Math.PI / 180;
    const dLat = (b[0] - a[0]) * toR, dLon = (b[1] - a[1]) * toR;
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * toR) * Math.cos(b[0] * toR) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
  }
  function dest(lat, lon, brg, d){
    const R = 6371000, toR = Math.PI / 180, b = brg * toR, la = lat * toR, lo = lon * toR, dr = d / R;
    const la2 = Math.asin(Math.sin(la) * Math.cos(dr) + Math.cos(la) * Math.sin(dr) * Math.cos(b));
    const lo2 = lo + Math.atan2(Math.sin(b) * Math.sin(dr) * Math.cos(la), Math.cos(dr) - Math.sin(la) * Math.sin(la2));
    return [la2 / toR, lo2 / toR];
  }
  function bearing(a, b){
    const toR = Math.PI / 180, y = Math.sin((b[1] - a[1]) * toR) * Math.cos(b[0] * toR);
    const x = Math.cos(a[0] * toR) * Math.sin(b[0] * toR) - Math.sin(a[0] * toR) * Math.cos(b[0] * toR) * Math.cos((b[1] - a[1]) * toR);
    return (Math.atan2(y, x) / toR + 360) % 360;
  }
  function mkPos(lat, lon, acc, speed, heading, t, extra){
    return Object.assign({ coords:{ latitude:lat, longitude:lon, accuracy:acc, speed:speed, heading:heading, altitude:null }, timestamp:t }, extra || {});
  }
  function status(state, extra){
    const s = Object.assign({ state, native:nativeOn, accuracy: last ? last.acc : null, age: last ? Date.now() - last.t : null }, extra || {});
    const key = state + '|' + (s.accuracy != null ? Math.round(s.accuracy / 10) : '');
    if(key === lastStatus && state !== 'predict') return;
    lastStatus = key;
    subs.forEach(w => { if(w.onStatus) try{ w.onStatus(s); }catch(e){} });
  }
  function emit(pos){ subs.forEach(w => { if(pos.predicted && !w.predict) return; try{ w.onFix(pos); }catch(e){ console.error(e); } }); }

  // jedna surová poloha z GPS (prohlížeč i aplikace)
  function raw(lat, lon, acc, speed, heading, t){
    if(!isFinite(lat) || !isFinite(lon)) return;
    acc = isFinite(acc) && acc > 0 ? acc : 50;
    speed = isFinite(speed) && speed >= 0 ? speed : null;
    heading = isFinite(heading) && heading >= 0 ? heading : null;
    t = t || Date.now();
    const now = Date.now();
    if(acc > ACC_WEAK_MAX){ status('weak', { accuracy: acc }); return; }
    const good = acc <= ACC_GOOD;
    // 1) nepřesná poloha, když jsme ještě nedávno měli dobrou → zahodit (šipka stojí / dopočítává se)
    if(!good && lastGoodAt && now - lastGoodAt < WEAK_GRACE_MS){ status('weak', { accuracy: acc }); return; }
    // 2) skok – vzdálenost od minulé polohy vůči času a přesnosti obou
    if(last){
      const dt = Math.max(0.5, (now - last.t) / 1000);
      const d = hav([last.lat, last.lon], [lat, lon]);
      const allowed = MAX_SPEED * dt + acc + last.acc + 30;
      if(dt < 60 && d > allowed){
        // opakovaně stejné „nové“ místo (např. po převozu) → přijmout
        if(jumpRef && hav(jumpRef, [lat, lon]) < 100 + acc) jumpCount++; else { jumpCount = 1; jumpRef = [lat, lon]; }
        if(jumpCount < JUMP_RESYNC){ status('weak', { accuracy: acc, jump: Math.round(d) }); return; }
      }
    }
    jumpCount = 0; jumpRef = null;
    // směr dopočítat z pohybu, když ho GPS neposlala
    if(heading == null && last && speed != null && speed > PREDICT_MIN_SPEED){
      const d = hav([last.lat, last.lon], [lat, lon]);
      if(d > 3) heading = bearing([last.lat, last.lon], [lat, lon]);
    }
    last = { lat, lon, acc, speed, heading, t: now };
    if(good) lastGoodAt = now;
    status(good ? 'ok' : 'weak', { accuracy: acc });
    emit(mkPos(lat, lon, acc, speed, heading, t, { weak: !good, predicted:false }));
  }

  // 3) dopočet při výpadku (běží každou sekundu)
  function tick(){
    if(!last) { status('wait'); return; }
    const age = Date.now() - last.t;
    if(age > LOST_MS){ status('lost'); return; }
    const wantPredict = [...subs].some(w => w.predict);
    if(!wantPredict || age < PREDICT_AFTER_MS || !(last.speed > PREDICT_MIN_SPEED) || age > PREDICT_MAX_MS) {
      if(age >= PREDICT_AFTER_MS) status('weak');
      return;
    }
    const meters = last.speed * age / 1000;
    let p = null;
    const w = [...subs].find(x => x.predict && x.predictor);
    if(w){ try{ p = w.predictor(mkPos(last.lat, last.lon, last.acc, last.speed, last.heading, last.t), meters); }catch(e){ p = null; } }
    if(!p && last.heading != null){ const q = dest(last.lat, last.lon, last.heading, meters); p = { lat:q[0], lon:q[1], heading:last.heading }; }
    if(!p) return;
    status('predict', { age });
    emit(mkPos(p.lat, p.lon, last.acc + age / 1000 * 3, last.speed, p.heading != null ? p.heading : last.heading, Date.now(), { predicted:true, weak:true }));
  }

  // zdroj polohy
  function startSource(){
    if(timer == null) timer = setInterval(tick, 1000);
    // aplikace pro Android 2.16+: přímo GPS čip (bez polohy z mobilní sítě)
    try{
      if(!nativeOn && window.CendurApp && typeof window.CendurApp.startGps === 'function' && window.CendurApp.startGps()){
        nativeOn = true;
      }
    }catch(e){ nativeOn = false; }
    if(nativeOn || browserWatch != null || !navigator.geolocation) return;
    browserWatch = navigator.geolocation.watchPosition(
      pos => { if(!nativeOn) raw(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy, pos.coords.speed, pos.coords.heading, pos.timestamp); },
      err => { subs.forEach(w => { if(w.onError) try{ w.onError(err); }catch(e){} }); },
      { enableHighAccuracy:true, maximumAge:0, timeout:15000 });
  }
  function stopSource(){
    if(browserWatch != null){ navigator.geolocation.clearWatch(browserWatch); browserWatch = null; }
    if(nativeOn){ try{ window.CendurApp.stopGps(); }catch(e){} nativeOn = false; }
    if(timer != null){ clearInterval(timer); timer = null; }
  }

  function watch(onFix, onError, opt){
    opt = opt || {};
    const w = { onFix, onError, onStatus: opt.onStatus, predict: !!opt.predict, predictor: null };
    subs.add(w);
    startSource();
    // kdo se připojí později, hned dostane poslední polohu (třeba výběr trasy → jízda)
    if(last && Date.now() - last.t < 10000) setTimeout(() => { if(subs.has(w)) onFix(mkPos(last.lat, last.lon, last.acc, last.speed, last.heading, last.t, { weak: last.acc > ACC_GOOD, predicted:false })); }, 0);
    return {
      stop(){ subs.delete(w); if(!subs.size) stopSource(); },
      setPredictor(fn){ w.predictor = typeof fn === 'function' ? fn : null; },
      get native(){ return nativeOn; }
    };
  }

  // volá aplikace pro Android (MainActivity) při každé poloze z GPS čipu
  function _native(lat, lon, acc, speed, heading, t){ raw(+lat, +lon, +acc, speed < 0 ? null : +speed, heading < 0 ? null : +heading, +t); }
  function _nativeError(code){
    nativeOn = false;
    subs.forEach(w => { if(w.onError) try{ w.onError({ code: code || 2, message:'GPS v telefonu není zapnutá' }); }catch(e){} });
    if(subs.size) startSource();   // zkusit prohlížeč
  }

  // společný štítek stavu GPS (stejný na všech stránkách)
  function badge(parent){
    const el = document.createElement('div');
    el.className = 'gps-badge'; el.hidden = true; el.setAttribute('aria-live', 'polite');
    (parent || document.body).appendChild(el);
    return {
      el,
      update(s){
        let txt = '';
        if(s.state === 'weak') txt = '📡 Slabý GPS' + (s.accuracy ? ' · ±' + Math.round(s.accuracy) + ' m' : '');
        else if(s.state === 'predict') txt = '📡 Bez signálu – dopočítávám';
        else if(s.state === 'lost') txt = '📡 GPS ztracena';
        el.textContent = txt; el.hidden = !txt;
        el.classList.toggle('bad', s.state === 'lost');
      },
      hide(){ el.hidden = true; }
    };
  }

  window.CendurGPS = { watch, badge, _native, _nativeError, ACC_GOOD,
    _test:{ raw, tick, reset(){ last = null; lastGoodAt = 0; jumpCount = 0; jumpRef = null; lastStatus = ''; } } };
})();
