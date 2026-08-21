import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import { ROOT, readJson, sha256Bytes, sha256Json } from '../src/io.mjs'
import {
  buildSnapshot,
  expectedSchemaByteReceipt,
  expectedSchemaCanonicalReceipt,
  loadCaptureBundle,
  loadInputs,
  snapshotIssues,
} from '../src/government.mjs'
import { loadSchema, schemaDocumentIssues, validateWithSchema } from '../src/schema-validator.mjs'

test('the sole Draft 2020-12 schema is closed, supported and exactly receipt-pinned', () => {
  const schema = loadSchema()
  const bytes = readFileSync(join(ROOT, 'schemas', 'v0.1', 'public-snapshot.schema.json'))
  assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema')
  assert.equal(schema.$id, 'https://thekingdom.dev/government/schemas/v0.1/public-snapshot.schema.json')
  assert.deepEqual(schemaDocumentIssues(schema), [])
  assert.equal(sha256Bytes(bytes), expectedSchemaByteReceipt)
  assert.equal(sha256Json(schema), expectedSchemaCanonicalReceipt)
})

test('schema validates the exact snapshot and rejects count or boundary drift', () => {
  const schema = loadSchema()
  const snapshot = buildSnapshot()
  assert.deepEqual(validateWithSchema(snapshot, schema), [])

  const countDrift = structuredClone(snapshot)
  countDrift.counts.sources = 67
  assert.match(validateWithSchema(countDrift, schema).join('\n'), /declared constant/u)

  const boundaryDrift = structuredClone(snapshot)
  boundaryDrift.boundaries.legalAdvice = true
  assert.match(validateWithSchema(boundaryDrift, schema).join('\n'), /declared constant/u)
})

test('schema meta-validator fails closed on the reproduced keyword-family weakenings', () => {
  const base = loadSchema()
  const mutations = [
    (schema) => { delete schema.$defs.source.type; delete schema.$defs.source.additionalProperties },
    (schema) => { delete schema.$defs.source.type },
    (schema) => { delete schema.properties.sources.items },
    (schema) => { schema.$defs.source.required = 'id' },
    (schema) => { schema.$defs.claim.properties.claimType.enum = 'source-stated' },
    (schema) => { delete schema.properties.sources.type },
    (schema) => { schema.properties.sources.items = true },
    (schema) => { schema.properties.sources.items = {} },
    (schema) => { schema.$defs.source.required.pop() },
    (schema) => { schema.$defs.flowStep.properties.order.minimum = 'one' },
    (schema) => { schema.$defs.flowStep.properties.order.maximum = null },
    (schema) => { schema.description = { unsafe: true } },
    (schema) => { schema.$defs.nonempty = {} },
    (schema) => { schema.$defs.nonempty = true },
    (schema) => { schema.$defs.claim.properties.claimType = {} },
    (schema) => { schema.$defs.claim.properties.claimType = true },
    (schema) => { schema.$defs.nonempty.$id = 'https://example.invalid/nested' },
    (schema) => { schema.$defs.nonempty.$schema = 'https://json-schema.org/draft/2019-09/schema' },
  ]
  for (const mutate of mutations) {
    const schema = structuredClone(base)
    mutate(schema)
    assert.notDeepEqual(schemaDocumentIssues(schema), [])
  }
})

test('exact schema receipt rejects syntactically valid widening and const mutations', () => {
  const base = loadSchema()
  const snapshot = buildSnapshot()
  const inputs = loadInputs()
  const captures = loadCaptureBundle()
  const mutations = [
    (schema) => { schema.properties.sources.maxItems = 67 },
    (schema) => { delete schema.$defs.publicBoundaries.properties.legalAdvice.const },
    (schema) => { schema.$defs.urls.properties.producer.const = 'https://example.invalid/widened' },
  ]
  for (const mutate of mutations) {
    const schema = structuredClone(base)
    mutate(schema)
    assert.match(snapshotIssues(snapshot, inputs, captures, schema).join('\n'), /schema: canonical receipt differs/u)
  }
})

test('package is private, unlicensed, zero-dependency and Node 20+', () => {
  const pkg = readJson(join(ROOT, 'package.json'))
  assert.equal(pkg.private, true)
  assert.equal(pkg.version, '0.1.0')
  assert.equal(pkg.license, 'UNLICENSED')
  assert.equal(pkg.engines.node, '>=20')
  assert.equal(Object.hasOwn(pkg, 'dependencies'), false)
  assert.equal(Object.hasOwn(pkg, 'devDependencies'), false)
})

test('CI actions are commit-pinned and check Node 20/22 receipt parity', () => {
  const workflow = readFileSync(join(ROOT, '.github', 'workflows', 'validate.yml'), 'utf8')
  assert.match(workflow, /actions\/checkout@[0-9a-f]{40}/u)
  assert.match(workflow, /actions\/setup-node@[0-9a-f]{40}/u)
  assert.match(workflow, /node-version: \["20", "22"\]/u)
  assert.match(workflow, /node-version: \$\{\{ matrix\.node-version \}\}/u)
  assert.match(workflow, /npm run build:check/u)
})
