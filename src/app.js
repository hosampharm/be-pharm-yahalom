import config from '/config.js';
import { createDatabaseClient } from './database.js';
import { createProductQueries } from './products.js';
const db = createProductQueries(createDatabaseClient(config));
const $ = id => document.getElementById(id);
let screen = 'home', revision = 0, selection = {}, categories = [], returnScreen = 'home';
let stream, cameraTimer, cameraGeneration = 0;
const el = (tag, text, className) => { const n = document.createElement(tag); if (text) n.textContent = text; if (className) n.className = className; return n; };
function button(text, action, className = 'primary') { const n = el('button', text, className); n.type = 'button'; n.onclick = action; return n; }
function stopCamera() {
  cameraGeneration++; clearTimeout(cameraTimer); stream?.getTracks().forEach(t => t.stop()); stream = null;
  $('camera').srcObject = null; $('camera').hidden = true; $('camera-stop').hidden = true;
}
function show(id) {
  revision++; stopCamera(); screen = id; $('status').textContent = '';
  document.querySelectorAll('.screen').forEach(n => n.classList.toggle('active', n.id === id));
  document.querySelector(`#${id} h1`)?.focus();
  if (id === 'category') loadCategories();
  if (id === 'need') loadProductTypes();
  if (id === 'scan') $('barcode').focus();
}
const errorText = e => e.message === 'SETUP_REQUIRED' ? 'הקטלוג טרם חובר. יש להגדיר חיבור Supabase ולבנות מחדש.' : e.message === 'INVALID_BARCODE' ? 'יש להזין ברקוד בן 8–14 ספרות.' : 'לא ניתן לטעון את הקטלוג כרגע. בדקו את החיבור ונסו שוב.';
async function load(target, task, render) {
  const ticket = ++revision;
  target.replaceChildren(el('p', 'טוען…')); target.setAttribute('aria-busy', 'true');
  try { const data = await task(); if (ticket === revision) { target.replaceChildren(); render(data); } }
  catch (e) { if (ticket === revision) target.replaceChildren(el('p', errorText(e)), button('ניסיון נוסף', () => load(target, task, render))); }
  finally { if (ticket === revision) target.removeAttribute('aria-busy'); }
}
function safeUrl(value) { try { const u = new URL(value, location.origin); return u.protocol === 'https:' || u.origin === location.origin ? u.href : null; } catch { return null; } }
function image(product) {
  const n = el('img', '', 'product-image'); n.src = safeUrl(product.image_url) || '/product-placeholder.svg'; n.alt = product.is_demo ? 'תמונת המחשה למוצר לדוגמה' : product.name_he; n.loading = 'lazy'; n.onerror = () => { n.onerror = null; n.src = '/product-placeholder.svg'; }; return n;
}
function badge(p) { return p.is_demo ? 'DEMO · נתוני דוגמה בלבד' : p.verification_status === 'verified' ? 'מידע מוצר מאומת' : 'מידע מוצר שטרם אומת / דורש בדיקה'; }
function card(p, explanation) {
  const n = el('article', '', 'result'); n.append(image(p), el('span', badge(p), 'tag'), el('h2', p.name_he), el('p', p.brand?.name || ''), el('p', explanation || p.short_description_he || ''), button('מידע נוסף', () => openProduct(p.id))); return n;
}
function renderList(target, products, explanation) {
  if (!products.length) target.append(el('p', 'לא נמצאו מוצרים תואמים. אפשר לשנות את הבחירה או לפנות לרוקח/ת.'));
  products.forEach(p => target.append(card(p, explanation)));
}
function loadCategories() {
  load($('categories'), db.getCategories, rows => {
    categories = rows;
    if (!rows.length) $('categories').append(el('p', 'עדיין אין קטגוריות בקטלוג.'));
    rows.forEach(c => $('categories').append(button(c.name_he, () => { selection = { category: c.id }; show('need'); }, 'choice')));
  });
}
function loadProductTypes() {
  load($('product-types'), () => db.getProductTypes(selection.category), rows => {
    const label = el('label', 'סוג מוצר (אפשר להשאיר את כל הסוגים)'); label.htmlFor = 'type-select';
    const select = el('select'); select.id = 'type-select';
    const all = el('option', 'כל הסוגים'); all.value = ''; select.append(all);
    [...new Set(rows.map(r => r.product_type))].forEach(type => { const option = el('option', type); option.value = type; select.append(option); });
    select.value = selection.productType || ''; select.onchange = () => { selection.productType = select.value; };
    $('product-types').append(label, select);
  });
}
['כתמים', 'אקנה', 'יובש', 'אנטי אייג׳ינג'].forEach(concern => $('concerns').append(button(concern, () => { selection.concern = concern; show('skin'); }, 'choice')));
['יבש', 'שמן', 'מעורב', 'רגיש'].forEach(skinType => $('skins').append(button(`עור ${skinType}`, () => {
  selection.skinType = skinType; show('results');
  const categoryName = categories.find(c => c.id === selection.category)?.name_he || '';
  $('summary').textContent = `${categoryName} • ${selection.concern} • עור ${skinType}`;
  const explanation = `התאמה לפי תגיות הקטלוג: ${categoryName}, ${selection.concern}, עור ${skinType}. זהו הסבר מבוסס כללים, ולא סיכום AI או אישור רפואי.`;
  load($('matches'), () => db.matchProducts(selection), rows => renderList($('matches'), rows, explanation));
}, 'choice')));
document.querySelectorAll('[data-screen]').forEach(n => n.onclick = () => show(n.dataset.screen));
$('search-form').onsubmit = e => { e.preventDefault(); const text = $('search-text').value; load($('search-results'), () => db.searchProducts(text), rows => renderList($('search-results'), rows)); };
function lookupBarcode(value) { stopCamera(); load($('scan-results'), () => db.getProductByBarcode(value), p => renderList($('scan-results'), p ? [p] : [])); }
$('barcode-form').onsubmit = e => { e.preventDefault(); lookupBarcode($('barcode').value); };
function openProduct(id) {
  if (screen !== 'details') returnScreen = screen;
  show('details');
  load($('product-details'), async () => {
    const p = await db.getProduct(id);
    if (!p) return null;
    try { return { p, recommendations: await db.getRecommendations(id) }; }
    catch { return { p, recommendations: null }; }
  }, data => {
    const target = $('product-details');
    if (!data) { target.append(el('p', 'המוצר אינו זמין עוד בקטלוג.')); return; }
    const { p, recommendations } = data, profile = p.profile || {};
    target.append(image(p), el('h2', p.name_he), el('p', p.brand?.name), el('p', badge(p), 'notice'));
    for (const [title, text] of [['מה זה?', p.short_description_he], ['למה משתמשים?', profile.concerns?.join(' • ')], ['איך משתמשים?', profile.usage_he], ['למי מתאים?', profile.suitable_for_he], ['חשוב לדעת', profile.warnings_he], ['רכיבים עיקריים', profile.key_ingredients?.join(' • ')]]) target.append(el('h2', title), el('p', text || 'לא נמסר מידע. יש לבדוק עם הרוקח/ת.'));
    target.append(el('p', `אימות אחרון: ${p.last_verified_at ? new Date(p.last_verified_at).toLocaleDateString('he-IL') : 'לא אומת'}`));
    if (p.source_url && safeUrl(p.source_url)) { const a = el('a', 'מקור מידע המוצר'); a.href = safeUrl(p.source_url); a.target = '_blank'; a.rel = 'noopener noreferrer'; target.append(a); }
    if (p.ai_summary_he) target.append(el('h2', 'סיכום שנוצר באמצעות AI — אינו מידע מאומת'), el('p', p.ai_summary_he), el('p', 'יש לבדוק מול מקור המוצר והרוקח/ת.'));
    target.append(el('h2', 'מוצרים משלימים'));
    if (recommendations === null) target.append(el('p', 'לא ניתן לטעון מוצרים משלימים.'), button('ניסיון נוסף', () => openProduct(id)));
    else {
      const complementary = recommendations.filter(r => r.product && r.recommendation_type === 'complementary');
      if (!complementary.length) target.append(el('p', 'אין מוצרים משלימים בקטלוג.'));
      complementary.forEach(r => target.append(card(r.product, r.reason_he)));
    }
  });
}
$('details-back').onclick = () => show(returnScreen);
$('camera-stop').onclick = stopCamera;
$('camera-start').onclick = async () => {
  stopCamera(); const generation = cameraGeneration;
  if (!('BarcodeDetector' in window) || !navigator.mediaDevices?.getUserMedia) { $('status').textContent = 'סריקת מצלמה אינה נתמכת בדפדפן זה. אפשר להקליד ברקוד או להשתמש בסורק USB.'; return; }
  try {
    const supported = await BarcodeDetector.getSupportedFormats();
    const formats = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'].filter(f => supported.includes(f));
    if (!formats.length) throw new Error();
    const detector = new BarcodeDetector({ formats });
    const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    if (generation !== cameraGeneration || screen !== 'scan') { media.getTracks().forEach(t => t.stop()); return; }
    stream = media; $('camera').srcObject = stream; $('camera').hidden = false; $('camera-stop').hidden = false; await $('camera').play();
    const detect = async () => {
      if (generation !== cameraGeneration) return;
      try {
        const codes = await detector.detect($('camera'));
        if (generation !== cameraGeneration) return;
        const code = codes.find(c => /^\d{8,14}$/.test(c.rawValue));
        if (code) { $('barcode').value = code.rawValue; lookupBarcode(code.rawValue); return; }
        cameraTimer = setTimeout(detect, 300);
      } catch { stopCamera(); $('status').textContent = 'הסריקה הופסקה. אפשר להקליד את הברקוד.'; }
    }; detect();
  } catch { if (generation === cameraGeneration) { stopCamera(); $('status').textContent = 'לא ניתן לפתוח מצלמה. בדקו הרשאה או השתמשו בהקלדת ברקוד.'; } }
};
document.addEventListener('visibilitychange', () => { if (document.hidden) stopCamera(); });
window.addEventListener('pagehide', stopCamera);
if (!config.url) $('status').textContent = errorText(new Error('SETUP_REQUIRED'));
