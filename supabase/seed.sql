-- OPTIONAL DEMO DATA: fictional brands/products, synthetic barcodes, no clinical claims.
-- Idempotent. Never import into a live customer catalog without intentionally enabling demos.
begin;
insert into public.brands(id,name,slug) values
 ('10000000-0000-0000-0000-000000000001','מותג הדגמה א׳','demo-a'),
 ('10000000-0000-0000-0000-000000000002','מותג הדגמה ב׳','demo-b'),
 ('10000000-0000-0000-0000-000000000003','מותג הדגמה ג׳','demo-c') on conflict do nothing;
insert into public.categories(id,name_he,slug) values
 ('20000000-0000-0000-0000-000000000001','סרום','serum'),
 ('20000000-0000-0000-0000-000000000002','לחות','moisturizer'),
 ('20000000-0000-0000-0000-000000000003','ניקוי','cleanser') on conflict do nothing;
insert into public.products(id,barcode,brand_id,category_id,name_he,name_en,short_description_he,image_url,product_type,active,is_demo,verification_status)
select ('30000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 '9900000000'||lpad(n::text,3,'0'),
 ('10000000-0000-0000-0000-'||lpad(((n-1)%3+1)::text,12,'0'))::uuid,
 ('20000000-0000-0000-0000-'||lpad(((n-1)/4+1)::text,12,'0'))::uuid,
 (case when n<=4 then 'סרום' when n<=8 then 'קרם לחות' else 'ג׳ל ניקוי' end)||' לדוגמה '||n,
 'DEMO product '||n,
 'נתוני הדגמה בלבד עבור כתמים, יובש ואקנה. זה אינו מוצר אמיתי או מידע רפואי.',
 '/product-placeholder.svg', case when n<=4 then 'סרום' when n<=8 then 'קרם' else 'ג׳ל' end,
 true,true,'sample' from generate_series(1,12) n on conflict do nothing;
insert into public.product_profiles(product_id,skin_types,concerns,target_areas,key_ingredients,usage_he,warnings_he,suitable_for_he)
select id, array['שמן','יבש','מעורב','רגיש'], array['כתמים','יובש','אקנה','אנטי אייג׳ינג'], array['פנים'], array['רכיב הדגמה בלבד'],
 'אין להשתמש בהוראות הדגמה. יש לעיין בהוראות היצרן של המוצר האמיתי.',
 'מוצר בדיוני. אין להסיק התאמה, בטיחות או יעילות מנתוני הדוגמה.',
 'דוגמה להצגת התאמה לפי מאפייני קטלוג בלבד.'
from public.products where id::text like '30000000-0000-0000-0000-%' and is_demo on conflict do nothing;
insert into public.product_recommendations(product_id,recommended_product_id,reason_he,priority)
select ('30000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 ('30000000-0000-0000-0000-'||lpad((case when n<=4 then n+4 when n<=8 then n+4 else n-8 end)::text,12,'0'))::uuid,
 'קישור הדגמה למוצר משלים. השילוב לא נבדק ואין לראות בו המלצת שימוש.',1
from generate_series(1,12) n on conflict do nothing;
commit;
