import { existsSync } from 'node:fs'
import { join } from 'node:path'

import {
  PUBLIC_SNAPSHOT,
  ROOT,
  atomicWritePublicSnapshot,
  canonicalJson,
  parseJsonBytes,
  prettyCanonicalJson,
  readBoundedBytes,
  readJson,
  sha256Bytes,
  sha256Json,
} from './io.mjs'
import { loadSchema, schemaDocumentIssues, validateWithSchema } from './schema-validator.mjs'

const INPUT_RECEIPTS = Object.freeze({
  config: 'sha256:df28ea6e660ccca354491679076b35990f84cf2a30a7fcd4d0bb1f42f4fb3cae',
  sources: 'sha256:b5a343aa733b52aa5a9c9f6b66b932a870bf14f2ebe41afd2142f13b3bed37f3',
  claims: 'sha256:a0e4fe92d93160d7567dc28604d9d8d3570d68e8c0e52fb6eb1db632d4b5e014',
  map: 'sha256:d0bdb744a2ac127ccedacccfa7b90393ca7ff8df562dcdc0e5878c07e8cf47a8',
  bridges: 'sha256:686367f97fd85eeb389657e4da108553c2b14e8f388955611c29c573c880cb52',
})

const CAPTURE_MANIFEST_RECEIPT = 'sha256:1b63c52a9e081b888985a3c600af902a3307667ba0868c00a7de678fa6445d53'
const SCHEMA_PATH = join(ROOT, 'schemas', 'v0.1', 'public-snapshot.schema.json')
const SCHEMA_BYTE_RECEIPT = 'sha256:2f646d15e4a1d7b96e9bcefdfe90b9e9d170a860fd2eca83f2120a67ece20c50'
const SCHEMA_CANONICAL_RECEIPT = 'sha256:e7748b8341f28610cf569ebe57d376f7c045a58531b294ad3fd580ff21ed4e11'

const EXPECTED_CAPTURES = Object.freeze({
  'vendor/captures/taxsorted/open-data-releases.json': 'sha256:b2378e2052e8aeae169f2ce3827fdc45b45cbc7719ad0a348a38efff1ac704f9',
  'vendor/captures/taxsorted/uk-public-funding/dictionary.json': 'sha256:e125ea0231a694bcbea9d7d817f74206ca32f95a90a62811843e1d04c38dc9ce',
  'vendor/captures/taxsorted/uk-public-funding/graph.json': 'sha256:8100d03e8d1d095ea2d3eea1cd237424d3b0bf11e13901018fdd52f55ec0d801',
  'vendor/captures/taxsorted/uk-public-funding/manifest.json': 'sha256:845f99da64fd9217a982f713db5a6dca863949fbcce11515e563453106fa579d',
  'vendor/captures/taxsorted/uk-public-funding/schema.json': 'sha256:5e6b15e720f4f65b9439f5c5688fced7c9c8c7f12ead9d9b23efb6503017bf54',
  'vendor/captures/taxsorted/uk-tax-system/dictionary.json': 'sha256:4abfd3174aee765590c718f72ac367e9783a92dfea1e992075464372f2e227d2',
  'vendor/captures/taxsorted/uk-tax-system/graph.json': 'sha256:400bbe40cad2cfad3a755cb248263822e53d633c22ceb42f2f7d4b84ecd0cb99',
  'vendor/captures/taxsorted/uk-tax-system/manifest.json': 'sha256:d94d25936dcceaeb7fca98d271db37a9b64dc0105621a64b940331456edf1ad1',
  'vendor/captures/taxsorted/uk-tax-system/schema.json': 'sha256:5fd46932c26c217335510ba308d0603e600acbf6952ecfbc07e4fddb4c9ace3f',
})

const EXPECTED_COUNTS = Object.freeze({
  planes: 6,
  sources: 66,
  claims: 58,
  bodies: 39,
  relations: 34,
  flows: 10,
  rails: 11,
  redressRoutes: 10,
  unknowns: 10,
  externalBridges: 2,
  relatedResources: 2,
})

const COLLECTIONS = Object.freeze([
  'planes',
  'sources',
  'claims',
  'bodies',
  'relations',
  'flows',
  'rails',
  'redressRoutes',
  'unknowns',
  'externalBridges',
  'relatedResources',
])

const MAP_KEYS = Object.freeze(['planes', 'bodies', 'relations', 'flows', 'rails', 'redressRoutes', 'unknowns', 'relatedResources'])

const SOURCE_INTEGRITY = Object.freeze({
  reviewMode: 'maintainer-authorized-assisted-url-review',
  exactTextHumanReviewed: false,
  rawBodyRetained: false,
  rawSha256: null,
  rawHashVerified: false,
  contentReceipt: null,
  byteVerified: false,
  immutableSnapshot: false,
})

const SOURCE_RIGHTS = Object.freeze({
  publicationMode: 'link-only',
  officialSourceBodyRepublished: false,
  reuseLicenceInferred: false,
  licence: null,
})

const SOURCE_DOES_NOT_PROVE = Object.freeze([
  'complete legal update',
  'continued availability',
  'current legal effect',
  'official endorsement',
])

const BRIDGE_BOUNDARIES = Object.freeze({
  captureReceiptAuthenticatesPublisher: false,
  captureReceiptGuaranteesAvailability: false,
  captureReceiptProvesTruth: false,
  captureReceiptSigned: false,
  endorsement: false,
  fullProviderSchemaValidationPerformed: false,
  governmentEvidenceSource: false,
  official: false,
  runtimeDataTransfer: false,
  taxsortedContentUsedAsGovernmentEvidence: false,
  taxsortedRecordTextProjectedIntoGovernmentSnapshot: false,
  upstreamSourceBodyBytesRetained: false,
})

