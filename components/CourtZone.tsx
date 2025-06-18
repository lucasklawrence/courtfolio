/**
 * CourtZone is a wrapper component that renders a <foreignObject> at specified
 * SVG coordinates on the basketball court. It enables injecting interactive HTML
 * content into precise locations within the SVG court layout.
 *
 * @param {number} x - The x-coordinate position of the foreignObject on the SVG canvas.
 * @param {number} y - The y-coordinate position of the foreignObject on the SVG canvas.
 * @param {number} width - The width of the rendered foreignObject.
 * @param {number} height - The height of the rendered foreignObject.
 * @param {React.ReactNode} children - The HTML or React content to render inside the foreignObject.
 *
 * @example
 * <CourtZone x={800} y={200} width={280} height={160}>
 *   <ZoneCareerStats />
 * </CourtZone>
 */
export function CourtZone({
  x,
  y,
  width,
  height,
  children,
  className
}: {
  x: number
  y: number
  width: number
  height: number
  children: React.ReactNode,
  className?: string
}) {
  return (
    <foreignObject x={x} y={y} width={width} height={height} className={className}>
      {children}
    </foreignObject>
  )
}
