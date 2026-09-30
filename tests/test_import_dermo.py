import collections
import hashlib
import json
from pathlib import Path
import sys
import unittest

import openpyxl

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from import_supplements import clean, valid_gtin


class DermoImportTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.catalog = json.loads((ROOT / 'data/dermo.json').read_text(encoding='utf-8'))
        cls.products = cls.catalog['products']

    def test_counts_and_catalog_isolation(self):
        self.assertEqual(collections.Counter(r['brand'] for r in self.products),
                         {'CeraVe': 15, 'La Roche-Posay': 15, 'Vichy': 15,
                          'Avène': 15, 'Bioderma': 15, 'Cetaphil': 15,
                          'Dr. Or': 15, 'Mustela': 15, 'SeboCalm': 15, 'Uriage': 15})
        supplements = json.loads((ROOT / 'data/supplements.json').read_text(encoding='utf-8'))['products']
        self.assertEqual(len(supplements), 248)
        self.assertFalse({r['id'] for r in supplements} & {r['id'] for r in self.products})

    def test_every_original_cell_preserved(self):
        for source in self.catalog['sources']:
            path = ROOT / source['file']
            self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(), source['sha256'])
            workbook = openpyxl.load_workbook(path, read_only=True, data_only=True)
            for sheet in workbook:
                values = iter(sheet.values)
                headers = next(values)
                for row_number, row in enumerate(values, 2):
                    if not any(v is not None for v in row):
                        continue
                    output = next(r for r in self.products if r['provenance']['file'] == source['file']
                                  and r['provenance']['sheet'] == sheet.title and r['provenance']['row'] == row_number)
                    for key, value in zip(headers, row):
                        self.assertEqual(clean(value), output[key], (source['file'], row_number, key))
            workbook.close()

    def test_barcodes_preserve_text_and_are_unique(self):
        barcodes = [r['barcode'] for r in self.products]
        self.assertEqual(len(barcodes), len(set(barcodes)))
        for row in self.products:
            self.assertIsInstance(row['barcode'], str)
            self.assertEqual(row['barcode'], row['barcode_original'])
            self.assertTrue(valid_gtin(row['barcode']))
            self.assertEqual(row['barcode_verification'], 'source_file_checksum_valid')

    def test_nulls_do_not_become_suitability_claims(self):
        self.assertTrue(any(r['pregnancy_info_he'] is None for r in self.products))
        for row in self.products:
            for key in ('pregnancy_info_he', 'warnings_he', 'active_ingredients', 'spf'):
                self.assertNotEqual(row[key], 'null')


if __name__ == '__main__':
    unittest.main()
