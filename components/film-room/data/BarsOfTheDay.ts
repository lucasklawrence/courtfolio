import { Project } from './project'

export const BARS_OF_THE_DAY: Project = {
  slug: 'bars-of-the-day',
  title: 'Bars of the Day',
  tagline: 'The art of a line, one bar at a time.',
  description: 'An experimental playground to display and remember bars.',
  coverImage: '/projects/BarsOfTheDay2.png',
  icon: '/projects/BarFavicon.png',
  slides: [
    {
      type: 'text',
      heading: 'How It Started',
      subtext: 'A simple text turned creative ritual.',
      content: `Bars of the Day began as a text I’d send to my girlfriend — breaking down why a particular rap lyric hit hard.

It became a ritual: appreciating not just the artist’s delivery, but the meaning, the rhythm, the layers. That habit turned into this site — a digital continuation of those daily texts.`,
    },
    {
      type: 'demo',
      heading: 'Live Demo',
      subtext: 'Bar-by-bar playback synced to audio',
      content: 'https://barsoftheday.com',
    },
    {
      type: 'text',
      heading: 'What’s Next',
      content: `Bars of the Day is expanding beyond the site.

• A Twitter bot that drops daily bars.
• A TikTok channel with bar breakdowns.
• Possibly a newsletter, maybe even audio commentary.

Rap is layered — and so is this project.`,
      reaction: {
        speaker: 'audience',
        text: 'That’s a whole media empire in the making!',
        position: { x: 250, y: 720 },
      },
    },
    {
      type: 'text',
      heading: 'Tech Stack',
      subtext: 'Under the hood — what makes it go.',
      content: `• Next.js 15 w/ App Router  
• Tailwind CSS for layout  
• Framer Motion for lyric animations  
• Supabase for auth & storage  
• Radix UI + Lucide for interface polish`,
    },
    {
      type: 'text',
      heading: 'Deployment & Hosting',
      subtext: 'Built for speed, hosted for scale.',
      content: `• Vercel — Handles builds, CDN, and edge caching  
• Zero-config deploys from GitHub  
• Previews for every PR  
• Instant rollbacks, zero downtime  

Build fast, ship faster.`,
    },
  ],
}
