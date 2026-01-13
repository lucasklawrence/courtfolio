import React from 'react'

import { SvgUse } from '@/components/common/SvgUse'

/**
 * SVG component for stack of books.
 * Can be scaled or positioned freely using Tailwind or inline styles.
 */

export const BooksSvg: React.FC<React.SVGProps<SVGSVGElement>> = props => {
  return <SvgUse href="/locker-room/BooksSvg.svg#BooksSvg" viewBox="0.00 0.00 1024.00 1024.00" />
}
