import React from 'react'

/**
 * Renders HTML inside an SVG <foreignObject> using XHTML namespace for Safari compatibility.
 *
 * This wrapper uses `React.createElement` instead of JSX because JSX does not support `xmlns` on `<div>`.
 *
 * @component
 * @param props.children - The React elements to render within the foreignObject XHTML context.
 * @example
 * <foreignObject x="100" y="100" width="200" height="100">
 *   <SafeSvgHtml>
 *     <button onClick={...}>Click Me</button>
 *   </SafeSvgHtml>
 * </foreignObject>
 */
export const SafeSvgHtml: React.FC<{ children: React.ReactNode }> = props => {
  return React.createElement(
    'div',
    {
      xmlns: 'http://www.w3.org/1999/xhtml',
      style: { width: '100%', height: '100%' },
    },
    props.children
  )
}
