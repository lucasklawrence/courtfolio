'use client'

import Link from 'next/link'

export function HalfCourtAbout() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-white text-black">
      {/* 🏀 Court background */}
      <div className="absolute inset-0 bg-[url('/court.svg')] bg-contain bg-no-repeat bg-center z-0" />

      {/* Overlay for readability */}
      <div className="absolute inset-0 bg-white/70 z-10 pointer-events-none" />

      {/* 🎯 Content */}
      <div className="relative z-20 flex flex-col items-center justify-center px-6 py-20 text-center space-y-10">

        {/* 🧍 Center Avatar / Intro */}
        <div className="space-y-2">
          <h1 className="text-4xl md:text-5xl font-bold">Lucas Lawrence</h1>
          <p className="text-lg text-orange-600 font-medium">Writing code with court vision.</p>
        </div>

        {/* 🔀 Court Zones */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl text-center mt-10">
          <div>
            <h2 className="text-xl font-bold">🧠 Mindset</h2>
            <p className="text-sm text-neutral-600">How I approach engineering challenges with clarity and collaboration.</p>
            <Link href="/principles" className="text-orange-500 underline">Explore Principles</Link>
          </div>

          <div>
            <h2 className="text-xl font-bold">🛠️ Tech Stack</h2>
            <p className="text-sm text-neutral-600">From backend services to front-end finesse — React, Spring Boot, Kafka, and more.</p>
            <Link href="/lineup" className="text-orange-500 underline">Meet the Lineup</Link>
          </div>
        </div>

        {/* 🚀 Baseline Actions */}
        <div className="flex flex-col md:flex-row justify-center gap-4 mt-10">
          <Link href="/projects" className="px-6 py-3 bg-black text-white rounded-full hover:bg-orange-500 transition">
            💻 Projects
          </Link>
          <Link href="/contact" className="px-6 py-3 border border-black text-black rounded-full hover:bg-black hover:text-white transition">
            📫 Contact
          </Link>
        </div>
      </div>
    </main>
  )
}
