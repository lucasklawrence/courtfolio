import { Project } from "./project";

export const courtfolio: Project = {
  slug: 'courtfolio',
  title: 'Courtfolio',
  tagline: 'A full-court press on creativity and code',
  description: `A basketball-themed personal site that blends storytelling, technical depth, and interactive SVG design. The Courtfolio is both portfolio and playground — using a full SVG basketball court as the navigational canvas, with animated lineups, project zones, and immersive micro-interactions.`,
  coverImage: '/images/projects/courtfolio/cover.png',
  slides: [
    {
      type: 'text',
      heading: 'Courtfolio: A Personal Site Reimagined',
      subtext: 'Tech portfolio meets basketball court',
      content: `Inspired by the game, built with precision. The Courtfolio transforms a standard resume into an immersive SVG-based experience — blending technical chops with design instincts.`
    },
    {
      type: 'image',
      heading: 'Interactive Court Layout',
      subtext: 'SVG zones for navigation',
      content: '/images/projects/courtfolio/court-layout.png'
    },
    {
      type: 'text',
      heading: 'Key Features',
      subtext: 'Everything you’d expect — but reimagined',
      content: `- SVG-based full court navigation  
- Lineup zones for Principles and Tech Stack  
- Animated tutorial sprite with Framer Motion  
- Locker Room for personal flavor.
- This film room for project deep dives.`
    },
    {
      type: 'image',
      heading: 'Court Tutorial Sprite',
      subtext: 'Animated guide for first-time visitors',
      content: '/images/projects/courtfolio/tutorial-sprite.gif'
    },
    {
      type: 'code',
      heading: 'Zone Architecture Pattern',
      subtext: 'Embedding content in SVG via React',
      content: `// Example: Embedding a lineup zone
<LockerRoomSvg zoneContent={{
  91: <TechStackLineup />,
  90: <PrinciplesLineup />
}} />`
    },
    {
      type: 'quote',
      heading: 'Why a court?',
      content: `Basketball’s been my north star — the court is a perfect metaphor for how I approach systems: fluid, strategic, expressive.`
    }
  ]
}
