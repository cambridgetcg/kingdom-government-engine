import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  PUBLIC_SNAPSHOT,
  canonicalJson,
  prettyCanonicalJson,
  readJson,
  sha256Bytes,
  sha256Json,
} from '../src/io.mjs'
import {
  assembleSnapshot,
  buildSnapshot,
  expectedCounts,
  loadCaptureBundle,
  loadInputs,
  snapshotIssues,
  validateCheckedInSnapshot,
} from '../src/government.mjs'

const SNAPSHOT_BYTE_RECEIPT = 'sha256:1751b2ac331d6a1283cbf57b5b6961d9071f528298f97589fcbd7cf36407e139'
const SNAPSHOT_CANONICAL_RECEIPT = 'sha256:cc2c22e356cef0160ed5da1e2fd756bad5801f574c4cb064dec157b9207b9739'

test('deterministic Phase-0 atlas has exact counts, planes and no active effects', () => {
  const snapshot = buildSnapshot()
  assert.deepEqual(snapshot.counts, expectedCounts)
  assert.deepEqual(snapshot.planes.map((plane) => plane.id), [
    'plane:delivery',
    'plane:jurisdiction',
    'plane:law',
    'plane:mandate',
    'plane:money',
    'plane:remedy',
  ])
  assert.equal(Object.values(snapshot.boundaries).every((value) => value === false), true)
  for (const key of [
    'governmentAffiliation', 'legalAdvice', 'taxAdvice', 'accuracyGuaranteed', 'eligibilityDetermination',
    'liabilityCalculation', 'accountAccess', 'credentialCollection', 'personalDataCollection', 'filingCapability',
    'paymentCapability', 'transactionExecution', 'automatedDecision', 'liveAuthorityGuarantee', 'runtimeNetwork',
  ]) assert.equal(snapshot.boundaries[key], false, key)
  assert.deepEqual(snapshotIssues(snapshot), [])
})

test('official sources are explicit assisted URL-only links, not body receipts or blanket licensed copies', () => {
  const snapshot = buildSnapshot()
  for (const source of snapshot.sources) {
    assert.equal(source.integrity.reviewMode, 'maintainer-authorized-assisted-url-review')
    assert.equal(source.integrity.exactTextHumanReviewed, false)
    assert.equal(source.integrity.rawBodyRetained, false)
    assert.equal(source.integrity.rawSha256, null)
    assert.equal(source.integrity.rawHashVerified, false)
    assert.equal(source.integrity.contentReceipt, null)
    assert.equal(source.integrity.byteVerified, false)
    assert.equal(source.rights.publicationMode, 'link-only')
    assert.equal(source.rights.officialSourceBodyRepublished, false)
    assert.equal(source.rights.reuseLicenceInferred, false)
    assert.equal(source.rights.licence, null)
    assert.equal(source.checkedOn, snapshot.asOf)
  }
  assert.equal(snapshot.authorship.origin, 'maintainer-authorized-assisted-publication')
  assert.equal(snapshot.authorship.humanDirectionRecorded, true)
  assert.equal(snapshot.authorship.exactTextHumanReviewed, false)
})

test('every government claim cites only the official source ledger and preserves a limitation', () => {
  const snapshot = buildSnapshot()
  const sourceIds = new Set(snapshot.sources.map((source) => source.id))
  const bridgeIds = new Set(snapshot.externalBridges.map((bridge) => bridge.id))
  for (const claim of snapshot.claims) {
    assert.equal(claim.sourceIds.length > 0, true)
    assert.equal(claim.sourceIds.every((id) => sourceIds.has(id)), true, claim.id)
    assert.equal(claim.sourceIds.every((id) => !bridgeIds.has(id) && !id.startsWith('taxsorted:')), true, claim.id)
    assert.equal(claim.limitation.length > 0, true)
  }
})

