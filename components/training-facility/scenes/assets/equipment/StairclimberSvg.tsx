import React from 'react'

import { SvgUse } from '@/components/common/SvgUse'

/**
 * Illustrated stair climber — vector trace of a side-on stair-climber machine.
 * Position within a parent scene SVG by spreading `x` / `y` / `width` / `height`
 * onto this wrapper.
 */
export const StairclimberSvg: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <SvgUse
    href="/training-facility/equipment/Stairclimber.svg#Stairclimber"
    viewBox="0.00 0.00 1024.00 1536.00"
    {...props}
  />
)
