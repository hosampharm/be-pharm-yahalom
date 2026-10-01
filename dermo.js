/* Dermo catalog: display source fields and exact source-tag intersections only. */
(() => {
  'use strict';
  const products=Array.isArray(window.DERMO_CATALOG?.products)?window.DERMO_CATALOG.products:[];
  const text=(product,key)=>product[key]===null||product[key]===undefined?'':String(product[key]).trim();
  const tags=(product,key)=>text(product,key).split('|').map(value=>value.trim()).filter(Boolean);
  const normalize=value=>String(value).normalize('NFKC').toLocaleLowerCase('he').trim();
  const name=product=>text(product,'product_name_he')||text(product,'product_name_en')||'שם מוצר לא נמסר';
  const node=(tag,className,content)=>{const result=document.createElement(tag);if(className)result.className=className;if(content!==undefined)result.textContent=content;return result;};
  const safeURL=raw=>{try{const url=new URL(raw);return url.protocol==='https:'?url.href:null;}catch{return null;}};
  const validBarcode=barcode=>{if(typeof barcode!=='string'||!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(barcode))return false;let sum=0;for(let i=barcode.length-2,n=0;i>=0;i--,n++)sum+=Number(barcode[i])*(n%2===0?3:1);return(10-sum%10)%10===Number(barcode.at(-1));};
  const concernMap={'כתמים':['dark_spots','pigmentation'],'אקנה':['acne'],'יובש':['dryness','dehydration'],'אנטי אייג׳ינג':['anti_aging']};
  const skinMap={'יבש':'dry','שמן':'oily','מעורב':'combination','רגיש':'sensitive'};
  const labels={dry:'יבש',oily:'שמן',combination:'מעורב',sensitive:'רגיש',normal:'רגיל',all:'כל סוגי העור',all_skin_types:'כל סוגי העור',dark_spots:'כתמים',acne:'אקנה',dryness:'יובש',dehydration:'חוסר לחות',anti_aging:'אנטי אייג׳ינג',face:'פנים',body:'גוף',eyes:'עיניים',lips:'שפתיים',hands:'ידיים',scalp:'קרקפת'};
  const tagText=(product,key)=>tags(product,key).map(tag=>labels[tag]||tag).join(' · ');
  Object.assign(labels,{acne_prone:'נוטה לאקנה',barrier_support:'תמיכה במחסום העור',blemishes:'פגמי עור',pigmentation:'פיגמנטציה',oil_control:'איזון שומניות',pores:'נקבוביות',sensitivity:'רגישות',sun_protection:'הגנה מהשמש',uneven_tone:'גוון לא אחיד',fine_lines:'קמטוטים',redness:'אדמומיות',wrinkles:'קמטים'});
  const brandAliases=brand=>{const key=normalize(brand).normalize('NFD').replace(/[^a-z]/g,'');return({cerave:'סרווה סראווה',larocheposay:'לה רוש פוזה לה רוש',vichy:'וישי',avene:'אוון אבן avene',bioderma:'ביודרמה',cetaphil:'צטאפיל סטאפיל',dror:'ד״ר עור דר עור דוקטור עור',mustela:'מוסטלה',sebocalm:'סבוקלם סבו קאלם',uriage:'אוריאז׳ אוריאז אוריאג'})[key]||'';};
  const resultsScreen=document.getElementById('results');
  resultsScreen.querySelector('h1').textContent='מוצרים לפי הבחירה';
  resultsScreen.querySelector('.result')?.remove();
  const resultStatus=node('p','dermo-status');resultStatus.setAttribute('role','status');
  const resultList=node('div','catalog-grid');resultList.id='dermoResultList';
  resultsScreen.append(node('p','dermo-note','המוצרים מוצגים לפי התחום וסוג העור הרשומים בקטלוג, ללא אבחון או המלצה אישית.'),resultStatus,resultList);
  function cards(container,matches){
    container.replaceChildren();
    matches.forEach(product=>{const card=node('button','product-card');card.type='button';card.append(window.createProductMedia(text(product,'image_url'),name(product)),node('span','product-brand',text(product,'brand')),node('span','product-name',name(product)),node('span','product-meta',text(product,'package_size')),node('span','product-open','למידע על המוצר ←'));card.addEventListener('click',()=>openProduct(product));container.append(card);});
  }
  window.renderDermoResults=(concern,skin)=>{
    const wanted=concernMap[concern]||[];
    const matches=products.filter(product=>wanted.some(tag=>tags(product,'concerns').includes(tag))&&tags(product,'skin_types').includes(skinMap[skin]));
    cards(resultList,matches);
    resultStatus.textContent=matches.length?matches.length+' מוצרים לפי הבחירה':'לא נמצאו מוצרים עם שני התיוגים שבחרתם. ניתן לשנות את הבחירה או לפנות לרוקח או לרוקחת.';
  };
  function searchScreen(id,label,placeholder,description){
    const screen=document.getElementById(id);screen.querySelector('.result')?.remove();
    screen.append(node('p','dermo-note',description));
    const form=node('form','dermo-search');form.setAttribute('role','search');
    const inputLabel=node('label','',label);inputLabel.htmlFor='dermo'+id+'Input';
    const row=node('div','dermo-input-row');const input=node('input');input.id=inputLabel.htmlFor;input.type='search';input.autocomplete='off';input.placeholder=placeholder;
    const button=node('button','','חיפוש');button.type='submit';row.append(input,button);form.append(inputLabel,row);
    const status=node('p','dermo-status');status.setAttribute('role','status');
    const list=node('div','catalog-grid');list.id='dermo'+id+'List';screen.append(form,status,list);return{form,input,status,list};
  }
  const search=searchScreen('search','ברקוד שעל האריזה, שם מוצר או מותג','הקלידו את כל ספרות הברקוד או שם מוצר','אפשר להקליד ידנית את הברקוד שעל האריזה. הופעת מוצר בקטלוג אינה מעידה על זמינות במלאי.');
  const scan=searchScreen('scan','ברקוד מלא','הקלידו ברקוד או סרקו בסורק המחובר','הסריקה מיועדת לסורק המחובר לעמדה. סריקה במצלמה אינה זמינה.');scan.input.inputMode='numeric';
  function find(target,barcodeOnly=false){
    const term=normalize(target.input.value);if(!term){cards(target.list,[]);target.status.textContent=barcodeOnly?'הזינו ברקוד מלא כדי לראות את המוצר':'התחילו להקליד כדי לראות מוצרים';return[];}
    const numeric=/^\d+$/.test(term);
    const matches=products.filter(product=>barcodeOnly||numeric?validBarcode(product.barcode)&&product.barcode===term:normalize([name(product),text(product,'product_name_en'),text(product,'brand'),brandAliases(text(product,'brand')),text(product,'product_line')].join(' ')).includes(term));
    cards(target.list,matches);target.status.textContent=matches.length?matches.length+' מוצרים נמצאו':'לא נמצא מוצר. בדקו את השם או הברקוד, או פנו לצוות בית המרקחת.';return matches;
  }
  search.input.addEventListener('input',()=>find(search));scan.input.addEventListener('input',()=>find(scan,true));
  [search,scan].forEach(target=>target.form.addEventListener('submit',event=>{event.preventDefault();const matches=find(target,target===scan);if(validBarcode(target.input.value.trim())&&matches.length===1)openProduct(matches[0]);}));
  const detail=node('section','screen dermo-detail');detail.id='dermoDetail';const heading=node('h1','','מידע על המוצר');heading.id='dermoDetailTitle';heading.tabIndex=-1;detail.setAttribute('aria-labelledby',heading.id);const content=node('div');detail.append(heading,content);document.querySelector('main').append(detail);
  function field(container,label,value){if(!value)return;const section=node('section','product-field');section.append(node('h2','',label),node('p','',value));container.append(section);}
  let currentProduct=null;
  const detailHistory=[];
  const complementRows=Array.isArray(window.DERMO_COMPLEMENTS?.relationships)?window.DERMO_COMPLEMENTS.relationships:[];
  const productById=new Map(products.map(p=>[p.id,p]));
  function complementaryProducts(product){
    return complementRows.filter(r=>r.source_id===product.id&&productById.has(r.recommended_id))
      .sort((a,b)=>(Number(a.routine_order)||99)-(Number(b.routine_order)||99));
  }
  window.handleDermoBack=()=>{if(currentScreen!=='dermoDetail'||!detailHistory.length)return false;openProduct(detailHistory.pop(),true);return true;};
  function openProduct(product,fromHistory=false){
    if(currentScreen!=='dermoDetail'){parentScreens.dermoDetail=currentScreen;detailHistory.length=0;}
    else if(!fromHistory&&currentProduct)detailHistory.push(currentProduct);
    currentProduct=product;content.replaceChildren();
    const intro=node('div','product-intro');const description=node('div');description.append(node('span','tag',text(product,'brand')),node('h2','',name(product)));
    if(text(product,'product_name_en')){const english=node('p','product-english',text(product,'product_name_en'));english.dir='auto';description.append(english);}
    description.append(node('p','product-meta',[text(product,'product_line'),text(product,'package_size')].filter(Boolean).join(' · ')));
    if(validBarcode(product.barcode))description.append(node('p','product-meta','ברקוד: '+product.barcode));
    const imageBox=node('div','product-image');const url=safeURL(text(product,'image_url'));const fallback=()=>imageBox.replaceChildren(node('span','','תמונת מוצר אינה זמינה'));
    if(url){const image=node('img');image.alt=name(product);image.referrerPolicy='no-referrer';image.addEventListener('error',fallback,{once:true});image.src=url;imageBox.append(image);}else fallback();intro.append(description,imageBox);content.append(intro);
    window.appendConsumerInfo?.(content,product);
    const info=node('div','product-information');
    [['recommended_use_he','איך משתמשים לפי המקור'],['suitable_for_he','למי מיועד לפי המקור'],['warnings_he','חשוב לדעת'],['key_ingredients','רכיבים מרכזיים'],['active_ingredients','רכיבים פעילים'],['spf','מקדם הגנה לפי המקור'],['texture','מרקם'],['fragrance_info','מידע על בישום'],['pregnancy_info_he','מידע בנושא היריון'],['age_group','גיל לפי המקור']].forEach(([key,label])=>field(info,label,text(product,key)));
    [['skin_types','סוגי עור לפי הקטלוג'],['concerns','תחומים לפי הקטלוג'],['target_areas','אזורי שימוש לפי הקטלוג']].forEach(([key,label])=>field(info,label,tagText(product,key)));
    content.append(info);
    const complements=node('section','dermo-complements');complements.id='dermoComplements';
    complements.append(node('h2','','להשלמת שגרת הטיפוח'),node('p','dermo-note','השילובים וההסברים מוצגים לפי קובץ המוצרים המשלימים שסופק. הם אינם התאמה אישית; יש לעיין בהוראות ובאזהרות של כל מוצר.'));
    const additions=complementaryProducts(product);
    if(additions.length){
      const grid=node('div','catalog-grid');grid.id='dermoComplementList';
      const contexts={morning:'בוקר',evening:'ערב',morning_evening:'בוקר וערב',as_needed:'לפי הצורך'};
      additions.forEach(relation=>{
        const item=productById.get(relation.recommended_id);const wrapper=node('article','complement-item');
        cards(wrapper,[item]);const card=wrapper.firstElementChild;
        if(relation.reason_he)card.insertBefore(node('span','product-meta',relation.reason_he),card.querySelector('.product-open'));
        if(relation.usage_context)card.insertBefore(node('span','product-meta','לפי הקובץ: '+(contexts[relation.usage_context]||relation.usage_context)),card.querySelector('.product-open'));
        const evidence=safeURL(relation.evidence_url);
        if(evidence){const link=node('a','source-link','מקור השילוב שסופק ↗');link.href=evidence;link.target='_blank';link.rel='noopener noreferrer';wrapper.append(link);}
        grid.append(wrapper);
      });complements.append(grid);
    }else complements.append(node('p','dermo-note','לא נמסר שילוב למוצר זה בקובץ. ניתן לפנות לצוות בית המרקחת.'));
    content.insertBefore(complements,info);const sources=node('section','product-field product-sources');sources.append(node('h2','','מקורות המידע'));
    let links=0;[['official_product_url','מקור רשמי'],['retailer_product_url','מקור קמעונאי']].forEach(([key,label])=>{const url=safeURL(text(product,key));if(!url)return;const link=node('a','source-link',label+' ↗');link.href=url;link.target='_blank';link.rel='noopener noreferrer';sources.append(link);links++;});if(!links)sources.append(node('p','','קישור למקור לא נמסר ברשומה.'));
    const statuses={verified_official:'סומן כמאומת מול מקור רשמי',verified_retailer:'סומן כמאומת מול מקור קמעונאי'};const status=text(product,'verification_status');if(status)sources.append(node('p','','סטטוס בקובץ המקור: '+(statuses[status]||status)));if(text(product,'last_verified_at'))sources.append(node('p','','תאריך בדיקה בקובץ המקור: '+text(product,'last_verified_at')));
    content.append(sources,node('p','dermo-note','המידע מוצג לפי הקטלוג שסופק ואינו אימות עצמאי או המלצה אישית. מידע חסר אינו מעיד על היעדר אזהרות. יש לעיין בתווית המוצר ולהיוועץ ברוקח או ברוקחת. הופעת מוצר אינה מעידה על זמינות במלאי.'));show('dermoDetail');
  }
  const concernGroups=[
    {title:'יובש ולחות',keys:['dryness','dehydration','barrier_support'],terms:'יובש לחות התייבשות'},
    {title:'כתמים וגוון עור',keys:['dark_spots','pigmentation','uneven_tone'],terms:'כתמים פיגמנטציה גוון'},
    {title:'אקנה ושומניות',keys:['acne','blemishes','oil_control','pores'],terms:'אקנה פצעונים שמן שומניות נקבוביות'},
    {title:'רגישות ואדמומיות',keys:['sensitivity','redness'],terms:'רגישות אדמומיות רגיש'},
    {title:'אנטי אייג׳ינג וקמטוטים',keys:['anti_aging','fine_lines','wrinkles'],terms:'אנטי אייגינג קמטוטים קמטים'},
    {title:'הגנה מהשמש',keys:['sun_protection'],terms:'שמש הגנה spf'}
  ].map(group=>({...group,contains:p=>tags(p,'concerns').some(tag=>group.keys.includes(tag))}));
  const typeGroups=[
    {title:'ניקוי העור',keys:['cleanser','foaming_cleanser','micellar_water','cleansing_gel'],terms:'ניקוי סבון מיסלר'},
    {title:'סרומים',keys:['serum'],terms:'סרום סרומים'},
    {title:'קרמים וג׳לים',keys:['cream','moisturizer','gel'],terms:'קרם קרמים גל ג׳ל לחות'},
    {title:'טיפוח העיניים',keys:['eye_cream'],terms:'עיניים עינים'},
    {title:'גוף וידיים',keys:['body_cream','hand_cream'],terms:'גוף ידיים ידים'},
    {title:'מסנני קרינה',keys:['sunscreen'],terms:'שמש הגנה קרינה spf'},
    {title:'טיפוח השפתיים',keys:['lip_care'],terms:'שפתיים שפתים שפתון'},
    {title:'טיפוח תינוקות',keys:['baby_care'],terms:'תינוקות תינוק בייבי'},
    {title:'מי פנים',keys:['toner'],terms:'מי פנים טונר'},
    {title:'מסכות פנים',keys:['mask'],terms:'מסכה מסכות'}
  ].map(group=>({...group,contains:p=>group.keys.includes(p.product_type)}));
  function withRemaining(groups){
    const known=groups.slice();
    return [...known,{title:'מוצרים נוספים',terms:'אחר נוספים',contains:p=>!known.some(group=>group.contains(p))}]
      .filter(group=>products.some(group.contains));
  }
  const directories={concerns:withRemaining(concernGroups),types:withRemaining(typeGroups)};
  let directoryMode='concerns';let selectedGroup=null;let selectedBrand='';
  const directoryProducts=()=>selectedBrand?products.filter(p=>p.brand===selectedBrand):products;
  function makeScreen(id,title){
    const section=node('section','screen');section.id=id;
    const h=node('h1','',title);h.id=id+'Title';h.tabIndex=-1;
    section.setAttribute('aria-labelledby',h.id);section.append(h);document.querySelector('main').append(section);return section;
  }
  const guide=makeScreen('dermoGuide','מה תרצו למצוא?');
  guide.append(node('p','journey-lead','בחרו תחום טיפוח או סוג מוצר, ומשם נמשיך למוצרים שבקטגוריה.'));
  const modeRow=node('div','dermo-modes');modeRow.setAttribute('aria-label','דרך בחירת קטגוריה');
  const modeButtons={};
  for(const [key,label] of [['concerns','לפי צורך'],['types','לפי סוג מוצר']]){
    const button=node('button','',label);button.type='button';button.setAttribute('aria-pressed',String(key===directoryMode));
    button.addEventListener('click',()=>{directoryMode=key;topicQuery.value='';renderDirectory();});modeButtons[key]=button;modeRow.append(button);
  }
  guide.append(modeRow);
  const topicLabel=node('label','journey-search','חיפוש קטגוריה');topicLabel.htmlFor='dermoTopicQuery';
  const topicQuery=node('input');topicQuery.type='search';topicQuery.id=topicLabel.htmlFor;topicQuery.placeholder='למשל: יובש, כתמים או סרום';topicQuery.autocomplete='off';topicLabel.append(topicQuery);guide.append(topicLabel);
  const guideStatus=node('p','dermo-status');guideStatus.setAttribute('role','status');
  const guideList=node('div','topic-grid');guideList.id='dermoTopicList';guide.append(guideStatus,guideList);
  const classic=node('button','dermo-classic','בחירה לפי צורך וסוג עור');classic.type='button';classic.addEventListener('click',()=>{parentScreens.need='dermoGuide';show('need');});
  guide.append(classic,node('p','dermo-note','הקטגוריות מבוססות על תיוגי הקטלוג, ללא אבחון או המלצה רפואית. מוצר עשוי להופיע בכמה תחומי טיפוח.'));
  const scoped=makeScreen('dermoCategory','מוצרים בקטגוריה');
  scoped.append(node('p','dermo-note','חפשו בתוך הקטגוריה שבחרתם. הופעת מוצר אינה מעידה על התאמה אישית או זמינות במלאי.'));
  const controls=node('form','catalog-filters');controls.setAttribute('role','search');
  function control(id,label,tag){const wrap=node('label','',label);wrap.htmlFor=id;const field=node(tag);field.id=id;wrap.append(field);controls.append(wrap);return field;}
  const scopedQuery=control('dermoCategoryQuery','ברקוד, שם מוצר או מותג','input');scopedQuery.type='search';scopedQuery.autocomplete='off';scopedQuery.placeholder='הקלידו ברקוד מלא או שם לחיפוש בקטגוריה';
  const scopedBrand=control('dermoCategoryBrand','מותג','select');const scopedSkin=control('dermoCategorySkin','סוג עור','select');
  const clearButton=node('button','','ניקוי סינון');clearButton.type='button';controls.append(clearButton);scoped.append(controls);
  const scopedStatus=node('p','dermo-status');scopedStatus.setAttribute('role','status');const scopedList=node('div','catalog-grid');scopedList.id='dermoCategoryList';scoped.append(scopedStatus,scopedList);
  function fillSelect(select,values,defaultLabel){select.replaceChildren();const all=node('option','',defaultLabel);all.value='';select.append(all);values.forEach(value=>{const option=node('option','',labels[value]||value);option.value=value;select.append(option);});}
  function renderScoped(){
    const source=selectedGroup?directoryProducts().filter(selectedGroup.contains):[];const term=normalize(scopedQuery.value);
    const matches=source.filter(p=>{
      if(scopedBrand.value&&p.brand!==scopedBrand.value)return false;
      if(scopedSkin.value&&!tags(p,'skin_types').includes(scopedSkin.value))return false;
      if(!term)return true;
      if(/^\d+$/.test(term))return validBarcode(p.barcode)&&p.barcode===term;
      return normalize([name(p),text(p,'product_name_en'),text(p,'brand'),brandAliases(text(p,'brand'))].join(' ')).includes(term);
    });
    cards(scopedList,matches);scopedStatus.textContent=matches.length?matches.length+' מוצרים מתוך '+source.length+' בקטגוריה':'לא נמצאו מוצרים בקטגוריה עם הסינון הזה. אפשר לשנות את החיפוש או לנקות את הסינון.';
  }
  function chooseGroup(group){
    selectedGroup=group;scoped.querySelector('h1').textContent=(selectedBrand?selectedBrand+' · ':'')+group.title;
    const source=directoryProducts().filter(group.contains);fillSelect(scopedBrand,[...new Set(source.map(p=>p.brand))].sort(),'כל המותגים');scopedBrand.closest('label').hidden=Boolean(selectedBrand);fillSelect(scopedSkin,[...new Set(source.flatMap(p=>tags(p,'skin_types')))].sort(),'כל סוגי העור');scopedQuery.value='';renderScoped();show('dermoCategory');
  }
  function renderDirectory(){
    guide.querySelector('h1').textContent=selectedBrand?selectedBrand+' · מה תרצו למצוא?':'מה תרצו למצוא?';
    classic.hidden=Boolean(selectedBrand);
    for(const [key,button] of Object.entries(modeButtons))button.setAttribute('aria-pressed',String(key===directoryMode));
    const term=normalize(topicQuery.value);
    const matches=directories[directoryMode].filter(group=>directoryProducts().some(group.contains)).filter(group=>!term||normalize(group.title+' '+group.terms).includes(term)||group.terms.split(' ').filter(word=>word.length>=3).some(word=>term.includes(word)));
    guideList.replaceChildren();guideStatus.textContent=matches.length?'בחרו קטגוריה כדי לראות את המוצרים':'לא נמצאה קטגוריה. נסו מילה אחרת או החליפו את דרך הבחירה.';
    matches.forEach(group=>{const button=node('button','journey-choice');button.type='button';button.append(node('span','world-title',group.title),node('span','world-description',directoryProducts().filter(group.contains).length+' מוצרים'),node('span','enter','למוצרים בקטגוריה ←'));button.addEventListener('click',()=>chooseGroup(group));guideList.append(button);});
  }
  topicQuery.addEventListener('input',renderDirectory);scopedQuery.addEventListener('input',renderScoped);scopedBrand.addEventListener('change',renderScoped);scopedSkin.addEventListener('change',renderScoped);controls.addEventListener('submit',event=>event.preventDefault());clearButton.addEventListener('click',()=>{scopedQuery.value='';scopedBrand.value='';scopedSkin.value='';renderScoped();scopedQuery.focus();});
  parentScreens.dermoGuide='dermo';parentScreens.dermoCategory='dermoGuide';
  const matchEntry=document.querySelector('#dermo button[onclick="show(\'need\')"]');
  if(matchEntry){matchEntry.removeAttribute('onclick');matchEntry.addEventListener('click',()=>{selectedBrand='';parentScreens.dermoGuide='dermo';directoryMode='concerns';topicQuery.value='';renderDirectory();show('dermoGuide');});matchEntry.querySelector('.card-description').textContent='בחרו קטגוריה או סוג מוצר ומצאו את עולם הטיפוח שלכם.';}

  const brandScreen=makeScreen('dermoBrands','המותגים שלנו');
  brandScreen.append(node('p','journey-lead','בחרו מותג, ואז את תחום הטיפוח שמעניין אתכם.'));
  const brandLabel=node('label','journey-search','חיפוש מותג');brandLabel.htmlFor='dermoBrandQuery';
  const brandQuery=node('input');brandQuery.id='dermoBrandQuery';brandQuery.type='search';brandQuery.autocomplete='off';brandQuery.placeholder='למשל: CeraVe או סרווה';brandLabel.append(brandQuery);brandScreen.append(brandLabel);
  const brandStatus=node('p','dermo-status');brandStatus.setAttribute('role','status');
  const brandList=node('div','topic-grid brand-directory');brandList.id='dermoBrandList';brandScreen.append(brandStatus,brandList);
  const brandNames=[...new Set(products.map(p=>p.brand))].sort((a,b)=>a.localeCompare(b));
  function renderBrands(){
    const term=normalize(brandQuery.value);const matches=brandNames.filter(brand=>normalize(brand+' '+brandAliases(brand)).includes(term));
    brandList.replaceChildren();brandStatus.textContent=matches.length?matches.length+' מותגים בקטלוג':'לא נמצא מותג. נסו שם אחר.';
    matches.forEach(brand=>{
      const button=node('button','journey-choice brand-choice');button.type='button';button.dataset.brand=brand;
      const title=node('span','world-title',brand);title.dir='auto';
      button.append(title,node('span','world-description',products.filter(p=>p.brand===brand).length+' מוצרים בקטלוג'),node('span','enter','לתחומי הטיפוח ←'));
      button.addEventListener('click',()=>{selectedBrand=brand;directoryMode='concerns';topicQuery.value='';parentScreens.dermoGuide='dermoBrands';renderDirectory();show('dermoGuide');});brandList.append(button);
    });
  }
  brandQuery.addEventListener('input',renderBrands);parentScreens.dermoBrands='dermo';
  const brandEntry=node('button','card');brandEntry.type='button';brandEntry.id='dermoBrandsEntry';
  const brandSymbol=node('span','icon','◇');brandSymbol.setAttribute('aria-hidden','true');
  brandEntry.append(brandSymbol,node('span','card-title','מותגים'),node('span','card-description','בחרו את המותג שלכם והמשיכו לקטגוריות שלו.'));
  brandEntry.addEventListener('click',()=>{renderBrands();show('dermoBrands');});document.querySelector('#dermo .grid').append(brandEntry);
  document.querySelectorAll('#dermo .card').forEach(card=>card.append(node('span','enter','לבחירה ←')));
  renderBrands();
  function resetCategories(){selectedBrand='';parentScreens.dermoGuide='dermo';brandQuery.value='';renderBrands();selectedGroup=null;directoryMode='concerns';topicQuery.value='';scopedQuery.value='';scopedBrand.value='';scopedSkin.value='';scopedList.replaceChildren();scopedStatus.textContent='';renderDirectory();}
  renderDirectory();
  window.onDermoScreen=id=>{if(id==='home'){currentProduct=null;detailHistory.length=0;resetCategories();search.input.value='';scan.input.value='';find(search);find(scan,true);resultList.replaceChildren();resultStatus.textContent='';content.replaceChildren();}if(id==='search')search.input.focus();if(id==='scan')scan.input.focus();};
  find(search);find(scan,true);
})();
