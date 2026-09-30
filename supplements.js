/* Source catalog browsing only: no matching, recommendations, or medical inference. */
(() => {
  'use strict';
  const catalog = window.SUPPLEMENT_CATALOG;
  const products = catalog && Array.isArray(catalog.products) ? catalog.products.map(p=>({...p,category:p.browse_category||p.category})) : [];
  const query = document.getElementById('supplementQuery');
  const brand = document.getElementById('supplementBrand');
  const category = document.getElementById('supplementCategory');
  const list = document.getElementById('supplementList');
  const count = document.getElementById('catalogCount');
  const empty = document.getElementById('catalogEmpty');
  const content = document.getElementById('supplementContent');
  let activeGroup = null;
  let selectedBrand = '';
  const scopedProducts = () => selectedBrand ? products.filter(p=>p.brand===selectedBrand) : products;
  let detailOrigin = 'supplementLookup';
  const scopedScreen = document.getElementById('supplements');
  scopedScreen.id = 'supplementCatalog';
  scopedScreen.querySelector('h1').id='supplementCatalogTitle';
  scopedScreen.setAttribute('aria-labelledby','supplementCatalogTitle');
  parentScreens.supplementCatalog = 'supplementGuide';
  parentScreens.supplementLookup = 'supplements';
  parentScreens.supplementGuide = 'supplements';
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
  Object.assign(categories,{minerals:'מינרלים',vitamins_minerals:'ויטמינים ומינרלים',children_vitamins:'ויטמינים לילדים',fatty_acids:'חומצות שומן',herbal:'צמחים',mushrooms:'פטריות',antioxidants:'נוגדי חמצון',superfoods:'סופרפוד',respiratory:'חורף וגרון',urinary:'דרכי השתן',women:'בריאות האישה',sports:'תזונת ספורט',topical_care:'שימוש חיצוני',infant_care:'מוצרי תינוקות',ear_care:'מוצרי אוזניים'});
  const extraBrandAliases={'מגנוקס':'magnox','צנטרום':'centrum','אלספה':'alsepa','ד"ר K':'dr k dr-k דוקטור קיי','ברא צמחים':'bara herbs','אקוסאפ':'ecosupp','הדס':'hadas'};
  Object.assign(categories,{joints:'מפרקים ותנועה',curcumin:'כורכום וכורכומין',cholesterol:'כולסטרול',cardiovascular:'לב וכלי דם'});
  const brandLabel = raw => { const he=brands[raw.toLowerCase().replace(/[^a-z]/g,'')];return he ? he+' · '+raw : raw; };
  const brandSearch=raw=>brandLabel(raw)+' '+(extraBrandAliases[raw]||'');
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
  function fillFilter(select, key, source=products) {
    while(select.options.length>1)select.remove(1);
    const values = [...new Set(source.map(product => value(product, key)).filter(Boolean))].sort((a,b) => a.localeCompare(b,'he'));
    values.forEach(text => { const option = element('option', '', key==='brand'?brandLabel(text):categoryLabel(text)); option.value = text; select.append(option); });
  }
  function render() {
    const term = normalize(query.value);
    const numeric = /^\d+$/.test(term);
    const matches = scopedProducts().filter(product => {
      if(!activeGroup || !activeGroup.categories.includes(product.category))return false;
      if (brand.value && value(product, 'brand') !== brand.value) return false;
      if (category.value && value(product, 'category') !== category.value) return false;
      if (!term) return true;
      if (numeric) return validBarcode(product.barcode) && product.barcode === term;
      const categoryText=categoryLabel(value(product,'category'));
      const aliases={vitamin_d:'ויטמין ד',vitamin_c:'ויטמין סי',vitamin_b:'ויטמין בי',vitamin_b12:'בי 12 בי12 ב12 ויטמין ב12'};
      return normalize([name(product), englishName(product), brandSearch(value(product, 'brand')),categoryText, value(product, 'category'),aliases[product.category]||''].join(' ')).includes(term);
    });
    list.replaceChildren();
    matches.forEach(product => {
      const card = element('button', 'product-card');
      card.type = 'button';
      card.append(window.createProductMedia(value(product,'image_url'),name(product)),element('span','product-brand',brandLabel(value(product,'brand'))),
        element('span','product-name',name(product)),
        element('span','product-meta',[categoryLabel(value(product,'category')),value(product,'package_size')].filter(Boolean).join(' · ')),
        element('span','product-open','למידע על המוצר ←'));
      card.addEventListener('click', () => openProduct(product));
      list.append(card);
    });
    const groupTotal=activeGroup?scopedProducts().filter(product=>activeGroup.categories.includes(product.category)).length:0;
    count.textContent = products.length ? matches.length + ' מוצרים מתוך ' + groupTotal + ' בתחום שבחרתם' : 'הקטלוג אינו זמין כרגע. ניתן לפנות לצוות בית המרקחת.';
    empty.hidden = matches.length > 0 || products.length === 0;
  }
  function field(container, title, text) {
    if (!text) return;
    const section = element('section','product-field');
    section.append(element('h2','',title),element('p','',text));
    container.append(section);
  }
  function openProduct(product) {
    detailOrigin=currentScreen;
    parentScreens.supplementDetail=detailOrigin;
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
    window.appendConsumerInfo?.(content,product);
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
  function clearFilters(){query.value='';brand.value='';category.value='';render();}
  window.resetSupplementCatalog = () => {
    selectedBrand='';parentScreens.supplementGuide='supplements';brandQuery.value='';renderBrands();brand.closest('label').hidden=false;
    activeGroup=null;clearFilters();content.replaceChildren();lookupInput.value='';topicInput.value='';renderLookup();renderTopics();
  };
  fillFilter(brand,'brand');fillFilter(category,'category');
  query.addEventListener('input',render);brand.addEventListener('change',render);category.addEventListener('change',render);
  document.getElementById('catalogFilters').addEventListener('submit',event=>{event.preventDefault();render();});
  document.getElementById('resetCatalog').addEventListener('click',()=>{clearFilters();query.focus();});
  function screen(id,title,lead){
    const section=element('section','screen');section.id=id;
    const heading=element('h1','',title);heading.id=id+'Title';heading.tabIndex=-1;
    section.setAttribute('aria-labelledby',heading.id);section.append(heading,element('p','journey-lead',lead));
    scopedScreen.before(section);return section;
  }
  function action(title,description,handler){
    const button=element('button','journey-choice');button.type='button';
    button.append(element('span','journey-symbol','◇'),element('span','world-title',title),element('span','world-description',description),element('span','enter','לבחירה ←'));
    button.addEventListener('click',handler);return button;
  }
  function input(section,id,label,placeholder){
    const wrap=element('label','journey-search',label);wrap.htmlFor=id;
    const control=element('input');control.id=id;control.type='search';control.autocomplete='off';control.placeholder=placeholder;
    wrap.append(control);section.append(wrap);return control;
  }
  const entry=screen('supplements','איך תרצו להתחיל?','ויטמינים ותוספי תזונה · בדרך שנוחה לכם');
  const choices=element('div','journey-choices');
  choices.append(action('הקלדה או סריקת מוצר','מכירים את המוצר? חפשו לפי שם או ברקוד.',()=>show('supplementLookup')),action('התאמה אישית','בחרו תחום עניין והמשיכו למוצרים שבתחום.',()=>{selectedBrand='';topicInput.value='';parentScreens.supplementGuide='supplements';renderTopics();show('supplementGuide');}),action('מותגים','בחרו את המותג שלכם והמשיכו לקטגוריות שלו.',()=>{renderBrands();show('supplementBrands');}));
  entry.append(choices,element('p','journey-note','בחירה לפי תחום עניין, ללא אבחון או המלצה רפואית.'));
  const lookup=screen('supplementLookup','איזה מוצר אתם מחפשים?','הקלידו שם או ברקוד, או סרקו בסורק המחובר לעמדה');
  const lookupInput=input(lookup,'lookupQuery','שם מוצר או ברקוד מלא','למשל: מגנזיום או שם המוצר');
  const lookupStatus=element('p','catalog-count');lookupStatus.setAttribute('role','status');
  const lookupList=element('div','catalog-grid');lookupList.id='lookupList';lookup.append(lookupStatus,lookupList,element('p','journey-note','הסריקה מיועדת לסורק המחובר לעמדה. סריקה במצלמה אינה זמינה.'));
  function renderLookup(){
    const term=normalize(lookupInput.value);lookupList.replaceChildren();
    if(!term){lookupStatus.textContent='התחילו להקליד כדי לראות מוצרים';return [];}
    const matches=products.filter(p=>/^\d+$/.test(term)?validBarcode(p.barcode)&&p.barcode===term:normalize([name(p),englishName(p),brandSearch(value(p,'brand'))].join(' ')).includes(term));
    lookupStatus.textContent=matches.length?matches.length+' מוצרים נמצאו':'לא נמצא מוצר. נסו שם אחר או ברקוד מלא, או פנו לצוות בית המרקחת.';
    matches.forEach(p=>{const card=element('button','product-card');card.type='button';card.append(window.createProductMedia(value(p,'image_url'),name(p)),element('span','product-brand',brandLabel(value(p,'brand'))),element('span','product-name',name(p)),element('span','product-meta',value(p,'package_size')),element('span','product-open','למידע על המוצר ←'));card.addEventListener('click',()=>openProduct(p));lookupList.append(card);});return matches;
  }
  lookupInput.addEventListener('input',renderLookup);
  lookupInput.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();const matches=renderLookup();if(validBarcode(lookupInput.value.trim())&&matches.length===1)openProduct(matches[0]);}});
  const guide=screen('supplementGuide','מה תרצו למצוא?','בחרו תחום, או כתבו בכמה מילים מה מעניין אתכם.');
  const topicInput=input(guide,'topicQuery','חיפוש תחום','למשל: מערכת עיכול, שינה או ויטמינים');
  guide.append(element('p','journey-note','בחירה לפי תחום עניין, ללא אבחון או המלצה רפואית.'));
  const topicStatus=element('p','catalog-count');topicStatus.setAttribute('role','status');const topicList=element('div','topic-grid');topicList.id='topicList';guide.append(topicStatus,topicList);
  const groups=[
    {title:'עיכול ופרוביוטיקה',categories:['digestive_support','probiotic'],terms:'מערכת עיכול בטן פרוביוטיקה'},
    {title:'שינה ורגיעה',categories:['sleep_support'],terms:'בעיות שינה הרגעה טבעית רגיעה'},
    {title:'ויטמינים ומינרלים',categories:['multivitamin','vitamin_d','vitamin_c','vitamin_b','vitamin_b12','iron','magnesium','calcium','zinc','folic_acid'],terms:'חוסר ויטמינים מינרלים ברזל מגנזיום סידן אבץ ויטמין ד ויטמין סי'},
    {title:'שיער, עור וציפורניים',categories:['hair_skin_nails'],terms:'שיער עור ציפורניים'},
    {title:'אומגה 3',categories:['omega_3'],terms:'אומגה omega'},
    {title:'מערכת החיסון',categories:['immune_support'],terms:'חיסון חיסונית'},
    {title:'תקופת ההיריון',categories:['prenatal'],terms:'הריון היריון prenatal'},
    {title:'תחומים נוספים',categories:['other'],terms:'אחר נוספים'}
  ];
  groups.find(g=>g.categories.includes('multivitamin')).categories.push('minerals','vitamins_minerals','children_vitamins');
  for(const key of ['fatty_acids','herbal','mushrooms','antioxidants','superfoods','respiratory','urinary','women','sports','topical_care','infant_care','ear_care','joints','curcumin','cholesterol','cardiovascular'])groups.push({title:categoryLabel(key),categories:[key],terms:categoryLabel(key)});
  const covered=new Set(groups.flatMap(g=>g.categories));
  groups.find(g=>g.categories.includes('other')).categories.push(...new Set(products.map(p=>p.category).filter(c=>!covered.has(c))));
  function selectGroup(group){activeGroup=group;const source=scopedProducts().filter(p=>group.categories.includes(p.category));fillFilter(brand,'brand',source);fillFilter(category,'category',source);brand.closest('label').hidden=Boolean(selectedBrand);clearFilters();scopedScreen.querySelector('h1').textContent=(selectedBrand?brandLabel(selectedBrand)+' · ':'')+group.title;scopedScreen.querySelector('.catalog-notice').textContent='מוצרים בתחום העניין שבחרתם. הופעת מוצר אינה מעידה על התאמה אישית או זמינות במלאי.';show('supplementCatalog');}
  function renderTopics(){
    guide.querySelector('h1').textContent=selectedBrand?brandLabel(selectedBrand)+' · מה תרצו למצוא?':'מה תרצו למצוא?';
    const term=normalize(topicInput.value);topicList.replaceChildren();
    const matches=groups.filter(group=>scopedProducts().some(p=>group.categories.includes(p.category))).filter(group=>{
      const searchable=normalize(group.title+' '+group.terms+' '+group.categories.map(categoryLabel).join(' '));
      const keywords=normalize(group.terms).split(/\s+/).filter(word=>word.length>=3&&!['מערכת','בעיות','טבעית','חוסר'].includes(word));
      return !term||searchable.includes(term)||keywords.some(word=>term.includes(word));
    });
    topicStatus.textContent=matches.length?'בחרו תחום כדי להמשיך':'לא נמצא תחום. נסו מילה אחרת או פנו לרוקח או לרוקחת להכוונה.';
    matches.forEach(group=>topicList.append(action(group.title,scopedProducts().filter(p=>group.categories.includes(p.category)).length+' מוצרים בתחום',()=>selectGroup(group))));
  }
  const brandScreen=screen('supplementBrands','המותגים שלנו','בחרו מותג, ואז את תחום העניין שמעניין אתכם.');
  parentScreens.supplementBrands='supplements';
  const brandQuery=input(brandScreen,'supplementBrandQuery','חיפוש מותג','למשל: סולגאר או Solgar');
  const brandStatus=element('p','catalog-count');brandStatus.setAttribute('role','status');
  const brandList=element('div','topic-grid brand-directory');brandList.id='supplementBrandList';brandScreen.append(brandStatus,brandList);
  function renderBrands(){
    const term=normalize(brandQuery.value);
    const matches=[...new Set(products.map(p=>p.brand))].sort((a,b)=>brandLabel(a).localeCompare(brandLabel(b),'he')).filter(b=>normalize(brandSearch(b)).includes(term));
    brandList.replaceChildren();brandStatus.textContent=matches.length?matches.length+' מותגים בקטלוג':'לא נמצא מותג. נסו שם אחר.';
    matches.forEach(b=>{const button=action(brandLabel(b),products.filter(p=>p.brand===b).length+' מוצרים בקטלוג',()=>{selectedBrand=b;topicInput.value='';parentScreens.supplementGuide='supplementBrands';renderTopics();show('supplementGuide');});button.classList.add('brand-choice');button.dataset.brand=b;brandList.append(button);});
  }
  brandQuery.addEventListener('input',renderBrands);renderBrands();
  topicInput.addEventListener('input',renderTopics);
  window.onSupplementScreen=id=>{if(id==='supplementLookup')lookupInput.focus();};
  renderLookup();renderTopics();
  render();
})();