const EXPECTED_SELECTED_BINDINGS = Object.freeze({
  'taxsorted:uk-public-funding': [
    'funds:fund-devolved-block-grants',
    'funds:fund-uk-consolidated-fund',
    'fundingMechanisms:mechanism-devolved-block-grants',
    'fundingMechanisms:mechanism-parliamentary-supply',
    'pipelineStages:pipeline-accountability-accounts',
    'pipelineStages:pipeline-accountability-audit',
    'pipelineStages:pipeline-accountability-parliament',
    'pipelineStages:pipeline-central-pool',
    'pipelineStages:pipeline-central-revenue',
    'pipelineStages:pipeline-central-supply',
    'transparencyGaps:gap-current-year-outturn-lag',
    'transparencyGaps:gap-four-nation-comparability',
    'transparencyGaps:gap-pooled-pound-traceability',
  ],
  'taxsorted:uk-tax-system': [
    'frameworks:framework-authority-chain',
    'frameworks:framework-challenge-separation',
    'frameworks:framework-plural-uk',
    'pipelineStages:stage-law-and-policy',
    'pipelineStages:stage-payment-and-reconciliation',
    'pipelineStages:stage-review-and-appeal',
    'pipelineStages:stage-service-complaint',
  ],
})

const OFFICIAL_SOURCE_HOSTS = new Set([
  'assets.publishing.service.gov.uk',
  'committees.parliament.uk',
  'ico.org.uk',
  'obr.uk',
  'uksa.statisticsauthority.gov.uk',
  'www.api.gov.uk',
  'www.bankofengland.co.uk',
  'www.data.gov.uk',
  'www.forms.service.gov.uk',
  'www.gov.scot',
  'www.gov.uk',
  'www.gov.wales',
  'www.judiciary.uk',
  'www.justice.gov.uk',
  'www.legislation.gov.uk',
  'www.lgo.org.uk',
  'www.nao.org.uk',
  'www.nationalarchives.gov.uk',
  'www.nidirect.gov.uk',
  'www.nipso.org.uk',
  'www.notifications.service.gov.uk',
  'www.ombudsman.org.uk',
  'www.ombudsman.wales',
  'www.ons.gov.uk',
  'www.parliament.uk',
  'www.payments.service.gov.uk',
  'www.psr.org.uk',
  'www.sign-in.service.gov.uk',
  'www.spso.org.uk',
  'www.supremecourt.uk',
])

const GRAPH_COUNT_KEYS = Object.freeze({
  'taxsorted:uk-public-funding': Object.freeze({
    allocations: 'allocations',
    contacts: 'contacts',
    funds: 'funds',
    gaps: 'transparencyGaps',
    governance: 'governanceUnits',
    institutions: 'institutions',
    locations: 'officeLocations',
    mechanisms: 'fundingMechanisms',
    offices: 'offices',
    pipeline: 'pipelineStages',
    programmes: 'programmes',
    relationships: 'relationships',
    sources: 'sources',
  }),
  'taxsorted:uk-tax-system': Object.freeze({
    accounts: 'accountTypes',
    actors: 'actors',
    cases: 'cases',
    frameworks: 'frameworks',
    gaps: 'transparencyGaps',
    permissions: 'permissions',
    pipeline: 'pipelineStages',
    relationships: 'relationships',
    rules: 'rules',
    sources: 'sources',
    systems: 'systems',
  }),
})

function issue(message) {
  return `semantic: ${message}`
}

function exactKeys(value, keys) {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort())
}

function compareAscii(left, right) {
  return left < right ? -1 : left > right ? 1 : 0
}

function sortedRecords(records) {
  return [...records].sort((left, right) => compareAscii(left.id, right.id))
}

function sortedStrings(values) {
  return [...values].sort(compareAscii)
}

function normalizeReferences(value) {
  if (Array.isArray(value)) return value.map((child) => normalizeReferences(child))
  if (value === null || typeof value !== 'object') return value
  const result = Object.create(null)
  for (const [key, child] of Object.entries(value)) {
    if (Array.isArray(child) && (key.endsWith('Ids') || key === 'sourceIds')) {
      result[key] = sortedStrings(child)
    } else if (key === 'steps' && Array.isArray(child)) {
      result[key] = [...child].sort((left, right) => left.order - right.order).map((entry) => normalizeReferences(entry))
    } else if (key === 'selectedRecordBindings' && Array.isArray(child)) {
      result[key] = [...child]
        .sort((left, right) => compareAscii(`${left.collection}:${left.recordId}`, `${right.collection}:${right.recordId}`))
        .map((entry) => normalizeReferences(entry))
    } else {
      result[key] = normalizeReferences(child)
    }
  }
  return result
}

function validDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value)
  if (match === null) return false
  const instant = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  return instant.toISOString().slice(0, 10) === value
}

function secureHttpsUrl(value, allowedHosts) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:'
      && url.username === ''
      && url.password === ''
      && url.port === ''
      && url.search === ''
      && url.hash === ''
      && allowedHosts.has(url.hostname)
  } catch {
    return false
  }
}

