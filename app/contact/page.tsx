'use client'

import Link from 'next/link'

export default function ContactPage() {
  return (
    <main className="relative min-h-screen bg-white text-black px-6 py-20">
      {/* Court-style background */}
      <div className="absolute inset-0 bg-[url('/court.svg')] bg-contain bg-no-repeat bg-center opacity-60 pointer-events-none z-0" />

      <div className="relative z-10 max-w-2xl mx-auto text-center space-y-8">
        <h1 className="text-3xl md:text-4xl font-bold">🏀 Scouting Inquiry</h1>

        <p className="text-lg text-neutral-700">
          Let’s connect — whether it’s for a dream team opportunity, a quick pick-up game of ideas, or a chance to collaborate.
        </p>

        <div className="space-y-2 text-sm text-neutral-600">
          <p><span className="font-bold">🧢 GM's Email:</span> <a href="mailto:lucasklawrence@gmail.com" className="text-orange-600 hover:underline">lucas@example.com</a></p>
          <p><span className="font-bold">🎥 Film Room:</span> <a href="https://linkedin.com/in/lucasklawrence" target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:underline">linkedin.com/in/lucaslawrence</a></p>
          <p><span className="font-bold">📄 Scouting Report:</span> <Link href="/resume.pdf" target="_blank" className="text-orange-600 hover:underline">View PDF</Link></p>
        </div>

        <Link
          href="/"
          className="inline-block mt-6 px-6 py-3 bg-black text-white rounded-full hover:bg-orange-500 transition"
        >
          🏟️ Back to the Court
        </Link>
      </div>
    </main>
  )
}
