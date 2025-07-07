import { useState, useEffect } from 'react'

export function useAudienceCommentary(projectSlug: string | null) {
  const commentsMap: Record<string, string[]> = {
    'bars-of-the-day': [
      'That timing animation goes hard!',
      'I love how the bars flow with the beat.',
    ],
    'courtfolio': [
      'This whole site is a flex.',
      'SVG game strong on this one.',
    ],
    'fantasy-football-ai': [
      'He’s cooking up trade advice like an analyst.',
      'Next-gen GM vibes right here.',
    ],
  }

  const [comment, setComment] = useState<string | null>(null)

  useEffect(() => {
    if (projectSlug && commentsMap[projectSlug]) {
      const lines = commentsMap[projectSlug]
      const pick = lines[Math.floor(Math.random() * lines.length)]
      setComment(pick)
    }
  }, [projectSlug])

  return comment
}
