'use client'

import { useRouter } from 'next/navigation'
import { CourtSvg } from '@/components/CourtSvg'

export default function ContactPage() {
  const router = useRouter()

  return (
    <main className="relative h-screen w-full overflow-hidden bg-black text-white">
      {/* 🏀 Court Background */}
      <CourtSvg
        zoneContent={{
          'zone-80': (
  <foreignObject x="580" y="420" width="380" height="220">
    <div
className="p-4 bg-orange-900/70 backdrop-blur-sm text-white drop-shadow-md rounded-md border border-orange-500/40"
>
  <h3 className="text-lg font-bold text-center text-orange-300">📋 Scouting Inquiry</h3>
  <p className="text-xs text-center leading-snug text-white/90">
    Let’s connect — for dream teams, pick-up ideas, or just a chat.
  </p>
  <ul className="text-xs space-y-1 list-none pl-0">
    <li>
      <strong>Email:</strong>{' '}
      <a href="mailto:lucasklawrence@gmail.com" className="text-orange-300 underline hover:text-orange-200">
        lucasklawrence@gmail.com
      </a>
    </li>
    <li>
      <strong>LinkedIn:</strong>{' '}
      <a href="https://linkedin.com/in/lucasklawrence" target="_blank" className="text-orange-300 underline hover:text-orange-200">
        /lucasklawrence
      </a>
    </li>
    <li>
      <strong>Resume:</strong>{' '}
      <a href="/LucasLawrenceResume.pdf" target="_blank" className="text-orange-300 underline hover:text-orange-200">
        View PDF
      </a>
    </li>
  </ul>
      <div className="text-center pt-2">
        <button
          className="px-4 py-1.5 rounded-full text-sm bg-black text-white hover:bg-orange-600 transition shadow-md"
          onClick={() => router.push('/')}
        >
          🏀 Back to the Court
        </button>
      </div>
    </div>
  </foreignObject>
          )
        }}
      />

    </main>
  )
}
