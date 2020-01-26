export const lockerZoneTooltips: Record<string, { title: string; description: string }> = {
  'zone-324': {
    title: 'Scouting Report',
    description: 'Breaking down opponents, ideas, and next moves.',
  },
  'zone-325': {
    title: 'Laptop',
    description: 'Where the magic gets built. Code, design, deploy.',
  },
  'zone-327': {
    title: 'Jerseys',
    description: 'Past teams, moments, and messages—each with a story.',
  },
  'zone-328': {
    title: 'Straw Hat',
    description: 'The One Piece is real!',
  },
  'zone-330': {
    title: 'Duffel Bag',
    description: 'Packed with skills and hustle. Ready for anything.',
  },
  'zone-342': {
    title: 'Dad Jersey',
    description: 'Legacy, strength, and what drives it all.',
  },
  'zone-355': {
    title: 'Canoga Placard',
    description: 'Current chapter. Building impactful network systems.',
  },
  'zone-356': {
    title: 'Personal Placard',
    description: 'Values, mindset, and the creative soul behind the code.',
  },
  'zone-357': {
    title: 'Hoops Placard',
    description: 'Where teamwork, drive, and passion were forged.',
  },
  'zone-360': {
    title: 'Wild Card Placard',
    description: 'Unpredictable strengths.',
  },
  'zone-363': {
    title: 'Next Team Placard',
    description: 'Future-ready. Open to a team that matches the energy.',
  },
  'zone-361': {
    title: 'Question Jersey',
    description: 'Something’s brewing. Maybe your logo fits here?',
  },
  'zone-441': {
    title: 'Zoë',
    description: 'Mascot and co-pilot through the late nights.',
  },
  'zone-358': {
    title: 'Higher Division Trophy',
    description: 'Pushed up a league. Earned through leadership and grit.',
  },
  'zone-344': {
    title: 'Game Ball',
    description: 'Center of it all. Energy, focus, and readiness.',
  },
  'zone-397': {
    title: 'Patent',
    description: 'Innovation that’s earned legal protection.',
  },
  'zone-400': {
    title: 'Headphones',
    description: 'Flow mode. Beats and code go hand in hand.',
  },
  'zone-437': {
    title: 'Melo 2s',
    description: 'Flash and comfort. A nod to underrated greatness.',
  },
  'zone-439': {
    title: 'Way of Wade 10s',
    description: 'Craft, style, and a bold statement on the floor.',
  },
  'zone-443': {
    title: 'Harden Vol. 7',
    description: 'Decisive moves and isolation excellence.',
  },
  'zone-376': {
    title: 'PS5 Console',
    description: 'Play is serious too. Precision, tactics, fun.',
  },
  'zone-378': {
    title: 'PS5 Controller (Left)',
    description: 'First controller—player one mindset.',
  },
  'zone-379': {
    title: 'PS5 Controller (Right)',
    description: 'Always ready for co-op.',
  },
}

export const LockerInfo = ({ zoneId }: { zoneId: string }) => {
  const info = lockerZoneTooltips[zoneId]
  if (!info) return null

  return (
    <div>
      <h2 className="text-xl font-bold mb-1">{info.title}</h2>
      <p className="text-sm text-neutral-300">{info.description}</p>
    </div>
  )
}
