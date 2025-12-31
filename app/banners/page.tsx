import { BannersView, type BannerSection } from '@/components/banners/BannersView'

/**
 * Static list of grouped banner achievements to render in The Rafters section.
 * Each banner represents a meaningful accomplishment — personal, technical, or basketball-related.
 */
const groupedBanners: BannerSection[] = [
  {
    label: '💻 Tech',
    icon: '💻',
    banners: [
      {
        year: '2021',
        title: 'Promoted to Senior Software Engineer',
        icon: '📈',
        category: 'tech',
      },
      {
        year: '2024',
        title: 'Granted Patent on Network Sync',
        icon: '📜',
        category: 'tech',
      },
      {
        year: '2025',
        title: 'Launched Production Grade NMS',
        icon: '🚀',
        category: 'tech',
      },
      {
        year: '2025',
        title: 'Built Internal GitLab Management Portal',
        icon: '🗂️',
        category: 'tech',
      },
    ],
  },
  {
    label: '🎤 Personal',
    icon: '🎤',
    banners: [
      {
        year: '2016',
        title: 'Graduated UCLA — B.S. Electrical Engineering',
        icon: '🎓',
        category: 'personal',
      },
      {
        year: '2020',
        title: 'Graduated University of Miami — M.S. Computer Engineering',
        icon: '🎓',
        category: 'personal',
      },
      {
        year: '2025',
        title: 'Launched Bars of the Day',
        icon: '🎤',
        category: 'personal',
      },
      {
        year: '2025',
        title: 'Launched Memorial Site for Dad',
        icon: '🕯️',
        category: 'personal',
      },
    ],
  },
  {
    label: '🏀 Basketball',
    icon: '🏀',
    banners: [
      {
        year: '2022',
        title: 'DCSA Fall League — High Division Champs',
        icon: '🥇',
        category: 'basketball',
      },
      {
        year: '2023',
        title: 'DCSA Winter League — Mythical 5 Selection',
        icon: '🌟',
        category: 'basketball',
      },
      {
        year: '2023',
        title: 'DCSA Summer League — 40+ Division Champs',
        icon: '🏆',
        category: 'basketball',
      },
      {
        year: '2024',
        title: 'KBL Season 5 — Legends vs Rookies Champs',
        icon: '🧢',
        category: 'basketball',
      },
      {
        year: '2025',
        title: 'KBL Season 6 — All Star Champs',
        icon: '⭐',
        category: 'basketball',
      },
      {
        year: '2025',
        title: 'KBL Season 7 — Season Champs',
        icon: '👑',
        category: 'basketball',
      },
    ],
  },
  {
    label: '🏈 Fantasy',
    icon: '🏈',
    banners: [
      {
        year: '2023',
        title: 'Friends League Champion',
        icon: '🥇',
        category: 'fantasy',
      },
      {
        year: '2024',
        title: 'Random League Champion',
        icon: '🥇',
        category: 'fantasy',
      },
    ],
  },
]

/**
 * BannersPage
 *
 * Renders the "Rafters" section of the site — a visual hall of fame
 * that showcases grouped career, personal, and basketball accomplishments.
 *
 * - Uses Framer Motion for fade + scale entrance.
 * - Groups banner cards by category with labeled headers.
 * - Each banner is animated and can sway subtly on render.
 *
 * @returns {JSX.Element} The full Rafters layout with grouped animated banners.
 */
export default function BannersPage() {
  return <BannersView sections={groupedBanners} />
}