function inputReceiptIssues(inputs) {
  const values = {
    config: inputs.config,
    sources: inputs.sources,
    claims: inputs.claims,
    map: inputs.map,
    bridges: inputs.bridges,
  }
  const issues = []
  for (const [name, expected] of Object.entries(INPUT_RECEIPTS)) {
    if (sha256Json(values[name]) !== expected) issues.push(issue(`${name}.json differs from the reviewed canonical receipt`))
  }
  return issues
}

export function loadInputs() {
  const config = readJson(join(ROOT, 'data', 'config.json'))
  const sources = readJson(join(ROOT, 'data', 'sources.json'))
  const claims = readJson(join(ROOT, 'data', 'claims.json'))
  const map = readJson(join(ROOT, 'data', 'map.json'))
  const bridges = readJson(join(ROOT, 'data', 'bridges.json'))
  if (!Array.isArray(sources) || !Array.isArray(claims) || !Array.isArray(bridges)) throw new TypeError('sources, claims and bridges must be arrays')
  if (!exactKeys(map, MAP_KEYS)) throw new Error('map.json has an unexpected collection inventory')
  for (const key of MAP_KEYS) if (!Array.isArray(map[key])) throw new TypeError(`map.${key} must be an array`)
  return { config, sources, claims, map, bridges }
}

function validateDatasetCapture(dataset, parsedFiles) {
  const graph = parsedFiles.get('graph')
  const releaseManifest = parsedFiles.get('manifest')
  const schema = parsedFiles.get('schema')
  const dictionary = parsedFiles.get('dictionary')
  const graphFile = dataset.files.find((file) => file.kind === 'graph')

  if (releaseManifest.datasetHash !== graphFile.sha256) throw new Error(`${dataset.id}: release manifest graph digest mismatch`)
  if (releaseManifest.schema !== graph.schema || dictionary.corpusSchema !== graph.schema) throw new Error(`${dataset.id}: corpus schema identity mismatch`)
  if (schema.$schema !== 'https://json-schema.org/draft/2020-12/schema') throw new Error(`${dataset.id}: external structural schema draft mismatch`)
  if (schema.$id !== dictionary.structuralSchema) throw new Error(`${dataset.id}: dictionary structural-schema binding mismatch`)
  if (schema.type !== 'object' || schema.additionalProperties !== false) throw new Error(`${dataset.id}: external graph schema root is not closed`)
  if (canonicalJson(sortedStrings(schema.required)) !== canonicalJson(Object.keys(graph).sort())) throw new Error(`${dataset.id}: graph top-level inventory differs from structural schema`)
  if (dictionary.version !== dataset.version || graph.meta?.version !== dataset.version || releaseManifest.version !== dataset.version) {
    throw new Error(`${dataset.id}: version binding mismatch`)
  }
  if (dictionary.reviewedOn !== dataset.reviewedOn || graph.meta?.reviewedOn !== dataset.reviewedOn || releaseManifest.reviewedOn !== dataset.reviewedOn) {
    throw new Error(`${dataset.id}: reviewed-on binding mismatch`)
  }
  if (releaseManifest.notComplete !== true || dataset.notComplete !== true) throw new Error(`${dataset.id}: incomplete-dataset boundary missing`)
  if (canonicalJson(releaseManifest.contentLicence) !== canonicalJson(dataset.curationLicence)
    || canonicalJson(graph.meta?.contentLicence) !== canonicalJson(dataset.curationLicence)) {
    throw new Error(`${dataset.id}: TaxSorted curation-licence declaration mismatch`)
  }
  for (const [countKey, collection] of Object.entries(GRAPH_COUNT_KEYS[dataset.id] ?? {})) {
    if (!Array.isArray(graph[collection]) || releaseManifest.counts?.[countKey] !== graph[collection].length) {
      throw new Error(`${dataset.id}: manifest count mismatch for ${collection}`)
    }
  }
  const ids = []
  for (const value of Object.values(graph)) {
    if (!Array.isArray(value)) continue
    for (const record of value) if (typeof record?.id === 'string') ids.push(record.id)
  }
  if (new Set(ids).size !== ids.length) throw new Error(`${dataset.id}: graph IDs are not dataset-wide unique`)
  if (!graph.sources.every((source) => validDate(source.reviewAfter))) throw new Error(`${dataset.id}: source reviewAfter contains an invalid date`)
  return { dataset, graph, releaseManifest, schema, dictionary }
}

