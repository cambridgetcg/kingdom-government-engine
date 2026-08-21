# AGENTS.md

## Scope

This repository produces the static, read-only UK Government Engine Phase-0 snapshot. The public snapshot/runtime does not operate a government service, make a decision, calculate tax, file, pay, authenticate, collect personal data, call an API, or fetch during validation/build. Exact vendor captures have the separate person-related-data scope documented in `NOTICE.md`.

## Required commands

Run all of these before changing a frozen receipt or handing off an artifact:

```sh
npm test
npm run validate
npm run build
npm run build:check
npm run check
```

`build` may write only `public/government.json`. Validation and build must remain offline and zero-dependency.

## Contract rules

- Keep exactly one Draft 2020-12 schema at `schemas/v0.1/public-snapshot.schema.json`; every object contract is closed.
- Keep the strict JSON reader: fatal UTF-8, duplicate-key rejection, bounded size/depth/nodes/collections/strings, safe integers, no symlink inputs, and inert `__proto__`/`constructor`/`prototype` member names.
- Sort receipt-bearing IDs with explicit ASCII/code-unit ordering, never locale-dependent ordering.
- Preserve exact source, claim, date, count, reference, URL-host and capture receipts. A change requires a deliberate contract review and new receipts.
- Official-source records are maintainer-authorized assisted URL reviews only. No raw official-source body or content hash is retained; no page licence is inferred.
- TaxSorted is an independent, non-official, receipt-bound crosswalk only. Its content cannot support a government claim and no TaxSorted record text is projected into the public snapshot.
- Never add people, parties, current officeholders, live tax rates, personal cases, advice, forms, POST routes, MCP exposure, action, filing, payment, credentials, scalar scores or automation.
- Keep authority, jurisdiction, law, public-money authority, payment operations, service/data delivery and redress distinct.
- Keep complaint, review, appeal, ombudsman, information-rights and judicial-review routes typed; do not imply an automatic ladder or calculate eligibility/deadlines.

## Vendor material

Do not edit files under `vendor/captures/taxsorted/`. They are exact upstream response bodies. Read `NOTICE.md` before changing, removing or redistributing vendor material.

## Repository operations

Do not commit, tag, push or publish unless the maintainer explicitly requests that separate operation. Preserve unrelated work and do not edit KINGDOM-OS or TaxSorted from this repository task.
