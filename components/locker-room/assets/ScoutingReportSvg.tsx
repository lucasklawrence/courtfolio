import React from 'react'

import { SvgUse } from '@/components/common/SvgUse'

/**
 * SVG component for Scouting Report.
 * Can be styled or positioned using Tailwind or inline props.
 */
export const ScoutingReportSvg: React.FC<React.SVGProps<SVGSVGElement>> = props => {
  return <SvgUse href="/locker-room/ScoutingReportSvg.svg#ScoutingReportSvg" viewBox="0 0 400 300" {...props} />
}
