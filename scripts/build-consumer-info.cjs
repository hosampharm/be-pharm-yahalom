// Input: JSON exported from the corrected consumer workbook. Review-only data stays private.
const fs = require('node:fs');
const path = require('node:path');
const source = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const key = value => String(value).trim().padStart(14, '0');
const result = {};
for (const product of source.Products) {
  if (product.publication_status === 'blocked_regulatory_review') continue;
  const issues = (source['פריטים פתוחים'] || []).filter(row => key(row['ברקוד']) === key(product.barcode));
  // Unresolved identity, classification, ingredients or purpose can invalidate both descriptions.
  if (issues.some(row => /label_purpose|product_name|classification|name\/|ingredients/.test(row['עמודה']))) continue;
  const purpose = product.label_purpose_he?.trim();
  const description = product.proposed_description_he?.trim();
  if (!purpose && !description) continue;
  result[key(product.barcode)] = {purpose, description};
}
const destination = path.join(__dirname, '..', 'data', 'consumer-info.js');
fs.writeFileSync(destination, 'window.CONSUMER_INFO = ' + JSON.stringify(result, null, 2) + ';\n');
console.log(`Exported descriptions for ${Object.keys(result).length} products; ${source.Products.length - Object.keys(result).length} withheld.`);
