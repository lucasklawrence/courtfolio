import React from 'react'

import { SvgUse } from '@/components/common/SvgUse'

/**
 * Official Snapchat Ghost Logo
 */

export const SnapGhost: React.FC<React.SVGProps<SVGSVGElement>> = props => {
  return <SvgUse href="/locker-room/SnapGhost.svg#SnapGhost" viewBox="0 0 500 500" {...props} />
}
