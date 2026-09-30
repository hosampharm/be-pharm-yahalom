"""Read supplied XLSX files without modifying them; generate the static catalog.

Requires openpyxl. Run from any directory with Python 3.
Use --verify-barcodes to refresh the Solgar retailer evidence (network read only).
Clinical fields and source verification labels are preserved, not independently certified.
"""
import argparse
import collections
import datetime
import hashlib
import html
import json
from pathlib import Path
import re
import urllib.request
from concurrent.futures import ThreadPoolExecutor

import openpyxl

ROOT = Path(__file__).resolve().parents[1]
FILES = ('VITAM/altman.xlsx', 'VITAM/nutricare.xlsx', 'VITAM/solgar.xlsx', 'VITAM/supherb.xlsx')
FILES += tuple('VITAM/' + name + '.xlsx' for name in ('magnox', 'centrum', 'alsepa', 'dr-k', 'bara-herbs', 'ecosupp', 'hadas'))
SUBCATEGORIES = {
    'joint_health':'joints','בריאות מפרקים ותנועה':'joints',
    'משחה הומאופתית לכאבי שרירים וחבלות':'topical_care',
    'מיצוי כורכום פטנטי':'curcumin','curcumin':'curcumin',
    'curcumin_antioxidant':'curcumin','herbal_antioxidant':'antioxidants',
    'urinary_tract_support':'urinary','superfood':'superfoods',
    'cholesterol_support':'cholesterol','herbal_cardiovascular':'cardiovascular',
    'cardiovascular_support':'cardiovascular','antioxidant_energy':'antioxidants',
    'minerals':'minerals','minerals_and_vitamins':'vitamins_minerals','vitamins':'vitamins_minerals',
    'multivitamins':'multivitamin','children_vitamins':'children_vitamins',
    'omega_3':'omega_3','fatty_acids':'fatty_acids',
    'digestive_health':'digestive_support','digestion':'digestive_support','probiotics':'probiotic',
    'calming_and_sleep':'sleep_support','calming_and_stress':'sleep_support','stress_sleep':'sleep_support',
    'immune_support':'immune_support','maternal_health':'prenatal',
    'herbal_supplements':'herbal','herbal':'herbal','mushroom_supplements':'mushrooms',
    'antioxidants':'antioxidants','superfoods':'superfoods','respiratory_care':'respiratory',
    'respiratory_health':'respiratory','winter_throat':'respiratory','urinary_tract':'urinary',
    'women_health':'women','sports_nutrition':'sports','compresses_and_wipes':'topical_care',
    'infant_care':'infant_care','ear_health':'ear_care',
    'ויטמין B12':'vitamin_b12','ויטמין C':'vitamin_c','ויטמין C לילדים':'vitamin_c',
    'ויטמין D':'vitamin_d','ויטמין D לתינוקות':'vitamin_d','חומצה פולית':'folic_acid',
    'כורכום וכורכומין':'herbal','מערכת החיסון לחורף':'immune_support',
    'מערכת עיכול':'digestive_support','פרוביוטיקה':'probiotic','שינה והרגעה':'sleep_support',
}
DATA = ROOT / 'data'


def clean(value):
    if value is None or str(value).strip().lower() in ('', 'null', 'none'):
        return None
    if isinstance(value, (datetime.date, datetime.datetime)):
        return value.isoformat()
    if isinstance(value, (int, float)) and float(value).is_integer():
        return str(int(value))
    return str(value).strip()


def valid_gtin(value):
    return bool(value and value.isdigit() and len(value) in (8, 12, 13, 14)
                and (sum(int(c) * (3 if i % 2 == 0 else 1)
                         for i, c in enumerate(value[-2::-1])) + int(value[-1])) % 10 == 0)


def read_records():
    records, files = [], []
    for filename in FILES:
        path = ROOT / filename
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        workbook = openpyxl.load_workbook(path, read_only=True, data_only=True)
        count = 0
        for sheet in workbook:
            values = iter(sheet.values)
            headers = next(values)
            for row_number, row in enumerate(values, 2):
                if not any(v is not None for v in row):
                    continue
                record = {key: clean(value) for key, value in zip(headers, row) if key}
                if not record.get('product_name_he'):
                    raise ValueError(f'Missing product name: {filename}:{row_number}')
                record['id'] = f'{path.stem}-{row_number}'
                record['provenance'] = {'file': filename, 'sheet': sheet.title, 'row': row_number, 'sha256': digest}
                record['barcode_original'] = record.get('barcode')
                records.append(record)
                count += 1
        workbook.close()
        files.append({'file': filename, 'sha256': digest, 'products': count})
    return records, files


