'use client'

import Link from 'next/link'

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-white text-black px-6 py-20 relative">
      {/* Optional background */}
      <div className="absolute inset-0 bg-[url('/court.svg')] bg-contain bg-no-repeat bg-center opacity-5 pointer-events-none z-0" />

      <div className="relative z-10 max-w-3xl mx-auto text-center space-y-8">
        <h1 className="text-4xl md:text-5xl font-bold">👋 About Me</h1>

        <p className="text-lg md:text-xl text-neutral-700">
          I’m <strong>Lucas Lawrence</strong> — a full-stack engineer with <span className="text-orange-500 font-semibold">court vision</span>.
          From designing cloud-based infrastructure to delivering high-precision UI animations, I approach code the way a point guard runs the floor:
          with clarity, anticipation, and teamwork.
        </p>

        <p className="text-lg text-neutral-600">
          Whether I’m shipping scalable services, launching creative tools like <Link href="https://barsoftheday.com" className="text-orange-600 underline">Bars of the Day</Link>, 
          or leading teammates through tight sprints — I bring the same principles I learned from the game: fundamentals, hustle, and trust.
        </p>

        <div className="flex flex-col md:flex-row justify-center items-center gap-4 mt-10">
          <Link href="/lineup" className="px-6 py-3 bg-black text-white rounded-full hover:bg-orange-500 transition">
            🏀 View My Starting 5
          </Link>
          <Link href="/projects" className="px-6 py-3 border border-black text-black rounded-full hover:bg-black hover:text-white transition">
            💻 Explore Projects
          </Link>
        </div>
      </div>
    </main>
  )
}
