# Be Pharm Yahalom kiosk

Static Hebrew RTL kiosk. Open `index.html` directly or serve this directory as a
static site. There is no build step, backend, database service, API key, or
recommendation engine. Dermo and supplement navigation are independent.

## Supplement catalog

The four supplied workbooks are source snapshots. They are never edited by the
importer. `scripts/import_supplements.py` reads 123 populated rows and generates
`data/supplements.json`, its browser-compatible `data/supplements.js` wrapper,
and `data/import-report.json`. The wrapper intentionally supports `file://`
previews without fetch/CORS or a build tool. Do not edit generated files by hand.

Use Python 3 with `openpyxl` installed:

```
python scripts/import_supplements.py
python -m unittest discover -s tests -v
```

To refresh the 22 Solgar barcode checks from the supplied retailer product URLs:

```
python scripts/import_supplements.py --verify-barcodes
```

Barcode evidence is saved in `data/barcode-evidence.json`. The importer requires
the explicit product barcode text on the live retailer page, a matching original
numeric value, and a valid GTIN check digit; it does not guess leading zeros from
image filenames. Unconfirmed barcodes are null and excluded from barcode lookup.
Other brands' barcodes are retained from the workbooks with checksum validation;
they have not been independently checked against every manufacturer page.

Each product retains source filename, row, sheet, SHA-256 and original barcode.
Literal `null` cells become missing values, never claims of absence. Clinical
fields and `verification_status` are copied from the supplied workbooks, not
independently clinically certified. No suitability or dosage is inferred.
The catalog is not a stock availability feed. Missing details remain missing.

Known source issue: Solgar curcumin row 20 links to an omega-3 page in its official
URL field. The customer link is omitted; its original value is retained in
provenance and the issue is recorded in the import report. Its retailer link is
preserved. Source links and remote images may change or be unavailable.

The dermo search and scan screens remain placeholders. Supplement barcode lookup
uses exact catalog identifiers; it is not camera scanning. A USB scanner that
types into the search field can supply the barcode. Clinical review of supplied
content is still a separate responsibility before production customer use.

## Deployment

Publish the repository root as a static directory (no build command). There is no
Netlify project configuration or known production URL in this repository. A GitHub
push by itself does not confirm a live Netlify deployment.