export function loadCaptureBundle() {
  const captureManifest = readJson(join(ROOT, 'vendor', 'capture-manifest.json'))
  if (sha256Json(captureManifest) !== CAPTURE_MANIFEST_RECEIPT) throw new Error('TaxSorted capture manifest differs from the reviewed canonical receipt')
  const declared = Object.fromEntries([
    [captureManifest.releaseLedger.path, captureManifest.releaseLedger.sha256],
    ...captureManifest.datasets.flatMap((dataset) => dataset.files.map((file) => [file.path, file.sha256])),
  ])
  if (canonicalJson(declared) !== canonicalJson(EXPECTED_CAPTURES)) throw new Error('TaxSorted capture file inventory or digest differs from exact reviewed constants')
  if (canonicalJson(captureManifest.boundaries) !== canonicalJson(BRIDGE_BOUNDARIES)) throw new Error('TaxSorted capture boundary contract differs from reviewed constants')
  if (captureManifest.capturedOn !== '2026-08-21' || !validDate(captureManifest.capturedOn)) throw new Error('TaxSorted capture date mismatch')

  const releaseLedgerBytes = readBoundedBytes(join(ROOT, captureManifest.releaseLedger.path))
  if (releaseLedgerBytes.byteLength !== captureManifest.releaseLedger.bytes
    || sha256Bytes(releaseLedgerBytes) !== captureManifest.releaseLedger.sha256) {
    throw new Error('TaxSorted release ledger byte binding mismatch')
  }
  const releaseLedger = parseJsonBytes(releaseLedgerBytes, captureManifest.releaseLedger.path)
  if (releaseLedger.schema !== 'taxsorted.open-data-release-ledger/1') throw new Error('TaxSorted release ledger schema mismatch')

  const datasets = new Map()
  for (const dataset of captureManifest.datasets) {
    const parsedFiles = new Map()
    for (const file of dataset.files) {
      const bytes = readBoundedBytes(join(ROOT, file.path))
      if (bytes.byteLength !== file.bytes) throw new Error(`${file.path}: byte length differs from capture manifest`)
      if (sha256Bytes(bytes) !== file.sha256) throw new Error(`${file.path}: exact byte digest differs from capture manifest`)
      parsedFiles.set(file.kind, parseJsonBytes(bytes, file.path))
    }
    if (canonicalJson([...parsedFiles.keys()].sort()) !== canonicalJson(['dictionary', 'graph', 'manifest', 'schema'])) {
      throw new Error(`${dataset.id}: capture must include exactly graph, manifest, schema and dictionary`)
    }
    const externalDatasetId = dataset.id.slice('taxsorted:'.length)
    const checkpoint = releaseLedger.checkpoints?.filter((entry) => entry.id === dataset.checkpointId)
    const publication = releaseLedger.currentPublication?.filter((entry) => entry.datasetId === externalDatasetId)
    const graphDigest = dataset.files.find((file) => file.kind === 'graph')?.sha256
    if (checkpoint?.length !== 1 || publication?.length !== 1
      || checkpoint[0].datasetId !== externalDatasetId
      || checkpoint[0].digest !== graphDigest
      || checkpoint[0].version !== dataset.version
      || checkpoint[0].evidenceReviewedOn !== dataset.reviewedOn
      || checkpoint[0].publicationStatusAtCheckpoint !== dataset.publicationStatus
      || checkpoint[0].links?.immutableSnapshot !== dataset.immutableSnapshot
      || publication[0].currentVersion !== dataset.version
      || publication[0].latestDeclaredCheckpointId !== dataset.checkpointId
      || publication[0].publicationStatus !== dataset.publicationStatus) {
      throw new Error(`${dataset.id}: retained release-ledger binding mismatch`)
    }
    if (dataset.publicationStatusSource !== 'retained-release-ledger'
      || dataset.immutableSnapshot !== null || dataset.publicationStatus !== 'open' || dataset.upstreamSourceBodiesRepublished !== false
      || dataset.upstreamSourceRightsNotGrantedByThisCapture !== true || dataset.rightsDeclarationIndependentlyVerified !== false) {
      throw new Error(`${dataset.id}: upstream mutability, publication or rights boundary mismatch`)
    }
    datasets.set(dataset.id, { ...validateDatasetCapture(dataset, parsedFiles), checkpoint: checkpoint[0], publication: publication[0] })
  }
  if (canonicalJson([...datasets.keys()].sort()) !== canonicalJson(['taxsorted:uk-public-funding', 'taxsorted:uk-tax-system'])) {
    throw new Error('TaxSorted capture dataset inventory mismatch')
  }
  return { captureManifest, releaseLedger, datasets }
}

function publicSource(source) {
  return normalizeReferences({
    ...source,
    integrity: SOURCE_INTEGRITY,
    rights: SOURCE_RIGHTS,
    doesNotProve: SOURCE_DOES_NOT_PROVE,
  })
}

function receiptObject(dataset, kind) {
  const file = dataset.files.find((entry) => entry.kind === kind)
  return { path: file.path, url: file.url, bytes: file.bytes, sha256: file.sha256 }
}

function publicBridge(bridge, captureBundle) {
  const captured = captureBundle.datasets.get(bridge.datasetId)
  if (captured === undefined) throw new Error(`${bridge.id}: unknown captured dataset ${bridge.datasetId}`)
  const { dataset, releaseManifest, checkpoint } = captured
  const pastReviewAfterCount = captured.graph.sources.filter((source) => source.reviewAfter < captureBundle.captureManifest.capturedOn).length
  return normalizeReferences({
    id: bridge.id,
    datasetId: bridge.datasetId,
    resourceId: bridge.resourceId,
    bridgeMode: 'receipt-bound-crosswalk-only',
    boundaryScope: captureBundle.captureManifest.boundaryScope,
    captureManifestCanonicalReceipt: CAPTURE_MANIFEST_RECEIPT,
    graphManifestDatasetHash: releaseManifest.datasetHash,
    releaseLedgerReceipt: {
      path: captureBundle.captureManifest.releaseLedger.path,
      url: captureBundle.captureManifest.releaseLedger.url,
      bytes: captureBundle.captureManifest.releaseLedger.bytes,
      sha256: captureBundle.captureManifest.releaseLedger.sha256,
    },
    captureReceipts: {
      dictionary: receiptObject(dataset, 'dictionary'),
      graph: receiptObject(dataset, 'graph'),
      manifest: receiptObject(dataset, 'manifest'),
      schema: receiptObject(dataset, 'schema'),
    },
    provenance: {
      acquiredOn: captureBundle.captureManifest.capturedOn,
      baseUrl: dataset.baseUrl,
      releaseCheckpointId: dataset.checkpointId,
      checkpointObservedPublicOn: checkpoint.observedPublicOn,
      immutableSnapshot: dataset.immutableSnapshot,
      notComplete: dataset.notComplete,
      publicationStatus: dataset.publicationStatus,
      upstreamReviewAlarm: true,
      upstreamReviewedOn: dataset.reviewedOn,
      version: dataset.version,
    },
    sourceFreshnessAtCapture: {
      evaluatedOn: captureBundle.captureManifest.capturedOn,
      totalSourceRecords: captured.graph.sources.length,
      pastReviewAfterCount,
      meaning: 'Count of TaxSorted source-locator records whose declared reviewAfter date was earlier than capture; not a truth, completeness or legal-currentness test.',
      allSourcesCurrentGuaranteed: false,
    },
    rights: {
      capturedMaterial: 'TaxSorted curated graph records and source locators, release manifest, structural schema and dictionary',
      curationLicence: dataset.curationLicence,
      declarationBy: 'TaxSorted',
      declarationIndependentlyVerified: dataset.rightsDeclarationIndependentlyVerified,
      rightsCaveat: dataset.rightsCaveat,
      upstreamSourceBodiesRepublished: dataset.upstreamSourceBodiesRepublished,
      upstreamSourceRightsNotGrantedByThisCapture: dataset.upstreamSourceRightsNotGrantedByThisCapture,
    },
    boundaries: captureBundle.captureManifest.boundaries,
    selectedRecordBindings: bridge.selectedRecordBindings,
  })
}

