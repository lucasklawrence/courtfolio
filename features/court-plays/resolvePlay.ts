import type { Play } from './plays.schema'
import { plays } from './plays'

export function resolvePlay(
  principleId: string | null,
  shotId: string | null,
  _contextId?: string | null
): Play | null {
  if (!principleId || !shotId) return null
  const key = `${principleId}::${shotId}` as const
  return plays[key] ?? null
}
