import React from 'react'

import { SvgUse } from '@/components/common/SvgUse'

/**
 * Illustrated dumbbell rack — tiered rack with dumbbells in ascending weights.
 * Position within a parent scene SVG by spreading `x` / `y` / `width` / `height`
 * onto this wrapper.
 */
export const DumbbellRackSvg: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <SvgUse
    href="/training-facility/equipment/DumbbellRack.svg#DumbbellRack"
    viewBox="0.00 0.00 1024.00 1536.00"
    {...props}
  />
)
