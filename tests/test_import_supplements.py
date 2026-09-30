"""Run: python -m unittest discover -s tests -v"""
import hashlib
import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('importer', ROOT / 'scripts/import_supplements.py')
importer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(importer)


class CatalogImportTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.catalog = json.loads((ROOT / 'data/supplements.json').read_text(encoding='utf-8'))
        cls.products = cls.catalog['products']
        cls.raw, _ = importer.read_records()

    def test_all_source_rows_preserved(self):
        self.assertEqual(len(self.products), 248)
        self.assertEqual(len(self.raw), 251)
        preserved = {r['id']: r for r in self.products}
        for record in self.products:
            preserved.update({r['id']: r for r in record.get('duplicate_sources', [])})
        self.assertEqual(set(r['id'] for r in self.raw), set(preserved))
        allowed_changes = {'barcode', 'barcode_verification', 'source_issues', 'provenance'}
        for source in self.raw:
            output = preserved[source['id']]
            for key, value in source.items():
                if key in allowed_changes or (source['id'] == 'solgar-20' and key == 'official_product_url'):
                    continue
                self.assertEqual(value, output[key], (source['id'], key))

    def test_original_workbooks_unchanged(self):
        for source in self.catalog['sources']:
            self.assertEqual(hashlib.sha256((ROOT / source['file']).read_bytes()).hexdigest(), source['sha256'])

    def test_barcodes_are_unique_valid_strings(self):
        values = [r['barcode'] for r in self.products]
        self.assertEqual(len(values), len(set(values)))
        for value in values:
            self.assertIsInstance(value, str)
            self.assertTrue(importer.valid_gtin(value), value)

    def test_solgar_has_live_evidence_not_blind_zero_padding(self):
        evidence = json.loads((ROOT / 'data/barcode-evidence.json').read_text(encoding='utf-8'))
        self.assertEqual(len(evidence), 22)
        by_id = {r['id']: r for r in self.products}
        for item in evidence:
            product = by_id[item['id']]
            self.assertEqual(item['status'], 'confirmed_retailer_barcode')
            self.assertIn(item['barcode'], item['excerpt'])
            self.assertEqual(product['barcode'], item['barcode'])
            self.assertEqual(product['retailer_product_url'], item['source_url'])
            self.assertEqual(int(product['barcode_original']), int(product['barcode']))

    def test_mismatched_source_is_not_published_as_product_source(self):
        product = next(r for r in self.products if r['id'] == 'solgar-20')
        self.assertIsNone(product['official_product_url'])
        self.assertTrue(product['provenance']['original_official_product_url'])
        self.assertTrue(product['source_issues'])

    def test_null_and_invalid_barcode_normalization(self):
        for value in (None, '', 'null', ' NULL ', 'none'):
            self.assertIsNone(importer.clean(value))
        self.assertEqual(importer.clean(33984011878.0), '33984011878')
        self.assertEqual(importer.clean('0033984011878'), '0033984011878')
        for value in (None, '33984011878', '0033984011879', 'ABC', '123'):
            self.assertFalse(importer.valid_gtin(value))
        self.assertTrue(importer.valid_gtin('0033984011878'))


if __name__ == '__main__':
    unittest.main()