def verify_solgar(record):
    url = record['retailer_product_url']
    evidence = {'id': record['id'], 'source_url': url, 'original': record['barcode_original'],
                'checked_at': datetime.datetime.now(datetime.timezone.utc).isoformat()}
    try:
        request = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(request, timeout=35) as response:
            page = response.read().decode('utf-8')
            evidence['resolved_url'] = response.url
        match = re.search(r'<p[^>]*class=["\'][^"\']*description-ean[^"\']*["\'][^>]*>(.*?)</p>', page, re.S)
        text = html.unescape(re.sub('<[^>]+>', '', match.group(1))) if match else ''
        candidates = re.findall(r'\b\d{8,14}\b', text)
        matched = [b for b in candidates if valid_gtin(b) and int(b) == int(record['barcode_original'])]
        evidence['excerpt'] = text.strip()
        evidence['barcode'] = matched[0] if len(matched) == 1 else None
        evidence['status'] = 'confirmed_retailer_barcode' if evidence['barcode'] else 'unconfirmed'
    except Exception as error:
        evidence.update(status='unconfirmed', barcode=None, error=str(error))
    return evidence


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--verify-barcodes', action='store_true')
    args = parser.parse_args()
    DATA.mkdir(exist_ok=True)
    records, sources = read_records()
    evidence_path = DATA / 'barcode-evidence.json'
    if args.verify_barcodes:
        with ThreadPoolExecutor(max_workers=4) as pool:
            evidence = list(pool.map(verify_solgar, [r for r in records if r['brand'] == 'Solgar']))
        evidence_path.write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    else:
        evidence = json.loads(evidence_path.read_text(encoding='utf-8')) if evidence_path.exists() else []
    evidence_by_id = {item['id']: item for item in evidence}
    issues = []
    for record in records:
        barcode = record['barcode_original']
        record['barcode_verification'] = 'source_file_checksum_valid' if valid_gtin(barcode) else 'unconfirmed'
        if record['brand'] == 'Solgar':
            item = evidence_by_id.get(record['id'], {})
            confirmed = (item.get('status') == 'confirmed_retailer_barcode'
                         and item.get('original') == barcode
                         and item.get('source_url') == record['retailer_product_url']
                         and valid_gtin(item.get('barcode')))
            barcode = item['barcode'] if confirmed else None
            record['barcode_verification'] = 'confirmed_retailer_barcode' if confirmed else 'unconfirmed'
        record['barcode'] = barcode if valid_gtin(barcode) else None
        record['source_issues'] = []
        # The supplied curcumin row links to the omega-3 product. Preserve the
        # original in provenance, but never present that as a curcumin source.
        if record['brand'] == 'Solgar' and record['barcode_original'] == '33984595972':
            record['provenance']['original_official_product_url'] = record['official_product_url']
            record['official_product_url'] = None
            record['source_issues'].append('Supplied official URL refers to omega-3, not this curcumin product; omitted from customer links.')
        if record['barcode'] is None:
            record['source_issues'].append('Barcode not confirmed; exact barcode lookup disabled for this record.')
        if record['source_issues']:
            issues.append({'id': record['id'], 'issues': record['source_issues']})
    merged, by_barcode, duplicates = [], {}, []
    for record in records:
        record['browse_category'] = SUBCATEGORIES.get(record.get('sub_category'), 'other') if record['category'] in ('other', 'supplements', 'dietary_supplements', 'topical_care', 'תוספי תזונה') else record['category']
        barcode = record['barcode']
        if barcode and barcode in by_barcode:
            previous = by_barcode[barcode]
            record['duplicate_sources'] = [previous]
            merged[merged.index(previous)] = record
            duplicates.append({'barcode': barcode, 'retained': record['id'], 'previous': previous['id']})
        else:
            merged.append(record)
        if barcode:
            by_barcode[barcode] = record
    records = merged
    barcodes = [r['barcode'] for r in records if r['barcode']]
    if len(barcodes) != len(set(barcodes)):
        raise ValueError('Duplicate barcodes; import halted')
    catalog = {'schema_version': 1, 'sources': sources, 'products': records,
               'verification_note': 'Clinical content and verification_status are supplied workbook values, not an independent clinical review.'}
    payload = json.dumps(catalog, ensure_ascii=False, indent=2)
    (DATA / 'supplements.json').write_text(payload + '\n', encoding='utf-8')
    (DATA / 'supplements.js').write_text('// Generated by scripts/import_supplements.py; do not edit.\nwindow.SUPPLEMENT_CATALOG = ' + payload.replace('<', '\\u003c') + ';\n', encoding='utf-8')
    report = {'products': len(records), 'brands': dict(collections.Counter(r['brand'] for r in records)),
              'source_statuses': dict(collections.Counter(r['verification_status'] for r in records)),
              'barcode_statuses': dict(collections.Counter(r['barcode_verification'] for r in records)),
              'issues': issues, 'sources': sources, 'duplicates_merged': duplicates}
    (DATA / 'import-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
