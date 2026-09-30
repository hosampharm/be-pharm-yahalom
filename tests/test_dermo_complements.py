import hashlib
import json
from pathlib import Path
import unittest
import openpyxl

ROOT = Path(__file__).resolve().parents[1]

class ComplementImportTests(unittest.TestCase):
    def test_relationships_preserve_source_and_resolve_catalog_products(self):
        source = ROOT / 'DERMO/dermo-complementary-products.xlsx'
        catalog = json.loads((ROOT / 'data/dermo.json').read_text(encoding='utf-8'))['products']
        products = {p['id']: p for p in catalog}
        data = json.loads((ROOT / 'data/dermo-complements.json').read_text(encoding='utf-8'))
        records = data['relationships']
        self.assertEqual(len(records), 282)
        self.assertEqual(data['source_products'], 148)
        self.assertEqual(len({(r['source_id'], r['recommended_id']) for r in records}), 282)
        workbook = openpyxl.load_workbook(source, read_only=True, data_only=True)
        rows = list(workbook.active.values)
        for record, row in zip(records, rows[1:]):
            for key, value in zip(rows[0], row):
                self.assertEqual(record[key], None if value is None else str(value).strip())
            self.assertEqual(record['provenance']['sha256'], hashlib.sha256(source.read_bytes()).hexdigest())
            for side in ('source', 'recommended'):
                product = products[record[side + '_id']]
                self.assertEqual(product['barcode'].zfill(14), record[side + '_barcode'].zfill(14))
                self.assertEqual(product['brand'], record[side + '_brand'])
            self.assertNotEqual(record['source_id'], record['recommended_id'])
        workbook.close()
