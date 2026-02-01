// TARGET PATH: app/(arena)/layout.tsx
import type { ReactNode } from 'react'
import { ArenaShell } from '@/src/arena/ArenaShell'

export default function ArenaLayout({ children }: { children: ReactNode }) {
  return <ArenaShell>{children}</ArenaShell>
}
