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
  const brandAliases=brand=>{const key=normalize(brand).replace(/[^a-z]/g,'');return({cerave:'סרווה סראווה',larocheposay:'לה רוש פוזה לה רוש',vichy:'וישי'})[key]||'';};
  const resultsScreen=document.getElementById('results');
  resultsScreen.querySelector('h1').textContent='מוצרים לפי הבחירה';
  resultsScreen.querySelector('.result')?.remove();
  const resultStatus=node('p','dermo-status');resultStatus.setAttribute('role','status');
  const resultList=node('div','catalog-grid');resultList.id='dermoResultList';
  resultsScreen.append(node('p','dermo-note','המוצרים מוצגים לפי התחום וסוג העור הרשומים בקטלוג, ללא אבחון או המלצה אישית.'),resultStatus,resultList);
  function cards(container,matches){
    container.replaceChildren();
    matches.forEach(product=>{const card=node('button','product-card');card.type='button';card.append(node('span','product-brand',text(product,'brand')),node('span','product-name',name(product)),node('span','product-meta',text(product,'package_size')),node('span','product-open','למידע על המוצר ←'));card.addEventListener('click',()=>openProduct(product));container.append(card);});
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
  const search=searchScreen('search','שם מוצר או מותג','התחילו להקליד שם מוצר','חיפוש במוצרי הטיפוח. הופעת מוצר בקטלוג אינה מעידה על זמינות במלאי.');
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
  function openProduct(product){
    parentScreens.dermoDetail=currentScreen;content.replaceChildren();
    const intro=node('div','product-intro');const description=node('div');description.append(node('span','tag',text(product,'brand')),node('h2','',name(product)));
    if(text(product,'product_name_en')){const english=node('p','product-english',text(product,'product_name_en'));english.dir='auto';description.append(english);}
    description.append(node('p','product-meta',[text(product,'product_line'),text(product,'package_size')].filter(Boolean).join(' · ')));
    if(validBarcode(product.barcode))description.append(node('p','product-meta','ברקוד: '+product.barcode));
    const imageBox=node('div','product-image');const url=safeURL(text(product,'image_url'));const fallback=()=>imageBox.replaceChildren(node('span','','תמונת מוצר אינה זמינה'));
    if(url){const image=node('img');image.alt=name(product);image.referrerPolicy='no-referrer';image.addEventListener('error',fallback,{once:true});image.src=url;imageBox.append(image);}else fallback();intro.append(description,imageBox);content.append(intro);
    const info=node('div','product-information');
    [['recommended_use_he','איך משתמשים לפי המקור'],['suitable_for_he','למי מיועד לפי המקור'],['warnings_he','חשוב לדעת'],['key_ingredients','רכיבים מרכזיים'],['active_ingredients','רכיבים פעילים'],['spf','מקדם הגנה לפי המקור'],['texture','מרקם'],['fragrance_info','מידע על בישום'],['pregnancy_info_he','מידע בנושא היריון'],['age_group','גיל לפי המקור']].forEach(([key,label])=>field(info,label,text(product,key)));
    [['skin_types','סוגי עור לפי הקטלוג'],['concerns','תחומים לפי הקטלוג'],['target_areas','אזורי שימוש לפי הקטלוג']].forEach(([key,label])=>field(info,label,tagText(product,key)));
    content.append(info);const sources=node('section','product-field product-sources');sources.append(node('h2','','מקורות המידע'));
    let links=0;[['official_product_url','מקור רשמי'],['retailer_product_url','מקור קמעונאי']].forEach(([key,label])=>{const url=safeURL(text(product,key));if(!url)return;const link=node('a','source-link',label+' ↗');link.href=url;link.target='_blank';link.rel='noopener noreferrer';sources.append(link);links++;});if(!links)sources.append(node('p','','קישור למקור לא נמסר ברשומה.'));
    const statuses={verified_official:'סומן כמאומת מול מקור רשמי',verified_retailer:'סומן כמאומת מול מקור קמעונאי'};const status=text(product,'verification_status');if(status)sources.append(node('p','','סטטוס בקובץ המקור: '+(statuses[status]||status)));if(text(product,'last_verified_at'))sources.append(node('p','','תאריך בדיקה בקובץ המקור: '+text(product,'last_verified_at')));
    content.append(sources,node('p','dermo-note','המידע מוצג לפי הקטלוג שסופק ואינו אימות עצמאי או המלצה אישית. מידע חסר אינו מעיד על היעדר אזהרות. יש לעיין בתווית המוצר ולהיוועץ ברוקח או ברוקחת. הופעת מוצר אינה מעידה על זמינות במלאי.'));show('dermoDetail');
  }
  window.onDermoScreen=id=>{if(id==='home'){search.input.value='';scan.input.value='';find(search);find(scan,true);resultList.replaceChildren();resultStatus.textContent='';content.replaceChildren();}if(id==='search')search.input.focus();if(id==='scan')scan.input.focus();};
  find(search);find(scan,true);
})();
