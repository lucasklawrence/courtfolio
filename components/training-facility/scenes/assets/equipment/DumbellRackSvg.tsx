import React from 'react'

import { SvgUse } from '@/components/common/SvgUse'

/**
 * Illustrated dumbbell rack — tiered rack with dumbbells in ascending weights.
 * Position within a parent scene SVG by spreading `x` / `y` / `width` / `height`
 * onto this wrapper.
 *
 * Filename uses the trace export's spelling (`Dumbell`) so the wrapper matches
 * the static asset on disk.
 */
export const DumbellRackSvg: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <SvgUse
    href="/training-facility/equipment/DumbellRack.svg#DumbellRack"
    viewBox="0.00 0.00 1024.00 1536.00"
    {...props}
  />
)
