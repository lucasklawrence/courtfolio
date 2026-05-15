import React from 'react'

import { SvgUse } from '@/components/common/SvgUse'

/**
 * Illustrated plyo box — wooden box for box jumps / step-ups.
 * Position within a parent scene SVG by spreading `x` / `y` / `width` / `height`
 * onto this wrapper.
 */
export const PlyoBoxSvg: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <SvgUse
    href="/training-facility/equipment/PlyoBox.svg#PlyoBox"
    viewBox="0.00 0.00 1024.00 1536.00"
    {...props}
  />
)
