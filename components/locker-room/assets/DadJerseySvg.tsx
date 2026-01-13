import React from 'react'

import { SvgUse } from '@/components/common/SvgUse'

/**
 * SVG component for Dad's basketball jersey.
 * Can be scaled or positioned freely using Tailwind or inline styles.
 */

export const DadJerseySVG: React.FC<React.SVGProps<SVGSVGElement>> = props => {
  return <SvgUse href="/locker-room/DadJerseySVG.svg#DadJerseySVG" viewBox="0.00 0.00 1024.00 1536.00" />
}
