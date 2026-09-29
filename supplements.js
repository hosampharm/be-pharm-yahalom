/* Source catalog browsing only: no matching, recommendations, or medical inference. */
(() => {
  'use strict';
  const catalog = window.SUPPLEMENT_CATALOG;
  const products = catalog && Array.isArray(catalog.products) ? catalog.products : [];
  const query = document.getElementById('supplementQuery');
  const brand = document.getElementById('supplementBrand');
  const category = document.getElementById('supplementCategory');
  const list = document.getElementById('supplementList');
  const count = document.getElementById('catalogCount');
  const empty = document.getElementById('catalogEmpty');
  const content = document.getElementById('supplementContent');
  const value = (product, ...keys) => {
    for (const key of keys) {
      const item = product[key];
      if (item !== null && item !== undefined && String(item).trim() !== '') return String(item).trim();
    }
    return '';
  };
  const name = product => value(product, 'product_name_he', 'product_name_en') || 'שם מוצר לא נמסר';
  const englishName = product => value(product, 'product_name_en');
  const categories = {calcium:'סידן',digestive_support:'תמיכה בעיכול',folic_acid:'חומצה פולית',hair_skin_nails:'שיער, עור וציפורניים',immune_support:'תמיכה במערכת החיסון',iron:'ברזל',magnesium:'מגנזיום',multivitamin:'מולטי ויטמין',omega_3:'אומגה 3',other:'אחר',prenatal:'תוספים לתקופת היריון',probiotic:'פרוביוטיקה',sleep_support:'תמיכה בשינה',vitamin_b:'ויטמיני B',vitamin_b12:'ויטמין B12',vitamin_c:'ויטמין C',vitamin_d:'ויטמין D',zinc:'אבץ'};
  const brands = {altman:'אלטמן',solgar:'סולגאר',supherb:'סופהרב',nutricare:'נוטריקר'};
  const brandLabel = raw => { const he=brands[raw.toLowerCase().replace(/[^a-z]/g,'')];return he ? he+' · '+raw : raw; };
  const categoryLabel = raw => categories[raw] || raw;
  const normalize = text => String(text).normalize('NFKC').toLocaleLowerCase('he').trim();
  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const safeURL = raw => {
    try { const url = new URL(raw); return url.protocol === 'https:' ? url.href : null; }
    catch { return null; }
  };
  const validBarcode = raw => {
    if (typeof raw !== 'string' || !/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(raw)) return false;
    let sum = 0;
    for (let i = raw.length - 2, position = 0; i >= 0; i--, position++) sum += Number(raw[i]) * (position % 2 === 0 ? 3 : 1);
    return (10 - sum % 10) % 10 === Number(raw.at(-1));
  };
  function fillFilter(select, key) {
    const values = [...new Set(products.map(product => value(product, key)).filter(Boolean))].sort((a,b) => a.localeCompare(b,'he'));
    values.forEach(text => { const option = element('option', '', key==='brand'?brandLabel(text):categoryLabel(text)); option.value = text; select.append(option); });
  }
  function render() {
    const term = normalize(query.value);
    const numeric = /^\d+$/.test(term);
    const matches = products.filter(product => {
      if (brand.value && value(product, 'brand') !== brand.value) return false;
      if (category.value && value(product, 'category') !== category.value) return false;
      if (!term) return true;
      if (numeric) return validBarcode(product.barcode) && product.barcode === term;
      const categoryText=categoryLabel(value(product,'category'));
      const aliases={vitamin_d:'ויטמין ד',vitamin_c:'ויטמין סי',vitamin_b:'ויטמין בי',vitamin_b12:'בי 12 בי12 ב12 ויטמין ב12'};
      return normalize([name(product), englishName(product), brandLabel(value(product, 'brand')),categoryText, value(product, 'category'),aliases[product.category]||''].join(' ')).includes(term);
    });
    list.replaceChildren();
    matches.forEach(product => {
      const card = element('button', 'product-card');
      card.type = 'button';
      card.append(element('span','product-brand',brandLabel(value(product,'brand'))),
        element('span','product-name',name(product)),
        element('span','product-meta',[categoryLabel(value(product,'category')),value(product,'package_size')].filter(Boolean).join(' · ')),
        element('span','product-open','למידע על המוצר ←'));
      card.addEventListener('click', () => openProduct(product));
      list.append(card);
    });
    count.textContent = products.length ? matches.length + ' מוצרים מתוך ' + products.length : 'הקטלוג אינו זמין כרגע. ניתן לפנות לצוות בית המרקחת.';
    empty.hidden = matches.length > 0 || products.length === 0;
  }
  function field(container, title, text) {
    if (!text) return;
    const section = element('section','product-field');
    section.append(element('h2','',title),element('p','',text));
    container.append(section);
  }
  function openProduct(product) {
    content.replaceChildren();
    const intro = element('div','product-intro');
    const description = element('div');
    description.append(element('span','tag',brandLabel(value(product,'brand'))),element('h2','',name(product)));
    if (englishName(product)) { const english = element('p','product-english',englishName(product)); english.dir='auto'; description.append(english); }
    description.append(element('p','product-meta',[categoryLabel(value(product,'category')),value(product,'package_size')].filter(Boolean).join(' · ')));
    if (validBarcode(product.barcode)) description.append(element('p','product-meta','ברקוד: '+product.barcode));
    const imageBox = element('div','product-image');
    const imageURL = safeURL(value(product,'image_url'));
    const fallback = () => imageBox.replaceChildren(element('span','','תמונת מוצר אינה זמינה'));
    if (imageURL) {
      const image = element('img'); image.alt=name(product); image.referrerPolicy='no-referrer';
      image.addEventListener('error',fallback,{once:true}); image.src=imageURL; imageBox.append(image);
    } else fallback();
    intro.append(description,imageBox); content.append(intro);
    const information = element('div','product-information');
    [
      ['active_ingredients','רכיבים פעילים'],['ingredient_amounts','כמויות רכיבים'],
      ['serving_size','גודל מנה'],['recommended_use_he','הוראות שימוש מהמקור'],
      ['age_group','גיל לפי המקור'],['pregnancy_info_he','מידע בנושא היריון'],['warnings_he','חשוב לדעת'],
      ['allergens_he','מידע על אלרגנים'],['storage_he','אחסון'],['kosher_info','מידע על כשרות']
    ].forEach(([key,title]) => field(information,title,value(product,key)));
    if (!information.children.length) field(information,'מידע נוסף','מידע מפורט לא נמסר ברשומת המקור. ניתן לפנות לרוקח או לרוקחת.');
    content.append(information);
    const sources = element('section','product-field product-sources');
    sources.append(element('h2','','מקורות המידע'));
    const links = [
      ['מקור רשמי',value(product,'official_product_url')],
      ['מקור קמעונאי',value(product,'retailer_product_url')]
    ];
    let linked = false;
    links.forEach(([title,raw]) => {
      const url = safeURL(raw); if (!url) return;
      const link=element('a','source-link',title+' ↗');link.href=url;link.target='_blank';link.rel='noopener noreferrer';sources.append(link);linked=true;
    });
    if (!linked) sources.append(element('p','','קישור למקור לא נמסר ברשומה.'));
    const verification=value(product,'verification_status');
    const statuses={verified_official:'סומן כמאומת מול מקור רשמי',verified_retailer:'סומן כמאומת מול מקור קמעונאי'};
    if (verification) sources.append(element('p','','סטטוס בקובץ המקור: '+(statuses[verification]||verification)));
    const date=value(product,'last_verified_at');
    if (date) sources.append(element('p','','תאריך בדיקה בקובץ המקור: '+date));
    content.append(sources,element('p','detail-notice','המידע מוצג כפי שנמסר בקטלוג ואינו מהווה אימות עצמאי או המלצה אישית. מידע חסר אינו מעיד על היעדר אזהרות או אלרגנים. יש לעיין בתווית המוצר ולהיוועץ ברוקח או ברוקחת.'));
    show('supplementDetail');
  }
  window.resetSupplementCatalog = () => {
    query.value='';brand.value='';category.value='';content.replaceChildren();render();
  };
  fillFilter(brand,'brand');fillFilter(category,'category');
  query.addEventListener('input',render);brand.addEventListener('change',render);category.addEventListener('change',render);
  document.getElementById('catalogFilters').addEventListener('submit',event=>{event.preventDefault();render();});
  document.getElementById('resetCatalog').addEventListener('click',()=>{window.resetSupplementCatalog();query.focus();});
  render();
})();