test('flows are finite and authority, service, payment and remedy rails stay distinct', () => {
  const snapshot = buildSnapshot()
  assert.equal(snapshot.flows.length, 10)
  for (const flow of snapshot.flows) {
    assert.deepEqual(flow.steps.map((step) => step.order), Array.from({ length: flow.steps.length }, (_, index) => index + 1))
    assert.equal(flow.steps.length <= 12, true)
  }
  for (const rail of snapshot.rails.filter((record) => ['service', 'data'].includes(record.railType))) {
    assert.equal(rail.authorityBoundary, 'does-not-confer-authority')
  }
  assert.equal(snapshot.rails.find((rail) => rail.id === 'rail:money-payments').authorityBoundary, 'does-not-create-tax-or-spending-authority')
})

test('redress routes are typed start doors with no ladder, eligibility, deadline or advice effect', () => {
  const snapshot = buildSnapshot()
  assert.equal(snapshot.redressRoutes.length, 10)
  assert.deepEqual(new Set(snapshot.redressRoutes.map((route) => route.routeType)), new Set([
    'information-rights', 'judicial-review', 'ombudsman', 'service-complaint', 'statutory-review', 'tribunal-appeal',
  ]))
  for (const route of snapshot.redressRoutes) {
    assert.equal(route.automaticEscalation, false)
    assert.equal(route.deadlineCalculated, false)
    assert.equal(route.eligibilityDetermined, false)
    assert.equal(route.legalAdvice, false)
    assert.match(route.deadlineRule, /varies|strict/u)
  }
  assert.equal(snapshot.unknowns.some((record) => record.id === 'unknown:tax-onward-appeal'), true)
})

test('publication routes use a dated canonical and an explicitly mutable alias', () => {
  const snapshot = buildSnapshot()
  assert.equal(snapshot.urls.canonical, 'https://thekingdom.dev/government/uk-government-engine-2026-08-21.json')
  assert.equal(snapshot.urls.mutableAlias, 'https://thekingdom.dev/government.json')
  assert.equal(Object.hasOwn(snapshot.urls, 'current'), false)
  assert.equal(snapshot.relatedResources.find((record) => record.id === 'resource:taxsorted-uk-system').url, 'https://taxsorted.io')
  assert.deepEqual(snapshot.relatedResources.find((record) => record.id === 'resource:world-commons').linkedRecordIds, [
    'companies-house', 'uk-ons', 'uk-small-business-desk', 'uk-trade-tariff',
  ])
})

test('assembly is deterministic under input/reference reordering and uses no locale-dependent sort', () => {
  const captures = loadCaptureBundle()
  const reviewed = loadInputs()
  const reordered = loadInputs()
  reordered.sources.reverse()
  reordered.claims.reverse()
  reordered.bridges.reverse()
  for (const collection of Object.values(reordered.map)) collection.reverse()

  const reverseReferences = (value, key = '') => {
    if (Array.isArray(value)) {
      if (key.endsWith('Ids') || key === 'sourceIds' || key === 'selectedRecordBindings' || key === 'steps') value.reverse()
      value.forEach((child) => reverseReferences(child, key))
      return
    }
    if (value === null || typeof value !== 'object') return
    for (const [childKey, child] of Object.entries(value)) reverseReferences(child, childKey)
  }
  reverseReferences(reordered)

  const expected = assembleSnapshot(reviewed, captures)
  const actual = assembleSnapshot(reordered, captures)
  assert.equal(canonicalJson(actual), canonicalJson(expected))
  assert.equal(sha256Json(actual), sha256Json(expected))
  assert.throws(() => buildSnapshot(reordered, captures), /reviewed canonical receipt/u)

  const producer = readFileSync(new URL('../src/government.mjs', import.meta.url), 'utf8')
  assert.doesNotMatch(producer, /localeCompare/u)
})

test('checked-in public snapshot is exact canonical build bytes', () => {
  const snapshot = buildSnapshot()
  const bytes = readFileSync(PUBLIC_SNAPSHOT)
  assert.equal(bytes.toString('utf8'), prettyCanonicalJson(snapshot))
  assert.equal(sha256Bytes(bytes), SNAPSHOT_BYTE_RECEIPT)
  assert.equal(sha256Json(snapshot), SNAPSHOT_CANONICAL_RECEIPT)
  assert.equal(validateCheckedInSnapshot().current, true)
  assert.equal(canonicalJson(readJson(PUBLIC_SNAPSHOT)), canonicalJson(snapshot))
})
