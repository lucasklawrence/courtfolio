import React from 'react'

import { SvgUse } from '@/components/common/SvgUse'

/**
 * Illustrated Vertec — vector trace of the vertical-jump measurement rig.
 * Position within a parent scene SVG by spreading `x` / `y` / `width` / `height`
 * onto this wrapper.
 */
export const VertecSvg: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <SvgUse
    href="/training-facility/equipment/Vertec.svg#Vertec"
    viewBox="0.00 0.00 1024.00 1536.00"
    {...props}
  />
)
