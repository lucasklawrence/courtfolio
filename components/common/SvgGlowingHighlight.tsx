export function SvgGlowHighlight({
  x,
  y,
  width,
  height,
  shape = 'rect',
}: {
  x: number
  y: number
  width: number
  height: number
  shape?: string
}) {
  const commonProps = {
    fill: 'rgba(252, 211, 77, 0.08)',
    stroke: 'rgba(252, 211, 77, 0.9)',
    strokeWidth: 2,
    style: {
      filter:
        'drop-shadow(0 0 10px rgba(252, 211, 77, 0.5)) drop-shadow(0 0 20px rgba(252, 211, 77, 0.4))',
    },
  }

  if (shape === 'circle') {
    const cx = x + width / 2
    const cy = y + height / 2
    const r = width / 2
    return <circle cx={cx} cy={cy} r={r} {...commonProps} />
  }

  return <rect x={x} y={y} width={width} height={height} rx={8} ry={8} {...commonProps} />
}
