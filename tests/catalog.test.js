import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createProductQueries, normalizeBarcode } from '../src/products.js';
import { createDatabaseClient } from '../src/database.js';
import { validateConfig } from '../src/config.js';

test('public config rejects secret and privileged JWT keys', () => {
  const jwt = role => `e30.${Buffer.from(JSON.stringify({role})).toString('base64url')}.signature`;
  for (const key of ['sb_secret_abc', jwt('service_role'), 'invalid']) assert.throws(() => validateConfig('https://example.supabase.co', key));
  assert.equal(validateConfig('https://example.supabase.co', jwt('anon')).url, 'https://example.supabase.co');
  assert.equal(validateConfig('https://example.supabase.co', 'sb_publishable_test').key, 'sb_publishable_test');
  assert.throws(() => validateConfig('https://user:password@example.com', 'sb_publishable_test'));
  assert.deepEqual(validateConfig(), { url: '', key: '' });
});
test('barcode and matching filters preserve exact values and enforce bounds', async () => {
  const calls = []; const db = createProductQueries(async (table, params) => { calls.push({table, params}); return []; });
  assert.equal(normalizeBarcode(' 0012345678901 '), '0012345678901');
  assert.throws(() => normalizeBarcode('123,or(active.eq.false)'));
  assert.equal(await db.getProductByBarcode('0012345678901'), null);
  assert.equal(calls.at(-1).params.barcode, 'eq.0012345678901');
  await db.matchProducts({ category: 'category-id', concern: 'כתמים', skinType: 'שמן', productType: 'סרום' });
  assert.equal(calls.at(-1).params['profile.concerns'], 'cs.{"כתמים"}');
  assert.equal(calls.at(-1).params['profile.skin_types'], 'cs.{"שמן"}');
  assert.equal(calls.at(-1).params.product_type, 'eq.סרום');
  assert.equal(calls.at(-1).params.limit, 4);
  assert.equal(calls.at(-1).params.active, 'eq.true');
  assert.throws(() => db.matchProducts({}));
  await db.searchProducts('סרום*,(active.eq.false)');
  assert.ok(!calls.at(-1).params.or.includes('active.eq.false'));
  assert.deepEqual(await db.searchProducts('***'), []);
});
test('REST failures are explicit; missing config makes no network request', async () => {
  let called = false;
  await assert.rejects(createDatabaseClient({}, () => {called = true;})('products'), /SETUP_REQUIRED/);
  assert.equal(called, false);
  const query = createDatabaseClient({url:'https://example.supabase.co',key:'sb_publishable_test'}, async (url, options) => {
    assert.equal(url.searchParams.get('barcode'), 'eq.0012345678901');
    assert.equal(options.headers.Authorization, undefined);
    return {ok:false};
  });
  await assert.rejects(query('products',{barcode:'eq.0012345678901'}), /DATABASE_UNAVAILABLE/);
});
test('PostgreSQL migration, seed, constraints, matching and public RLS', async () => {
  const pg = new PGlite();
  try {
    await pg.exec('create role anon; create role authenticated; grant usage on schema public to anon, authenticated;');
    await pg.exec(await readFile('supabase/migrations/202609290001_product_catalog.sql','utf8'));
    const seed = await readFile('supabase/seed.sql','utf8');
    await pg.exec(seed); await pg.exec(seed);
    assert.equal((await pg.query('select count(*)::int n from products')).rows[0].n,12);
    assert.equal((await pg.query("select count(*)::int n from products p join product_profiles f on f.product_id=p.id where p.product_type='סרום' and f.concerns @> array['כתמים'] and f.skin_types @> array['שמן']")).rows[0].n,4);
    await assert.rejects(pg.exec("insert into products(barcode,brand_id,category_id,name_he,product_type) select barcode,brand_id,category_id,name_he,product_type from products limit 1"), /unique/);
    await assert.rejects(pg.exec("update products set verification_status='verified'"), /check constraint/);
    await pg.exec("update products set is_demo=false, verification_status='unverified', source_url='https://example.com/product' where barcode='9900000000002'");
    await pg.exec("update products set verification_status='verified',last_verified_at=now() where barcode='9900000000002'");
    await pg.exec("update products set short_description_he='changed' where barcode='9900000000002'");
    assert.equal((await pg.query("select verification_status from products where barcode='9900000000002'")).rows[0].verification_status,'needs_review');
    await pg.exec("update products set verification_status='verified',last_verified_at=now() where barcode='9900000000002'");
    await pg.exec("update product_profiles set warnings_he='changed' where product_id='30000000-0000-0000-0000-000000000002'");
    assert.equal((await pg.query("select last_verified_at from products where barcode='9900000000002'")).rows[0].last_verified_at,null);
    await pg.exec("update products set active=false where barcode='9900000000005'");
    for (const role of ['anon','authenticated']) {
      await pg.exec(`set role ${role}`);
      assert.equal((await pg.query('select count(*)::int n from products')).rows[0].n,11);
      assert.equal((await pg.query('select count(*)::int n from product_profiles')).rows[0].n,11);
      assert.equal((await pg.query('select count(*)::int n from product_recommendations')).rows[0].n,10);
      for (const table of ['brands','categories','products','product_profiles','product_recommendations']) {
        assert.equal((await pg.query(`select has_table_privilege(current_user,'${table}','UPDATE') allowed`)).rows[0].allowed,false);
        await assert.rejects(pg.exec(`delete from ${table}`), /permission denied/);
        await assert.rejects(pg.exec(`insert into ${table} default values`), /permission denied/);
      }
      await assert.rejects(pg.exec('update products set active=false'), /permission denied/);
      await pg.exec('reset role');
    }
    await pg.exec("update product_profiles set usage_he='updated' where product_id='30000000-0000-0000-0000-000000000001'");
    assert.equal((await pg.query("select verification_status from products where barcode='9900000000001'")).rows[0].verification_status,'sample');
  } finally { await pg.close(); }
});
