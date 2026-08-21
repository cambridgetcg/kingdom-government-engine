import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { PUBLIC_SNAPSHOT, canonicalJson, sha256Json } from '../src/io.mjs'
import {
  assembleSnapshot,
  buildSnapshot,
  loadCaptureBundle,
  loadInputs,
  snapshotIssues,
  writeSnapshot,
} from '../src/government.mjs'

test('exact input receipts reject config, source, claim, map and bridge mutations', () => {
  const captures = loadCaptureBundle()
  const mutations = [
    (inputs) => { inputs.config.asOf = '2026-08-22' },
    (inputs) => { inputs.sources[0].checkedOn = '2026-08-20' },
    (inputs) => { inputs.claims[0].text += ' drift' },
    (inputs) => { inputs.map.relations[0].relationType += '-drift' },
    (inputs) => { inputs.bridges[0].selectedRecordBindings[0].recordId += '-drift' },
  ]
  for (const mutate of mutations) {
    const inputs = loadInputs()
    mutate(inputs)
    assert.throws(() => buildSnapshot(inputs, captures), /reviewed canonical receipt/u)
  }
})

test('root and nested prototype-shaped members remain inert, alter receipts and fail closed', () => {
  const captures = loadCaptureBundle()
  const baselineReceipt = sha256Json(assembleSnapshot(loadInputs(), captures))
  const receipts = [baselineReceipt]
  for (const member of ['__proto__', 'constructor', 'prototype']) {
    const inputs = loadInputs()
    Object.defineProperty(inputs.sources[0], member, { value: { injected: member }, enumerable: true, configurable: true })
    Object.defineProperty(inputs.bridges[0].selectedRecordBindings[0], member, { value: `nested-${member}`, enumerable: true, configurable: true })
    const assembled = assembleSnapshot(inputs, captures)
    const source = assembled.sources.find((record) => record.id === inputs.sources[0].id)
    const bridge = assembled.externalBridges.find((record) => record.id === inputs.bridges[0].id)
    const binding = bridge.selectedRecordBindings.find((record) => record.recordId === inputs.bridges[0].selectedRecordBindings[0].recordId)
    assert.equal(Object.hasOwn(source, member), true)
    assert.equal(Object.hasOwn(binding, member), true)
    assert.match(canonicalJson(assembled), new RegExp(`"${member}"`, 'u'))
    const mutatedReceipt = sha256Json(assembled)
    assert.notEqual(mutatedReceipt, baselineReceipt)
    receipts.push(mutatedReceipt)
    assert.throws(() => buildSnapshot(inputs, captures), /reviewed canonical receipt|additional property is forbidden/u)
    assert.equal(Object.prototype.injected, undefined)
  }
  assert.equal(new Set(receipts).size, 4)
})

test('reference, source-integrity, crosswalk and negative-effect mutations fail semantic checks', () => {
  const inputs = loadInputs()
  const captures = loadCaptureBundle()
  const mutations = [
    [(snapshot) => { snapshot.relations[0].toId = 'body:absent' }, /absent local ID/u],
    [(snapshot) => { snapshot.planes[0].claimIds[0] = 'claim:absent' }, /absent claim/u],
    [(snapshot) => { snapshot.claims[0].sourceIds = ['bridge:taxsorted-tax-system'] }, /absent source/u],
    [(snapshot) => { snapshot.unknowns[0].sourceIds[0] = 'source:absent' }, /absent source/u],
    [(snapshot) => { snapshot.sources[0].integrity.rawBodyRetained = true }, /non-archival|declared constant/u],
    [(snapshot) => { snapshot.boundaries.automatedDecision = true }, /must remain false|declared constant/u],
    [(snapshot) => { snapshot.externalBridges[0].selectedRecordBindings[0].recordId = 'missing-record' }, /selected record|finite crosswalk/u],
    [(snapshot) => { snapshot.externalBridges[0].boundaries.governmentEvidenceSource = true }, /receipt\/crosswalk|declared constant/u],
  ]
  for (const [mutate, pattern] of mutations) {
    const snapshot = buildSnapshot(inputs, captures)
    mutate(snapshot)
    assert.match(snapshotIssues(snapshot, inputs, captures).join('\n'), pattern)
  }
})

