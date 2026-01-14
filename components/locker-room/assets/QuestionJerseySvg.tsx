import React from 'react'

import { SvgUse } from '@/components/common/SvgUse'

/**
 * SVG component for Next Job basketball jersey.
 * Can be scaled or positioned freely using Tailwind or inline styles.
 */

export const QuestionJerseySVG: React.FC<React.SVGProps<SVGSVGElement>> = props => {
  return <SvgUse href="/locker-room/QuestionJerseySVG.svg#QuestionJerseySVG" viewBox="0.00 0.00 1024.00 1536.00" {...props} />
}
