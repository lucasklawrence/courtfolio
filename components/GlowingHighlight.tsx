export function GlowingHighlight({
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
    <div
      className="z-10 pointer-events-none rounded-lg border-2 border-yellow-300/70 shadow-[0_0_20px_6px_rgba(252,211,77,0.5)] animate-pulse"
      style={{
        left: `${x}px`,
        top: `${y}px`,
        width: `${width}px`,
        height: `${height}px`,
      }}
    />
  )
}