test('added, removed, duplicate and reordered records or references fail closed', () => {
  const inputs = loadInputs()
  const captures = loadCaptureBundle()
  const mutations = [
    [(snapshot) => { snapshot.bodies.push({ ...structuredClone(snapshot.bodies.at(-1)), id: 'body:unreviewed-extra' }) }, /counts|projection|too many/u],
    [(snapshot) => { snapshot.claims.pop() }, /counts|projection|too few/u],
    [(snapshot) => { snapshot.bodies.push(structuredClone(snapshot.bodies[0])) }, /repeats ID|counts|unique/u],
    [(snapshot) => { snapshot.relations[0].id = snapshot.bodies[0].id }, /appears in both/u],
    [(snapshot) => { snapshot.sources.reverse() }, /ordered by ASCII ID|projection/u],
    [(snapshot) => { snapshot.claims.find((claim) => claim.sourceIds.length > 1).sourceIds.reverse() }, /ordered by ASCII ID|projection/u],
    [(snapshot) => { snapshot.externalBridges[0].selectedRecordBindings.reverse() }, /ordered by ASCII collection|projection/u],
    [(snapshot) => { snapshot.flows[0].steps.reverse() }, /finite and contiguous|projection/u],
  ]
  for (const [mutate, pattern] of mutations) {
    const snapshot = buildSnapshot(inputs, captures)
    mutate(snapshot)
    assert.match(snapshotIssues(snapshot, inputs, captures).join('\n'), pattern)
  }
})

test('dates, counts, authorship, status and inactive-effect gates cannot drift', () => {
  const inputs = loadInputs()
  const captures = loadCaptureBundle()
  const mutations = [
    [(snapshot) => { snapshot.counts.sources = 65 }, /counts|declared constant/u],
    [(snapshot) => { snapshot.asOf = '2026-08-22' }, /asOf|declared constant/u],
    [(snapshot) => { snapshot.freshness.nextReviewDue = '2026-09-22' }, /next review|declared constant/u],
    [(snapshot) => { snapshot.authorship.exactTextHumanReviewed = true }, /authorship|declared constant/u],
    [(snapshot) => { snapshot.authorship.origin = 'human-reviewed' }, /authorship|declared constant/u],
    [(snapshot) => { snapshot.boundaries.automaticAction = true }, /must remain false|declared constant/u],
    [(snapshot) => { snapshot.redressRoutes[0].automaticEscalation = true }, /automaticEscalation|declared constant/u],
    [(snapshot) => { snapshot.externalBridges[0].provenance.publicationStatus = 'closed' }, /projection|declared constant/u],
    [(snapshot) => { snapshot.externalBridges[0].boundaries.fullProviderSchemaValidationPerformed = true }, /receipt\/crosswalk|declared constant/u],
  ]
  for (const [mutate, pattern] of mutations) {
    const snapshot = buildSnapshot(inputs, captures)
    mutate(snapshot)
    assert.match(snapshotIssues(snapshot, inputs, captures).join('\n'), pattern)
  }
})

