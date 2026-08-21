#!/usr/bin/env node

import { relative } from 'node:path'

import { ROOT, prettyCanonicalJson, sha256Json } from './io.mjs'
import {
  buildSnapshot,
  expectedCaptureManifestReceipt,
  validateCheckedInSnapshot,
  writeSnapshot,
} from './government.mjs'

const HELP = `KINGDOM Government Engine v0.1 (offline, static, read-only)

Usage:
  kingdom-government validate   validate inputs, schema, official-source links, captures, crosswalks, and semantics
  kingdom-government build      deterministically write only public/government.json
  kingdom-government check      prove public/government.json matches the exact deterministic dated build
  kingdom-government overview   print a bounded read-only atlas summary
  kingdom-government help       print this help
`

function output(value) {
  process.stdout.write(prettyCanonicalJson(value))
}

function requireNoArguments(rest) {
  if (rest.length !== 0) throw new Error(`unexpected argument(s): ${rest.join(' ')}`)
}

function main() {
  const [command = 'help', ...rest] = process.argv.slice(2)
  if (command === 'help' || command === '--help' || command === '-h') {
    requireNoArguments(rest)
    process.stdout.write(HELP)
    return
  }
  requireNoArguments(rest)

  if (command === 'validate') {
    const snapshot = buildSnapshot()
    output({
      state: 'valid-static-uk-government-atlas',
      asOf: snapshot.asOf,
      nextReviewDue: snapshot.freshness.nextReviewDue,
      counts: snapshot.counts,
      snapshotCanonicalReceipt: sha256Json(snapshot),
      taxsortedCaptureManifestCanonicalReceipt: expectedCaptureManifestReceipt,
      sourceReviewMode: snapshot.sourceLedgerPolicy.reviewMode,
      exactTextHumanReviewed: snapshot.authorship.exactTextHumanReviewed,
      networkUsed: false,
      automaticAction: false,
    })
    return
  }

  if (command === 'build') {
    const built = writeSnapshot()
    output({
      state: 'built-deterministic-static-uk-government-atlas',
      path: relative(ROOT, built.path),
      bytes: built.bytes,
      counts: built.snapshot.counts,
      snapshotByteReceipt: built.byteReceipt,
      snapshotCanonicalReceipt: built.canonicalReceipt,
      networkUsed: false,
    })
    return
  }

  if (command === 'check') {
    const checked = validateCheckedInSnapshot()
    if (!checked.current) throw new Error('public/government.json is absent or differs from the deterministic build')
    output({
      state: 'matches-deterministic-dated-static-uk-government-atlas',
      asOf: checked.snapshot.asOf,
      nextReviewDue: checked.snapshot.freshness.nextReviewDue,
      path: 'public/government.json',
      counts: checked.snapshot.counts,
      snapshotByteReceipt: checked.byteReceipt,
      snapshotCanonicalReceipt: checked.canonicalReceipt,
      networkUsed: false,
    })
    return
  }

  if (command === 'overview') {
    const snapshot = buildSnapshot()
    output({
      phase: '0-static-source-linked-atlas',
      asOf: snapshot.asOf,
      nextReviewDue: snapshot.freshness.nextReviewDue,
      planes: snapshot.planes.map((plane) => plane.name),
      finiteFlows: snapshot.flows.length,
      typedRedressRoutes: snapshot.redressRoutes.length,
      officialSourceLinks: snapshot.sources.length,
      receiptBoundExternalBridges: snapshot.externalBridges.length,
      mutablePublicationAlias: snapshot.urls.mutableAlias,
      sourceReviewMode: snapshot.sourceLedgerPolicy.reviewMode,
      exactTextHumanReviewed: snapshot.authorship.exactTextHumanReviewed,
      legalAdvice: false,
      taxAdvice: false,
      governmentAffiliation: false,
      automaticAction: false,
      runtimeNetwork: false,
    })
    return
  }

  throw new Error(`unknown command ${JSON.stringify(command)}\n\n${HELP}`)
}

try {
  main()
} catch (error) {
  process.stderr.write(`${error?.stack ?? error}\n`)
  process.exitCode = 1
}
