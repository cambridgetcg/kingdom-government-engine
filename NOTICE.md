# Rights and retained-material notice

This notice separates three different rights scopes. No single repository-wide licence is implied.

## Producer material

The producer code, schema, authored source/claim/map data, guide and README are marked `UNLICENSED`. No permission grant is made here.

## Official source links

`data/sources.json` and the public snapshot contain titles, publishers, URLs, concise paraphrases and cautions. They do not retain or republish the linked official page bodies. No page-specific reuse licence is inferred.

The Open Government Licence v3 is linked as a rights source, not applied as a blanket licence. Its conditions and exclusions include attribution, no implied official status, personal data, logos, third-party rights and other excluded material. UK Parliament, statutory bodies and third parties may use different terms.

## Exact TaxSorted vendor captures

The following unmodified UTF-8 JSON response bodies were acquired from TaxSorted public endpoints on 2026-08-21 and are retained for byte-receipt and selected-record-ID validation:

- `vendor/captures/taxsorted/open-data-releases.json`
- `vendor/captures/taxsorted/uk-public-funding/dictionary.json`
- `vendor/captures/taxsorted/uk-public-funding/graph.json`
- `vendor/captures/taxsorted/uk-public-funding/manifest.json`
- `vendor/captures/taxsorted/uk-public-funding/schema.json`
- `vendor/captures/taxsorted/uk-tax-system/dictionary.json`
- `vendor/captures/taxsorted/uk-tax-system/graph.json`
- `vendor/captures/taxsorted/uk-tax-system/manifest.json`
- `vendor/captures/taxsorted/uk-tax-system/schema.json`

Canonical sources are `https://api.taxsorted.io/v1/open-data/releases`, `https://api.taxsorted.io/v1/public-funding/uk/*` and `https://api.taxsorted.io/v1/tax-system/uk/*`. Exact file sizes and SHA-256 values are recorded in `vendor/capture-manifest.json` and checked offline.

TaxSorted declares Creative Commons Attribution-ShareAlike 4.0 for its curation: `https://creativecommons.org/licenses/by-sa/4.0/`. Attribution: TaxSorted (`https://taxsorted.io`). These files are retained without modification.

That declaration is not independently verified by KINGDOM and is not treated as a blanket licence for linked upstream source bodies, official publications, logos, personal data or third-party material. Applicable rights must be checked item by item. Linked upstream source bodies were not fetched into these captures.

The full TaxSorted graphs include curated source-locator records, public functional contact details and reported case-party names. This material sits outside the public snapshot's `personalData:false` assertion. It is retained only for exact receipt validation, is never projected into `public/government.json`, and is not used for people profiles. A bounded inspection found no taxpayer/customer records or actual taxpayer identifiers; this is not a guarantee about future upstream material.

## Corrections, privacy and removal

For this retained copy, request correction, update or removal at `https://github.com/cambridgetcg/kingdom-government-engine/issues`. For the upstream TaxSorted dataset, use `https://github.com/cambridgetcg/taxsorted.io/issues`. Do not include sensitive personal information in a public issue; use the repository owner's private security/contact channel when disclosure itself would create harm.

A removal or replacement must update the capture manifest, reviewed receipts, public bridge and deterministic snapshot together. Hash mismatch is a validation failure, not permission to fetch silently.
