// ---------------------------------------------------------------
// Data pro celou oblast „ČR + 100 km od hranic“ (v1.49)
// - benzínky a CHKO se stáhnou z OpenStreetMap (Overpass) JEDNOU pro celou oblast,
//   uloží se v prohlížeči (IndexedDB) a týden se používají bez dalšího stahování
// - mapa pak jen ukazuje, co je zrovna v záběru -> rychlé i bez signálu
// ---------------------------------------------------------------
(function(){
  // obdélník kolem ČR (48.55–51.06 s. š., 12.09–18.86 v. d.) rozšířený o ~100 km
  // (100 km ≈ 0.9° zeměpisné šířky, ≈ 1.4° délky v našich šířkách)
  const REGION = { s:47.65, w:10.70, n:51.96, e:20.26 };
  const OVERPASS_URLS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
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

  async function overpass(query){
    let lastErr = null;
    for(const url of OVERPASS_URLS){
      try{
        const res = await fetch(url, { method:'POST', headers:{ 'Content-Type':'application/x-www-form-urlencoded' }, body:'data=' + encodeURIComponent(query) });
        if(!res.ok) throw new Error('HTTP ' + res.status);
        return await res.json();
      }catch(err){ lastErr = err; }
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

  // Načte data: z prohlížeče, pokud jsou čerstvá; jinak stáhne (a když stažení
  // selže, použije aspoň starší uloženou verzi). Souběžná volání sdílí jedno stahování.
  const pending = {};
  function load(kind, download, onDownloadStart){
    if(pending[kind]) return pending[kind];
    pending[kind] = (async ()=>{
      const saved = await idbGet(kind);
      if(saved && saved.data && Date.now() - saved.t < MAX_AGE_DAYS*86400000) return saved.data;
      try{
        if(onDownloadStart) onDownloadStart();
        const data = await download();
        await idbSet(kind, { t:Date.now(), data });
        return data;
      }catch(err){
        if(saved && saved.data) return saved.data;
        throw err;
      }
    })();
    pending[kind].catch(()=>{ delete pending[kind]; });   // po chybě půjde zkusit znovu
    return pending[kind];
  }

  window.CendurRegion = { REGION, overpass, bboxStr, stripes, load };
})();
