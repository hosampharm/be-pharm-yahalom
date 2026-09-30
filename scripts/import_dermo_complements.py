"""Import supplied relationships; source verification claims are not independently verified."""
import hashlib
import json
from pathlib import Path
import openpyxl
from import_supplements import clean, valid_gtin

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'DERMO/dermo-complementary-products.xlsx'

def build():
    products = json.loads((ROOT / 'data/dermo.json').read_text(encoding='utf-8'))['products']
    by_gtin = {p['barcode'].zfill(14): p for p in products if valid_gtin(p['barcode'])}
    workbook = openpyxl.load_workbook(SOURCE, read_only=True, data_only=True)
    digest = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
    relationships, seen = [], set()
    for sheet in workbook:
        rows = iter(sheet.values)
        headers = next(rows)
        for number, row in enumerate(rows, 2):
            if not any(v is not None for v in row):
                continue
            record = {k: clean(v) for k, v in zip(headers, row) if k}
            for side in ('source', 'recommended'):
                barcode = record[side + '_barcode']
                if not valid_gtin(barcode) or barcode.zfill(14) not in by_gtin:
                    raise ValueError(f'Unmatched barcode at row {number}: {barcode}')
                product = by_gtin[barcode.zfill(14)]
                if product['brand'] != record[side + '_brand']:
                    raise ValueError(f'Brand mismatch at row {number}')
                record[side + '_id'] = product['id']
            pair = (record['source_id'], record['recommended_id'])
            if pair[0] == pair[1] or pair in seen:
                raise ValueError(f'Duplicate/self relationship at row {number}')
            seen.add(pair)
            record['provenance'] = {'file': str(SOURCE.relative_to(ROOT)), 'sheet': sheet.title, 'row': number, 'sha256': digest}
            relationships.append(record)
    workbook.close()
    return {'relationships': relationships, 'source_products': len({r['source_id'] for r in relationships}), 'verification_note': 'Supplied relationship evidence and verification labels; not independently verified.'}

if __name__ == '__main__':
    payload = json.dumps(build(), ensure_ascii=False, indent=2)
    (ROOT / 'data/dermo-complements.json').write_text(payload + '\n', encoding='utf-8')
    (ROOT / 'data/dermo-complements.js').write_text('window.DERMO_COMPLEMENTS = ' + payload.replace('<', '\\u003c') + ';\n', encoding='utf-8')
