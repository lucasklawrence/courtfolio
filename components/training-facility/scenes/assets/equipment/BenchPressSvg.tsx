import React from 'react'

import { SvgUse } from '@/components/common/SvgUse'

/**
 * Illustrated bench press — flat bench with a loaded barbell racked above it.
 * Position within a parent scene SVG by spreading `x` / `y` / `width` / `height`
 * onto this wrapper.
 */
export const BenchPressSvg: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <SvgUse
    href="/training-facility/equipment/BenchPress.svg#BenchPress"
    viewBox="0.00 0.00 1024.00 1536.00"
    {...props}
  />
)
