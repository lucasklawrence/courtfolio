import React from 'react'

import { SvgUse } from '@/components/common/SvgUse'

/**
 * SVG component for Duffel bag.
 * Can be scaled or positioned freely using Tailwind or inline styles.
 */

export const DuffelBagSvg: React.FC<React.SVGProps<SVGSVGElement>> = props => {
  return <SvgUse href="/locker-room/DuffelBagSvg.svg#DuffelBagSvg" viewBox="0.00 0.00 1536.00 1024.00" {...props} />
}