export function assembleSnapshot(inputs = loadInputs(), captureBundle = loadCaptureBundle()) {
  const externalBridges = inputs.bridges.map((bridge) => publicBridge(bridge, captureBundle))
  const collections = {
    planes: inputs.map.planes,
    sources: inputs.sources.map((source) => publicSource(source)),
    claims: inputs.claims,
    bodies: inputs.map.bodies,
    relations: inputs.map.relations,
    flows: inputs.map.flows,
    rails: inputs.map.rails,
    redressRoutes: inputs.map.redressRoutes,
    unknowns: inputs.map.unknowns,
    externalBridges,
    relatedResources: inputs.map.relatedResources,
  }
  const arrays = {}
  const counts = {}
  for (const name of COLLECTIONS) {
    arrays[name] = sortedRecords(collections[name]).map((record) => normalizeReferences(record))
    counts[name] = arrays[name].length
  }
  return {
    schema: 'kingdom.government-engine-public-snapshot/0.1',
    contractVersion: inputs.config.contractVersion,
    title: inputs.config.title,
    asOf: inputs.config.asOf,
    jurisdiction: inputs.config.jurisdiction,
    urls: normalizeReferences(inputs.config.urls),
    authorship: normalizeReferences(inputs.config.authorship),
    freshness: normalizeReferences(inputs.config.freshness),
    sourceLedgerPolicy: {
      reviewMode: SOURCE_INTEGRITY.reviewMode,
      checkedOnMeaning: 'Assisted URL observation date only; not exact-text human review, a content receipt, a legal-status guarantee or a freshness guarantee.',
      integrity: SOURCE_INTEGRITY,
      rights: SOURCE_RIGHTS,
      doesNotProve: SOURCE_DOES_NOT_PROVE,
    },
    interpretationRules: normalizeReferences(inputs.config.interpretationRules),
    boundaries: normalizeReferences(inputs.config.boundaries),
    buildProvenance: {
      inputCanonicalReceipts: INPUT_RECEIPTS,
      schemaByteReceipt: SCHEMA_BYTE_RECEIPT,
      schemaCanonicalReceipt: SCHEMA_CANONICAL_RECEIPT,
      taxsortedCaptureManifestCanonicalReceipt: CAPTURE_MANIFEST_RECEIPT,
      networkUsed: false,
    },
    counts,
    ...arrays,
  }
}

function uniqueIdIssues(snapshot) {
  const issues = []
  const global = new Map()
  for (const collection of COLLECTIONS) {
    const local = new Set()
    for (const record of snapshot[collection] ?? []) {
      if (typeof record?.id !== 'string') continue
      if (local.has(record.id)) issues.push(issue(`${collection} repeats ID ${record.id}`))
      local.add(record.id)
      if (global.has(record.id)) issues.push(issue(`${record.id} appears in both ${global.get(record.id)} and ${collection}`))
      global.set(record.id, collection)
    }
  }
  return issues
}

function orderingIssues(snapshot) {
  const issues = []
  for (const collection of COLLECTIONS) {
    const ids = (snapshot[collection] ?? []).map((record) => record?.id)
    if (!ids.every((id) => typeof id === 'string')) {
      issues.push(issue(`${collection} records must carry string IDs before ordering`))
    } else if (canonicalJson(ids) !== canonicalJson(sortedStrings(ids))) {
      issues.push(issue(`${collection} records must be ordered by ASCII ID`))
    }
  }

  const visit = (value, owner, key = '') => {
    if (Array.isArray(value)) {
      if (key.endsWith('Ids') || key === 'sourceIds') {
        if (!value.every((id) => typeof id === 'string')) {
          issues.push(issue(`${owner}.${key} must contain string IDs before ordering`))
        } else if (canonicalJson(value) !== canonicalJson(sortedStrings(value))) {
          issues.push(issue(`${owner}.${key} must be ordered by ASCII ID`))
        }
      }
      value.forEach((child) => visit(child, owner, key))
      return
    }
    if (value === null || typeof value !== 'object') return
    for (const [childKey, child] of Object.entries(value)) visit(child, owner, childKey)
  }
  for (const collection of COLLECTIONS) {
    for (const record of snapshot[collection] ?? []) visit(record, record?.id ?? collection)
  }
  for (const bridge of snapshot.externalBridges ?? []) {
    const keys = bridge.selectedRecordBindings.map((binding) => `${binding.collection}:${binding.recordId}`)
    if (canonicalJson(keys) !== canonicalJson(sortedStrings(keys))) {
      issues.push(issue(`${bridge.id}.selectedRecordBindings must be ordered by ASCII collection and record ID`))
    }
  }
  return issues
}

