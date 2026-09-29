import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { createProductQueries } from '../src/products.js';

test('Hebrew RTL wizard, search, barcode, details, recommendations and safe content', async () => {
  const html = await readFile('index.html', 'utf8');
  assert.ok(!html.includes('????'));
  const dom = new JSDOM(html, { url: 'https://kiosk.example', runScripts: 'outside-only' });
  const { window } = dom, document = window.document;
  const product = { id: 'p1', name_he: '<img src=x onerror=alert(1)>', is_demo: true, brand: {name:'מותג לדוגמה'}, profile: { concerns:['כתמים'], usage_he:'הוראות לדוגמה', warnings_he:'אזהרה לדוגמה' } };
  const calls = [];
  let fail = false;
  const query = async (table, params) => {
    calls.push({table, params});
    if (fail) throw new Error('DATABASE_UNAVAILABLE');
    if (table === 'categories') return [{id:'c1',name_he:'סרום'}];
    if (table === 'product_recommendations') return [{ product:{...product,id:'p2',name_he:'מוצר משלים'}, reason_he:'הדגמה',recommendation_type:'complementary'}];
    if (params.select === 'product_type') return [{product_type:'סרום'}];
    if (params.barcode === 'eq.99999999') return [];
    if (params.limit === 4) return Array.from({length:4}, (_,i) => ({...product,id:`p${i+1}`}));
    return [product];
  };
  window.createDatabaseClient = () => query;
  window.createProductQueries = createProductQueries;
  window.config = {url:'https://example.supabase.co'};
  const source = (await readFile('src/app.js','utf8')).replace(/^import .*;\r?\n/gm,'');
  window.eval(source);
  const tick = () => new Promise(resolve => setTimeout(resolve, 5));
  const click = selector => document.querySelector(selector).click();
  try {
    assert.equal(document.documentElement.dir,'rtl');
    click('[data-screen="category"]'); await tick(); click('#categories button'); await tick();
    const type = document.getElementById('type-select'); type.value='סרום'; type.dispatchEvent(new window.Event('change'));
    click('#concerns button'); click('#skins button:nth-child(2)'); await tick();
    assert.equal(document.querySelectorAll('#matches article').length,4);
    assert.equal(calls.at(-1).params.product_type,'eq.סרום');
    assert.equal(calls.at(-1).params['profile.skin_types'],'cs.{"שמן"}');
    click('#matches button'); await tick();
    const detail = document.getElementById('product-details');
    for (const text of ['מה זה?','למה משתמשים?','איך משתמשים?','למי מתאים?','חשוב לדעת','מוצרים משלימים','DEMO']) assert.ok(detail.textContent.includes(text));
    assert.equal(detail.querySelector('[onerror]'),null);
    click('#details-back'); assert.ok(document.getElementById('results').classList.contains('active'));
    click('#results [data-screen="home"]'); click('[data-screen="search"]');
    document.getElementById('search-text').value='סרום';
    document.getElementById('search-form').dispatchEvent(new window.Event('submit',{cancelable:true})); await tick();
    assert.equal(document.querySelectorAll('#search-results article').length,1);
    click('#search [data-screen="home"]'); click('[data-screen="scan"]');
    const scan = value => { document.getElementById('barcode').value=value; document.getElementById('barcode-form').dispatchEvent(new window.Event('submit',{cancelable:true})); };
    scan('0012345678901'); await tick(); assert.equal(document.querySelectorAll('#scan-results article').length,1);
    scan('99999999'); await tick(); assert.ok(document.getElementById('scan-results').textContent.includes('לא נמצאו'));
    click('#camera-start'); await tick(); assert.ok(document.getElementById('status').textContent.includes('אינה נתמכת'));
    fail=true; scan('0012345678901'); await tick(); assert.ok(document.getElementById('scan-results').textContent.includes('ניסיון נוסף'));
    fail=false; click('#scan-results button'); await tick(); assert.equal(document.querySelectorAll('#scan-results article').length,1);
  } finally { window.close(); }
});
