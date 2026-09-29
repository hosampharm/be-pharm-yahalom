# Be Pharm Yahalom kiosk

Static Hebrew RTL kiosk. Open `index.html` directly or serve this directory as a
static site. There is no build step, backend, database service, API key, or
recommendation engine. Dermo and supplement navigation are independent.

## Guided supplement navigation

The supplement entrance offers direct product lookup or guided browsing. Direct
lookup starts empty and updates product matches while typing; an exact full
barcode submitted by a keyboard-style scanner opens the matching record.
Guided browsing searches a small, explicit directory of topics backed by existing
catalog categories. Terms such as digestion or sleep suggest a topic to select,
not a diagnosis or a product prescription. Unknown terms do not invent results.
Product name search and filters remain inside the selected topic. Back preserves
that context; Home starts a new session. The original full catalog is not shown
on entry.

Topic synonyms are navigation labels only. They do not establish that a product
treats a condition, that a customer has a deficiency, or that a product is suitable
for them. Category assignments are inherited from the supplied workbooks and
still require pharmacy review alongside the product information.

## Supplement catalog

The four supplied workbooks in `VITAM/` are source snapshots. They are never edited by the
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

Supplement barcode lookup
uses exact catalog identifiers; it is not camera scanning. A USB scanner that
types into the search field can supply the barcode. Clinical review of supplied
content is still a separate responsibility before production customer use.

## Dermo catalog

`DERMO/cerave.xlsx`, `DERMO/la-roche-posay.xlsx`, and `DERMO/vichy.xlsx` supply
45 products in an independent catalog. Run `python scripts/import_dermo.py` to
rebuild `data/dermo.json`, `data/dermo.js`, and `data/dermo-import-report.json`.
The workbooks are read without modification. Source rows, hashes, missing fields,
and verification declarations are preserved. Barcode check digits are validated;
this is not independent verification of product identity or clinical content.

Dermo search and barcode lookup use only the dermo catalog. The existing
concern/skin journey filters exact pipe-separated tags from source records, using
an intersection of the selected concern and skin type; it does not infer medical
suitability or fill missing tags. No-match combinations remain empty. Product
details preserve source information, warnings, links and status attribution.
Both worlds support keyboard-style scanners, not camera capture.

## Deployment

Publish the repository root as a static directory (no build command). There is no
Netlify project configuration or known production URL in this repository. A GitHub
push by itself does not confirm a live Netlify deployment.
