/* Shared source-image presentation. No substitute package imagery is invented. */
window.createProductMedia = (rawURL, productName) => {
  const box = document.createElement('span');
  box.className = 'product-media';
  const fallback = () => {
    const label = document.createElement('span');
    label.className = 'product-media-fallback';
    label.textContent = 'תמונה אינה זמינה';
    box.replaceChildren(label);
  };
  let url;
  try { url = new URL(rawURL); } catch { fallback(); return box; }
  if (url.protocol !== 'https:') { fallback(); return box; }
  const image = document.createElement('img');
  image.alt = productName;
  image.loading = 'lazy';
  image.decoding = 'async';
  image.referrerPolicy = 'no-referrer';
  image.addEventListener('error', fallback, {once:true});
  image.src = url.href;
  box.append(image);
  return box;
};
