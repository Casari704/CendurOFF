// Spuštění: node --test tests/
const test = require('node:test');
const assert = require('node:assert');
const sec = require('../security');

const list = sec.originList({ CORS_ORIGINS: 'https://novy.example/ , https://druhy.example' });

test('povolené adresy webu', () => {
  assert.ok(sec.isAllowedOrigin('https://cenduroff.cz', list));
  assert.ok(sec.isAllowedOrigin('https://casari704.github.io', list));
  assert.ok(sec.isAllowedOrigin('https://novy.example', list));          // z proměnné CORS_ORIGINS
  assert.ok(sec.isAllowedOrigin('http://localhost:3000', list));
  assert.ok(sec.isAllowedOrigin(undefined, list));                         // bez Origin (curl, server)
});
test('cizí adresy se blokují', () => {
  assert.ok(!sec.isAllowedOrigin('https://evil.example', list));
  assert.ok(!sec.isAllowedOrigin('https://cenduroff.cz.evil.example', list));
  assert.ok(!sec.isAllowedOrigin('null', list));
  assert.ok(!sec.isAllowedOrigin('http://cenduroff.cz', list));            // jiné schéma
});
test('originGuard: zápis z cizího webu = 403, čtení projde', () => {
  const g = sec.originGuard(list);
  const run = (method, origin) => {
    let status = null, called = false;
    const res = { status(c){ status = c; return this; }, json(){ return this; } };
    g({ method, headers: { origin } }, res, () => { called = true; });
    return { status, called };
  };
  assert.deepStrictEqual(run('DELETE', 'https://evil.example'), { status: 403, called: false });
  assert.deepStrictEqual(run('POST', 'https://evil.example'), { status: 403, called: false });
  assert.deepStrictEqual(run('GET', 'https://evil.example'), { status: null, called: true });
  assert.deepStrictEqual(run('POST', 'https://cenduroff.cz'), { status: null, called: true });
  assert.deepStrictEqual(run('POST', undefined), { status: null, called: true });
});
test('corsOptions vrací odpověď podle seznamu', () => {
  const o = sec.corsOptions(list);
  assert.strictEqual(o.credentials, true);
  const ask = origin => { let r; o.origin(origin, (e, ok) => { r = ok; }); return r; };
  assert.strictEqual(ask('https://cenduroff.cz'), true);
  assert.strictEqual(ask('https://evil.example'), false);
});

const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(20)]);
const png = Buffer.concat([Buffer.from([0x89]), Buffer.from('PNG\r\n\x1a\n'), Buffer.alloc(20)]);
const gif = Buffer.concat([Buffer.from('GIF89a'), Buffer.alloc(20)]);
const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(20)]);
test('typ obrázku se pozná z obsahu', () => {
  assert.strictEqual(sec.detectImageType(jpeg), 'image/jpeg');
  assert.strictEqual(sec.detectImageType(png), 'image/png');
  assert.strictEqual(sec.detectImageType(gif), 'image/gif');
  assert.strictEqual(sec.detectImageType(webp), 'image/webp');
  assert.strictEqual(sec.detectImageType(Buffer.from('<svg onload=alert(1)></svg>   ')), null);
  assert.strictEqual(sec.detectImageType(Buffer.from('<html><script>alert(1)</script></html>')), null);
  assert.strictEqual(sec.detectImageType(Buffer.alloc(3)), null);
  assert.strictEqual(sec.detectImageType('text'), null);
});
test('bezpečná data URL fotky', () => {
  assert.ok(sec.isSafeDataUrl('data:image/jpeg;base64,/9j/4AAQSkZJRg=='));
  assert.ok(sec.isSafeDataUrl('data:image/png;base64,iVBORw0KGgo='));
  assert.ok(!sec.isSafeDataUrl('data:x" onerror="alert(1)" a=";base64,AAAA'));       // útok přes typ souboru
  assert.ok(!sec.isSafeDataUrl('data:image/svg+xml;base64,PHN2Zz4='));
  assert.ok(!sec.isSafeDataUrl('data:text/html;base64,PHNjcmlwdD4='));
  assert.ok(!sec.isSafeDataUrl('javascript:alert(1)'));
  assert.ok(!sec.isSafeDataUrl(null));
});
test('limit pro nepřihlášené: po vyčerpání 429 s needsLogin, přihlášený bez limitu', () => {
  let logged = false;
  const lim = sec.anonLimiter({ windowMs: 1000, max: 3, isLoggedIn: () => logged });
  const hit = ip => {
    let status = null, body = null, passed = false;
    const res = { set(){}, status(c){ status = c; return this; }, json(b){ body = b; return this; } };
    lim({ ip }, res, () => { passed = true; });
    return { status, body, passed };
  };
  for (let i = 0; i < 3; i++) assert.ok(hit('1.1.1.1').passed);
  const over = hit('1.1.1.1');
  assert.strictEqual(over.status, 429);
  assert.strictEqual(over.body.needsLogin, true);
  assert.ok(hit('2.2.2.2').passed);                  // jiná adresa má vlastní počítadlo
  logged = true;
  for (let i = 0; i < 10; i++) assert.ok(hit('1.1.1.1').passed);   // přihlášený projde
});
