import React from 'react'

import { SvgUse } from '@/components/common/SvgUse'

/**
 * Illustrated treadmill — vector trace of a side-on running treadmill.
 * Drop into a scene SVG and position via `x`, `y`, `width`, `height` props
 * (the wrapper emits its own `<svg>` root, so any sizing/positioning attrs
 * spread onto that outer element).
 */
export const TreadmillSvg: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <SvgUse
    href="/training-facility/equipment/Treadmill.svg#Treadmill"
    viewBox="0.00 0.00 1024.00 1536.00"
    {...props}
  />
)