test('TaxSorted public projection rejects text, claim IDs and receipt or freshness drift', () => {
  const inputs = loadInputs()
  const captures = loadCaptureBundle()
  const mutations = [
    [(bridge) => { bridge.recordText = 'provider text must not be projected' }, /projection|additional property/u],
    [(bridge) => { bridge.claimIds = ['claim:law-primary-authority'] }, /cannot import|additional property/u],
    [(bridge) => { bridge.selectedRecordBindings[0].recordText = 'provider text' }, /cannot import|additional property/u],
    [(bridge) => { bridge.captureManifestCanonicalReceipt = `sha256:${'0'.repeat(64)}` }, /projection|declared constant/u],
    [(bridge) => { bridge.graphManifestDatasetHash = `sha256:${'0'.repeat(64)}` }, /projection/u],
    [(bridge) => { bridge.releaseLedgerReceipt.sha256 = `sha256:${'0'.repeat(64)}` }, /projection/u],
    [(bridge) => { bridge.captureReceipts.graph.sha256 = `sha256:${'0'.repeat(64)}` }, /projection/u],
    [(bridge) => { bridge.provenance.releaseCheckpointId += '-drift' }, /projection/u],
    [(bridge) => { bridge.provenance.version = bridge.provenance.version.endsWith('.1') ? '2026-07-10.2' : '2026-07-10.1' }, /projection/u],
    [(bridge) => { bridge.sourceFreshnessAtCapture.pastReviewAfterCount = 9 }, /source-freshness|declared constant/u],
    [(bridge) => { bridge.sourceFreshnessAtCapture.totalSourceRecords += 1 }, /source-freshness|projection/u],
  ]
  for (const [mutate, pattern] of mutations) {
    const snapshot = buildSnapshot(inputs, captures)
    mutate(snapshot.externalBridges[0])
    assert.match(snapshotIssues(snapshot, inputs, captures).join('\n'), pattern)
  }
})

test('URL policy rejects scheme, credentials, port, query, fragment and hostname lookalikes on every URL class', () => {
  const inputs = loadInputs()
  const captures = loadCaptureBundle()
  const targets = [
    [(snapshot, url) => { snapshot.sources[0].url = url }, [
      'http://www.gov.uk/path', 'ftp://www.gov.uk/path', 'https://user:pass@www.gov.uk/path',
      'https://www.gov.uk:444/path', 'https://www.gov.uk/path?query=1', 'https://www.gov.uk/path#fragment',
      'https://www.gov.uk.evil.example/path',
    ]],
    [(snapshot, url) => { snapshot.externalBridges[0].provenance.baseUrl = url }, [
      'http://api.taxsorted.io/path', 'https://user@api.taxsorted.io/path', 'https://api.taxsorted.io:444/path',
      'https://api.taxsorted.io/path?query=1', 'https://api.taxsorted.io.evil.example/path',
    ]],
    [(snapshot, url) => { snapshot.externalBridges[0].captureReceipts.graph.url = url }, [
      'ftp://api.taxsorted.io/path', 'https://user@api.taxsorted.io/path', 'https://api.taxsorted.io:444/path',
      'https://api.taxsorted.io/path#fragment', 'https://evil.example/path',
    ]],
    [(snapshot, url) => { snapshot.relatedResources[0].url = url }, [
      'http://taxsorted.io', 'https://user@taxsorted.io', 'https://taxsorted.io:444/',
      'https://taxsorted.io/?query=1', 'https://taxsorted.io.evil.example/',
    ]],
    [(snapshot, url) => { snapshot.redressRoutes[0].startUrl = url }, [
      'http://www.gov.uk/path', 'https://user@www.gov.uk/path', 'https://www.gov.uk:444/path',
      'https://www.gov.uk/path?query=1', 'https://evil.example/path',
    ]],
  ]
  for (const [mutate, urls] of targets) {
    for (const url of urls) {
      const snapshot = buildSnapshot(inputs, captures)
      mutate(snapshot, url)
      assert.match(snapshotIssues(snapshot, inputs, captures).join('\n'), /URL violates|startUrl|projection|does not match pattern/u)
    }
  }
})

test('invalid build fails before the fixed public output is touched', () => {
  const before = readFileSync(PUBLIC_SNAPSHOT)
  const inputs = loadInputs()
  inputs.config.boundaries.automaticAction = true
  assert.throws(() => writeSnapshot(inputs), /validation failed/u)
  assert.deepEqual(readFileSync(PUBLIC_SNAPSHOT), before)
})
