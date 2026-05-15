import React from 'react'

import { SvgUse } from '@/components/common/SvgUse'

/**
 * Illustrated squat rack — power rack with loaded barbell at shoulder height.
 * Position within a parent scene SVG by spreading `x` / `y` / `width` / `height`
 * onto this wrapper.
 */
export const SquatRackSvg: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <SvgUse
    href="/training-facility/equipment/SquatRack.svg#SquatRack"
    viewBox="0.00 0.00 1024.00 1536.00"
    {...props}
  />
)
