import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import { ROOT, sha256Bytes } from '../src/io.mjs'
import {
  buildSnapshot,
  expectedCaptureManifestReceipt,
  expectedCaptureReceipts,
  loadCaptureBundle,
} from '../src/government.mjs'

test('all nine exact TaxSorted captures retain reviewed byte receipts', () => {
  assert.equal(Object.keys(expectedCaptureReceipts).length, 9)
  for (const [path, receipt] of Object.entries(expectedCaptureReceipts)) {
    assert.equal(sha256Bytes(readFileSync(join(ROOT, path))), receipt, path)
  }
  const bundle = loadCaptureBundle()
  assert.equal(bundle.captureManifest.datasets.length, 2)
  assert.equal(bundle.releaseLedger.schema, 'taxsorted.open-data-release-ledger/1')
  assert.match(expectedCaptureManifestReceipt, /^sha256:[0-9a-f]{64}$/u)
})

test('release ledger exactly binds both graph digests, versions, checkpoint IDs and open status', () => {
  const bundle = loadCaptureBundle()
  for (const [datasetId, captured] of bundle.datasets) {
    const graphReceipt = captured.dataset.files.find((file) => file.kind === 'graph').sha256
    assert.equal(captured.checkpoint.digest, graphReceipt)
    assert.equal(captured.checkpoint.id, captured.dataset.checkpointId)
    assert.equal(captured.checkpoint.version, captured.dataset.version)
    assert.equal(captured.checkpoint.publicationStatusAtCheckpoint, 'open')
    assert.equal(captured.checkpoint.links.immutableSnapshot, null)
    assert.equal(captured.publication.latestDeclaredCheckpointId, captured.dataset.checkpointId)
    assert.equal(captured.releaseManifest.datasetHash, graphReceipt, datasetId)
  }
})

test('public bridge exposes selected IDs only and cannot become government evidence', () => {
  const snapshot = buildSnapshot()
  assert.deepEqual(snapshot.externalBridges.map((bridge) => bridge.selectedRecordBindings.length), [13, 7])
  for (const bridge of snapshot.externalBridges) {
    assert.equal(bridge.bridgeMode, 'receipt-bound-crosswalk-only')
    assert.equal(bridge.boundaryScope, 'government-engine-public-projection')
    assert.equal(Object.values(bridge.boundaries).every((value) => value === false), true)
    assert.equal(bridge.boundaries.governmentEvidenceSource, false)
    assert.equal(bridge.boundaries.fullProviderSchemaValidationPerformed, false)
    assert.equal(bridge.boundaries.taxsortedContentUsedAsGovernmentEvidence, false)
    assert.equal(bridge.boundaries.taxsortedRecordTextProjectedIntoGovernmentSnapshot, false)
    assert.equal(bridge.boundaries.upstreamSourceBodyBytesRetained, false)
    assert.equal(bridge.rights.declarationBy, 'TaxSorted')
    assert.equal(bridge.rights.declarationIndependentlyVerified, false)
    assert.equal(bridge.rights.upstreamSourceBodiesRepublished, false)
    assert.equal(bridge.rights.upstreamSourceRightsNotGrantedByThisCapture, true)
    assert.equal(Object.hasOwn(bridge.provenance, 'sourceCommit'), false)
    assert.equal(Object.hasOwn(bridge.provenance, 'etag'), false)
    for (const binding of bridge.selectedRecordBindings) {
      assert.deepEqual(Object.keys(binding).sort(), ['collection', 'localIds', 'purpose', 'recordId'])
    }
  }
})

test('freshness alarms are computed from exact captured source locator dates', () => {
  const snapshot = buildSnapshot()
  const tax = snapshot.externalBridges.find((bridge) => bridge.datasetId === 'taxsorted:uk-tax-system')
  const funding = snapshot.externalBridges.find((bridge) => bridge.datasetId === 'taxsorted:uk-public-funding')
  assert.deepEqual({ total: tax.sourceFreshnessAtCapture.totalSourceRecords, past: tax.sourceFreshnessAtCapture.pastReviewAfterCount }, { total: 73, past: 10 })
  assert.deepEqual({ total: funding.sourceFreshnessAtCapture.totalSourceRecords, past: funding.sourceFreshnessAtCapture.pastReviewAfterCount }, { total: 52, past: 10 })
  assert.equal(tax.sourceFreshnessAtCapture.allSourcesCurrentGuaranteed, false)
  assert.equal(funding.sourceFreshnessAtCapture.allSourcesCurrentGuaranteed, false)
})

test('NOTICE scopes TaxSorted rights, vendor person-related data and correction paths', () => {
  const notice = readFileSync(join(ROOT, 'NOTICE.md'), 'utf8')
  assert.match(notice, /Creative Commons Attribution-ShareAlike 4\.0/u)
  assert.match(notice, /retained without modification/u)
  assert.match(notice, /public functional contact details and reported case-party names/u)
  assert.match(notice, /no taxpayer\/customer records or actual taxpayer identifiers/u)
  assert.match(notice, /kingdom-government-engine\/issues/u)
  assert.match(notice, /taxsorted\.io\/issues/u)
  assert.match(notice, /UNLICENSED/u)
})
