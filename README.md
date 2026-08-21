# KINGDOM Government Engine

This repository builds a deterministic, static map of how the United Kingdom's government system moves through six separate planes: mandate, jurisdiction, law, money, delivery and remedy.

The output is [public/government.json](public/government.json). Its intended public locations are:

- dated publication: `https://thekingdom.dev/government/uk-government-engine-2026-08-21.json`
- mutable alias to the latest dated publication selected by KINGDOM: `https://thekingdom.dev/government.json`
- human view: `https://thekingdom.dev/government-engine/`

The mutable alias is not a claim that law, government structure, source content or a remedy remains current.

## What it maps

Phase 0 contains six planes, 10 finite flows, typed bodies and relations, 11 distinct rails, 10 redress start doors and explicit unknowns. It is an institutional atlas, not an organisation ranking or a universal process engine.

The core separation is deliberate:

```text
representation / confidence
            ↓
law and competence  →  public-money authority  →  accountable delivery
                               ≠
                    banking / payment settlement

complaint ≠ statutory review ≠ appeal ≠ ombudsman ≠ FOI/ICO ≠ judicial review
```

Read [UK-GOVERNMENT-ENGINE.md](UK-GOVERNMENT-ENGINE.md) for the full model and boundaries.

## Build and validate

Node.js 20 or later is the only runtime requirement. There are no package dependencies.

```sh
npm test
npm run validate
npm run build
npm run build:check
npm run overview
```

Validation and build do not use the network. `build` writes only `public/government.json`, atomically, after every schema, receipt, reference and semantic check succeeds.

## Source integrity

The 66 official-source records are links observed on 2026-08-21 through a maintainer-authorized assisted URL review. Exact source text was not separately human-reviewed. Official page bodies were not retained, byte-verified or hashed. Each public source record says this explicitly and uses link-only publication with no inferred reuse licence.

Claims are paraphrases or labelled editorial syntheses. Enacted legislation is kept distinct from institutional role pages, procedures, guidance, codes, service contracts and rights terms. A legislation contents page does not guarantee that a provision is commenced, fully updated or applicable to a live matter.

## TaxSorted bridge

The repository retains nine exact TaxSorted public JSON response bodies: two four-file graph bundles and the shared release ledger. Their SHA-256 receipts prove only byte identity of the retained capture. They do not authenticate TaxSorted, prove truth, establish endorsement or guarantee continued availability.

The retained provider schemas are receipt-pinned and receive bounded structural boot checks. The zero-dependency build does not establish full provider-schema conformance (`fullProviderSchemaValidationPerformed:false`). Full standards validation would be required before any future content projection or action surface.

The public atlas exposes only 20 selected dataset/record ID crosswalks to local plane, flow, rail, redress or unknown IDs. It projects no TaxSorted record text and uses no TaxSorted content as evidence for government claims. There is no runtime data transfer or internal HMRC/authentication coupling.

TaxSorted is independent and non-official. Both retained datasets say they are not complete, have review date 2026-07-10, and have no immutable snapshot URL in the retained release ledger. The atlas therefore raises an upstream-review warning.

## Personal-data scope

`personalData:false` describes the public Government Engine projection and runtime only. Exact vendored TaxSorted graphs contain public functional contact details and reported case-party names. Those bytes are retained solely for receipt validation, never projected into `public/government.json` and never used to build people profiles.

A bounded inspection found no taxpayer/customer records or actual taxpayer identifiers in the retained captures; that is not a repository-wide or future-content guarantee. See [NOTICE.md](NOTICE.md) for file scope, rights, correction and removal paths.

## Licence

Producer code, schemas, data authored for this atlas and documentation are `UNLICENSED`; no permission grant is made by this repository. Exact TaxSorted vendor material has a separate file-scoped rights notice. Official linked source bodies are not republished and retain their own applicable rights.
