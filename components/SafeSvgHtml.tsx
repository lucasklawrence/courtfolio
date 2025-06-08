import React from 'react'

/**
 * Renders HTML inside an SVG <foreignObject> using XHTML namespace for Safari compatibility.
 *
 * This wrapper uses `React.createElement` to apply the `xmlns` attribute which JSX does not natively support on `<div>`.
 *
 * @component
 * @example
 * <foreignObject x="100" y="100" width="200" height="100">
 *   <SafeSvgHtml>
 *     <button onClick={...}>Click Me</button>
 *   </SafeSvgHtml>
 * </foreignObject>
 */
export function SafeSvgHtml({ children }: { children: React.ReactNode }) {
  return React.createElement(
    'div',
    {
      xmlns: 'http://www.w3.org/1999/xhtml',
      style: { width: '100%', height: '100%' },
    },
    children
  )
}
