const select = '*,brand:brands(name),category:categories(name_he,slug),profile:product_profiles!inner(*)';
const arrayContains = value => `cs.{${JSON.stringify(value)}}`;
export function normalizeBarcode(value) {
  const barcode = String(value).trim();
  if (!/^\d{8,14}$/.test(barcode)) throw new Error('INVALID_BARCODE');
  return barcode;
}
export function createProductQueries(query) {
  const products = params => query('products', { select, active: 'eq.true', order: 'name_he.asc,id.asc', ...params });
  return {
    getCategories: () => query('categories', { select: '*', order: 'name_he.asc' }),
    getProductTypes: category => query('products', { select: 'product_type', active: 'eq.true', category_id: `eq.${category}`, order: 'product_type.asc', limit: 1000 }),
    getProductByBarcode: async barcode => (await products({ barcode: `eq.${normalizeBarcode(barcode)}`, limit: 1 }))[0] ?? null,
    getProduct: async id => (await products({ id: `eq.${id}`, limit: 1 }))[0] ?? null,
    matchProducts: ({ category, concern, skinType, productType }) => {
      if (![category, concern, skinType].every(v => typeof v === 'string' && v.trim())) throw new Error('MISSING_FILTER');
      return products({ category_id: `eq.${category}`, 'profile.concerns': arrayContains(concern), 'profile.skin_types': arrayContains(skinType), ...(productType ? { product_type: `eq.${productType}` } : {}), limit: 4 });
    },
    searchProducts: text => {
      // Remove PostgREST filter grammar and wildcard characters from free text.
      const term = String(text).normalize('NFKC').replace(/[^\p{L}\p{N}\s-]/gu, ' ').trim().slice(0, 100);
      if (!term) return Promise.resolve([]);
      return products({ or: `(name_he.ilike.*${term}*,name_en.ilike.*${term}*,product_type.ilike.*${term}*,short_description_he.ilike.*${term}*)`, limit: 24 });
    },
    getRecommendations: id => query('product_recommendations', { select: 'reason_he,recommendation_type,priority,product:products!product_recommendations_recommended_product_id_fkey(*,brand:brands(name),profile:product_profiles(*))', product_id: `eq.${id}`, recommendation_type: 'eq.complementary', order: 'priority.asc,recommended_product_id.asc', limit: 4 })
  };
}