function projectionIssues(snapshot, inputs, captureBundle) {
  try {
    const expected = assembleSnapshot(inputs, captureBundle)
    return canonicalJson(snapshot) === canonicalJson(expected)
      ? []
      : [issue('snapshot differs from the deterministic projection of receipt-pinned inputs and captures')]
  } catch (error) {
    return [issue(`could not assemble deterministic reviewed projection: ${error.message}`)]
  }
}

function referenceIssues(snapshot, captureBundle, inputs) {
  const issues = []
  const ids = new Set(COLLECTIONS.flatMap((name) => (snapshot[name] ?? []).map((record) => record.id)))
  const sources = new Map(snapshot.sources.map((record) => [record.id, record]))
  const claims = new Map(snapshot.claims.map((record) => [record.id, record]))
  const usedClaims = new Set()
  const usedSources = new Set()

  for (const claim of claims.values()) {
    for (const sourceId of claim.sourceIds) {
      if (!sources.has(sourceId)) issues.push(issue(`${claim.id} cites absent source ${sourceId}`))
      usedSources.add(sourceId)
    }
    if (claim.checkedOn !== snapshot.asOf) issues.push(issue(`${claim.id} checkedOn must equal the dated snapshot asOf`))
    if (claim.claimType === 'editorial-synthesis' && claim.sourceIds.length < 1) issues.push(issue(`${claim.id} editorial synthesis has no official source`))
  }

  const visitReferences = (value, owner, key = '') => {
    if (Array.isArray(value)) {
      value.forEach((child) => visitReferences(child, owner, key))
      return
    }
    if (value === null || typeof value !== 'object') return
    for (const [childKey, child] of Object.entries(value)) {
      if (childKey === 'claimIds') {
        for (const claimId of child) {
          if (!claims.has(claimId)) issues.push(issue(`${owner} references absent claim ${claimId}`))
          usedClaims.add(claimId)
        }
      } else if (childKey === 'sourceIds') {
        for (const sourceId of child) {
          if (!sources.has(sourceId)) issues.push(issue(`${owner} references absent source ${sourceId}`))
          usedSources.add(sourceId)
        }
      } else if (childKey.endsWith('Ids') && childKey !== 'linkedRecordIds') {
        for (const targetId of child) if (!ids.has(targetId)) issues.push(issue(`${owner} references absent local ID ${targetId}`))
      } else if (['fromId', 'toId', 'resourceId'].includes(childKey) && !ids.has(child)) {
        issues.push(issue(`${owner} references absent local ID ${child}`))
      } else {
        visitReferences(child, owner, childKey)
      }
    }
  }

  for (const collection of ['planes', 'bodies', 'relations', 'flows', 'rails', 'redressRoutes', 'unknowns']) {
    for (const record of snapshot[collection]) visitReferences(record, record.id)
  }
  for (const claimId of claims.keys()) if (!usedClaims.has(claimId)) issues.push(issue(`${claimId} is not bound to any map record`))
  for (const sourceId of sources.keys()) if (!usedSources.has(sourceId)) issues.push(issue(`${sourceId} is not bound to any claim or unknown`))

  for (const bridge of snapshot.externalBridges) {
    const captured = captureBundle.datasets.get(bridge.datasetId)
    const selected = []
    for (const binding of bridge.selectedRecordBindings) {
      selected.push(`${binding.collection}:${binding.recordId}`)
      const records = captured?.graph?.[binding.collection]
      if (!Array.isArray(records) || records.filter((record) => record.id === binding.recordId).length !== 1) {
        issues.push(issue(`${bridge.id} selected record ${binding.collection}:${binding.recordId} is absent or ambiguous in exact capture`))
      }
      for (const localId of binding.localIds) if (!ids.has(localId)) issues.push(issue(`${bridge.id} selected binding references absent local ID ${localId}`))
    }
    if (canonicalJson(sortedStrings(selected)) !== canonicalJson(sortedStrings(EXPECTED_SELECTED_BINDINGS[bridge.datasetId]))) {
      issues.push(issue(`${bridge.id} selected TaxSorted record IDs differ from the reviewed finite crosswalk`))
    }
  }
  const expectedBridges = sortedRecords(inputs.bridges.map((bridge) => publicBridge(bridge, captureBundle)))
  if (canonicalJson(snapshot.externalBridges) !== canonicalJson(expectedBridges)) {
    issues.push(issue('external bridge projection differs from exact retained capture and reviewed crosswalk bindings'))
  }
  return issues
}

