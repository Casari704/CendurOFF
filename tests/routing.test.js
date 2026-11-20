const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path'), vm = require('vm');

function load(file, win){
  const ctx = Object.assign({ window: win, console, setTimeout, clearTimeout, AbortController, Date, Math, JSON, Error, encodeURIComponent }, win);
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'public', file), 'utf8'), ctx);
  return win;
}

test('routing.js: Mapy.com odpověď → body [lat, lon, null]', async () => {
  const calls = [];
  const win = { CendurMaps: { MAPY_KEY: 'k' } };
  win.fetch = async url => { calls.push(url); return { ok:true, status:200, text: async () => JSON.stringify({ geometry:{ geometry:{ coordinates:[[17.1,49.1],[17.2,49.2]] } } }) }; };
  load('routing.js', win);
  const pts = await win.CendurRouting.find({ lat:49.1, lng:17.1 }, { lat:49.2, lng:17.2 }, 'silnice');
  assert.strictEqual(JSON.stringify(pts), "[[49.1,17.1,null],[49.2,17.2,null]]");
  assert.match(calls[0], /routeType=car_short/);
  const t = await win.CendurRouting.find({ lat:49.1, lng:17.1 }, { lat:49.2, lng:17.2 }, 'teren');
  assert.match(calls[1], /routeType=foot_hiking/);
});

test('routing.js: výpadek Mapy.com → záloha OpenStreetMap', async () => {
  const calls = [];
  const win = { CendurMaps: { MAPY_KEY: 'k' }, CendurBRouterProfile: () => 'profil' };
  win.fetch = async (url, opt) => {
    calls.push(url);
    if(/api\.mapy\.com/.test(url)) return { ok:false, status:500, text: async () => '{}' };
    if(/\/profile$/.test(url)) return { ok:true, status:200, text: async () => JSON.stringify({ profileid:'p1' }) };
    return { ok:true, status:200, text: async () => JSON.stringify({ features:[{ geometry:{ coordinates:[[17.1,49.1,300],[17.2,49.2,310]] } }] }) };
  };
  load('routing.js', win);
  const pts = await win.CendurRouting.find({ lat:49.1, lng:17.1 }, { lat:49.2, lng:17.2 }, 'teren');
  assert.strictEqual(JSON.stringify(pts[1]), "[49.2,17.2,310]");
  // druhé hledání už Mapy.com 10 minut nezkouší
  const before = calls.filter(c => /api\.mapy\.com/.test(c)).length;
  await win.CendurRouting.find({ lat:49.1, lng:17.1 }, { lat:49.2, lng:17.2 }, 'teren');
  assert.strictEqual(calls.filter(c => /api\.mapy\.com/.test(c)).length, before);
});
