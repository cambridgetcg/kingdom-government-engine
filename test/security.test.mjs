import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

import { PUBLIC_SNAPSHOT, ROOT } from '../src/io.mjs'

const SOURCE_FILES = readdirSync(join(ROOT, 'src'))
  .filter((name) => name.endsWith('.mjs'))
  .sort()
  .map((name) => ({ name, text: readFileSync(join(ROOT, 'src', name), 'utf8') }))

test('production source imports only bounded Node built-ins and local modules', () => {
  const allowedBuiltins = new Set(['node:crypto', 'node:fs', 'node:path', 'node:url'])
  for (const { name, text } of SOURCE_FILES) {
    const imports = [...text.matchAll(/from\s+['"]([^'"]+)['"]/gu)].map((match) => match[1])
    for (const specifier of imports) {
      assert.equal(specifier.startsWith('./') || specifier.startsWith('../') || allowedBuiltins.has(specifier), true, `${name}: ${specifier}`)
    }
  }
})

test('production source contains no network, subprocess, credential, environment or dynamic-code door', () => {
  const source = SOURCE_FILES.map(({ name, text }) => `\n${name}\n${text}`).join('\n')
  const forbidden = [
    /\bfetch\s*\(/u,
    /\bXMLHttpRequest\b/u,
    /\bWebSocket\b/u,
    /\bEventSource\b/u,
    /node:(?:http|https|net|tls|dgram|dns|child_process|cluster|worker_threads|vm)/u,
    /\b(?:exec|execFile|spawn|fork)Sync?\s*\(/u,
    /\bprocess\.env\b/u,
    /\beval\s*\(/u,
    /\bnew\s+Function\b/u,
    /\bWebAssembly\b/u,
    /\bnpm\s+(?:install|exec|publish)\b/u,
  ]
  for (const pattern of forbidden) assert.doesNotMatch(source, pattern)
})

test('the sole production write target is fixed to public/government.json', () => {
  const source = SOURCE_FILES.map(({ text }) => text).join('\n')
  const io = readFileSync(join(ROOT, 'src', 'io.mjs'), 'utf8')
  const cli = readFileSync(join(ROOT, 'src', 'cli.mjs'), 'utf8')
  assert.match(io, /PUBLIC_SNAPSHOT = join\(ROOT, 'public', 'government\.json'\)/u)
  assert.match(io, /export function atomicWritePublicSnapshot\(text, operations = \{\}\)/u)
  assert.doesNotMatch(source.replace(io, ''), /\b(?:writeFile|appendFile|openSync|writeSync|renameSync|mkdirSync)\b/u)
  assert.doesNotMatch(cli, /--output/u)
})

test('read-only CLI exposes only validate, build, check, overview and help', () => {
  const before = readFileSync(PUBLIC_SNAPSHOT)
  const publicDirectory = join(ROOT, 'public')
  const temporaryBefore = readdirSync(publicDirectory).filter((name) => name.endsWith('.tmp')).sort()
  const overview = spawnSync(process.execPath, ['src/cli.mjs', 'overview'], { cwd: ROOT, encoding: 'utf8' })
  assert.equal(overview.status, 0, overview.stderr)
  const parsed = JSON.parse(overview.stdout)
  assert.equal(parsed.legalAdvice, false)
  assert.equal(parsed.taxAdvice, false)
  assert.equal(parsed.governmentAffiliation, false)
  assert.equal(parsed.exactTextHumanReviewed, false)
  assert.equal(parsed.sourceReviewMode, 'maintainer-authorized-assisted-url-review')

  for (const command of ['poll', 'fetch', 'run', 'execute', 'approve', 'sign', 'file', 'pay', 'post', 'mcp']) {
    const result = spawnSync(process.execPath, ['src/cli.mjs', command], { cwd: ROOT, encoding: 'utf8' })
    assert.notEqual(result.status, 0)
    assert.equal(result.stdout, '')
    assert.match(result.stderr, /unknown command/u)
  }
  const arbitraryOutput = spawnSync(process.execPath, ['src/cli.mjs', 'build', '--output', '/tmp/elsewhere'], { cwd: ROOT, encoding: 'utf8' })
  assert.notEqual(arbitraryOutput.status, 0)
  assert.equal(arbitraryOutput.stdout, '')
  assert.match(arbitraryOutput.stderr, /unexpected argument/u)
  assert.deepEqual(readFileSync(PUBLIC_SNAPSHOT), before)
  assert.deepEqual(readdirSync(publicDirectory).filter((name) => name.endsWith('.tmp')).sort(), temporaryBefore)
})

test('public projection contains no TaxSorted record text fields or operational capability fields', () => {
  const text = readFileSync(join(ROOT, 'public', 'government.json'), 'utf8')
  for (const key of ['recordText', 'recordLabel', 'fullText', 'sourceCode', 'credentialValue', 'signatureValue', 'personId', 'partyId']) {
    assert.doesNotMatch(text, new RegExp(`"${key}"\\s*:`, 'u'))
  }
  assert.doesNotMatch(text, /"(?:status|outcome|score)"\s*:/iu)
})
