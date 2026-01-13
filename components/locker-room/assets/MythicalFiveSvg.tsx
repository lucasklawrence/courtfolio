import React from 'react'

import { SvgUse } from '@/components/common/SvgUse'

/**
 * SVG component for Mythical 5 trophy.
 * Can be scaled or positioned freely using Tailwind or inline styles.
 */

export const MythicalFiveTrophySvg: React.FC<React.SVGProps<SVGSVGElement>> = props => {
  return <SvgUse href="/locker-room/MythicalFiveTrophySvg.svg#MythicalFiveTrophySvg" viewBox="0.00 0.00 1024.00 1536.00" />
}
