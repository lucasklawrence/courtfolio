export const lockerZoneTooltips: Record<string, { title: string; description: string }> = {
  'scout-report': {
    title: 'Scouting Report',
    description: 'Breaking down opponents, ideas, and next moves.',
  },
  laptop: {
    title: 'Laptop',
    description: 'Where the magic gets built. Code, design, deploy.',
  },
  jereseys: {
    title: 'Jerseys',
    description: 'Past teams, moments, and messages—each with a story.',
  },
  'straw-hat': {
    title: 'Straw Hat',
    description: 'The One Piece is real!',
  },
  'duffel-bag': {
    title: 'Duffel Bag',
    description: 'Packed with skills and hustle. Ready for anything.',
  },
  'dad-jersey': {
    title: 'Dad Jersey',
    description: 'Legacy, strength, and what drives it all.',
  },
  'locker-placard-4': {
    title: 'Canoga Placard',
    description: 'Current chapter. Building impactful network systems.',
  },
  'locker-placard-2': {
    title: 'Personal Placard',
    description: 'Values, mindset, and the creative soul behind the code.',
  },
  'locker-placard-1': {
    title: 'Hoops Placard',
    description: 'Where teamwork, drive, and passion were forged.',
  },
  'locker-placard-3': {
    title: 'Wild Card Placard',
    description: 'Unpredictable strengths.',
  },
  'locker-placard-5': {
    title: 'Next Team Placard',
    description: 'Future-ready. Open to a team that matches the energy.',
  },
  'question-jersey': {
    title: 'Question Jersey',
    description: 'Something’s brewing. Maybe your logo fits here?',
  },
  zoe: {
    title: 'Zoë',
    description: 'Mascot and co-pilot through the late nights.',
  },
  'higher-division-trophy': {
    title: 'Higher Division Trophy',
    description: 'Pushed up a league. Earned through leadership and grit.',
  },
  basketball: {
    title: 'Game Ball',
    description: 'Center of it all. Energy, focus, and readiness.',
  },
  patent: {
    title: 'Patent',
    description: 'Innovation that’s earned legal protection.',
  },
  headphones: {
    title: 'Headphones',
    description: 'Flow mode. Beats and code go hand in hand.',
  },
  'melo-2': {
    title: 'Melo 2s',
    description: 'Flash and comfort. A nod to underrated greatness.',
  },
  'way-of-wade-10': {
    title: 'Way of Wade 10s',
    description: 'Craft, style, and a bold statement on the floor.',
  },
  'harden-7': {
    title: 'Harden Vol. 7',
    description: 'Decisive moves and isolation excellence.',
  },
  ps5: {
    title: 'PS5 Console',
    description: 'Play is serious too. Precision, tactics, fun.',
  },
  'ps5-controller-1': {
    title: 'PS5 Controller (Left)',
    description: 'First controller—player one mindset.',
  },
  'ps5-controller-2': {
    title: 'PS5 Controller (Right)',
    description: 'Always ready for co-op.',
  },
}

export const LockerInfo = ({ zoneId }: { zoneId: string }) => {
  console.log('in locker info' + zoneId)
  const info = lockerZoneTooltips[zoneId]
  if (!info) return null

  return (
    <div>
      <h2 className="text-xl font-bold mb-1">{info.title}</h2>
      <p className="text-sm text-neutral-300">{info.description}</p>
    </div>
  )
}
