// @vitest-environment node

import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { DELETE, PUT } from './route'

/**
 * Direct-handler tests for PUT/DELETE /api/dev/movement-benchmarks/[date].
 * Mirrors the collection route harness: tmp file via env stub, dev-only gate
 * via NODE_ENV stub.
 */

let tmpDir: string
let tmpFile: string

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'movement-item-route-'))
  tmpFile = path.join(tmpDir, 'movement_benchmarks.json')
  vi.stubEnv('MOVEMENT_BENCHMARKS_FILE', tmpFile)
  vi.stubEnv('NODE_ENV', 'development')
})

afterEach(async () => {
  vi.unstubAllEnvs()
  await fs.rm(tmpDir, { recursive: true, force: true })
})

function ctxFor(date: string): { params: Promise<{ date: string }> } {
  return { params: Promise.resolve({ date }) }
}

function putRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/dev/movement-benchmarks/2026-04-15', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function deleteRequest(): NextRequest {
  return new NextRequest('http://localhost/api/dev/movement-benchmarks/2026-04-15', {
    method: 'DELETE',
  })
}

async function seed(entries: Array<{ date: string } & Record<string, unknown>>): Promise<void> {
  await fs.writeFile(tmpFile, JSON.stringify(entries), 'utf8')
}

describe('PUT /api/dev/movement-benchmarks/[date]', () => {
  it('200 — merges partial update into the existing entry', async () => {
    await seed([{ date: '2026-04-15', bodyweight_lbs: 232, vertical_in: 21 }])
    const res = await PUT(putRequest({ vertical_in: 23.5 }), ctxFor('2026-04-15'))
    expect(res.status).toBe(200)
    const body = await res.json()
    // Original bodyweight_lbs preserved, vertical_in updated.
    expect(body).toMatchObject({ date: '2026-04-15', bodyweight_lbs: 232, vertical_in: 23.5 })

    const onDisk = JSON.parse(await fs.readFile(tmpFile, 'utf8'))
    expect(onDisk[0].vertical_in).toBe(23.5)
    expect(onDisk[0].bodyweight_lbs).toBe(232)
  })

  it('404 — no benchmark exists for the URL date', async () => {
    await seed([{ date: '2026-03-15' }])
    const res = await PUT(putRequest({ vertical_in: 22 }), ctxFor('2026-04-15'))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toMatch(/2026-04-15/)
  })

  it('400 — bad date format in URL segment', async () => {
    const res = await PUT(putRequest({ vertical_in: 22 }), ctxFor('not-a-date'))
    expect(res.status).toBe(400)
  })

  it('400 — non-JSON body', async () => {
    await seed([{ date: '2026-04-15' }])
    const req = new NextRequest('http://localhost/api/dev/movement-benchmarks/2026-04-15', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: '{not json',
    })
    const res = await PUT(req, ctxFor('2026-04-15'))
    expect(res.status).toBe(400)
  })

  it('400 — Zod rejects date field in the update body (caller cannot rename via PUT)', async () => {
    await seed([{ date: '2026-04-15' }])
    const res = await PUT(
      putRequest({ date: '2026-05-15', vertical_in: 22 }),
      ctxFor('2026-04-15'),
    )
    expect(res.status).toBe(400)
  })

  it('404 — prod-gate when NODE_ENV is not development', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const res = await PUT(putRequest({ vertical_in: 22 }), ctxFor('2026-04-15'))
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/dev/movement-benchmarks/[date]', () => {
  it('200 — removes the entry and echoes it back', async () => {
    await seed([
      { date: '2026-04-15', bodyweight_lbs: 232 },
      { date: '2026-03-15', bodyweight_lbs: 235 },
    ])
    const res = await DELETE(deleteRequest(), ctxFor('2026-04-15'))
    expect(res.status).toBe(200)
    const removed = await res.json()
    expect(removed.bodyweight_lbs).toBe(232)

    const onDisk = JSON.parse(await fs.readFile(tmpFile, 'utf8'))
    expect(onDisk).toHaveLength(1)
    expect(onDisk[0].date).toBe('2026-03-15')
  })

  it('404 — no benchmark exists for the URL date', async () => {
    await seed([{ date: '2026-03-15' }])
    const res = await DELETE(deleteRequest(), ctxFor('2026-04-15'))
    expect(res.status).toBe(404)
  })

  it('400 — bad date format in URL segment', async () => {
    const res = await DELETE(deleteRequest(), ctxFor('not-a-date'))
    expect(res.status).toBe(400)
  })

  it('404 — prod-gate when NODE_ENV is not development', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const res = await DELETE(deleteRequest(), ctxFor('2026-04-15'))
    expect(res.status).toBe(404)
  })
})
