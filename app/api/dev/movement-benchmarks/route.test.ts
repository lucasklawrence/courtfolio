// @vitest-environment node

import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { POST } from './route'

/**
 * Direct-handler tests for the dev-only POST /api/dev/movement-benchmarks
 * route. Each test stubs MOVEMENT_BENCHMARKS_FILE at a fresh tmp file so
 * the real fixture is never touched, and stubs NODE_ENV=development so
 * the route's prod-gate doesn't 404 us.
 */

let tmpDir: string
let tmpFile: string

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'movement-route-'))
  tmpFile = path.join(tmpDir, 'movement_benchmarks.json')
  vi.stubEnv('MOVEMENT_BENCHMARKS_FILE', tmpFile)
  vi.stubEnv('NODE_ENV', 'development')
})

afterEach(async () => {
  vi.unstubAllEnvs()
  await fs.rm(tmpDir, { recursive: true, force: true })
})

function jsonRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/dev/movement-benchmarks', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/dev/movement-benchmarks', () => {
  it('201 — creates a new benchmark and persists it sorted', async () => {
    const res = await POST(jsonRequest({ date: '2026-04-15', bodyweight_lbs: 232 }))
    expect(res.status).toBe(201)
    const echoed = await res.json()
    expect(echoed.date).toBe('2026-04-15')

    const onDisk = JSON.parse(await fs.readFile(tmpFile, 'utf8'))
    expect(onDisk).toHaveLength(1)
    expect(onDisk[0].bodyweight_lbs).toBe(232)
  })

  it('409 — rejects a duplicate date with PUT-instead guidance', async () => {
    await fs.writeFile(tmpFile, JSON.stringify([{ date: '2026-04-15' }]), 'utf8')
    const res = await POST(jsonRequest({ date: '2026-04-15', vertical_in: 22 }))
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toMatch(/already exists/i)
    expect(body.error).toMatch(/PUT/)
  })

  it('400 — non-JSON body', async () => {
    const req = new NextRequest('http://localhost/api/dev/movement-benchmarks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{not json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/JSON/)
  })

  it('400 — Zod validation failure (missing required date)', async () => {
    const res = await POST(jsonRequest({ bodyweight_lbs: 232 }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/Validation/)
    expect(body.issues).toBeDefined()
  })

  it('400 — Zod rejects unknown fields (.strict() prevents typo data loss)', async () => {
    const res = await POST(jsonRequest({ date: '2026-04-15', bodyweight_lb: 232 }))
    expect(res.status).toBe(400)
  })

  it('404 — prod-gate when NODE_ENV is not development', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const res = await POST(jsonRequest({ date: '2026-04-15' }))
    expect(res.status).toBe(404)
  })
})
