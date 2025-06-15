export function SvgGlowHighlight({
  x,
  y,
  width,
  height,
}: {
  x: number
  y: number
  width: number
  height: number
}) {
  return (
    <rect
      x={x}
      y={y}
      width={width}
      height={height}
      rx={8}
      ry={8}
      fill="rgba(252, 211, 77, 0.08)"
      stroke="rgba(252, 211, 77, 0.9)"
      strokeWidth={2}
      style={{
        filter: 'drop-shadow(0 0 10px rgba(252, 211, 77, 0.5)) drop-shadow(0 0 20px rgba(252, 211, 77, 0.4))',
      }}
    />
  )
}