function contractIssues(snapshot) {
  const issues = []
  if (canonicalJson(snapshot.counts) !== canonicalJson(EXPECTED_COUNTS)) issues.push(issue('counts differ from exact Phase-0 constants'))
  for (const [name, expected] of Object.entries(EXPECTED_COUNTS)) {
    if (!Array.isArray(snapshot[name]) || snapshot[name].length !== expected) issues.push(issue(`${name} must contain exactly ${expected} records`))
  }
  if (!validDate(snapshot.asOf) || snapshot.asOf !== '2026-08-21') issues.push(issue('snapshot asOf must be the reviewed date 2026-08-21'))
  if (!validDate(snapshot.freshness?.nextReviewDue) || snapshot.freshness.nextReviewDue !== '2026-09-21') issues.push(issue('next review must remain 2026-09-21'))
  if (!(Date.parse(snapshot.asOf) < Date.parse(snapshot.freshness.nextReviewDue))) issues.push(issue('next review must follow snapshot date'))
  if (snapshot.authorship?.origin !== 'maintainer-authorized-assisted-publication'
    || snapshot.authorship?.humanDirectionRecorded !== true
    || snapshot.authorship?.exactTextHumanReviewed !== false
    || snapshot.authorship?.compiledBy !== 'codex-assisted-publication') {
    issues.push(issue('authorship must preserve maintainer-authorized assisted-publication truth'))
  }
  for (const [key, value] of Object.entries(snapshot.boundaries ?? {})) {
    if (value !== false) issues.push(issue(`public boundary ${key} must remain false`))
  }
  if (snapshot.buildProvenance?.networkUsed !== false || snapshot.boundaries?.buildNetworkUsed !== false) {
    issues.push(issue('validate/build must remain network-free'))
  }
  if (snapshot.buildProvenance?.schemaByteReceipt !== SCHEMA_BYTE_RECEIPT
    || snapshot.buildProvenance?.schemaCanonicalReceipt !== SCHEMA_CANONICAL_RECEIPT) {
    issues.push(issue('public build provenance must retain exact schema byte and canonical receipts'))
  }
  if (snapshot.urls?.mutableAlias !== 'https://thekingdom.dev/government.json'
    || Object.hasOwn(snapshot.urls ?? {}, 'current')) issues.push(issue('publication URL must use the exact mutableAlias contract'))

  for (const source of snapshot.sources) {
    if (source.checkedOn !== snapshot.asOf || canonicalJson(source.integrity) !== canonicalJson(SOURCE_INTEGRITY)
      || canonicalJson(source.rights) !== canonicalJson(SOURCE_RIGHTS)
      || canonicalJson(source.doesNotProve) !== canonicalJson(SOURCE_DOES_NOT_PROVE)) {
      issues.push(issue(`${source.id} must expose the exact assisted URL-only, non-archival, link-only source contract`))
    }
    if (!secureHttpsUrl(source.url, OFFICIAL_SOURCE_HOSTS)) issues.push(issue(`${source.id} URL violates the exact HTTPS official-source host policy`))
  }
  for (const bridge of snapshot.externalBridges) {
    if (bridge.bridgeMode !== 'receipt-bound-crosswalk-only'
      || bridge.boundaryScope !== 'government-engine-public-projection'
      || canonicalJson(bridge.boundaries) !== canonicalJson(BRIDGE_BOUNDARIES)
      || bridge.provenance?.immutableSnapshot !== null
      || bridge.provenance?.notComplete !== true
      || bridge.provenance?.upstreamReviewAlarm !== true
      || bridge.rights?.declarationIndependentlyVerified !== false
      || bridge.rights?.upstreamSourceBodiesRepublished !== false
      || bridge.rights?.upstreamSourceRightsNotGrantedByThisCapture !== true) {
      issues.push(issue(`${bridge.id} must retain exact non-official receipt/crosswalk, mutability, rights and no-import boundaries`))
    }
    const expectedFreshness = bridge.datasetId === 'taxsorted:uk-tax-system'
      ? { totalSourceRecords: 73, pastReviewAfterCount: 10 }
      : { totalSourceRecords: 52, pastReviewAfterCount: 10 }
    if (bridge.sourceFreshnessAtCapture?.evaluatedOn !== '2026-08-21'
      || bridge.sourceFreshnessAtCapture?.totalSourceRecords !== expectedFreshness.totalSourceRecords
      || bridge.sourceFreshnessAtCapture?.pastReviewAfterCount !== expectedFreshness.pastReviewAfterCount
      || bridge.sourceFreshnessAtCapture?.allSourcesCurrentGuaranteed !== false) {
      issues.push(issue(`${bridge.id} retained source-freshness count differs from exact captured graph`))
    }
    if (Object.hasOwn(bridge, 'claimIds') || bridge.selectedRecordBindings.some((binding) => Object.hasOwn(binding, 'recordText') || Object.hasOwn(binding, 'recordLabel'))) {
      issues.push(issue(`${bridge.id} cannot import TaxSorted record or claim text`))
    }
    const taxsortedHosts = new Set(['api.taxsorted.io'])
    if (!secureHttpsUrl(bridge.provenance.baseUrl, taxsortedHosts)
      || !secureHttpsUrl(bridge.releaseLedgerReceipt.url, taxsortedHosts)
      || Object.values(bridge.captureReceipts).some((receipt) => !secureHttpsUrl(receipt.url, taxsortedHosts))) {
      issues.push(issue(`${bridge.id} capture URLs violate the exact HTTPS TaxSorted host policy`))
    }
    if (!secureHttpsUrl(bridge.rights.curationLicence.url, new Set(['creativecommons.org']))) {
      issues.push(issue(`${bridge.id} curation licence URL violates the exact HTTPS rights host policy`))
    }
  }

  for (const flow of snapshot.flows) {
    const orders = flow.steps.map((step) => step.order)
    const expected = Array.from({ length: flow.steps.length }, (_, index) => index + 1)
    if (canonicalJson(orders) !== canonicalJson(expected)) issues.push(issue(`${flow.id} steps must be finite and contiguous from 1`))
  }
  for (const rail of snapshot.rails) {
    if (['service', 'data'].includes(rail.railType) && rail.authorityBoundary !== 'does-not-confer-authority') {
      issues.push(issue(`${rail.id} service/data rail must explicitly confer no authority`))
    }
  }
  for (const route of snapshot.redressRoutes) {
    for (const key of ['automaticEscalation', 'deadlineCalculated', 'eligibilityDetermined', 'legalAdvice']) {
      if (route[key] !== false) issues.push(issue(`${route.id}.${key} must remain false`))
    }
    const supportingUrls = new Set(route.claimIds.flatMap((claimId) => {
      const claim = snapshot.claims.find((entry) => entry.id === claimId)
      return (claim?.sourceIds ?? []).map((sourceId) => snapshot.sources.find((source) => source.id === sourceId)?.url)
    }))
    if (!supportingUrls.has(route.startUrl)) issues.push(issue(`${route.id} startUrl must be one of its official supporting claim URLs`))
  }
  const resources = Object.fromEntries(snapshot.relatedResources.map((record) => [record.id, record]))
  for (const resource of snapshot.relatedResources) {
    if (!secureHttpsUrl(resource.url, new Set(['taxsorted.io', 'thekingdom.dev']))) {
      issues.push(issue(`${resource.id} URL violates the exact HTTPS related-resource host policy`))
    }
  }
  if (resources['resource:taxsorted-uk-system']?.url !== 'https://taxsorted.io'
    || canonicalJson(resources['resource:taxsorted-uk-system']?.linkedRecordIds) !== canonicalJson(['bridge:taxsorted-public-funding', 'bridge:taxsorted-tax-system'])) {
    issues.push(issue('TaxSorted related-resource route/bridge IDs differ from reviewed constants'))
  }
  if (resources['resource:world-commons']?.url !== 'https://thekingdom.dev/commons.json'
    || canonicalJson(resources['resource:world-commons']?.linkedRecordIds) !== canonicalJson(['companies-house', 'uk-ons', 'uk-small-business-desk', 'uk-trade-tariff'])) {
    issues.push(issue('World Commons route/record IDs differ from reviewed constants'))
  }
  return issues
}

