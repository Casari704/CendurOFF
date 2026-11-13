// ---------------------------------------------------------------
// Data pro celou oblast „ČR + 100 km od hranic“ (v1.49)
// - benzínky a CHKO se stáhnou JEDNOU pro celou oblast (od v4.12 z našeho serveru, záložně z Overpass),
//   uloží se v prohlížeči (IndexedDB) a týden se používají bez dalšího stahování
// - mapa pak jen ukazuje, co je zrovna v záběru -> rychlé i bez signálu
// ---------------------------------------------------------------
(function(){
  // obdélník kolem ČR (48.55–51.06 s. š., 12.09–18.86 v. d.) rozšířený o ~100 km
  // (100 km ≈ 0.9° zeměpisné šířky, ≈ 1.4° délky v našich šířkách)
  const REGION = { s:47.65, w:10.70, n:51.96, e:20.26 };
  const OVERPASS_URLS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
  const TIMEOUT_MS = 150000;
  const MAX_AGE_DAYS = 7;
  const DB_NAME = 'cenduroff-data', STORE = 'kv';

  // ---- IndexedDB (localStorage by na takové množství dat nestačil) ----
  let dbP = null;
  function db(){
    if(!dbP) dbP = new Promise((res, rej)=>{
      try{
        const r = indexedDB.open(DB_NAME, 1);
        r.onupgradeneeded = ()=> r.result.createObjectStore(STORE);
        r.onsuccess = ()=> res(r.result);
        r.onerror = ()=> rej(r.error);
      }catch(e){ rej(e); }
    });
    return dbP;
  }
  async function idbGet(key){
    try{
      const d = await db();
      return await new Promise((res)=>{
        const q = d.transaction(STORE, 'readonly').objectStore(STORE).get(key);
        q.onsuccess = ()=> res(q.result || null);
        q.onerror = ()=> res(null);
      });
    }catch(e){ return null; }
  }
  async function idbSet(key, val){
    try{
      const d = await db();
      await new Promise((res)=>{
        const tx = d.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(val, key);
        tx.oncomplete = res; tx.onerror = res; tx.onabort = res;
      });
    }catch(e){}
  }

  // Dotazy jdou po jednom (Overpass dovolí z jedné adresy jen ~2 souběžné dotazy),
  // každý s časovým limitem; při chybě se zkusí další server.
  let chain = Promise.resolve();
  function overpass(query){
    const run = chain.then(()=>overpassNow(query));
    chain = run.catch(()=>{});
    return run;
  }
  async function overpassNow(query){
    let lastErr = null;
    for(const url of OVERPASS_URLS){
      const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = ctl ? setTimeout(()=>ctl.abort(), TIMEOUT_MS) : null;
      try{
        const res = await fetch(url, { method:'POST', headers:{ 'Content-Type':'application/x-www-form-urlencoded' }, body:'data=' + encodeURIComponent(query), signal: ctl ? ctl.signal : undefined });
        if(!res.ok) throw new Error('server ' + res.status);
        const json = await res.json();
        if(json.remark && /runtime error|timed out|out of memory/i.test(json.remark) && !(json.elements||[]).length) throw new Error('server přetížený');
        return json;
      }catch(err){
        lastErr = (err && err.name === 'AbortError') ? new Error('vypršel čas') : err;
      }finally{ if(timer) clearTimeout(timer); }
    }
    throw lastErr || new Error('Overpass nedostupný');
  }

  function bboxStr(b){ return `${b.s.toFixed(3)},${b.w.toFixed(3)},${b.n.toFixed(3)},${b.e.toFixed(3)}`; }
  // oblast rozdělená na pruhy podle délky - menší dotazy, méně zátěže pro Overpass
  function stripes(n){
    const out = [], step = (REGION.e - REGION.w) / n;
    for(let i=0;i<n;i++) out.push({ s:REGION.s, n:REGION.n, w:REGION.w + i*step, e:REGION.w + (i+1)*step });
    return out;
  }

  // v4.12: odkud brát data – nejdřív z našeho serveru (ten je drží pro všechny a obnovuje jednou
  // za týden), teprve když nejde, stáhnout přímo z Overpass jako dřív
  const API = () => window.CENDUROFF_API_URL || 'https://cenduroff-web.up.railway.app';
  async function fromServer(kind){
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctl ? setTimeout(()=>ctl.abort(), 90000) : null;
    try{
      const res = await fetch(API() + '/api/region/' + kind, { signal: ctl ? ctl.signal : undefined });
      if(!res.ok) throw new Error('server ' + res.status);
      const j = await res.json();
      if(!j || !Array.isArray(j.data) || !j.data.length) throw new Error('prázdná data');
      return j;
    }finally{ if(timer) clearTimeout(timer); }
  }
  // ať prohlížeč uložená data sám nemaže, když mu dochází místo
  try{ if(navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(()=>{}); }catch(e){}

  // Načte data: z prohlížeče (i starší – hned je ukáže a čerstvá si stáhne na pozadí);
  // když v prohlížeči nic není, vezme je ze serveru, a teprve když nejde ani to, z Overpass.
  // Souběžná volání sdílí jedno stahování.
  const pending = {}, refreshing = {};
  function refresh(kind, download){
    if(refreshing[kind]) return;
    refreshing[kind] = (async ()=>{
      let data = null, t = Date.now();
      try{ const j = await fromServer(kind); data = j.data; t = j.t || t; }
      catch(e){ try{ data = await download(); }catch(e2){} }
      if(data && data.length) await idbSet(kind, { t, data });
    })().finally(()=>{ delete refreshing[kind]; });
  }
  function load(kind, download, onDownloadStart){
    if(pending[kind]) return pending[kind];
    pending[kind] = (async ()=>{
      const saved = await idbGet(kind);
      if(saved && saved.data && saved.data.length){
        if(Date.now() - saved.t >= MAX_AGE_DAYS*86400000) refresh(kind, download);   // obnova na pozadí, ukáže se příště
        return saved.data;
      }
      try{
        const j = await fromServer(kind);
        await idbSet(kind, { t: j.t || Date.now(), data: j.data });
        return j.data;
      }catch(e){ /* server nedostupný – zkusíme přímo Overpass */ }
      if(onDownloadStart) onDownloadStart();
      const data = await download();
      await idbSet(kind, { t:Date.now(), data });
      return data;
    })();
    pending[kind].catch(()=>{ delete pending[kind]; });   // po chybě půjde zkusit znovu
    return pending[kind];
  }

  window.CendurRegion = { REGION, overpass, bboxStr, stripes, load };
})();
