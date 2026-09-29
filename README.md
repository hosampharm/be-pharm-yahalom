# בי פארם יהלום — product database

The existing Hebrew RTL kiosk, extended with a Supabase PostgreSQL catalog. The original home layout, cards, colors, and responsive styling are retained. There is no framework or runtime dependency: browser ES modules query Supabase's PostgREST API with a public key.

## Setup

1. Create a Supabase project. In its SQL Editor, run `supabase/migrations/202609290001_product_catalog.sql` once as the project administrator. Alternatively, apply the migration through your existing Supabase CLI migration workflow. The `public` schema must be exposed through the Data API (the Supabase default).
2. For a **test/preview project only**, run `supabase/seed.sql`. It is repeatable and creates 12 fictional DEMO products, three fictional brands, three categories, profiles, and complementary links. All products display sample labels. Barcodes `9900000000001` through `9900000000012` are synthetic lookup fixtures, not valid retail EAN labels; use manual entry, a keyboard scanner, or Code 128 labels for these fixtures.
3. Install Node.js 22 or later, then run `npm ci`.
4. Copy `.env.example` to `.env`; set `SUPABASE_URL` and `SUPABASE_ANON_KEY` using your project URL and **public anon JWT or publishable key**. Never enter a service-role, secret, database password, or AI API key. The build explicitly rejects privileged/unknown keys.
5. Run `npm run dev` and open `http://127.0.0.1:4173`. Run `npm test` for checks and `npm run build` for the deployable `dist/` folder. Missing credentials produce an explicit setup message, not a hidden local-data fallback. Partially configured or invalid credentials fail the build.

## Netlify configuration

The checked-in `netlify.toml` sets `npm run build`, `dist`, Node 22, and browser security headers. Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` in Netlify's build environment, then rebuild. Use a separate demo Supabase project for deploy previews. These two values are deliberately public in `dist/config.js`; no other environment variables are emitted.

Default CSP permits API calls to `https://*.supabase.co`. If you use a custom Supabase API domain, add that exact HTTPS origin to `connect-src` in `netlify.toml`. Camera access requires HTTPS (or localhost), browser permission, and native `BarcodeDetector` support. Unsupported browsers show a Hebrew fallback; manual entry and USB scanners that send Enter work without camera support. Camera tracks stop on navigation, tab hiding, success, and explicit stop.

## Catalog and matching

- `brands`: name, slug, optional logo URL.
- `categories`: Hebrew name and slug.
- `products`: unique textual barcode (leading zeros preserved), brand/category foreign keys, Hebrew/English names, description, image, product type, active flag, timestamps, sample marker, source URL, last verification date, verification status, and separate future AI-summary provenance.
- `product_profiles`: one-to-one skin types, concerns, target areas, ingredients, usage, warnings, and suitability.
- `product_recommendations`: directed complementary/alternative links, reason, priority. Self-links and duplicate links are rejected.

`src/database.js` handles public REST requests and timeouts; `src/products.js` provides `getProductByBarcode(barcode)`, `getProduct(id)`, `searchProducts(text)`, `matchProducts({ category, concern, skinType, productType })`, categories/types, and recommendations.

The wizard is category → concern (with optional product type) → skin type → results. All supplied filters are ANDed, including array membership for concern and skin type. Matching returns at most four active products, deterministically ordered by name/id. The seeded serum + spots + oily-skin query returns four. Sparse real catalogs may return zero or one; the kiosk never invents matches to meet a minimum. Search is a literal substring over Hebrew/English name, description, and product type, capped at 24 results; refine the term for larger catalogs. It is not natural-language/AI search. Product-type choices load up to 1,000 active rows per category; normalize into a separate type taxonomy before exceeding that size.

Use the Hebrew taxonomy consistently: concerns `כתמים`, `אקנה`, `יובש`, `אנטי אייג׳ינג`; skin types `יבש`, `שמן`, `מעורב`, `רגיש`. Categories and product types come from the database. Changing this concern/skin taxonomy requires updating `src/app.js` and product profiles together.

Details display מה זה?, למה משתמשים?, איך משתמשים?, למי מתאים?, חשוב לדעת, ingredients, source/date/status, and complementary products. Text is rendered with DOM `textContent`, not interpolated HTML. Missing images fall back to a local placeholder; missing data, network failures, empty results, and deleted/inactive products have explicit states.

## Security, verification, and operations

RLS is enabled on all five tables. `anon` and `authenticated` receive SELECT only. They can read brands/categories and active products; profiles and recommendations are visible only when their parent/target products are active. There are no public write policies. Catalog editing is administrative through Supabase, not through this kiosk. All fields of active products are public: do not store private notes or credentials in these tables.

New products default to inactive and unverified. Add the product, source URL and profile, verify against an authoritative manufacturer source, then in a separate update set `last_verified_at`, `verification_status='verified'`, and `active=true`. Verified products require source/date and cannot be samples. Profile or product-content/source edits automatically clear verification and require review. Reverify in a separate update after completing edits. Deactivating a product hides its profile and both directions of its recommendation links.

DEMO data has no manufacturer source or verified date and contains no real usage claims. Before launch, deactivate it with `update public.products set active=false where is_demo;` and load pharmacist-reviewed real products. Do not change fictional records into verified real products. Keep the demo seed out of production migration automation.

Current matching explanations are deterministic catalog-tag explanations, labelled as rules-based. `ai_summary_he`, `ai_model`, and `ai_generated_at` reserve a separate, explicitly labelled AI output channel; no AI service is called. Future AI generation must run server-side, keep API secrets there, retain source provenance, and never overwrite verified product information.

No shopper profile or choice is stored. Before public launch, configure project backups and monitoring, review the catalog and Supabase Security Advisor, and verify the target kiosk's camera/scanner hardware.

## Validation

`npm test` executes query/config tests and runs the actual migration and seed against PGlite (embedded PostgreSQL). It checks seed repeatability, matching, unique barcodes, verification constraints, public role write denial, and inactive product/profile/recommendation visibility. A jsdom integration test runs the actual UI and query layer with a fixture transport through wizard, search, barcode, details, recommendations, error/retry, and unsafe-content cases. Both test dependencies are development-only and are not shipped to the browser.

Live acceptance after configuring Supabase:

1. Walk through סרום → כתמים → שמן and check four demo results, images, names, brands, explanations, and details.
2. Search `DEMO` or `סרום`, look up `9900000000001`, try an unknown barcode, and inspect complementary products.
3. Test network failure/retry, no matches, tablet/mobile layout, keyboard navigation, denied camera permission, and USB scanner Enter submission.
4. Deactivate one product administratively; confirm direct lookup, profile reads, and incoming/outgoing recommendations hide it with both public roles.
5. Confirm unauthenticated insert/update/delete requests fail. Test real PostgREST relationship embeds against your Supabase project; embedded PostgreSQL tests do not run the hosted HTTP API.

References: [Supabase public API keys](https://supabase.com/docs/guides/getting-started/api-keys), [row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security).