export function snapshotIssues(snapshot, inputs = loadInputs(), captureBundle = loadCaptureBundle(), schema = loadSchema()) {
  const issues = []
  issues.push(...inputReceiptIssues(inputs))
  if (sha256Bytes(readBoundedBytes(SCHEMA_PATH)) !== SCHEMA_BYTE_RECEIPT) issues.push('schema: byte receipt differs from reviewed constant')
  if (sha256Json(schema) !== SCHEMA_CANONICAL_RECEIPT) issues.push('schema: canonical receipt differs from reviewed constant')
  issues.push(...schemaDocumentIssues(schema).map((entry) => `schema: ${entry}`))
  issues.push(...validateWithSchema(snapshot, schema).map((entry) => `schema: ${entry}`))
  issues.push(...projectionIssues(snapshot, inputs, captureBundle))
  issues.push(...uniqueIdIssues(snapshot))
  issues.push(...orderingIssues(snapshot))
  issues.push(...referenceIssues(snapshot, captureBundle, inputs))
  issues.push(...contractIssues(snapshot))
  return [...new Set(issues)].sort()
}

export function buildSnapshot(inputs = loadInputs(), captureBundle = loadCaptureBundle()) {
  const snapshot = assembleSnapshot(inputs, captureBundle)
  const issues = snapshotIssues(snapshot, inputs, captureBundle)
  if (issues.length > 0) throw new Error(`Government Engine validation failed:\n${issues.map((entry) => `- ${entry}`).join('\n')}`)
  return snapshot
}

export function writeSnapshot(inputs = loadInputs(), captureBundle = loadCaptureBundle()) {
  const snapshot = buildSnapshot(inputs, captureBundle)
  const text = prettyCanonicalJson(snapshot)
  atomicWritePublicSnapshot(text)
  const bytes = Buffer.from(text)
  return {
    path: PUBLIC_SNAPSHOT,
    bytes: bytes.byteLength,
    byteReceipt: sha256Bytes(bytes),
    canonicalReceipt: sha256Json(snapshot),
    snapshot,
  }
}

export function validateCheckedInSnapshot(inputs = loadInputs(), captureBundle = loadCaptureBundle()) {
  const snapshot = buildSnapshot(inputs, captureBundle)
  const text = prettyCanonicalJson(snapshot)
  if (!existsSync(PUBLIC_SNAPSHOT)) return { current: false, snapshot }
  const bytes = readBoundedBytes(PUBLIC_SNAPSHOT)
  return {
    current: bytes.toString('utf8') === text,
    byteReceipt: sha256Bytes(bytes),
    canonicalReceipt: sha256Json(parseJsonBytes(bytes, 'public/government.json')),
    snapshot,
  }
}

export const expectedCounts = EXPECTED_COUNTS
export const expectedInputReceipts = INPUT_RECEIPTS
export const expectedCaptureManifestReceipt = CAPTURE_MANIFEST_RECEIPT
export const expectedCaptureReceipts = EXPECTED_CAPTURES
export const expectedSchemaByteReceipt = SCHEMA_BYTE_RECEIPT
export const expectedSchemaCanonicalReceipt = SCHEMA_CANONICAL_RECEIPT
