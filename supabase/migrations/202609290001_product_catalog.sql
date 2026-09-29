begin;
create table public.brands (
 id uuid primary key default gen_random_uuid(), name text not null, slug text not null unique, logo_url text
);
create table public.categories (
 id uuid primary key default gen_random_uuid(), name_he text not null, slug text not null unique
);
create table public.products (
 id uuid primary key default gen_random_uuid(),
 barcode text not null unique check (barcode ~ '^[0-9]{8,14}$'),
 brand_id uuid not null references public.brands(id),
 category_id uuid not null references public.categories(id),
 name_he text not null, name_en text, short_description_he text,
 image_url text, product_type text not null,
 active boolean not null default false, is_demo boolean not null default false,
 source_url text check (source_url is null or source_url ~ '^https://'),
 last_verified_at timestamptz,
 verification_status text not null default 'unverified' check (verification_status in ('unverified','verified','needs_review','sample')),
 ai_summary_he text, ai_model text, ai_generated_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check (verification_status <> 'verified' or (source_url is not null and last_verified_at is not null and not is_demo)),
 check (not is_demo or verification_status = 'sample'),
 check (ai_summary_he is null or (ai_model is not null and ai_generated_at is not null))
);
create table public.product_profiles (
 product_id uuid primary key references public.products(id) on delete cascade,
 skin_types text[] not null default '{}', concerns text[] not null default '{}',
 target_areas text[] not null default '{}', key_ingredients text[] not null default '{}',
 usage_he text, warnings_he text, suitable_for_he text
);
create table public.product_recommendations (
 product_id uuid not null references public.products(id) on delete cascade,
 recommended_product_id uuid not null references public.products(id) on delete cascade,
 recommendation_type text not null default 'complementary' check (recommendation_type in ('complementary','alternative')),
 reason_he text not null, priority integer not null default 100 check (priority >= 0),
 primary key (product_id, recommended_product_id, recommendation_type),
 check (product_id <> recommended_product_id)
);
create index products_matching_idx on public.products(category_id, product_type, name_he, id) where active;
create index products_brand_idx on public.products(brand_id);
create index profiles_skin_idx on public.product_profiles using gin(skin_types);
create index profiles_concerns_idx on public.product_profiles using gin(concerns);
create index recommendations_target_idx on public.product_recommendations(recommended_product_id);
create function public.touch_product() returns trigger language plpgsql set search_path = '' as $$
begin
 new.updated_at = now();
 if row(new.name_he,new.name_en,new.short_description_he,new.brand_id,new.category_id,new.product_type,new.source_url,new.barcode)
 is distinct from row(old.name_he,old.name_en,old.short_description_he,old.brand_id,old.category_id,old.product_type,old.source_url,old.barcode) then
   new.verification_status = case when new.is_demo then 'sample' else 'needs_review' end;
   new.last_verified_at = null;
 end if;
 return new;
end;
$$;
create trigger products_updated before update on public.products for each row execute function public.touch_product();
-- Profile edits invalidate the verification of the combined product information.
create function public.invalidate_product_verification() returns trigger language plpgsql set search_path = '' as $$
begin
 update public.products set verification_status = case when is_demo then 'sample' else 'needs_review' end,
 last_verified_at = null where id = coalesce(new.product_id, old.product_id);
 return coalesce(new, old);
end;
$$;
create trigger profiles_updated after insert or update or delete on public.product_profiles for each row execute function public.invalidate_product_verification();
alter table public.brands enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_profiles enable row level security;
alter table public.product_recommendations enable row level security;
revoke all on public.brands, public.categories, public.products, public.product_profiles, public.product_recommendations from anon, authenticated;
grant select on public.brands, public.categories, public.products, public.product_profiles, public.product_recommendations to anon, authenticated;
create policy brands_read on public.brands for select to anon, authenticated using (true);
create policy categories_read on public.categories for select to anon, authenticated using (true);
create policy products_read on public.products for select to anon, authenticated using (active);
create policy profiles_read on public.product_profiles for select to anon, authenticated using (exists (select 1 from public.products p where p.id = product_id and p.active));
create policy recommendations_read on public.product_recommendations for select to anon, authenticated using (
 exists (select 1 from public.products p where p.id = product_id and p.active)
 and exists (select 1 from public.products p where p.id = recommended_product_id and p.active)
);
revoke execute on function public.touch_product(), public.invalidate_product_verification() from public, anon, authenticated;
commit;
