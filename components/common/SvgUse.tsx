import React from 'react'

type SvgUseProps = React.SVGProps<SVGSVGElement> & {
  href: string
}

const getUseSize = (viewBox?: string) => {
  if (!viewBox) {
    return { width: '100%', height: '100%' }
  }

  const parts = viewBox.trim().split(/[\s,]+/).map(Number)
  if (parts.length !== 4 || parts.some(Number.isNaN)) {
    return { width: '100%', height: '100%' }
  }

  return { width: parts[2], height: parts[3] }
}

export function SvgUse({ href, viewBox, ...props }: SvgUseProps) {
  const useSize = getUseSize(viewBox)

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={viewBox} {...props}>
      <use href={href} {...useSize} />
    </svg>
  )
}
