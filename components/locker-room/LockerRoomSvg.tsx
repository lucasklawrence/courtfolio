'use client'

import React, { useCallback } from 'react'
import { LockerContentKey } from './types'

type LockerRoomSvgProps = {
  onZoneClick?: (zoneId: string) => void
  className?: string
  zoneContent?: Partial<Record<LockerContentKey, React.ReactNode>>
}

/**
 * Inline SVG of a basketball court with zone interactivity.
 * Allows content injection per zone via `zoneContent`.
 */
export const LockerRoomSvg: React.FC<LockerRoomSvgProps> = ({
  onZoneClick,
  className,
  zoneContent = {},
}) => {
  const handleClick = useCallback(
    (zoneId: string) => {
      if (onZoneClick) {
        onZoneClick(zoneId)
      }
    },
    [onZoneClick]
  )
  return (
    <svg
      viewBox="0 0 1536 1024"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid meet"
      className="w-full h-full max-w-none touch-pan-x touch-pan-y touch-pinch-zoom"
    >
      <g fill="none" strokeLinecap="butt" strokeWidth="2.00">
        <g id="grouped-lockers">
          <g id="item-1" onClick={() => handleClick('item-1')}>
            <path
              d="   M 39.13 0.00   Q 38.09 4.51 38.06 10.75   Q 37.87 61.96 38.16 75.88   C 38.25 80.45 38.58 85.79 42.36 88.36   A 0.31 0.31 0.0 0 0 42.84 88.12   L 43.44 78.69"
              stroke="#b77432"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-2" onClick={() => handleClick('item-2')}>
            <path
              d="   M 43.44 78.69   Q 43.77 80.47 44.69 81.98"
              stroke="#ce8a43"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-3" onClick={() => handleClick('item-3')}>
            <path
              d="   M 44.69 81.98   L 44.65 895.69   A 0.40 0.40 0.0 0 1 44.25 896.09   L 0.00 896.26"
              stroke="#704b28"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-4" onClick={() => handleClick('item-4')}>
            <path
              d="   M 0.00 631.35   L 42.12 631.46   A 1.01 1.01 0.0 0 0 43.13 630.45   L 43.13 627.27   A 1.34 1.34 0.0 0 0 41.78 625.93   Q 25.19 626.04 9.24 626.09   C 6.21 626.10 3.04 626.54 0.00 627.00"
              stroke="#b77432"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-5" onClick={() => handleClick('item-5')}>
            <path
              d="   M 0.00 190.51   L 42.30 190.87   A 0.77 0.76 -89.6 0 0 43.07 190.10   L 43.07 186.13   A 0.80 0.80 0.0 0 0 42.27 185.33   L 0.00 185.38"
              stroke="#b77432"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-6" onClick={() => handleClick('item-6')}>
            <path
              d="   M 10.19 279.84   L 8.27 281.76   A 1.25 1.23 -19.9 0 0 7.93 282.47   Q 7.18 288.46 7.17 289.43   C 6.84 313.74 7.18 336.59 7.07 360.57   Q 6.85 404.21 7.11 449.60   Q 7.16 457.80 8.84 464.92   A 0.54 0.54 0.0 0 0 9.88 464.94   Q 11.58 458.89 11.61 452.11   Q 11.90 402.77 11.61 381.28   C 11.22 352.77 12.08 321.29 11.55 291.70   Q 11.44 285.44 10.71 280.02   A 0.31 0.31 0.0 0 0 10.19 279.84"
              stroke="#b77432"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-7" onClick={() => handleClick('item-7')}>
            <path
              d="   M 6.66 895.16   L 8.98 895.16   A 0.93 0.93 0.0 0 0 9.91 894.23   L 9.91 764.88   A 8.14 1.25 -90.0 0 0 8.66 756.74   L 6.98 756.74   A 8.14 1.25 -90.0 0 0 5.73 764.88   L 5.73 894.23   A 0.93 0.93 0.0 0 0 6.66 895.16"
              stroke="#b77432"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-8" onClick={() => handleClick('item-8')}>
            <path
              d="   M 41.99 0.00   Q 42.30 3.15 42.33 6.32   Q 42.62 33.27 42.62 60.23   Q 42.62 68.76 43.93 76.49"
              stroke="#b77432"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-9" onClick={() => handleClick('item-9')}>
            <path
              d="   M 43.93 76.49   L 43.44 78.69"
              stroke="#c7843f"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-10" onClick={() => handleClick('item-10')}>
            <path
              d="   M 113.27 0.00   Q 112.93 33.35 113.03 66.70   Q 113.04 71.11 113.91 75.29"
              stroke="#b77432"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-11" onClick={() => handleClick('item-11')}>
            <path
              d="   M 113.91 75.29   Q 82.71 75.01 51.31 75.08   Q 46.59 75.09 43.93 76.49"
              stroke="#ce8a43"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-12" onClick={() => handleClick('item-12')}>
            <path
              d="   M 116.53 0.00   Q 117.81 4.19 117.81 10.26   Q 117.81 42.20 117.72 74.14   Q 117.72 75.03 117.38 75.33"
              stroke="#b77432"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-13" onClick={() => handleClick('item-13')}>
            <path
              d="   M 117.38 75.33   Q 115.74 75.87 113.91 75.29"
              stroke="#c7843f"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-14" onClick={() => handleClick('item-14')}>
            <path
              d="   M 186.47 0.00   Q 185.72 3.65 185.67 8.63   Q 185.40 39.75 185.56 57.34   Q 185.63 64.83 184.87 75.13"
              stroke="#b77432"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-15" onClick={() => handleClick('item-15')}>
            <path
              d="   M 184.87 75.13   L 117.38 75.33"
              stroke="#ce8a43"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-16" onClick={() => handleClick('item-16')}>
            <path
              d="   M 190.06 0.00   L 190.36 75.14"
              stroke="#b77432"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-17" onClick={() => handleClick('item-17')}>
            <path
              d="   M 190.36 75.14   L 184.87 75.13"
              stroke="#c7843f"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-18" onClick={() => handleClick('item-18')}>
            <path
              d="   M 260.21 0.00   L 259.66 75.07"
              stroke="#b77432"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-19" onClick={() => handleClick('item-19')}>
            <path
              d="   M 259.66 75.07   L 190.36 75.14"
              stroke="#ce8a43"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-20" onClick={() => handleClick('item-20')}>
            <path
              d="   M 263.25 0.00   Q 264.42 4.54 264.47 9.27   Q 264.78 38.12 264.18 66.97   Q 264.13 69.31 264.63 75.17"
              stroke="#b77432"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-21" onClick={() => handleClick('item-21')}>
            <path
              d="   M 264.63 75.17   L 259.66 75.07"
              stroke="#c7843f"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-22" onClick={() => handleClick('item-22')}>
            <path
              d="   M 393.30 0.00   Q 392.48 3.27 392.46 11.04   Q 392.34 43.08 392.89 75.20"
              stroke="#b77432"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-23" onClick={() => handleClick('item-23')}>
            <path
              d="   M 392.89 75.20   L 318.19 75.05"
              stroke="#ce8a43"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-24" onClick={() => handleClick('item-24')}>
            <path
              d="   M 318.19 75.05   Q 317.48 66.99 317.55 61.45   Q 317.93 29.29 317.56 4.58   Q 317.56 4.45 317.29 1.33   A 1.22 1.21 87.4 0 0 316.08 0.22   L 314.31 0.22   A 1.47 1.47 0.0 0 0 312.84 1.69   L 312.85 75.20"
              stroke="#b77432"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-25" onClick={() => handleClick('item-25')}>
            <path
              d="   M 312.85 75.20   L 264.63 75.17"
              stroke="#ce8a43"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-26" onClick={() => handleClick('item-26')}>
            <path
              d="   M 396.65 0.00   Q 397.16 5.87 397.39 24.98   Q 397.69 49.88 397.44 75.17"
              stroke="#b77432"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-27" onClick={() => handleClick('item-27')}>
            <path
              d="   M 397.44 75.17   Q 395.22 75.83 392.89 75.20"
              stroke="#c7843f"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-28" onClick={() => handleClick('item-28')}>
            <path
              d="   M 479.74 0.00   L 479.86 75.22"
              stroke="#b77432"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-29" onClick={() => handleClick('item-29')}>
            <path
              d="   M 479.86 75.22   L 397.44 75.17"
              stroke="#ce8a43"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-30" onClick={() => handleClick('item-30')}>
            <path
              d="   M 484.33 0.00   L 484.43 75.18"
              stroke="#b77432"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-31" onClick={() => handleClick('item-31')}>
            <path
              d="   M 484.43 75.18   L 479.86 75.22"
              stroke="#c7843f"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-32" onClick={() => handleClick('item-32')}>
            <path
              d="   M 553.96 0.00   Q 553.71 4.02 553.71 8.05   Q 553.71 36.75 553.84 65.44   Q 553.86 68.93 554.31 75.31"
              stroke="#b77432"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-33" onClick={() => handleClick('item-33')}>
            <path
              d="   M 554.31 75.31   L 484.43 75.18"
              stroke="#ce8a43"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-34" onClick={() => handleClick('item-34')}>
            <path
              d="   M 556.98 0.00   Q 557.89 3.34 557.92 5.33   Q 558.42 40.07 558.01 75.05"
              stroke="#b77432"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-35" onClick={() => handleClick('item-35')}>
            <path
              d="   M 558.01 75.05   L 554.31 75.31"
              stroke="#c7843f"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-36" onClick={() => handleClick('item-36')}>
            <path
              d="   M 601.92 0.00   L 601.58 75.16"
              stroke="#b77432"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-37" onClick={() => handleClick('item-37')}>
            <path
              d="   M 601.58 75.16   L 558.01 75.05"
              stroke="#ce8a43"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-38" onClick={() => handleClick('item-38')}>
            <path
              d="   M 604.77 0.00   Q 606.12 1.62 606.15 5.87   Q 606.30 24.45 606.27 32.80   Q 606.19 51.48 606.47 70.14   Q 606.51 72.55 606.95 75.03"
              stroke="#b77432"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-39" onClick={() => handleClick('item-39')}>
            <path
              d="   M 606.95 75.03   Q 604.39 75.68 601.58 75.16"
              stroke="#c7843f"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-40" onClick={() => handleClick('item-40')}>
            <path
              d="   M 658.00 0.00   L 657.72 75.11"
              stroke="#b77432"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-41" onClick={() => handleClick('item-41')}>
            <path
              d="   M 657.72 75.11   L 606.95 75.03"
              stroke="#ce8a43"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-42" onClick={() => handleClick('item-42')}>
            <path
              d="   M 662.46 0.00   L 662.56 75.14"
              stroke="#b77432"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-43" onClick={() => handleClick('item-43')}>
            <path
              d="   M 662.56 75.14   Q 660.07 75.58 657.72 75.11"
              stroke="#c7843f"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-44" onClick={() => handleClick('item-44')}>
            <path
              d="   M 706.53 0.00   Q 705.26 3.46 705.22 7.09   Q 704.85 37.27 705.09 67.45   Q 705.12 70.51 706.29 75.21"
              stroke="#b77432"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-45" onClick={() => handleClick('item-45')}>
            <path
              d="   M 706.29 75.21   L 662.56 75.14"
              stroke="#ce8a43"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-46" onClick={() => handleClick('item-46')}>
            <path
              d="   M 709.13 0.00   Q 709.55 5.21 709.63 10.42   Q 710.04 40.32 709.80 70.22   Q 709.79 72.47 710.06 75.12"
              stroke="#b77432"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-47" onClick={() => handleClick('item-47')}>
            <path
              d="   M 710.06 75.12   L 706.29 75.21"
              stroke="#c7843f"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-48" onClick={() => handleClick('item-48')}>
            <path
              d="   M 769.95 0.00   C 769.52 2.40 769.13 4.77 769.07 7.27   Q 768.26 41.23 769.58 75.26"
              stroke="#b77432"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-49" onClick={() => handleClick('item-49')}>
            <path
              d="   M 769.58 75.26   L 710.06 75.12"
              stroke="#ce8a43"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-50" onClick={() => handleClick('item-50')}>
            <path
              d="   M 773.20 0.00   Q 773.71 3.63 773.70 5.74   Q 773.52 40.37 773.64 75.07"
              stroke="#b77432"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-51" onClick={() => handleClick('item-51')}>
            <path
              d="   M 773.64 75.07   L 769.58 75.26"
              stroke="#c7843f"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-52" onClick={() => handleClick('item-52')}>
            <path
              d="   M 829.64 0.00   Q 827.00 8.83 827.66 21.75   Q 828.24 33.07 827.85 67.99   Q 827.81 71.44 827.26 75.08"
              stroke="#b77432"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-53" onClick={() => handleClick('item-53')}>
            <path
              d="   M 827.26 75.08   L 773.64 75.07"
              stroke="#ce8a43"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-54" onClick={() => handleClick('item-54')}>
            <path
              d="   M 832.26 0.00   L 833.03 75.16"
              stroke="#b77432"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-55" onClick={() => handleClick('item-55')}>
            <path
              d="   M 833.03 75.16   Q 830.14 75.66 827.26 75.08"
              stroke="#c7843f"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-56" onClick={() => handleClick('item-56')}>
            <path
              d="   M 879.69 0.00   L 879.78 75.25"
              stroke="#b77432"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-57" onClick={() => handleClick('item-57')}>
            <path
              d="   M 879.78 75.25   L 833.03 75.16"
              stroke="#ce8a43"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-58" onClick={() => handleClick('item-58')}>
            <path
              d="   M 884.03 0.00   L 884.17 75.17"
              stroke="#b77432"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-59" onClick={() => handleClick('item-59')}>
            <path
              d="   M 884.17 75.17   Q 882.28 75.66 879.78 75.25"
              stroke="#c7843f"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-60" onClick={() => handleClick('item-60')}>
            <path
              d="   M 958.48 0.00   Q 957.76 3.62 957.72 5.27   Q 957.13 37.24 957.17 69.21   Q 957.18 72.03 956.79 75.00"
              stroke="#b77432"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-61" onClick={() => handleClick('item-61')}>
            <path
              d="   M 956.79 75.00   L 884.17 75.17"
              stroke="#ce8a43"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-62" onClick={() => handleClick('item-62')}>
            <path
              d="   M 960.99 0.00   Q 961.95 4.33 961.94 8.77   Q 961.90 37.26 961.86 65.74   Q 961.85 70.34 961.56 75.05"
              stroke="#b77432"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-63" onClick={() => handleClick('item-63')}>
            <path
              d="   M 961.56 75.05   L 956.79 75.00"
              stroke="#c7843f"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-64" onClick={() => handleClick('item-64')}>
            <path
              d="   M 1035.39 0.00   C 1035.18 2.49 1034.86 5.05 1034.84 7.51   Q 1034.69 37.09 1034.67 66.67   Q 1034.67 71.26 1036.31 75.30"
              stroke="#b77432"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-65" onClick={() => handleClick('item-65')}>
            <path
              d="   M 1036.31 75.30   L 961.56 75.05"
              stroke="#ce8a43"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-66" onClick={() => handleClick('item-66')}>
            <path
              d="   M 1038.63 0.00   Q 1039.57 7.71 1039.58 10.89   Q 1039.70 42.96 1039.28 75.20"
              stroke="#b77432"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-67" onClick={() => handleClick('item-67')}>
            <path
              d="   M 1039.28 75.20   Q 1037.15 74.91 1036.31 75.30"
              stroke="#c7843f"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-68" onClick={() => handleClick('item-68')}>
            <path
              d="   M 1084.26 0.00   Q 1083.86 3.51 1083.81 7.04   Q 1083.36 41.09 1084.04 75.22"
              stroke="#b77432"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-69" onClick={() => handleClick('item-69')}>
            <path
              d="   M 1084.04 75.22   L 1039.28 75.20"
              stroke="#ce8a43"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-70" onClick={() => handleClick('item-70')}>
            <path
              d="   M 1087.66 0.00   Q 1087.94 3.04 1087.95 6.09   Q 1088.02 25.92 1088.24 45.75   Q 1088.41 60.52 1087.57 75.11"
              stroke="#b77432"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-71" onClick={() => handleClick('item-71')}>
            <path
              d="   M 1087.57 75.11   L 1084.04 75.22"
              stroke="#c7843f"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-72" onClick={() => handleClick('item-72')}>
            <path
              d="   M 1145.96 0.00   L 1145.92 75.34"
              stroke="#b77432"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-73" onClick={() => handleClick('item-73')}>
            <path
              d="   M 1145.92 75.34   L 1087.57 75.11"
              stroke="#ce8a43"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-74" onClick={() => handleClick('item-74')}>
            <path
              d="   M 1150.25 0.00   Q 1150.37 30.49 1150.50 60.98   Q 1150.52 68.15 1149.22 75.25"
              stroke="#b77432"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-75" onClick={() => handleClick('item-75')}>
            <path
              d="   M 1149.22 75.25   L 1145.92 75.34"
              stroke="#c7843f"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-76" onClick={() => handleClick('item-76')}>
            <path
              d="   M 1293.20 0.00   Q 1292.67 5.07 1292.72 10.25   Q 1292.94 36.37 1292.77 62.49   Q 1292.72 69.07 1293.35 75.22"
              stroke="#b77432"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-77" onClick={() => handleClick('item-77')}>
            <path
              d="   M 1293.35 75.22   L 1220.09 75.12"
              stroke="#ce8a43"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-78" onClick={() => handleClick('item-78')}>
            <path
              d="   M 1220.09 75.12   L 1219.86 1.68   A 1.40 1.37 23.0 0 0 1219.45 0.70   Q 1218.27 -0.48 1216.40 0.55   A 1.01 1.01 0.0 0 0 1215.86 1.46   L 1215.97 75.13"
              stroke="#b77432"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-79" onClick={() => handleClick('item-79')}>
            <path
              d="   M 1215.97 75.13   L 1149.22 75.25"
              stroke="#ce8a43"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-80" onClick={() => handleClick('item-80')}>
            <path
              d="   M 1296.92 0.00   Q 1297.41 3.74 1297.38 7.56   Q 1297.17 33.77 1297.08 59.99   Q 1297.06 67.57 1297.18 75.08"
              stroke="#b77432"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-81" onClick={() => handleClick('item-81')}>
            <path
              d="   M 1297.18 75.08   Q 1295.84 75.45 1293.35 75.22"
              stroke="#c7843f"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-82" onClick={() => handleClick('item-82')}>
            <path
              d="   M 1345.17 0.00   L 1345.02 75.31"
              stroke="#b77432"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-83" onClick={() => handleClick('item-83')}>
            <path
              d="   M 1345.02 75.31   L 1297.18 75.08"
              stroke="#ce8a43"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-84" onClick={() => handleClick('item-84')}>
            <path
              d="   M 1349.62 0.00   L 1349.61 75.09"
              stroke="#b77432"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-85" onClick={() => handleClick('item-85')}>
            <path
              d="   M 1349.61 75.09   L 1345.02 75.31"
              stroke="#c7843f"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-86" onClick={() => handleClick('item-86')}>
            <path
              d="   M 1441.40 0.00   Q 1441.00 4.17 1440.99 6.31   Q 1440.89 40.79 1440.84 75.30"
              stroke="#b77432"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-87" onClick={() => handleClick('item-87')}>
            <path
              d="   M 1440.84 75.30   L 1349.61 75.09"
              stroke="#ce8a43"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-88" onClick={() => handleClick('item-88')}>
            <path
              d="   M 1445.00 0.00   Q 1445.77 5.49 1445.78 6.91   Q 1445.82 32.09 1445.93 57.27   Q 1445.97 68.90 1444.46 78.61"
              stroke="#b77432"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-89" onClick={() => handleClick('item-89')}>
            <path
              d="   M 1444.46 78.61   Q 1443.01 76.20 1440.84 75.30"
              stroke="#c7843f"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-90" onClick={() => handleClick('item-90')}>
            <path
              d="   M 1508.50 0.00   L 1508.29 185.68   A 1.15 1.14 -89.5 0 1 1507.14 186.82   Q 1479.57 186.73 1451.06 186.94   Q 1449.48 186.95 1444.82 187.44"
              stroke="#b77432"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-91" onClick={() => handleClick('item-91')}>
            <path
              d="   M 1444.82 187.44   L 1444.46 78.61"
              stroke="#ce8a43"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-92" onClick={() => handleClick('item-92')}>
            <path
              d="   M 1512.93 0.00   C 1513.27 3.07 1513.62 6.24 1513.56 9.31   C 1513.04 34.21 1513.70 55.83 1513.42 80.19   C 1513.08 108.59 1513.82 129.18 1513.32 156.95   Q 1513.17 164.98 1513.27 188.22   Q 1513.45 230.52 1513.38 312.39   Q 1513.36 326.25 1513.43 328.14   C 1513.91 341.51 1513.38 353.77 1513.47 367.40   C 1513.64 392.49 1513.98 415.69 1513.55 438.42   C 1513.10 462.30 1513.72 480.68 1513.46 509.16   C 1513.27 531.11 1513.61 564.78 1513.40 594.60   Q 1513.32 606.30 1513.44 626.24   A 0.35 0.35 0.0 0 0 1513.83 626.59   C 1520.80 625.96 1529.30 625.42 1536.00 627.75"
              stroke="#b77432"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-93" onClick={() => handleClick('item-93')}>
            <path
              d="   M 1536.00 631.22   C 1528.76 632.20 1521.30 631.85 1514.41 632.09   A 1.34 1.34 0.0 0 0 1513.11 633.44   L 1513.75 895.09"
              stroke="#b77432"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-94" onClick={() => handleClick('item-94')}>
            <path
              d="   M 1513.75 895.09   Q 1510.76 895.57 1507.54 894.91"
              stroke="#c7843f"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-95" onClick={() => handleClick('item-95')}>
            <path
              d="   M 1507.54 894.91   C 1509.25 885.31 1508.04 875.35 1508.20 865.51   Q 1508.78 830.11 1508.27 801.04   A 1.09 1.08 -0.3 0 0 1507.18 799.97   L 1445.64 799.97   A 0.60 0.59 90.0 0 1 1445.05 799.37   L 1445.05 794.67   A 0.59 0.58 -87.8 0 1 1445.68 794.08   Q 1455.80 794.73 1461.89 794.64   Q 1485.12 794.30 1507.02 794.61   A 1.36 1.36 0.0 0 0 1508.40 793.24   C 1508.07 748.19 1508.50 699.18 1508.39 651.63   Q 1508.37 642.64 1508.85 633.02   A 1.09 1.08 -88.7 0 0 1507.77 631.88   L 1445.51 631.88   A 0.61 0.61 0.0 0 1 1444.90 631.27   L 1444.90 626.86   A 0.98 0.97 -88.3 0 1 1445.93 625.88   Q 1461.42 626.71 1480.17 626.24   C 1489.46 626.00 1496.80 626.29 1507.48 626.31   A 0.95 0.95 0.0 0 0 1508.43 625.36   L 1508.43 420.54   A 0.83 0.83 0.0 0 0 1507.58 419.71   Q 1485.44 420.27 1454.06 420.09   C 1451.49 420.07 1447.94 420.51 1445.80 420.62   A 0.78 0.77 88.6 0 1 1444.99 419.84   L 1444.99 415.45   A 0.67 0.67 0.0 0 1 1445.67 414.78   Q 1465.77 415.00 1488.94 414.62   C 1494.10 414.54 1501.43 414.91 1507.47 415.41   A 0.83 0.83 0.0 0 0 1508.37 414.58   L 1508.37 193.71   A 0.95 0.95 0.0 0 0 1507.42 192.76   L 1444.73 192.58"
              stroke="#b77432"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-96" onClick={() => handleClick('item-96')}>
            <path
              d="   M 1444.73 192.58   L 1444.82 187.44"
              stroke="#c7843f"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-97" onClick={() => handleClick('item-97')}>
            <path
              d="   M 318.19 75.05   L 312.85 75.20"
              stroke="#c7843f"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-98" onClick={() => handleClick('item-98')}>
            <path
              d="   M 1220.09 75.12   L 1215.97 75.13"
              stroke="#c7843f"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-99" onClick={() => handleClick('item-99')}>
            <path
              d="   M 1444.73 192.58   Q 1444.71 210.86 1444.63 229.25   C 1444.48 262.87 1444.81 296.75 1444.62 330.13   C 1444.52 349.23 1444.96 365.67 1444.75 382.09   C 1444.64 390.70 1445.01 399.54 1444.79 409.43   Q 1444.54 420.66 1444.63 425.59   Q 1444.69 429.28 1444.70 451.25   Q 1444.70 451.72 1444.61 557.96   C 1444.59 581.12 1445.01 602.42 1444.80 624.25   C 1444.78 626.19 1444.39 627.89 1444.62 629.71   Q 1444.83 631.37 1444.82 633.82   Q 1444.54 710.03 1444.74 770.59   C 1444.77 777.74 1445.16 782.52 1444.92 788.24   Q 1444.59 795.85 1444.69 801.47   Q 1445.02 820.80 1444.60 854.06   C 1444.42 868.10 1444.90 881.26 1444.42 893.77   A 0.99 0.98 8.4 0 0 1445.16 894.76   C 1449.01 895.73 1452.72 895.12 1457.18 895.11   Q 1482.36 895.02 1507.54 894.91"
              stroke="#ce8a43"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-100" onClick={() => handleClick('item-100')}>
            <path
              d="   M 1513.75 895.09   Q 1525.81 894.80 1535.01 895.45   Q 1535.59 895.49 1535.20 896.14"
              stroke="#ce8a43"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-101" onClick={() => handleClick('item-101')}>
            <path
              d="   M 1535.20 896.14   L 1443.95 895.97   A 0.39 0.39 0.0 0 1 1443.56 895.57   Q 1443.61 652.63 1443.55 80.75   Q 1443.54 76.44 1438.75 76.39   Q 1423.69 76.25 1401.50 76.25   Q 1261.41 76.26 50.84 76.24   C 45.93 76.24 44.16 76.52 44.69 81.98"
              stroke="#805c35"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-102" onClick={() => handleClick('item-102')}>
            <path
              d="   M 1535.20 896.14   Q 1535.46 896.34 1536.00 896.25"
              stroke="#704b28"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-103" onClick={() => handleClick('item-103')}>
            <path
              d="   M 1536.00 902.75   L 1444.07 902.81   A 0.52 0.51 90.0 0 0 1443.56 903.33   L 1443.56 939.40   A 0.51 0.51 0.0 0 0 1444.07 939.91   L 1536.00 939.87"
              stroke="#4e2f1b"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-104" onClick={() => handleClick('item-104')}>
            <path
              d="   M 1536.00 946.44   L 1444.40 946.44   A 0.69 0.69 0.0 0 0 1443.74 946.93   Q 1443.27 948.44 1443.31 950.63   Q 1443.49 962.06 1443.32 981.25   C 1443.28 984.91 1442.53 986.42 1438.75 986.44   Q 1423.00 986.54 1410.50 986.53   Q 1407.00 986.52 1404.08 985.89   A 2.43 2.38 72.2 0 1 1402.94 985.29   L 1399.86 982.42"
              stroke="#232c38"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-105" onClick={() => handleClick('item-105')}>
            <path
              d="   M 1399.86 982.42   Q 1377.18 964.54 1353.77 948.06   C 1350.76 945.94 1349.01 945.35 1345.50 945.44   Q 1334.32 945.76 1319.37 945.66   C 1307.26 945.59 1295.68 946.07 1285.00 945.78   Q 1272.82 945.46 1206.09 945.80   A 1.60 1.60 0.0 0 0 1204.50 947.41   L 1204.82 982.97"
              stroke="#1c2630"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-106" onClick={() => handleClick('item-106')}>
            <path
              d="   M 1204.82 982.97   Q 1204.93 984.37 1204.09 985.53   A 1.36 1.34 11.6 0 1 1203.29 986.05   Q 1201.51 986.42 1199.50 986.44   C 1184.98 986.57 1177.74 987.16 1170.07 986.06   A 2.00 1.92 66.6 0 1 1169.16 985.68   Q 1166.95 984.03 1166.24 982.13"
              stroke="#232c38"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-107" onClick={() => handleClick('item-107')}>
            <path
              d="   M 1166.24 982.13   L 1134.40 947.37   A 5.18 5.18 0.0 0 0 1130.58 945.69   L 937.10 945.69   A 2.34 2.34 0.0 0 0 934.76 948.03   L 934.76 983.54"
              stroke="#1c2630"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-108" onClick={() => handleClick('item-108')}>
            <path
              d="   M 934.76 983.54   Q 933.70 986.58 930.00 986.48   Q 922.76 986.27 911.25 986.48   Q 906.01 986.57 902.75 986.52   Q 900.99 986.50 899.37 985.87   A 1.93 1.91 -8.9 0 1 898.61 985.32   L 896.36 982.69"
              stroke="#232c38"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-109" onClick={() => handleClick('item-109')}>
            <path
              d="   M 896.36 982.69   L 879.88 947.10   A 2.47 2.46 -12.3 0 0 877.64 945.67   L 673.17 945.67   A 2.72 2.72 0.0 0 0 670.72 947.21   L 653.58 982.95"
              stroke="#1c2630"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-110" onClick={() => handleClick('item-110')}>
            <path
              d="   M 653.58 982.95   Q 652.13 986.50 648.51 986.49   Q 636.68 986.47 622.75 986.51   C 620.22 986.52 615.75 986.82 615.39 983.04"
              stroke="#232c38"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-111" onClick={() => handleClick('item-111')}>
            <path
              d="   M 615.39 983.04   L 615.17 946.31   A 0.66 0.66 0.0 0 0 614.51 945.65   L 418.09 945.65   A 4.53 4.51 21.3 0 0 414.77 947.10   L 381.79 982.68"
              stroke="#1c2630"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-112" onClick={() => handleClick('item-112')}>
            <path
              d="   M 381.79 982.68   Q 380.94 984.10 379.33 985.25   Q 377.62 986.46 375.53 986.48   Q 361.13 986.64 346.50 986.49   Q 342.50 986.45 342.97 982.85"
              stroke="#232c38"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-113" onClick={() => handleClick('item-113')}>
            <path
              d="   M 342.97 982.85   L 343.07 946.85   A 1.06 1.05 -88.9 0 0 342.06 945.79   Q 336.60 945.57 330.70 945.62   C 313.63 945.75 295.66 945.46 285.13 945.82   Q 283.01 945.89 271.32 945.70   Q 259.78 945.51 257.50 945.61   Q 256.86 945.64 235.75 945.66   Q 186.83 945.72 174.09 945.57   C 164.13 945.45 156.37 945.66 142.75 945.46   Q 140.66 945.42 137.79 946.07   A 5.29 5.27 17.2 0 0 135.31 947.37   C 130.93 951.46 126.07 954.63 121.90 957.77   Q 105.76 969.96 89.53 982.32"
              stroke="#1c2630"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-114" onClick={() => handleClick('item-114')}>
            <path
              d="   M 89.53 982.32   L 86.28 985.16   A 5.39 5.39 0.0 0 1 82.79 986.49   Q 61.07 986.68 47.77 986.36   C 44.47 986.28 44.47 982.51 44.48 980.25   Q 44.49 973.29 44.69 948.76   Q 44.71 946.42 42.50 946.44   Q 21.25 946.63 0.00 946.74"
              stroke="#232c38"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-115" onClick={() => handleClick('item-115')}>
            <path
              d="   M 0.00 940.51   L 0.24 939.65"
              stroke="#694624"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-116" onClick={() => handleClick('item-116')}>
            <path
              d="   M 0.24 939.65   Q 0.89 940.05 1.24 940.05   Q 19.59 940.00 43.80 940.00   A 0.91 0.91 0.0 0 0 44.71 939.09   L 44.71 903.92   A 1.18 1.17 90.0 0 0 43.54 902.74   L 0.31 902.83"
              stroke="#4e2f1b"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-117" onClick={() => handleClick('item-117')}>
            <path
              d="   M 0.31 902.83   L 0.00 901.58"
              stroke="#704b28"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-118" onClick={() => handleClick('item-118')}>
            <path
              d="   M 96.29 111.92   L 347.39 112.27   A 1.82 1.82 0.0 0 1 349.21 114.09   L 349.44 975.79"
              stroke="#744e2a"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-119" onClick={() => handleClick('item-119')}>
            <path
              d="   M 349.44 975.79   Q 349.11 977.95 349.44 979.46   A 0.67 0.66 -6.5 0 0 350.09 979.97   L 373.71 979.97   A 0.43 0.42 90.0 0 0 374.13 979.54   L 374.09 113.79"
              stroke="#805c35"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-120" onClick={() => handleClick('item-120')}>
            <path
              d="   M 374.09 113.79   Q 374.50 112.23 376.22 112.18   Q 385.65 111.92 391.50 111.92   Q 504.00 111.91 616.50 111.93   C 618.07 111.93 620.82 111.85 621.60 113.30"
              stroke="#744e2a"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-121" onClick={() => handleClick('item-121')}>
            <path
              d="   M 621.60 113.30   L 621.68 979.75   A 0.22 0.21 0.0 0 0 621.90 979.96   L 645.76 979.99"
              stroke="#805c35"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-122" onClick={() => handleClick('item-122')}>
            <path
              d="   M 645.76 979.99   L 646.24 113.41   A 1.08 1.08 0.0 0 1 647.20 112.34   Q 649.66 112.06 656.00 112.05   Q 813.56 111.92 899.50 111.84   Q 902.74 111.84 904.59 113.01"
              stroke="#744e2a"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-123" onClick={() => handleClick('item-123')}>
            <path
              d="   M 904.59 113.01   L 904.88 979.39   A 0.60 0.60 0.0 0 0 905.48 979.99   L 928.03 979.99   A 0.54 0.53 90.0 0 0 928.56 979.45   L 928.72 113.96"
              stroke="#805c35"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-124" onClick={() => handleClick('item-124')}>
            <path
              d="   M 928.72 113.96   Q 928.45 112.04 931.24 112.04   Q 935.21 112.03 940.37 112.03   Q 1134.08 111.83 1167.75 112.11   Q 1171.74 112.15 1172.93 112.41   A 1.42 1.41 -83.6 0 1 1174.03 113.79   L 1174.03 979.29   A 0.72 0.72 0.0 0 0 1174.75 980.01   L 1198.36 980.01   A 0.27 0.26 0.0 0 0 1198.63 979.75   L 1198.63 113.09   A 0.78 0.78 0.0 0 1 1199.33 112.31   Q 1200.99 112.12 1208.50 112.08   Q 1226.95 111.97 1404.25 111.94   Q 1406.90 111.94 1408.29 113.24"
              stroke="#744e2a"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-125" onClick={() => handleClick('item-125')}>
            <path
              d="   M 1408.29 113.24   L 1408.40 979.49   A 0.50 0.49 0.0 0 0 1408.90 979.98   L 1436.74 979.98   A 0.41 0.41 0.0 0 0 1437.15 979.57   L 1437.15 82.96   A 0.23 0.22 -90.0 0 0 1436.93 82.73   L 51.35 82.73   A 0.33 0.32 90.0 0 0 51.03 83.06   L 51.03 979.37   A 0.63 0.63 0.0 0 0 51.66 980.00   L 80.50 980.00   A 0.64 0.64 0.0 0 0 81.14 979.36   L 81.14 113.32   A 1.18 1.18 0.0 0 1 82.30 112.14   L 96.29 111.92"
              stroke="#805c35"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-126" onClick={() => handleClick('item-126')}>
            <path
              d="   M 1408.29 113.24   Q 1409.58 112.67 1409.68 115.94   Q 1410.00 126.13 1410.00 131.00   Q 1410.02 382.18 1409.97 927.95   Q 1409.97 963.93 1409.76 973.58   Q 1409.71 975.70 1409.38 977.83   A 1.00 1.00 0.0 0 0 1410.37 978.98   L 1435.18 978.98   A 1.02 1.01 90.0 0 0 1436.19 977.96   L 1436.19 84.81   A 1.00 1.00 0.0 0 0 1435.19 83.81   L 52.46 83.81   A 0.42 0.42 0.0 0 0 52.04 84.23   Q 51.93 373.72 51.90 749.75   Q 51.90 775.07 51.90 800.50   Q 51.94 952.68 51.89 952.74   Q 51.79 952.87 52.01 963.31   Q 52.17 970.95 51.65 977.97   A 0.93 0.92 -87.7 0 0 52.57 978.97   L 79.37 978.97   A 0.97 0.97 0.0 0 0 80.34 978.06   C 80.48 976.16 80.14 974.44 80.14 972.63   Q 80.30 820.97 80.10 790.50   C 80.04 781.30 80.18 776.05 80.19 769.17   Q 80.31 727.57 80.08 199.50   Q 80.07 175.74 80.10 115.28   Q 80.10 111.21 84.07 111.06   Q 92.34 110.76 96.09 110.86   A 0.48 0.48 0.0 0 1 96.49 111.59   L 96.29 111.92"
              stroke="#d28d45"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-127" onClick={() => handleClick('item-127')}>
            <path
              d="   M 928.72 113.96   Q 927.49 116.93 927.31 121.44   Q 927.04 128.23 927.01 137.50   Q 926.79 198.73 927.26 261.17   C 927.36 274.24 926.69 285.14 927.04 297.24   Q 927.26 304.96 927.12 324.35   Q 926.89 356.19 927.15 433.66   Q 927.38 500.90 927.31 636.93   Q 927.28 708.02 927.16 763.81   Q 927.15 770.28 927.36 774.53   C 927.81 783.45 927.05 791.85 927.06 801.30   Q 927.11 826.46 927.01 882.41   C 926.96 912.62 927.38 939.00 927.29 968.76   Q 927.28 970.48 927.47 977.43   A 1.45 1.45 0.0 0 1 926.02 978.92   L 907.02 978.92   A 1.41 1.41 0.0 0 1 905.61 977.45   Q 905.82 972.61 905.83 968.51   Q 906.07 895.10 905.74 853.08   Q 905.70 847.47 905.71 846.72   Q 906.20 819.16 905.65 766.42   Q 905.63 764.32 905.84 756.62   Q 905.94 752.95 905.88 746.80   Q 905.62 722.17 905.75 660.93   Q 905.86 606.36 905.93 539.75   Q 905.97 506.51 905.81 473.23   C 905.71 451.95 906.04 430.34 905.83 412.33   C 905.68 399.89 905.96 388.12 905.87 375.01   Q 905.77 360.63 905.82 347.01   Q 906.06 285.35 905.73 265.25   Q 905.60 257.66 905.74 248.74   C 905.99 231.96 905.89 216.71 905.78 205.75   C 905.72 199.86 906.05 194.59 905.94 188.47   Q 905.59 169.40 905.86 154.41   C 906.12 140.25 905.86 130.22 905.84 114.77   Q 905.84 113.80 904.59 113.01"
              stroke="#d28d45"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-128" onClick={() => handleClick('item-128')}>
            <path
              d="   M 645.76 979.99   Q 646.02 978.68 645.51 978.68   C 644.67 978.69 643.88 979.00 643.13 979.00   Q 633.29 978.92 623.90 979.00   A 1.00 1.00 0.0 0 1 622.89 978.00   Q 622.97 913.24 622.91 865.75   Q 622.89 844.75 622.89 759.56   Q 622.89 742.09 622.92 736.25   Q 622.97 724.41 622.90 642.25   C 622.86 584.82 623.20 510.07 622.77 474.82   Q 622.70 469.15 622.88 452.61   C 623.12 430.83 622.85 407.94 622.91 387.25   Q 623.02 349.53 622.89 319.09   Q 622.88 316.61 622.89 309.84   Q 622.99 207.46 622.88 117.00   Q 622.88 116.10 622.40 113.41   A 0.37 0.37 0.0 0 0 622.01 113.11   Q 621.78 113.12 621.60 113.30"
              stroke="#d28d45"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-129" onClick={() => handleClick('item-129')}>
            <path
              d="   M 374.09 113.79   L 373.75 113.85   A 0.47 0.46 85.7 0 0 373.36 114.31   L 373.36 978.16   A 0.92 0.91 -88.8 0 1 372.41 979.08   Q 362.63 978.73 351.86 979.16   Q 350.07 979.24 349.44 975.79"
              stroke="#d28d45"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-130" onClick={() => handleClick('item-130')}>
            <path
              d="   M 343.14 118.75   A 0.31 0.31 0.0 0 0 342.83 118.44   L 92.45 118.44   A 0.31 0.31 0.0 0 0 92.24 118.98   L 123.37 146.88   A 0.31 0.31 0.0 0 0 123.58 146.96   L 342.83 146.96   A 0.31 0.31 0.0 0 0 343.14 146.65   L 343.14 118.75"
              stroke="#4e2f1b"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-131" onClick={() => handleClick('item-131')}>
            <path
              d="   M 615.38 118.77   A 0.34 0.34 0.0 0 0 615.04 118.43   L 385.38 118.43   A 0.34 0.34 0.0 0 0 385.12 118.99   L 408.44 146.83   A 0.34 0.34 0.0 0 0 408.70 146.95   L 615.04 146.95   A 0.34 0.34 0.0 0 0 615.38 146.61   L 615.38 118.77"
              stroke="#4e2f1b"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-132" onClick={() => handleClick('item-132')}>
            <path
              d="   M 671.19 146.70   A 0.47 0.47 0.0 0 0 671.60 146.95   L 879.71 146.95   A 0.47 0.47 0.0 0 0 880.12 146.70   L 895.12 119.11   A 0.47 0.47 0.0 0 0 894.71 118.42   L 656.60 118.42   A 0.47 0.47 0.0 0 0 656.19 119.11   L 671.19 146.70"
              stroke="#4e2f1b"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-133" onClick={() => handleClick('item-133')}>
            <path
              d="   M 935.06 146.63   A 0.31 0.31 0.0 0 0 935.37 146.94   L 1141.42 146.94   A 0.31 0.31 0.0 0 0 1141.66 146.83   L 1164.60 118.94   A 0.31 0.31 0.0 0 0 1164.36 118.43   L 935.37 118.43   A 0.31 0.31 0.0 0 0 935.06 118.74   L 935.06 146.63"
              stroke="#4e2f1b"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-134" onClick={() => handleClick('item-134')}>
            <path
              d="   M 1204.90 146.47   A 0.47 0.47 0.0 0 0 1205.37 146.94   L 1368.52 146.94   A 0.47 0.47 0.0 0 0 1368.85 146.81   L 1398.20 119.24   A 0.47 0.47 0.0 0 0 1397.88 118.43   L 1205.37 118.43   A 0.47 0.47 0.0 0 0 1204.90 118.90   L 1204.90 146.47"
              stroke="#4e2f1b"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-135" onClick={() => handleClick('item-135')}>
            <path
              d="   M 120.16 249.75   A 0.33 0.33 0.0 0 0 120.49 249.42   L 120.49 153.21   A 0.33 0.33 0.0 0 0 120.38 152.96   L 88.41 124.31   A 0.33 0.33 0.0 0 0 87.86 124.56   L 87.86 249.42   A 0.33 0.33 0.0 0 0 88.19 249.75   L 120.16 249.75"
              stroke="#4e2f1b"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-136" onClick={() => handleClick('item-136')}>
            <path
              d="   M 404.54 249.76   A 0.31 0.31 0.0 0 0 404.85 249.45   L 404.85 152.68   A 0.31 0.31 0.0 0 0 404.78 152.48   L 381.00 124.10   A 0.31 0.31 0.0 0 0 380.45 124.30   L 380.45 249.45   A 0.31 0.31 0.0 0 0 380.76 249.76   L 404.54 249.76"
              stroke="#4e2f1b"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-137" onClick={() => handleClick('item-137')}>
            <path
              d="   M 1401.60 249.76   A 0.31 0.31 0.0 0 0 1401.91 249.45   L 1401.91 125.68   A 0.31 0.31 0.0 0 0 1401.39 125.45   L 1371.53 153.50   A 0.31 0.31 0.0 0 0 1371.43 153.72   L 1371.43 249.45   A 0.31 0.31 0.0 0 0 1371.74 249.76   L 1401.60 249.76"
              stroke="#4e2f1b"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-138" onClick={() => handleClick('item-138')}>
            <path
              d="   M 1167.77 126.36   A 0.38 0.38 0.0 0 0 1167.10 126.12   Q 1153.74 142.42 1147.37 150.12   Q 1145.25 152.68 1145.26 156.25   Q 1145.31 223.97 1145.22 248.90   A 0.90 0.90 0.0 0 0 1146.12 249.80   L 1167.29 249.80   A 0.48 0.48 0.0 0 0 1167.77 249.32   L 1167.77 126.36"
              stroke="#4e2f1b"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-139" onClick={() => handleClick('item-139')}>
            <path
              d="   M 665.91 249.71   A 0.34 0.34 0.0 0 0 666.25 249.37   L 666.25 151.46   A 0.34 0.34 0.0 0 0 666.21 151.29   L 652.96 126.93   A 0.34 0.34 0.0 0 0 652.32 127.10   L 652.32 249.37   A 0.34 0.34 0.0 0 0 652.66 249.71   L 665.91 249.71"
              stroke="#4e2f1b"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-140" onClick={() => handleClick('item-140')}>
            <path
              d="   M 897.83 249.66   A 0.49 0.49 0.0 0 0 898.32 249.17   L 898.32 129.25   A 0.49 0.49 0.0 0 0 897.40 129.01   L 884.81 152.16   A 0.49 0.49 0.0 0 0 884.75 152.39   L 884.75 249.17   A 0.49 0.49 0.0 0 0 885.24 249.66   L 897.83 249.66"
              stroke="#4e2f1b"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-141" onClick={() => handleClick('item-141')}>
            <path
              d="   M 343.06 153.79   A 0.60 0.60 0.0 0 0 342.46 153.19   L 127.68 153.19   A 0.60 0.60 0.0 0 0 127.08 153.79   L 127.08 249.15   A 0.60 0.60 0.0 0 0 127.68 249.75   L 342.46 249.75   A 0.60 0.60 0.0 0 0 343.06 249.15   L 343.06 153.79"
              stroke="#57351d"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-142" onClick={() => handleClick('item-142')}>
            <path
              d="   M 615.38 153.94   A 0.77 0.77 0.0 0 0 614.61 153.17   L 412.03 153.17   A 0.77 0.77 0.0 0 0 411.26 153.94   L 411.26 248.96   A 0.77 0.77 0.0 0 0 412.03 249.73   L 614.61 249.73   A 0.77 0.77 0.0 0 0 615.38 248.96   L 615.38 153.94"
              stroke="#57351d"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-143" onClick={() => handleClick('item-143')}>
            <path
              d="   M 878.35 153.76   A 0.56 0.56 0.0 0 0 877.79 153.20   L 673.43 153.20   A 0.56 0.56 0.0 0 0 672.87 153.76   L 672.87 249.20   A 0.56 0.56 0.0 0 0 673.43 249.76   L 877.79 249.76   A 0.56 0.56 0.0 0 0 878.35 249.20   L 878.35 153.76"
              stroke="#57351d"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-144" onClick={() => handleClick('item-144')}>
            <path
              d="   M 1138.84 153.93   A 0.74 0.74 0.0 0 0 1138.10 153.19   L 935.76 153.19   A 0.74 0.74 0.0 0 0 935.02 153.93   L 935.02 248.99   A 0.74 0.74 0.0 0 0 935.76 249.73   L 1138.10 249.73   A 0.74 0.74 0.0 0 0 1138.84 248.99   L 1138.84 153.93"
              stroke="#57351d"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-145" onClick={() => handleClick('item-145')}>
            <path
              d="   M 1365.01 154.06   A 0.87 0.87 0.0 0 0 1364.14 153.19   L 1205.80 153.19   A 0.87 0.87 0.0 0 0 1204.93 154.06   L 1204.93 248.86   A 0.87 0.87 0.0 0 0 1205.80 249.73   L 1364.14 249.73   A 0.87 0.87 0.0 0 0 1365.01 248.86   L 1365.01 154.06"
              stroke="#57351d"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-146" onClick={() => handleClick('item-146')}>
            <path
              d="   M 343.14 256.56   A 0.60 0.60 0.0 0 0 342.54 255.96   L 88.46 255.96   A 0.60 0.60 0.0 0 0 87.86 256.56   L 87.86 276.22   A 0.60 0.60 0.0 0 0 88.46 276.82   L 342.54 276.82   A 0.60 0.60 0.0 0 0 343.14 276.22   L 343.14 256.56"
              stroke="#744e2a"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-147" onClick={() => handleClick('item-147')}>
            <path
              d="   M 615.38 256.28   A 0.32 0.32 0.0 0 0 615.06 255.96   L 380.86 255.96   A 0.32 0.32 0.0 0 0 380.54 256.28   L 380.54 276.50   A 0.32 0.32 0.0 0 0 380.86 276.82   L 615.06 276.82   A 0.32 0.32 0.0 0 0 615.38 276.50   L 615.38 256.28"
              stroke="#744e2a"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-148" onClick={() => handleClick('item-148')}>
            <path
              d="   M 898.27 256.49   A 0.51 0.51 0.0 0 0 897.76 255.98   L 652.88 255.98   A 0.51 0.51 0.0 0 0 652.37 256.49   L 652.37 276.31   A 0.51 0.51 0.0 0 0 652.88 276.82   L 897.76 276.82   A 0.51 0.51 0.0 0 0 898.27 276.31   L 898.27 256.49"
              stroke="#744e2a"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-149" onClick={() => handleClick('item-149')}>
            <path
              d="   M 1167.72 256.48   A 0.51 0.51 0.0 0 0 1167.21 255.97   L 935.49 255.97   A 0.51 0.51 0.0 0 0 934.98 256.48   L 934.98 276.32   A 0.51 0.51 0.0 0 0 935.49 276.83   L 1167.21 276.83   A 0.51 0.51 0.0 0 0 1167.72 276.32   L 1167.72 256.48"
              stroke="#744e2a"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-150" onClick={() => handleClick('item-150')}>
            <path
              d="   M 1401.84 256.50   A 0.53 0.53 0.0 0 0 1401.31 255.97   L 1205.41 255.97   A 0.53 0.53 0.0 0 0 1204.88 256.50   L 1204.88 276.28   A 0.53 0.53 0.0 0 0 1205.41 276.81   L 1401.31 276.81   A 0.53 0.53 0.0 0 0 1401.84 276.28   L 1401.84 256.50"
              stroke="#744e2a"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-151" onClick={() => handleClick('item-151')}>
            <path
              d="   M 88.52 756.83   L 119.38 734.08   A 2.74 2.74 0.0 0 0 120.49 731.88   L 120.49 338.73   A 0.63 0.62 -86.3 0 0 119.95 338.11   Q 114.61 337.36 110.00 339.75   A 4.09 3.54 -34.2 0 1 105.39 339.21   C 99.93 333.39 100.03 323.64 103.70 317.29   C 105.11 314.85 107.93 313.09 110.56 314.61   Q 111.24 315.00 113.46 316.42   A 1.77 1.76 -28.7 0 0 114.40 316.69   L 119.97 316.69   A 0.58 0.57 0.0 0 0 120.55 316.12   L 120.55 283.66   A 0.54 0.54 0.0 0 0 120.01 283.12   L 88.39 283.12   A 0.54 0.54 0.0 0 0 87.85 283.66   L 87.85 756.50   A 0.42 0.42 0.0 0 0 88.52 756.83"
              stroke="#4e2f1b"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-152" onClick={() => handleClick('item-152')}>
            <path
              d="   M 343.12 283.56   A 0.47 0.47 0.0 0 0 342.65 283.09   L 127.51 283.09   A 0.47 0.47 0.0 0 0 127.04 283.56   L 127.04 316.28   A 0.47 0.47 0.0 0 0 127.51 316.75   L 342.65 316.75   A 0.47 0.47 0.0 0 0 343.12 316.28   L 343.12 283.56"
              stroke="#4e2f1b"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-153" onClick={() => handleClick('item-153')}>
            <path
              d="   M 381.23 757.29   L 403.82 733.21   A 3.90 3.88 66.7 0 0 404.87 730.55   L 404.87 338.91   A 1.00 0.99 -2.4 0 0 403.79 337.92   L 400.56 338.20   A 1.49 1.40 -58.2 0 0 400.04 338.34   C 398.04 339.35 396.76 340.26 395.04 340.11   Q 392.24 339.88 390.79 336.71   C 388.09 330.82 387.71 321.31 391.90 315.88   C 393.52 313.78 396.20 313.59 398.48 315.32   Q 400.87 317.14 404.40 316.76   A 0.48 0.48 0.0 0 0 404.84 316.28   L 404.84 283.68   A 0.58 0.58 0.0 0 0 404.26 283.10   L 380.66 283.10   A 0.26 0.25 90.0 0 0 380.41 283.36   L 380.41 756.97   A 0.47 0.47 0.0 0 0 381.23 757.29"
              stroke="#4e2f1b"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-154" onClick={() => handleClick('item-154')}>
            <path
              d="   M 615.44 283.75   A 0.65 0.65 0.0 0 0 614.79 283.10   L 411.91 283.10   A 0.65 0.65 0.0 0 0 411.26 283.75   L 411.26 316.09   A 0.65 0.65 0.0 0 0 411.91 316.74   L 614.79 316.74   A 0.65 0.65 0.0 0 0 615.44 316.09   L 615.44 283.75"
              stroke="#4e2f1b"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-155" onClick={() => handleClick('item-155')}>
            <path
              d="   M 666.24 314.50   L 666.24 283.70   A 0.64 0.63 0.0 0 0 665.60 283.07   L 652.99 283.07   A 0.64 0.64 0.0 0 0 652.35 283.71   L 652.35 753.90   A 0.30 0.30 0.0 0 0 652.91 754.06   Q 658.53 744.95 664.41 736.01   C 666.23 733.26 666.28 731.29 666.28 728.00   Q 666.19 534.24 666.28 340.47   A 0.55 0.55 0.0 0 0 665.51 339.96   Q 661.66 341.59 659.58 337.59   Q 654.66 328.11 658.56 318.26   C 659.67 315.44 662.70 312.33 665.62 314.78   A 0.38 0.37 20.3 0 0 666.24 314.50"
              stroke="#4e2f1b"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-156" onClick={() => handleClick('item-156')}>
            <path
              d="   M 878.38 283.76   A 0.66 0.66 0.0 0 0 877.72 283.10   L 673.56 283.10   A 0.66 0.66 0.0 0 0 672.90 283.76   L 672.90 316.08   A 0.66 0.66 0.0 0 0 673.56 316.74   L 877.72 316.74   A 0.66 0.66 0.0 0 0 878.38 316.08   L 878.38 283.76"
              stroke="#4e2f1b"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-157" onClick={() => handleClick('item-157')}>
            <path
              d="   M 898.31 753.08   L 898.31 283.85   A 0.74 0.74 0.0 0 0 897.57 283.11   L 885.30 283.11   A 0.55 0.55 0.0 0 0 884.75 283.66   L 884.75 313.22   A 0.71 0.70 -87.8 0 0 885.40 313.93   Q 890.17 314.31 891.91 320.43   Q 894.34 328.95 891.37 336.09   Q 889.58 340.38 885.24 340.17   A 0.41 0.41 0.0 0 0 884.81 340.57   Q 884.65 367.40 884.67 401.02   Q 884.74 522.87 884.65 725.76   C 884.65 730.51 884.44 733.07 886.66 736.33   Q 893.81 746.86 897.90 753.20   A 0.22 0.22 0.0 0 0 898.31 753.08"
              stroke="#4e2f1b"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-158" onClick={() => handleClick('item-158')}>
            <path
              d="   M 1138.85 283.78   A 0.69 0.69 0.0 0 0 1138.16 283.09   L 935.76 283.09   A 0.69 0.69 0.0 0 0 935.07 283.78   L 935.07 316.04   A 0.69 0.69 0.0 0 0 935.76 316.73   L 1138.16 316.73   A 0.69 0.69 0.0 0 0 1138.85 316.04   L 1138.85 283.78"
              stroke="#4e2f1b"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-159" onClick={() => handleClick('item-159')}>
            <path
              d="   M 1167.79 755.12   L 1167.79 284.04   A 0.96 0.96 0.0 0 0 1166.83 283.08   L 1146.08 283.08   A 0.76 0.75 90.0 0 0 1145.33 283.84   L 1145.33 315.87   A 0.72 0.71 -83.4 0 0 1145.88 316.57   Q 1149.38 317.42 1151.83 315.81   C 1155.27 313.56 1157.39 313.07 1159.75 316.59   C 1163.49 322.18 1162.87 331.49 1160.21 336.92   C 1157.87 341.71 1154.73 340.12 1151.11 338.38   A 2.69 2.54 -29.1 0 0 1150.13 338.13   L 1146.38 337.88   A 1.03 1.02 -87.9 0 0 1145.29 338.90   Q 1145.21 351.28 1145.25 730.50   Q 1145.25 732.23 1146.56 733.68   Q 1156.86 744.98 1167.15 755.39   A 0.38 0.37 -67.7 0 0 1167.79 755.12"
              stroke="#4e2f1b"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-160" onClick={() => handleClick('item-160')}>
            <path
              d="   M 1365.03 283.49   A 0.40 0.40 0.0 0 0 1364.63 283.09   L 1205.31 283.09   A 0.40 0.40 0.0 0 0 1204.91 283.49   L 1204.91 316.37   A 0.40 0.40 0.0 0 0 1205.31 316.77   L 1364.63 316.77   A 0.40 0.40 0.0 0 0 1365.03 316.37   L 1365.03 283.49"
              stroke="#4e2f1b"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-161" onClick={() => handleClick('item-161')}>
            <path
              d="   M 1401.90 756.61   L 1401.90 283.91   A 0.79 0.78 90.0 0 0 1401.12 283.12   L 1372.45 283.12   A 0.94 0.94 0.0 0 0 1371.51 284.06   L 1371.51 315.97   A 0.59 0.58 7.9 0 0 1371.94 316.53   Q 1375.23 317.47 1377.63 315.87   C 1380.93 313.67 1383.61 312.83 1386.17 316.37   C 1390.06 321.74 1390.02 329.74 1387.69 335.44   C 1386.49 338.38 1383.28 341.93 1379.77 339.50   Q 1377.23 337.74 1372.84 337.97   A 1.49 1.48 88.6 0 0 1371.43 339.46   L 1371.43 731.41   A 2.47 2.46 19.4 0 0 1372.35 733.33   L 1401.71 756.70   A 0.12 0.12 0.0 0 0 1401.90 756.61"
              stroke="#4e2f1b"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-162" onClick={() => handleClick('item-162')}>
            <path
              d="   M 343.11 324.31   A 0.76 0.76 0.0 0 0 342.35 323.55   L 108.83 323.55   A 0.76 0.76 0.0 0 0 108.07 324.31   L 108.07 330.41   A 0.76 0.76 0.0 0 0 108.83 331.17   L 342.35 331.17   A 0.76 0.76 0.0 0 0 343.11 330.41   L 343.11 324.31"
              stroke="#62564d"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-163" onClick={() => handleClick('item-163')}>
            <path
              d="   M 615.34 330.24   L 615.34 324.46   A 0.93 0.93 0.0 0 0 614.41 323.53   L 396.69 323.53   A 2.23 1.27 -90.0 0 0 395.42 325.76   L 395.42 328.94   A 2.23 1.27 -90.0 0 0 396.69 331.17   L 614.41 331.17   A 0.93 0.93 0.0 0 0 615.34 330.24"
              stroke="#62564d"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-164" onClick={() => handleClick('item-164')}>
            <path
              d="   M 886.24 324.86   A 1.32 1.32 0.0 0 0 884.92 323.54   L 665.24 323.54   A 1.32 1.32 0.0 0 0 663.92 324.86   L 663.92 329.86   A 1.32 1.32 0.0 0 0 665.24 331.18   L 884.92 331.18   A 1.32 1.32 0.0 0 0 886.24 329.86   L 886.24 324.86"
              stroke="#62564d"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-165" onClick={() => handleClick('item-165')}>
            <path
              d="   M 1155.40 324.30   A 0.77 0.77 0.0 0 0 1154.63 323.53   L 935.67 323.53   A 0.77 0.77 0.0 0 0 934.90 324.30   L 934.90 330.40   A 0.77 0.77 0.0 0 0 935.67 331.17   L 1154.63 331.17   A 0.77 0.77 0.0 0 0 1155.40 330.40   L 1155.40 324.30"
              stroke="#62564d"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-166" onClick={() => handleClick('item-166')}>
            <path
              d="   M 1382.35 324.30   A 0.75 0.75 0.0 0 0 1381.60 323.55   L 1205.56 323.55   A 0.75 0.75 0.0 0 0 1204.81 324.30   L 1204.81 330.48   A 0.75 0.75 0.0 0 0 1205.56 331.23   L 1381.60 331.23   A 0.75 0.75 0.0 0 0 1382.35 330.48   L 1382.35 324.30"
              stroke="#62564d"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-167" onClick={() => handleClick('item-167')}>
            <path
              d="   M 127.05 409.84   L 127.07 729.99"
              stroke="#704b28"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-168" onClick={() => handleClick('item-168')}>
            <path
              d="   M 127.07 729.99   L 342.41 730.04   A 0.50 0.50 0.0 0 0 342.91 729.54   L 342.91 410.21"
              stroke="#805c35"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-169" onClick={() => handleClick('item-169')}>
            <path
              d="   M 342.91 410.21   L 342.89 409.46"
              stroke="#704b28"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-170" onClick={() => handleClick('item-170')}>
            <path
              d="   M 342.89 409.46   L 343.12 338.56   A 0.54 0.53 90.0 0 0 342.59 338.02   L 127.56 338.02   A 0.58 0.58 0.0 0 0 126.98 338.60   L 127.05 409.84"
              stroke="#57351d"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-171" onClick={() => handleClick('item-171')}>
            <path
              d="   M 342.89 409.46   L 341.26 409.86   A 0.88 0.77 -48.9 0 1 341.04 409.89   L 127.05 409.84"
              stroke="#a5632b"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-172" onClick={() => handleClick('item-172')}>
            <path
              d="   M 342.91 410.21   Q 342.56 410.20 342.35 410.45   A 0.32 0.27 69.5 0 0 342.28 410.65   Q 342.03 424.63 342.03 443.03   Q 342.03 513.60 342.08 589.49   C 342.09 596.97 341.84 603.32 341.93 610.33   Q 342.12 624.57 342.12 625.94   Q 341.91 692.87 342.09 723.60   C 342.10 725.40 342.39 726.57 342.33 728.29   A 1.13 1.12 -88.7 0 1 341.20 729.38   L 306.04 729.17"
              stroke="#ce8a43"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-173" onClick={() => handleClick('item-173')}>
            <path
              d="   M 306.04 729.17   Q 306.53 724.22 306.50 722.23   Q 306.15 697.69 306.36 665.52   Q 306.50 645.68 306.00 560.84   C 305.98 558.22 305.58 555.07 305.16 551.73   A 0.77 0.77 0.0 0 0 303.69 551.53   Q 302.17 555.08 302.11 559.41   Q 301.54 601.03 301.88 697.07   Q 301.93 713.19 301.78 729.10"
              stroke="#b77432"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-174" onClick={() => handleClick('item-174')}>
            <path
              d="   M 301.78 729.10   L 268.05 729.05"
              stroke="#ce8a43"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-175" onClick={() => handleClick('item-175')}>
            <path
              d="   M 268.05 729.05   L 267.52 412.57   A 0.66 0.66 0.0 0 0 267.14 411.97   L 265.26 411.06   A 1.20 1.19 15.0 0 0 263.54 412.05   Q 262.77 423.24 262.91 435.53   Q 263.38 476.86 263.12 510.25   Q 262.90 539.15 263.14 720.43   Q 263.14 724.83 264.31 729.20"
              stroke="#b77432"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-176" onClick={() => handleClick('item-176')}>
            <path
              d="   M 264.31 729.20   L 190.95 729.11"
              stroke="#ce8a43"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-177" onClick={() => handleClick('item-177')}>
            <path
              d="   M 190.95 729.11   C 190.59 725.77 190.24 722.29 190.31 718.98   Q 190.64 702.03 190.40 687.94   Q 190.12 670.85 190.23 656.88   Q 190.55 618.59 190.28 556.26   C 190.10 512.22 190.44 470.58 190.26 423.53   Q 190.25 419.96 189.89 412.67   A 1.34 1.33 88.6 0 0 188.56 411.39   L 187.09 411.39   A 1.30 1.29 -89.3 0 0 185.80 412.66   Q 185.69 418.42 185.69 421.50   Q 185.65 479.38 185.64 618.40   C 185.64 642.10 186.00 653.54 185.52 673.19   Q 185.25 684.50 185.58 716.44   Q 185.66 724.17 186.63 729.04"
              stroke="#b77432"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-178" onClick={() => handleClick('item-178')}>
            <path
              d="   M 186.63 729.04   C 178.81 729.27 172.10 729.16 163.13 729.35   Q 157.23 729.48 149.19 729.29   Q 141.02 729.10 127.07 729.99"
              stroke="#ce8a43"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-179" onClick={() => handleClick('item-179')}>
            <path
              d="   M 186.63 729.04   L 190.95 729.11"
              stroke="#c7843f"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-180" onClick={() => handleClick('item-180')}>
            <path
              d="   M 264.31 729.20   L 268.05 729.05"
              stroke="#c7843f"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-181" onClick={() => handleClick('item-181')}>
            <path
              d="   M 301.78 729.10   L 306.04 729.17"
              stroke="#c7843f"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-182" onClick={() => handleClick('item-182')}>
            <path
              d="   M 411.27 409.85   L 411.27 728.90"
              stroke="#704b28"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-183" onClick={() => handleClick('item-183')}>
            <path
              d="   M 411.27 728.90   L 411.34 729.83   A 0.29 0.28 87.8 0 0 411.62 730.10   L 614.66 730.10   A 0.54 0.54 0.0 0 0 615.20 729.56   L 615.24 409.78"
              stroke="#805c35"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-184" onClick={() => handleClick('item-184')}>
            <path
              d="   M 615.24 409.78   L 615.35 338.56   A 0.54 0.53 -0.0 0 0 614.81 338.03   L 411.85 338.03   A 0.66 0.66 0.0 0 0 411.19 338.69   L 411.27 409.85"
              stroke="#57351d"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-185" onClick={() => handleClick('item-185')}>
            <path
              d="   M 615.24 409.78   L 615.05 409.51   A 0.36 0.36 0.0 0 0 614.57 409.42   L 613.90 409.87"
              stroke="#b47338"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-186" onClick={() => handleClick('item-186')}>
            <path
              d="   M 613.90 409.87   L 461.69 409.85"
              stroke="#a5632b"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-187" onClick={() => handleClick('item-187')}>
            <path
              d="   M 461.69 409.85   L 459.13 409.82"
              stroke="#9e5d26"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-188" onClick={() => handleClick('item-188')}>
            <path
              d="   M 459.13 409.82   L 413.11 409.84   A 1.46 0.20 24.2 0 1 412.18 409.57   Q 411.67 409.36 411.27 409.85"
              stroke="#a5632b"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-189" onClick={() => handleClick('item-189')}>
            <path
              d="   M 458.80 729.27   L 463.51 729.23"
              stroke="#c7843f"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-190" onClick={() => handleClick('item-190')}>
            <path
              d="   M 463.51 729.23   Q 474.10 729.29 484.64 729.26   Q 484.74 729.26 496.85 729.52   Q 503.09 729.66 509.31 729.13"
              stroke="#ce8a43"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-191" onClick={() => handleClick('item-191')}>
            <path
              d="   M 509.31 729.13   L 512.95 729.29"
              stroke="#c7843f"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-192" onClick={() => handleClick('item-192')}>
            <path
              d="   M 512.95 729.29   L 553.73 729.28"
              stroke="#ce8a43"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-193" onClick={() => handleClick('item-193')}>
            <path
              d="   M 553.73 729.28   Q 555.66 729.76 557.48 729.19"
              stroke="#c7843f"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-194" onClick={() => handleClick('item-194')}>
            <path
              d="   M 557.48 729.19   L 613.06 729.56   A 1.40 1.40 0.0 0 0 614.46 728.02   C 613.67 720.08 614.77 712.52 614.43 704.98   Q 613.96 694.57 614.36 669.08   Q 614.61 652.89 614.22 556.83   Q 614.21 554.19 614.37 548.71   C 614.57 541.95 614.09 534.60 614.36 528.42   C 614.68 521.18 614.25 513.52 614.36 506.19   C 614.71 483.73 614.13 460.53 614.20 437.50   Q 614.23 428.94 614.12 417.75   A 3.81 3.59 52.8 0 1 614.22 416.81   Q 615.01 413.27 613.90 409.87"
              stroke="#ce8a43"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-195" onClick={() => handleClick('item-195')}>
            <path
              d="   M 557.48 729.19   Q 558.18 724.63 558.19 723.23   Q 558.26 710.03 558.20 599.35   Q 558.13 470.41 558.18 418.09   Q 558.18 417.22 557.63 411.73   A 1.15 1.15 0.0 0 0 555.98 410.81   L 555.12 411.23   A 2.24 2.24 0.0 0 0 553.85 413.25   L 553.73 729.28"
              stroke="#b77432"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-196" onClick={() => handleClick('item-196')}>
            <path
              d="   M 512.95 729.29   Q 513.55 725.91 513.56 722.48   Q 513.61 677.10 513.57 620.12   C 513.56 600.27 513.88 583.19 513.66 565.66   C 513.20 527.58 513.84 493.93 513.49 453.98   Q 513.37 439.82 513.91 420.41   Q 513.96 418.49 513.26 412.26   A 0.70 0.66 11.0 0 0 512.88 411.73   L 510.26 410.46   A 0.88 0.88 0.0 0 0 509.00 411.25   L 509.31 729.13"
              stroke="#b77432"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-197" onClick={() => handleClick('item-197')}>
            <path
              d="   M 463.51 729.23   Q 463.80 679.51 463.69 629.83   Q 463.59 590.83 463.70 554.66   Q 463.81 517.06 463.71 479.46   Q 463.63 449.02 463.62 418.29   Q 463.62 414.60 461.69 409.85"
              stroke="#b77432"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-198" onClick={() => handleClick('item-198')}>
            <path
              d="   M 459.13 409.82   L 458.80 729.27"
              stroke="#b77432"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-199" onClick={() => handleClick('item-199')}>
            <path
              d="   M 458.80 729.27   L 415.72 729.39   Q 415.69 729.39 415.66 729.39   L 411.27 728.90"
              stroke="#ce8a43"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-200" onClick={() => handleClick('item-200')}>
            <path
              d="   M 673.03 409.78   L 672.95 729.82   A 0.29 0.29 0.0 0 0 673.24 730.11   L 878.02 730.11   A 0.26 0.26 0.0 0 0 878.28 729.85   L 878.32 409.17"
              stroke="#704b28"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-201" onClick={() => handleClick('item-201')}>
            <path
              d="   M 878.32 409.17   L 878.34 338.59   A 0.56 0.56 0.0 0 0 877.78 338.03   L 673.40 338.03   A 0.52 0.51 -0.0 0 0 672.88 338.54   L 673.03 409.78"
              stroke="#57351d"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-202" onClick={() => handleClick('item-202')}>
            <path
              d="   M 878.32 409.17   Q 877.75 409.02 876.92 409.72   A 0.70 0.70 0.0 0 1 876.45 409.90   L 673.03 409.78"
              stroke="#a5632b"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-203" onClick={() => handleClick('item-203')}>
            <path
              d="   M 935.03 409.82   L 935.20 427.00"
              stroke="#704b28"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-204" onClick={() => handleClick('item-204')}>
            <path
              d="   M 935.20 427.00   L 935.11 729.57   A 0.54 0.53 -0.0 0 0 935.65 730.10   L 1138.42 730.10   A 0.47 0.47 0.0 0 0 1138.89 729.62   L 1138.72 722.22"
              stroke="#805c35"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-205" onClick={() => handleClick('item-205')}>
            <path
              d="   M 1138.72 722.22   L 1138.82 409.42"
              stroke="#704b28"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-206" onClick={() => handleClick('item-206')}>
            <path
              d="   M 1138.82 409.42   L 1138.81 338.52   A 0.49 0.49 0.0 0 0 1138.32 338.03   L 935.70 338.03   A 0.61 0.60 -0.0 0 0 935.09 338.63   L 935.03 409.82"
              stroke="#57351d"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-207" onClick={() => handleClick('item-207')}>
            <path
              d="   M 1138.82 409.42   Q 1136.09 409.89 1132.00 409.89   Q 1033.65 409.88 935.03 409.82"
              stroke="#a5632b"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-208" onClick={() => handleClick('item-208')}>
            <path
              d="   M 1138.72 722.22   L 1138.54 721.64   A 0.44 0.43 36.2 0 0 1137.69 721.77   L 1137.69 728.78   A 0.55 0.55 0.0 0 1 1137.14 729.33   L 1088.38 729.26"
              stroke="#ce8a43"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-209" onClick={() => handleClick('item-209')}>
            <path
              d="   M 1088.38 729.26   L 1088.06 413.29   A 1.27 1.27 0.0 0 0 1086.79 412.02   L 1085.46 412.02   A 1.27 1.27 0.0 0 0 1084.19 413.29   L 1083.74 729.19"
              stroke="#b77432"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-210" onClick={() => handleClick('item-210')}>
            <path
              d="   M 1083.74 729.19   L 1032.28 729.25"
              stroke="#ce8a43"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-211" onClick={() => handleClick('item-211')}>
            <path
              d="   M 1032.28 729.25   Q 1032.56 726.77 1032.58 724.36   Q 1032.67 708.16 1032.62 632.28   Q 1032.54 506.24 1032.65 431.16   Q 1032.66 423.93 1031.91 412.89   A 1.37 1.36 88.0 0 0 1030.55 411.62   L 1029.31 411.62   A 1.36 1.36 0.0 0 0 1027.95 412.98   L 1028.10 729.19"
              stroke="#b77432"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-212" onClick={() => handleClick('item-212')}>
            <path
              d="   M 1028.10 729.19   L 984.00 729.08"
              stroke="#ce8a43"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-213" onClick={() => handleClick('item-213')}>
            <path
              d="   M 984.00 729.08   C 984.30 700.98 983.98 673.04 984.19 644.72   C 984.46 606.78 984.14 577.70 983.97 534.24   C 983.91 520.83 984.29 510.91 984.03 498.31   Q 983.86 490.35 984.17 434.91   C 984.21 427.53 983.76 417.89 983.62 412.70   A 1.21 1.21 0.0 0 0 982.44 411.52   L 980.95 411.48   A 1.25 1.24 1.6 0 0 979.67 412.68   C 978.85 435.69 979.81 459.57 979.22 480.11   Q 979.04 486.13 979.36 523.44   Q 979.45 533.56 979.17 672.00   Q 979.15 679.37 979.29 690.44   C 979.45 703.06 979.17 714.38 979.80 729.08"
              stroke="#b77432"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-214" onClick={() => handleClick('item-214')}>
            <path
              d="   M 979.80 729.08   Q 959.66 729.16 939.55 729.45   Q 937.89 729.47 936.50 728.77   A 0.87 0.86 -76.5 0 1 936.03 728.00   Q 936.08 671.03 936.11 612.75   Q 936.15 550.90 936.01 496.00   Q 936.01 495.89 936.20 469.15   Q 936.35 448.05 935.20 427.00"
              stroke="#ce8a43"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-215" onClick={() => handleClick('item-215')}>
            <path
              d="   M 984.00 729.08   L 979.80 729.08"
              stroke="#c7843f"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-216" onClick={() => handleClick('item-216')}>
            <path
              d="   M 1032.28 729.25   L 1028.10 729.19"
              stroke="#c7843f"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-217" onClick={() => handleClick('item-217')}>
            <path
              d="   M 1088.38 729.26   L 1083.74 729.19"
              stroke="#c7843f"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-218" onClick={() => handleClick('item-218')}>
            <path
              d="   M 1205.17 409.40   L 1204.96 729.55   A 0.56 0.55 0.5 0 0 1205.52 730.11   L 1364.44 730.11   A 0.46 0.46 0.0 0 0 1364.90 729.65   L 1364.93 409.33"
              stroke="#704b28"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-219" onClick={() => handleClick('item-219')}>
            <path
              d="   M 1364.93 409.33   L 1365.03 338.45   A 0.43 0.43 0.0 0 0 1364.60 338.02   L 1205.46 338.02   A 0.54 0.53 -0.5 0 0 1204.92 338.56   L 1205.17 409.40"
              stroke="#57351d"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-220" onClick={() => handleClick('item-220')}>
            <path
              d="   M 1364.93 409.33   Q 1363.69 409.75 1362.75 409.75   Q 1327.01 409.96 1291.32 409.85"
              stroke="#a5632b"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-221" onClick={() => handleClick('item-221')}>
            <path
              d="   M 1291.32 409.85   L 1288.99 409.87"
              stroke="#9e5d26"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-222" onClick={() => handleClick('item-222')}>
            <path
              d="   M 1288.99 409.87   Q 1249.78 409.89 1210.50 409.82   Q 1207.04 409.81 1205.17 409.40"
              stroke="#a5632b"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-223" onClick={() => handleClick('item-223')}>
            <path
              d="   M 1288.99 409.87   Q 1287.92 413.06 1287.93 417.53   Q 1288.00 594.44 1287.94 696.46   C 1287.93 710.54 1288.28 719.21 1287.82 728.20   A 0.73 0.73 0.0 0 0 1288.55 728.97   L 1292.25 728.97   A 0.71 0.71 0.0 0 0 1292.96 728.22   C 1292.47 719.70 1292.88 709.84 1292.88 700.11   Q 1292.76 505.79 1292.85 416.48   Q 1292.85 412.71 1291.32 409.85"
              stroke="#b77432"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-224" onClick={() => handleClick('item-224')}>
            <path
              d="   M 104.45 753.50   L 90.22 764.29   A 0.27 0.27 0.0 0 0 90.38 764.77   L 342.46 764.77   A 0.60 0.59 -90.0 0 0 343.05 764.17   L 342.99 738.10"
              stroke="#744e2a"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-225" onClick={() => handleClick('item-225')}>
            <path
              d="   M 342.99 738.10   Q 343.12 737.45 342.93 737.01   A 0.41 0.41 0.0 0 0 342.55 736.75   L 128.20 736.75   A 4.55 4.50 26.1 0 0 125.46 737.67   L 104.45 753.50"
              stroke="#805c35"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-226" onClick={() => handleClick('item-226')}>
            <path
              d="   M 342.99 738.10   L 128.04 737.81   A 2.53 2.51 26.8 0 0 126.56 738.29   L 105.16 754.07   A 0.42 0.41 -23.2 0 1 104.50 753.81   Q 104.49 753.72 104.45 753.50"
              stroke="#d28d45"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-227" onClick={() => handleClick('item-227')}>
            <path
              d="   M 395.43 751.67   L 383.43 764.36   A 0.24 0.24 0.0 0 0 383.61 764.77   L 614.94 764.77   A 0.35 0.35 0.0 0 0 615.29 764.42   L 615.29 737.11   A 0.45 0.45 0.0 0 0 614.84 736.66   L 608.08 736.74"
              stroke="#744e2a"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-228" onClick={() => handleClick('item-228')}>
            <path
              d="   M 608.08 736.74   L 410.81 736.74   A 3.76 3.73 21.1 0 0 408.05 737.95   L 395.43 751.67"
              stroke="#805c35"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-229" onClick={() => handleClick('item-229')}>
            <path
              d="   M 608.08 736.74   Q 610.76 737.74 605.50 737.76   Q 503.07 737.99 483.25 737.91   Q 451.74 737.77 410.06 737.93   A 2.41 2.37 -69.8 0 0 408.23 738.79   Q 402.42 745.75 396.52 751.89   Q 396.22 752.19 395.79 752.18   Q 395.60 752.18 395.43 751.67"
              stroke="#d28d45"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-230" onClick={() => handleClick('item-230')}>
            <path
              d="   M 664.16 748.25   L 653.77 764.36   A 0.25 0.25 0.0 0 0 653.98 764.74   L 877.54 764.74"
              stroke="#744e2a"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-231" onClick={() => handleClick('item-231')}>
            <path
              d="   M 877.54 764.74   L 897.13 764.70   A 0.19 0.19 0.0 0 0 897.29 764.41   L 880.13 738.11   A 2.97 2.94 73.2 0 0 877.66 736.77   L 673.07 736.77   A 2.77 2.74 16.2 0 0 670.75 738.03   L 664.16 748.25"
              stroke="#805c35"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-232" onClick={() => handleClick('item-232')}>
            <path
              d="   M 877.54 764.74   L 875.99 764.14   A 0.36 0.36 0.0 0 1 876.12 763.45   L 893.51 763.45   A 0.84 0.84 0.0 0 0 894.34 762.46   C 893.95 760.23 892.49 759.13 891.43 757.43   Q 885.13 747.33 879.40 738.83   A 2.09 2.09 0.0 0 0 877.67 737.91   L 672.52 737.91   A 1.82 1.80 14.8 0 0 670.95 738.81   L 664.99 749.14   A 0.37 0.37 0.0 0 1 664.38 749.19   Q 664.11 748.86 664.16 748.25"
              stroke="#d28d45"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-233" onClick={() => handleClick('item-233')}>
            <path
              d="   M 935.24 759.83   L 935.01 764.18   A 0.55 0.55 0.0 0 0 935.56 764.76   L 1166.20 764.76   A 0.29 0.28 -16.9 0 0 1166.44 764.32   Q 1164.25 761.03 1161.17 759.02"
              stroke="#744e2a"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-234" onClick={() => handleClick('item-234')}>
            <path
              d="   M 1161.17 759.02   Q 1152.15 748.67 1142.72 738.95   C 1141.24 737.43 1140.02 736.72 1138.00 736.72   Q 1056.23 736.83 935.74 736.74   A 0.51 0.51 0.0 0 0 935.23 737.25   L 935.24 759.83"
              stroke="#805c35"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-235" onClick={() => handleClick('item-235')}>
            <path
              d="   M 1161.17 759.02   Q 1151.17 750.03 1142.38 739.88   Q 1140.36 737.55 1138.78 737.63   Q 1133.36 737.90 1128.36 737.89   Q 1059.54 737.82 936.90 737.93   A 1.04 1.03 81.8 0 0 935.91 739.26   Q 936.27 740.47 936.31 742.00   Q 936.55 751.06 935.24 759.83"
              stroke="#d28d45"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-236" onClick={() => handleClick('item-236')}>
            <path
              d="   M 1395.63 761.12   L 1367.65 737.97   A 5.38 5.33 64.6 0 0 1364.24 736.74   L 1207.57 736.79"
              stroke="#805c35"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-237" onClick={() => handleClick('item-237')}>
            <path
              d="   M 1207.57 736.79   Q 1206.51 736.53 1205.45 736.81   A 0.70 0.69 82.3 0 0 1204.94 737.48   L 1204.94 764.35   A 0.40 0.40 0.0 0 0 1205.34 764.75   L 1400.03 764.75   A 0.36 0.36 0.0 0 0 1400.28 764.13   Q 1398.04 761.96 1395.63 761.12"
              stroke="#744e2a"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-238" onClick={() => handleClick('item-238')}>
            <path
              d="   M 1207.57 736.79   Q 1209.64 738.15 1213.10 738.01   Q 1215.88 737.89 1215.97 737.89   Q 1282.78 737.82 1364.94 737.87   A 1.04 1.00 54.4 0 1 1365.31 737.94   Q 1367.42 738.83 1369.16 740.34   Q 1381.83 751.36 1395.63 761.12"
              stroke="#d28d45"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-239" onClick={() => handleClick('item-239')}>
            <path
              d="   M 343.18 771.92   A 0.67 0.67 0.0 0 0 342.51 771.25   L 88.57 771.25   A 0.67 0.67 0.0 0 0 87.90 771.92   L 87.90 790.70   A 0.67 0.67 0.0 0 0 88.57 791.37   L 342.51 791.37   A 0.67 0.67 0.0 0 0 343.18 790.70   L 343.18 771.92"
              stroke="#744e2a"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-240" onClick={() => handleClick('item-240')}>
            <path
              d="   M 615.41 771.76   A 0.50 0.50 0.0 0 0 614.91 771.26   L 381.03 771.26   A 0.50 0.50 0.0 0 0 380.53 771.76   L 380.53 790.88   A 0.50 0.50 0.0 0 0 381.03 791.38   L 614.91 791.38   A 0.50 0.50 0.0 0 0 615.41 790.88   L 615.41 771.76"
              stroke="#744e2a"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-241" onClick={() => handleClick('item-241')}>
            <path
              d="   M 898.35 771.83   A 0.57 0.57 0.0 0 0 897.78 771.26   L 652.98 771.26   A 0.57 0.57 0.0 0 0 652.41 771.83   L 652.41 790.79   A 0.57 0.57 0.0 0 0 652.98 791.36   L 897.78 791.36   A 0.57 0.57 0.0 0 0 898.35 790.79   L 898.35 771.83"
              stroke="#744e2a"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-242" onClick={() => handleClick('item-242')}>
            <path
              d="   M 1167.85 772.02   A 0.76 0.76 0.0 0 0 1167.09 771.26   L 935.85 771.26   A 0.76 0.76 0.0 0 0 935.09 772.02   L 935.09 790.62   A 0.76 0.76 0.0 0 0 935.85 791.38   L 1167.09 791.38   A 0.76 0.76 0.0 0 0 1167.85 790.62   L 1167.85 772.02"
              stroke="#744e2a"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-243" onClick={() => handleClick('item-243')}>
            <path
              d="   M 1401.86 771.70   A 0.45 0.45 0.0 0 0 1401.41 771.25   L 1205.35 771.25   A 0.45 0.45 0.0 0 0 1204.90 771.70   L 1204.90 790.92   A 0.45 0.45 0.0 0 0 1205.35 791.37   L 1401.41 791.37   A 0.45 0.45 0.0 0 0 1401.86 790.92   L 1401.86 771.70"
              stroke="#744e2a"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-244" onClick={() => handleClick('item-244')}>
            <path
              d="   M 87.86 801.71   L 87.82 909.99   A 0.46 0.45 72.0 0 0 88.54 910.36   Q 109.51 894.91 129.57 880.06   Q 132.53 877.87 131.91 874.68"
              stroke="#57351d"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-245" onClick={() => handleClick('item-245')}>
            <path
              d="   M 131.91 874.68   L 131.92 798.85   A 1.02 1.01 0.0 0 0 130.90 797.84   L 88.40 797.84   A 0.63 0.63 0.0 0 0 87.78 798.36   Q 87.46 800.05 87.86 801.71"
              stroke="#4e2f1b"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-246" onClick={() => handleClick('item-246')}>
            <path
              d="   M 131.91 874.68   Q 128.02 873.06 125.70 868.53   Q 123.73 864.68 117.80 854.63   Q 113.88 847.98 109.99 840.70   Q 99.45 820.97 87.86 801.71"
              stroke="#83461d"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-247" onClick={() => handleClick('item-247')}>
            <path
              d="   M 343.12 798.25   A 0.44 0.44 0.0 0 0 342.68 797.81   L 138.68 797.81   A 0.44 0.44 0.0 0 0 138.24 798.25   L 138.24 876.43   A 0.44 0.44 0.0 0 0 138.68 876.87   L 342.68 876.87   A 0.44 0.44 0.0 0 0 343.12 876.43   L 343.12 798.25"
              stroke="#4e2f1b"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-248" onClick={() => handleClick('item-248')}>
            <path
              d="   M 380.52 816.61   L 380.52 907.97   A 0.50 0.50 0.0 0 0 381.38 908.32   Q 396.12 893.28 410.79 879.08   Q 411.21 878.67 411.28 878.24   Q 411.37 877.76 411.30 877.22"
              stroke="#57351d"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-249" onClick={() => handleClick('item-249')}>
            <path
              d="   M 411.30 877.22   L 411.49 798.92   A 1.10 1.09 0.3 0 0 410.39 797.82   L 381.05 797.82   A 0.50 0.50 0.0 0 0 380.55 798.32   L 380.52 816.61"
              stroke="#4e2f1b"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-250" onClick={() => handleClick('item-250')}>
            <path
              d="   M 411.30 877.22   Q 409.10 875.70 408.59 874.38   Q 407.30 870.99 404.07 864.69   Q 396.19 849.29 387.54 828.74   Q 385.32 823.48 380.52 816.61"
              stroke="#83461d"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-251" onClick={() => handleClick('item-251')}>
            <path
              d="   M 615.43 798.45   A 0.64 0.64 0.0 0 0 614.79 797.81   L 418.43 797.81   A 0.64 0.64 0.0 0 0 417.79 798.45   L 417.79 876.21   A 0.64 0.64 0.0 0 0 418.43 876.85   L 614.79 876.85   A 0.64 0.64 0.0 0 0 615.43 876.21   L 615.43 798.45"
              stroke="#4e2f1b"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-252" onClick={() => handleClick('item-252')}>
            <path
              d="   M 652.40 814.21   L 652.35 905.08   A 0.27 0.27 0.0 0 0 652.87 905.20   L 665.67 878.76   A 6.48 6.47 -32.3 0 0 666.32 875.89   L 666.21 856.45"
              stroke="#57351d"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-253" onClick={() => handleClick('item-253')}>
            <path
              d="   M 666.21 856.45   L 666.36 798.35   A 0.59 0.59 0.0 0 0 665.77 797.75   L 652.86 797.75   A 0.49 0.49 0.0 0 0 652.37 798.25   L 652.40 814.21"
              stroke="#4e2f1b"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-254" onClick={() => handleClick('item-254')}>
            <path
              d="   M 666.21 856.45   C 664.20 857.56 664.80 862.32 664.91 864.38   A 0.20 0.20 0.0 0 1 664.71 864.60   L 664.38 864.60   A 0.36 0.36 0.0 0 1 664.03 864.31   C 662.71 857.69 660.66 850.85 659.61 845.05   Q 658.59 839.42 657.34 834.99   C 655.14 827.23 654.14 820.74 653.95 813.51   A 0.55 0.55 0.0 0 0 652.92 813.27   L 652.40 814.21"
              stroke="#83461d"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-255" onClick={() => handleClick('item-255')}>
            <path
              d="   M 878.35 798.18   A 0.37 0.37 0.0 0 0 877.98 797.81   L 673.22 797.81   A 0.37 0.37 0.0 0 0 672.85 798.18   L 672.85 876.48   A 0.37 0.37 0.0 0 0 673.22 876.85   L 877.98 876.85   A 0.37 0.37 0.0 0 0 878.35 876.48   L 878.35 798.18"
              stroke="#4e2f1b"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-256" onClick={() => handleClick('item-256')}>
            <path
              d="   M 885.00 862.11   L 884.80 878.51   A 6.27 6.26 32.5 0 0 885.41 881.25   L 897.73 906.67   A 0.21 0.21 0.0 0 0 898.12 906.58   L 898.12 812.91"
              stroke="#57351d"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-257" onClick={() => handleClick('item-257')}>
            <path
              d="   M 898.12 812.91   L 898.29 798.33   A 0.52 0.52 0.0 0 0 897.77 797.80   L 885.33 797.80   A 0.42 0.42 0.0 0 0 884.91 798.22   L 885.00 862.11"
              stroke="#4e2f1b"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-258" onClick={() => handleClick('item-258')}>
            <path
              d="   M 898.12 812.91   Q 893.13 836.21 888.37 854.13   Q 887.35 857.94 885.00 862.11"
              stroke="#83461d"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-259" onClick={() => handleClick('item-259')}>
            <path
              d="   M 1130.88 798.18   A 0.36 0.36 0.0 0 0 1130.52 797.82   L 935.42 797.82   A 0.36 0.36 0.0 0 0 935.06 798.18   L 935.06 876.48   A 0.36 0.36 0.0 0 0 935.42 876.84   L 1130.52 876.84   A 0.36 0.36 0.0 0 0 1130.88 876.48   L 1130.88 798.18"
              stroke="#4e2f1b"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-260" onClick={() => handleClick('item-260')}>
            <path
              d="   M 1137.37 871.31   L 1137.36 877.37   A 3.42 3.40 22.6 0 0 1138.36 879.78   L 1167.43 908.86   A 0.21 0.21 0.0 0 0 1167.79 908.71   L 1167.85 816.71"
              stroke="#57351d"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-261" onClick={() => handleClick('item-261')}>
            <path
              d="   M 1167.85 816.71   L 1167.67 798.45   A 0.64 0.64 0.0 0 0 1167.03 797.81   L 1137.84 797.81   A 0.58 0.58 0.0 0 0 1137.26 798.39   L 1137.37 871.31"
              stroke="#4e2f1b"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-262" onClick={() => handleClick('item-262')}>
            <path
              d="   M 1167.85 816.71   Q 1165.96 818.53 1164.84 820.84   Q 1160.76 829.32 1155.96 838.87   C 1151.23 848.29 1144.85 859.48 1139.79 870.13   A 1.21 1.19 -86.1 0 1 1139.10 870.74   L 1137.37 871.31"
              stroke="#83461d"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-263" onClick={() => handleClick('item-263')}>
            <path
              d="   M 1351.91 798.23   A 0.41 0.41 0.0 0 0 1351.50 797.82   L 1205.32 797.82   A 0.41 0.41 0.0 0 0 1204.91 798.23   L 1204.91 876.45   A 0.41 0.41 0.0 0 0 1205.32 876.86   L 1351.50 876.86   A 0.41 0.41 0.0 0 0 1351.91 876.45   L 1351.91 798.23"
              stroke="#4e2f1b"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-264" onClick={() => handleClick('item-264')}>
            <path
              d="   M 1359.10 878.76   L 1401.72 911.07   A 0.15 0.15 0.0 0 0 1401.96 910.95   L 1401.92 807.13"
              stroke="#57351d"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-265" onClick={() => handleClick('item-265')}>
            <path
              d="   M 1401.92 807.13   L 1401.67 798.36   A 0.58 0.57 -1.0 0 0 1401.09 797.81   L 1358.68 797.81   A 0.56 0.56 0.0 0 0 1358.12 798.38   Q 1358.40 834.48 1358.10 874.99   Q 1358.09 876.91 1359.10 878.76"
              stroke="#4e2f1b"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-266" onClick={() => handleClick('item-266')}>
            <path
              d="   M 1401.92 807.13   Q 1400.78 809.29 1400.03 811.54   Q 1398.98 814.65 1398.17 815.91   C 1395.75 819.72 1393.73 823.47 1390.97 827.77   Q 1375.66 851.60 1371.14 859.64   C 1366.14 868.51 1363.23 873.68 1359.10 878.76"
              stroke="#83461d"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-267" onClick={() => handleClick('item-267')}>
            <path
              d="   M 343.05 883.56   A 0.46 0.46 0.0 0 0 342.59 883.10   L 136.30 883.10   A 0.46 0.46 0.0 0 0 136.03 883.19   L 93.91 914.25   A 0.46 0.46 0.0 0 0 94.18 915.08   L 342.59 915.08   A 0.46 0.46 0.0 0 0 343.05 914.62   L 343.05 883.56"
              stroke="#57351d"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-268" onClick={() => handleClick('item-268')}>
            <path
              d="   M 615.38 883.44   A 0.33 0.33 0.0 0 0 615.05 883.11   L 415.90 883.11   A 0.33 0.33 0.0 0 0 415.66 883.21   L 384.35 914.52   A 0.33 0.33 0.0 0 0 384.59 915.08   L 615.05 915.08   A 0.33 0.33 0.0 0 0 615.38 914.75   L 615.38 883.44"
              stroke="#57351d"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-269" onClick={() => handleClick('item-269')}>
            <path
              d="   M 655.53 914.59   A 0.34 0.34 0.0 0 0 655.83 915.08   L 893.76 915.08   A 0.34 0.34 0.0 0 0 894.06 914.59   L 878.90 883.31   A 0.34 0.34 0.0 0 0 878.60 883.12   L 670.97 883.12   A 0.34 0.34 0.0 0 0 670.67 883.31   L 655.53 914.59"
              stroke="#57351d"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-270" onClick={() => handleClick('item-270')}>
            <path
              d="   M 1163.66 915.01   A 0.31 0.31 0.0 0 0 1163.69 914.55   Q 1146.43 896.65 1135.05 885.46   Q 1132.65 883.11 1130.32 883.11   Q 1020.37 883.07 935.62 883.17   A 0.60 0.60 0.0 0 0 935.02 883.77   L 935.02 914.61   A 0.46 0.46 0.0 0 0 935.48 915.07   L 1163.44 915.12   A 0.20 0.07 3.9 0 0 1163.60 915.08   Q 1163.63 915.03 1163.66 915.01"
              stroke="#57351d"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-271" onClick={() => handleClick('item-271')}>
            <path
              d="   M 1395.83 915.08   A 0.25 0.24 -26.4 0 0 1395.98 914.64   Q 1375.22 899.21 1357.73 885.73   C 1355.75 884.21 1353.63 883.08 1351.37 883.08   Q 1281.73 883.12 1205.65 883.14   A 0.73 0.73 0.0 0 0 1204.92 883.87   L 1204.92 914.47   A 0.61 0.61 0.0 0 0 1205.53 915.08   L 1395.83 915.08"
              stroke="#57351d"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-272" onClick={() => handleClick('item-272')}>
            <path
              d="   M 615.40 921.89   A 0.44 0.44 0.0 0 0 614.96 921.45   L 381.08 921.45   A 0.44 0.44 0.0 0 0 380.64 921.89   L 380.64 938.57   A 0.44 0.44 0.0 0 0 381.08 939.01   L 614.96 939.01   A 0.44 0.44 0.0 0 0 615.40 938.57   L 615.40 921.89"
              stroke="#744e2a"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-273" onClick={() => handleClick('item-273')}>
            <path
              d="   M 1401.84 921.94   A 0.50 0.50 0.0 0 0 1401.34 921.44   L 1205.34 921.44   A 0.50 0.50 0.0 0 0 1204.84 921.94   L 1204.84 938.52   A 0.50 0.50 0.0 0 0 1205.34 939.02   L 1401.34 939.02   A 0.50 0.50 0.0 0 0 1401.84 938.52   L 1401.84 921.94"
              stroke="#744e2a"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-274" onClick={() => handleClick('item-274')}>
            <path
              d="   M 343.12 922.02   A 0.57 0.57 0.0 0 0 342.55 921.45   L 88.45 921.45   A 0.57 0.57 0.0 0 0 87.88 922.02   L 87.88 938.44   A 0.57 0.57 0.0 0 0 88.45 939.01   L 342.55 939.01   A 0.57 0.57 0.0 0 0 343.12 938.44   L 343.12 922.02"
              stroke="#744e2a"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-275" onClick={() => handleClick('item-275')}>
            <path
              d="   M 898.33 922.01   A 0.57 0.57 0.0 0 0 897.76 921.44   L 653.00 921.44   A 0.57 0.57 0.0 0 0 652.43 922.01   L 652.43 938.45   A 0.57 0.57 0.0 0 0 653.00 939.02   L 897.76 939.02   A 0.57 0.57 0.0 0 0 898.33 938.45   L 898.33 922.01"
              stroke="#744e2a"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-276" onClick={() => handleClick('item-276')}>
            <path
              d="   M 1167.84 922.08   A 0.64 0.64 0.0 0 0 1167.20 921.44   L 935.74 921.44   A 0.64 0.64 0.0 0 0 935.10 922.08   L 935.10 938.38   A 0.64 0.64 0.0 0 0 935.74 939.02   L 1167.20 939.02   A 0.64 0.64 0.0 0 0 1167.84 938.38   L 1167.84 922.08"
              stroke="#744e2a"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-277" onClick={() => handleClick('item-277')}>
            <path
              d="   M 380.96 945.52   A 0.49 0.49 0.0 0 0 380.47 946.01   L 380.47 973.50   A 0.49 0.49 0.0 0 0 381.32 973.84   L 407.09 946.35   A 0.49 0.49 0.0 0 0 406.73 945.52   L 380.96 945.52"
              stroke="#57351d"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-278" onClick={() => handleClick('item-278')}>
            <path
              d="   M 127.23 946.23   A 0.38 0.38 0.0 0 0 127.00 945.54   L 88.20 945.54   A 0.38 0.38 0.0 0 0 87.82 945.92   L 87.82 974.54   A 0.38 0.38 0.0 0 0 88.43 974.84   L 127.23 946.23"
              stroke="#57351d"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-279" onClick={() => handleClick('item-279')}>
            <path
              d="   M 652.49 970.35   L 664.26 946.06   A 0.39 0.39 0.0 0 0 663.91 945.50   L 653.18 945.50   A 0.82 0.82 0.0 0 0 652.36 946.32   L 652.36 970.32   A 0.07 0.07 0.0 0 0 652.49 970.35"
              stroke="#4e2f1b"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-280" onClick={() => handleClick('item-280')}>
            <path
              d="   M 897.41 970.23   A 0.43 0.43 0.0 0 0 898.23 970.06   L 898.23 946.04   A 0.43 0.43 0.0 0 0 897.80 945.61   L 886.88 945.61   A 0.43 0.43 0.0 0 0 886.49 946.22   L 897.41 970.23"
              stroke="#4e2f1b"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-281" onClick={() => handleClick('item-281')}>
            <path
              d="   M 1167.79 945.80   A 0.30 0.30 0.0 0 0 1167.49 945.50   L 1141.68 945.50   A 0.30 0.30 0.0 0 0 1141.46 946.01   L 1167.27 973.49   A 0.30 0.30 0.0 0 0 1167.79 973.28   L 1167.79 945.80"
              stroke="#57351d"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-282" onClick={() => handleClick('item-282')}>
            <path
              d="   M 1361.42 945.51   A 0.15 0.14 -26.6 0 0 1361.33 945.77   L 1401.26 975.22   A 0.37 0.37 0.0 0 0 1401.85 974.92   L 1401.85 946.05   A 0.54 0.54 0.0 0 0 1401.31 945.51   L 1361.42 945.51"
              stroke="#57351d"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-283" onClick={() => handleClick('item-283')}>
            <path
              d="   M 717.22 729.28   A 0.80 0.80 0.0 0 0 718.02 728.48   L 718.02 413.03   A 1.42 1.42 0.0 0 0 717.23 411.76   L 714.84 410.60   A 0.84 0.84 0.0 0 0 713.63 411.36   Q 713.44 470.47 713.64 529.51   Q 713.66 535.25 713.69 558.26   Q 713.73 589.44 713.36 725.07   Q 713.36 726.80 712.80 728.38   A 0.68 0.67 9.7 0 0 713.44 729.28   L 717.22 729.28"
              stroke="#b77432"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-284" onClick={() => handleClick('item-284')}>
            <path
              d="   M 771.35 729.07   Q 773.08 729.07 773.71 728.90   A 0.52 0.52 0.0 0 0 774.07 728.27   Q 773.74 726.89 773.77 721.87   C 773.94 680.62 773.63 639.03 773.77 598.38   Q 773.90 558.27 773.84 508.47   Q 773.81 480.58 773.66 418.28   Q 773.64 412.69 773.52 412.35   A 4.64 3.53 70.6 0 1 773.33 411.72   Q 773.12 410.81 771.38 410.81   Q 769.63 410.81 769.42 411.72   A 4.64 3.53 -70.6 0 1 769.23 412.35   Q 769.11 412.69 769.09 418.28   Q 768.93 480.58 768.89 508.47   Q 768.82 558.27 768.95 598.38   C 769.08 639.03 768.76 680.62 768.92 721.87   Q 768.95 726.89 768.62 728.27   A 0.52 0.52 0.0 0 0 768.98 728.90   Q 769.61 729.07 771.35 729.07"
              stroke="#b77432"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-285" onClick={() => handleClick('item-285')}>
            <path
              d="   M 824.60 729.01   A 0.56 0.56 0.0 0 0 825.16 728.42   Q 825.00 725.85 824.94 722.72   Q 824.61 707.00 824.66 597.70   Q 824.69 527.44 824.79 452.30   C 824.81 437.73 824.43 426.17 824.68 413.14   A 2.19 2.18 -0.6 0 0 822.40 410.92   L 822.29 410.93   A 2.36 2.35 -1.2 0 0 820.04 413.27   Q 819.91 665.20 820.22 721.58   Q 820.24 723.83 820.63 728.59   A 0.46 0.45 87.2 0 0 821.08 729.01   L 824.60 729.01"
              stroke="#b77432"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-286" onClick={() => handleClick('item-286')}>
            <path
              d="   M 226.92 494.30   Q 224.94 502.85 224.97 511.55   Q 225.00 522.61 225.03 605.72   C 225.03 613.57 225.06 620.43 227.84 626.00   A 0.68 0.68 0.0 0 0 229.12 625.72   C 230.01 596.58 229.42 561.26 229.57 530.28   Q 229.67 508.52 228.89 499.85   Q 228.49 495.42 228.34 494.36   A 0.72 0.72 0.0 0 0 226.92 494.30"
              stroke="#b77432"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-287" onClick={() => handleClick('item-287')}>
            <path
              d="   M 1241.03 729.18   L 1245.60 728.77   A 0.26 0.25 86.5 0 0 1245.83 728.50   Q 1245.74 725.02 1245.58 721.75   Q 1245.58 721.70 1245.57 679.67   Q 1245.55 556.36 1245.71 422.75   Q 1245.72 418.04 1245.09 412.81   A 2.06 2.06 0.0 0 0 1243.10 410.99   L 1242.77 410.98   A 1.71 1.71 0.0 0 0 1240.99 412.69   L 1240.99 729.15   A 0.04 0.03 0.0 0 0 1241.03 729.18"
              stroke="#b77432"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-288" onClick={() => handleClick('item-288')}>
            <path
              d="   M 1324.72 509.27   C 1322.85 515.23 1322.98 520.29 1322.87 527.63   Q 1322.70 538.19 1322.85 551.12   C 1322.94 558.44 1322.37 565.40 1322.58 573.25   Q 1322.75 579.35 1322.70 589.29   Q 1322.62 603.87 1322.65 636.52   Q 1322.66 644.50 1323.30 651.44   A 0.98 0.97 87.4 0 0 1324.27 652.33   L 1326.02 652.33   A 1.11 1.11 0.0 0 0 1327.13 651.25   Q 1327.99 625.38 1327.76 598.35   Q 1327.37 553.16 1327.40 550.48   C 1327.58 534.75 1328.05 522.81 1326.17 509.39   A 0.75 0.75 0.0 0 0 1324.72 509.27"
              stroke="#b77432"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-289" onClick={() => handleClick('item-289')}>
            <path
              d="   M 0.31 902.83   L 0.00 904.07"
              stroke="#9c5d29"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-290" onClick={() => handleClick('item-290')}>
            <path
              d="   M 0.24 939.65   Q 0.21 938.98 0.00 938.62"
              stroke="#955724"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-291" onClick={() => handleClick('item-291')}>
            <path
              d="   M 342.97 982.85   Q 340.45 983.08 338.40 983.07   Q 239.55 982.88 139.91 983.02   C 126.62 983.04 109.93 982.75 95.31 982.82   Q 92.67 982.83 89.53 982.32"
              stroke="#1d354e"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-292" onClick={() => handleClick('item-292')}>
            <path
              d="   M 615.39 983.04   Q 606.95 983.20 598.75 983.19   Q 500.84 983.00 402.92 982.96   C 396.88 982.96 389.05 983.31 381.79 982.68"
              stroke="#1d354e"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-293" onClick={() => handleClick('item-293')}>
            <path
              d="   M 896.36 982.69   L 653.58 982.95"
              stroke="#1d354e"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-294" onClick={() => handleClick('item-294')}>
            <path
              d="   M 1166.24 982.13   Q 1161.64 983.09 1157.15 983.09   Q 1051.09 983.01 945.03 982.96   Q 941.62 982.96 934.76 983.54"
              stroke="#1d354e"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-295" onClick={() => handleClick('item-295')}>
            <path
              d="   M 1399.86 982.42   Q 1395.89 982.97 1390.98 982.97   Q 1298.13 982.94 1204.82 982.97"
              stroke="#1d354e"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g id="item-296" onClick={() => handleClick('item-296')}>
            <path
              d="   M 39.13 0.00   Q 38.09 4.51 38.06 10.75   Q 37.87 61.96 38.16 75.88   C 38.25 80.45 38.58 85.79 42.36 88.36   A 0.31 0.31 0.0 0 0 42.84 88.12   L 43.44 78.69   Q 43.77 80.47 44.69 81.98   L 44.65 895.69   A 0.40 0.40 0.0 0 1 44.25 896.09   L 0.00 896.26   L 0.00 631.35   L 42.12 631.46   A 1.01 1.01 0.0 0 0 43.13 630.45   L 43.13 627.27   A 1.34 1.34 0.0 0 0 41.78 625.93   Q 25.19 626.04 9.24 626.09   C 6.21 626.10 3.04 626.54 0.00 627.00   L 0.00 190.51   L 42.30 190.87   A 0.77 0.76 -89.6 0 0 43.07 190.10   L 43.07 186.13   A 0.80 0.80 0.0 0 0 42.27 185.33   L 0.00 185.38   L 0.00 0.00   L 39.13 0.00   Z   M 10.19 279.84   L 8.27 281.76   A 1.25 1.23 -19.9 0 0 7.93 282.47   Q 7.18 288.46 7.17 289.43   C 6.84 313.74 7.18 336.59 7.07 360.57   Q 6.85 404.21 7.11 449.60   Q 7.16 457.80 8.84 464.92   A 0.54 0.54 0.0 0 0 9.88 464.94   Q 11.58 458.89 11.61 452.11   Q 11.90 402.77 11.61 381.28   C 11.22 352.77 12.08 321.29 11.55 291.70   Q 11.44 285.44 10.71 280.02   A 0.31 0.31 0.0 0 0 10.19 279.84   Z   M 6.66 895.16   L 8.98 895.16   A 0.93 0.93 0.0 0 0 9.91 894.23   L 9.91 764.88   A 8.14 1.25 -90.0 0 0 8.66 756.74   L 6.98 756.74   A 8.14 1.25 -90.0 0 0 5.73 764.88   L 5.73 894.23   A 0.93 0.93 0.0 0 0 6.66 895.16   Z"
              fill="#be7936"
            />
          </g>
          <g id="item-297" onClick={() => handleClick('item-297')}>
            <path
              d="   M 41.99 0.00   Q 42.30 3.15 42.33 6.32   Q 42.62 33.27 42.62 60.23   Q 42.62 68.76 43.93 76.49   L 43.44 78.69   L 42.84 88.12   A 0.31 0.31 0.0 0 1 42.36 88.36   C 38.58 85.79 38.25 80.45 38.16 75.88   Q 37.87 61.96 38.06 10.75   Q 38.09 4.51 39.13 0.00   L 41.99 0.00   Z"
              fill="#b06e2d"
            />
          </g>
          <g id="item-298" onClick={() => handleClick('item-298')}>
            <path
              d="   M 113.27 0.00   Q 112.93 33.35 113.03 66.70   Q 113.04 71.11 113.91 75.29   Q 82.71 75.01 51.31 75.08   Q 46.59 75.09 43.93 76.49   Q 42.62 68.76 42.62 60.23   Q 42.62 33.27 42.33 6.32   Q 42.30 3.15 41.99 0.00   L 113.27 0.00   Z"
              fill="#be7936"
            />
          </g>
          <g id="item-299" onClick={() => handleClick('item-299')}>
            <path
              d="   M 116.53 0.00   Q 117.81 4.19 117.81 10.26   Q 117.81 42.20 117.72 74.14   Q 117.72 75.03 117.38 75.33   Q 115.74 75.87 113.91 75.29   Q 113.04 71.11 113.03 66.70   Q 112.93 33.35 113.27 0.00   L 116.53 0.00   Z"
              fill="#b06e2d"
            />
          </g>
          <g id="item-300" onClick={() => handleClick('item-300')}>
            <path
              d="   M 186.47 0.00   Q 185.72 3.65 185.67 8.63   Q 185.40 39.75 185.56 57.34   Q 185.63 64.83 184.87 75.13   L 117.38 75.33   Q 117.72 75.03 117.72 74.14   Q 117.81 42.20 117.81 10.26   Q 117.81 4.19 116.53 0.00   L 186.47 0.00   Z"
              fill="#be7936"
            />
          </g>
          <g id="item-301" onClick={() => handleClick('item-301')}>
            <path
              d="   M 190.06 0.00   L 190.36 75.14   L 184.87 75.13   Q 185.63 64.83 185.56 57.34   Q 185.40 39.75 185.67 8.63   Q 185.72 3.65 186.47 0.00   L 190.06 0.00   Z"
              fill="#b06e2d"
            />
          </g>
          <g id="item-302" onClick={() => handleClick('item-302')}>
            <path
              d="   M 260.21 0.00   L 259.66 75.07   L 190.36 75.14   L 190.06 0.00   L 260.21 0.00   Z"
              fill="#be7936"
            />
          </g>
          <g id="item-303" onClick={() => handleClick('item-303')}>
            <path
              d="   M 263.25 0.00   Q 264.42 4.54 264.47 9.27   Q 264.78 38.12 264.18 66.97   Q 264.13 69.31 264.63 75.17   L 259.66 75.07   L 260.21 0.00   L 263.25 0.00   Z"
              fill="#b06e2d"
            />
          </g>
          <g id="item-304" onClick={() => handleClick('item-304')}>
            <path
              d="   M 393.30 0.00   Q 392.48 3.27 392.46 11.04   Q 392.34 43.08 392.89 75.20   L 318.19 75.05   Q 317.48 66.99 317.55 61.45   Q 317.93 29.29 317.56 4.58   Q 317.56 4.45 317.29 1.33   A 1.22 1.21 87.4 0 0 316.08 0.22   L 314.31 0.22   A 1.47 1.47 0.0 0 0 312.84 1.69   L 312.85 75.20   L 264.63 75.17   Q 264.13 69.31 264.18 66.97   Q 264.78 38.12 264.47 9.27   Q 264.42 4.54 263.25 0.00   L 393.30 0.00   Z"
              fill="#be7936"
            />
          </g>
          <g id="item-305" onClick={() => handleClick('item-305')}>
            <path
              d="   M 396.65 0.00   Q 397.16 5.87 397.39 24.98   Q 397.69 49.88 397.44 75.17   Q 395.22 75.83 392.89 75.20   Q 392.34 43.08 392.46 11.04   Q 392.48 3.27 393.30 0.00   L 396.65 0.00   Z"
              fill="#b06e2d"
            />
          </g>
          <g id="item-306" onClick={() => handleClick('item-306')}>
            <path
              d="   M 479.74 0.00   L 479.86 75.22   L 397.44 75.17   Q 397.69 49.88 397.39 24.98   Q 397.16 5.87 396.65 0.00   L 479.74 0.00   Z"
              fill="#be7936"
            />
          </g>
          <g id="item-307" onClick={() => handleClick('item-307')}>
            <path
              d="   M 484.33 0.00   L 484.43 75.18   L 479.86 75.22   L 479.74 0.00   L 484.33 0.00   Z"
              fill="#b06e2d"
            />
          </g>
          <g id="item-308" onClick={() => handleClick('item-308')}>
            <path
              d="   M 553.96 0.00   Q 553.71 4.02 553.71 8.05   Q 553.71 36.75 553.84 65.44   Q 553.86 68.93 554.31 75.31   L 484.43 75.18   L 484.33 0.00   L 553.96 0.00   Z"
              fill="#be7936"
            />
          </g>
          <g id="item-309" onClick={() => handleClick('item-309')}>
            <path
              d="   M 556.98 0.00   Q 557.89 3.34 557.92 5.33   Q 558.42 40.07 558.01 75.05   L 554.31 75.31   Q 553.86 68.93 553.84 65.44   Q 553.71 36.75 553.71 8.05   Q 553.71 4.02 553.96 0.00   L 556.98 0.00   Z"
              fill="#b06e2d"
            />
          </g>
          <g id="item-310" onClick={() => handleClick('item-310')}>
            <path
              d="   M 601.92 0.00   L 601.58 75.16   L 558.01 75.05   Q 558.42 40.07 557.92 5.33   Q 557.89 3.34 556.98 0.00   L 601.92 0.00   Z"
              fill="#be7936"
            />
          </g>
          <g id="item-311" onClick={() => handleClick('item-311')}>
            <path
              d="   M 604.77 0.00   Q 606.12 1.62 606.15 5.87   Q 606.30 24.45 606.27 32.80   Q 606.19 51.48 606.47 70.14   Q 606.51 72.55 606.95 75.03   Q 604.39 75.68 601.58 75.16   L 601.92 0.00   L 604.77 0.00   Z"
              fill="#b06e2d"
            />
          </g>
          <g id="item-312" onClick={() => handleClick('item-312')}>
            <path
              d="   M 658.00 0.00   L 657.72 75.11   L 606.95 75.03   Q 606.51 72.55 606.47 70.14   Q 606.19 51.48 606.27 32.80   Q 606.30 24.45 606.15 5.87   Q 606.12 1.62 604.77 0.00   L 658.00 0.00   Z"
              fill="#be7936"
            />
          </g>
          <g id="item-313" onClick={() => handleClick('item-313')}>
            <path
              d="   M 662.46 0.00   L 662.56 75.14   Q 660.07 75.58 657.72 75.11   L 658.00 0.00   L 662.46 0.00   Z"
              fill="#b06e2d"
            />
          </g>
          <g id="item-314" onClick={() => handleClick('item-314')}>
            <path
              d="   M 706.53 0.00   Q 705.26 3.46 705.22 7.09   Q 704.85 37.27 705.09 67.45   Q 705.12 70.51 706.29 75.21   L 662.56 75.14   L 662.46 0.00   L 706.53 0.00   Z"
              fill="#be7936"
            />
          </g>
          <g id="item-315" onClick={() => handleClick('item-315')}>
            <path
              d="   M 709.13 0.00   Q 709.55 5.21 709.63 10.42   Q 710.04 40.32 709.80 70.22   Q 709.79 72.47 710.06 75.12   L 706.29 75.21   Q 705.12 70.51 705.09 67.45   Q 704.85 37.27 705.22 7.09   Q 705.26 3.46 706.53 0.00   L 709.13 0.00   Z"
              fill="#b06e2d"
            />
          </g>
          <g id="item-316" onClick={() => handleClick('item-316')}>
            <path
              d="   M 769.95 0.00   C 769.52 2.40 769.13 4.77 769.07 7.27   Q 768.26 41.23 769.58 75.26   L 710.06 75.12   Q 709.79 72.47 709.80 70.22   Q 710.04 40.32 709.63 10.42   Q 709.55 5.21 709.13 0.00   L 769.95 0.00   Z"
              fill="#be7936"
            />
          </g>
          <g id="item-317" onClick={() => handleClick('item-317')}>
            <path
              d="   M 773.20 0.00   Q 773.71 3.63 773.70 5.74   Q 773.52 40.37 773.64 75.07   L 769.58 75.26   Q 768.26 41.23 769.07 7.27   C 769.13 4.77 769.52 2.40 769.95 0.00   L 773.20 0.00   Z"
              fill="#b06e2d"
            />
          </g>
          <g id="item-318" onClick={() => handleClick('item-318')}>
            <path
              d="   M 829.64 0.00   Q 827.00 8.83 827.66 21.75   Q 828.24 33.07 827.85 67.99   Q 827.81 71.44 827.26 75.08   L 773.64 75.07   Q 773.52 40.37 773.70 5.74   Q 773.71 3.63 773.20 0.00   L 829.64 0.00   Z"
              fill="#be7936"
            />
          </g>
          <g id="item-319" onClick={() => handleClick('item-319')}>
            <path
              d="   M 832.26 0.00   L 833.03 75.16   Q 830.14 75.66 827.26 75.08   Q 827.81 71.44 827.85 67.99   Q 828.24 33.07 827.66 21.75   Q 827.00 8.83 829.64 0.00   L 832.26 0.00   Z"
              fill="#b06e2d"
            />
          </g>
          <g id="item-320" onClick={() => handleClick('item-320')}>
            <path
              d="   M 879.69 0.00   L 879.78 75.25   L 833.03 75.16   L 832.26 0.00   L 879.69 0.00   Z"
              fill="#be7936"
            />
          </g>
          <g id="item-321" onClick={() => handleClick('item-321')}>
            <path
              d="   M 884.03 0.00   L 884.17 75.17   Q 882.28 75.66 879.78 75.25   L 879.69 0.00   L 884.03 0.00   Z"
              fill="#b06e2d"
            />
          </g>
          <g id="item-322" onClick={() => handleClick('item-322')}>
            <path
              d="   M 958.48 0.00   Q 957.76 3.62 957.72 5.27   Q 957.13 37.24 957.17 69.21   Q 957.18 72.03 956.79 75.00   L 884.17 75.17   L 884.03 0.00   L 958.48 0.00   Z"
              fill="#be7936"
            />
          </g>
          <g id="item-323" onClick={() => handleClick('item-323')}>
            <path
              d="   M 960.99 0.00   Q 961.95 4.33 961.94 8.77   Q 961.90 37.26 961.86 65.74   Q 961.85 70.34 961.56 75.05   L 956.79 75.00   Q 957.18 72.03 957.17 69.21   Q 957.13 37.24 957.72 5.27   Q 957.76 3.62 958.48 0.00   L 960.99 0.00   Z"
              fill="#b06e2d"
            />
          </g>
          <g id="item-324" onClick={() => handleClick('item-324')}>
            <path
              d="   M 1035.39 0.00   C 1035.18 2.49 1034.86 5.05 1034.84 7.51   Q 1034.69 37.09 1034.67 66.67   Q 1034.67 71.26 1036.31 75.30   L 961.56 75.05   Q 961.85 70.34 961.86 65.74   Q 961.90 37.26 961.94 8.77   Q 961.95 4.33 960.99 0.00   L 1035.39 0.00   Z"
              fill="#be7936"
            />
          </g>
          <g id="item-325" onClick={() => handleClick('item-325')}>
            <path
              d="   M 1038.63 0.00   Q 1039.57 7.71 1039.58 10.89   Q 1039.70 42.96 1039.28 75.20   Q 1037.15 74.91 1036.31 75.30   Q 1034.67 71.26 1034.67 66.67   Q 1034.69 37.09 1034.84 7.51   C 1034.86 5.05 1035.18 2.49 1035.39 0.00   L 1038.63 0.00   Z"
              fill="#b06e2d"
            />
          </g>
          <g id="item-326" onClick={() => handleClick('item-326')}>
            <path
              d="   M 1084.26 0.00   Q 1083.86 3.51 1083.81 7.04   Q 1083.36 41.09 1084.04 75.22   L 1039.28 75.20   Q 1039.70 42.96 1039.58 10.89   Q 1039.57 7.71 1038.63 0.00   L 1084.26 0.00   Z"
              fill="#be7936"
            />
          </g>
          <g id="item-327" onClick={() => handleClick('item-327')}>
            <path
              d="   M 1087.66 0.00   Q 1087.94 3.04 1087.95 6.09   Q 1088.02 25.92 1088.24 45.75   Q 1088.41 60.52 1087.57 75.11   L 1084.04 75.22   Q 1083.36 41.09 1083.81 7.04   Q 1083.86 3.51 1084.26 0.00   L 1087.66 0.00   Z"
              fill="#b06e2d"
            />
          </g>
          <g id="item-328" onClick={() => handleClick('item-328')}>
            <path
              d="   M 1145.96 0.00   L 1145.92 75.34   L 1087.57 75.11   Q 1088.41 60.52 1088.24 45.75   Q 1088.02 25.92 1087.95 6.09   Q 1087.94 3.04 1087.66 0.00   L 1145.96 0.00   Z"
              fill="#be7936"
            />
          </g>
          <g id="item-329" onClick={() => handleClick('item-329')}>
            <path
              d="   M 1150.25 0.00   Q 1150.37 30.49 1150.50 60.98   Q 1150.52 68.15 1149.22 75.25   L 1145.92 75.34   L 1145.96 0.00   L 1150.25 0.00   Z"
              fill="#b06e2d"
            />
          </g>
          <g id="item-330" onClick={() => handleClick('item-330')}>
            <path
              d="   M 1293.20 0.00   Q 1292.67 5.07 1292.72 10.25   Q 1292.94 36.37 1292.77 62.49   Q 1292.72 69.07 1293.35 75.22   L 1220.09 75.12   L 1219.86 1.68   A 1.40 1.37 23.0 0 0 1219.45 0.70   Q 1218.27 -0.48 1216.40 0.55   A 1.01 1.01 0.0 0 0 1215.86 1.46   L 1215.97 75.13   L 1149.22 75.25   Q 1150.52 68.15 1150.50 60.98   Q 1150.37 30.49 1150.25 0.00   L 1293.20 0.00   Z"
              fill="#be7936"
            />
          </g>
          <g id="item-331" onClick={() => handleClick('item-331')}>
            <path
              d="   M 1296.92 0.00   Q 1297.41 3.74 1297.38 7.56   Q 1297.17 33.77 1297.08 59.99   Q 1297.06 67.57 1297.18 75.08   Q 1295.84 75.45 1293.35 75.22   Q 1292.72 69.07 1292.77 62.49   Q 1292.94 36.37 1292.72 10.25   Q 1292.67 5.07 1293.20 0.00   L 1296.92 0.00   Z"
              fill="#b06e2d"
            />
          </g>
          <g id="item-332" onClick={() => handleClick('item-332')}>
            <path
              d="   M 1345.17 0.00   L 1345.02 75.31   L 1297.18 75.08   Q 1297.06 67.57 1297.08 59.99   Q 1297.17 33.77 1297.38 7.56   Q 1297.41 3.74 1296.92 0.00   L 1345.17 0.00   Z"
              fill="#be7936"
            />
          </g>
          <g id="item-333" onClick={() => handleClick('item-333')}>
            <path
              d="   M 1349.62 0.00   L 1349.61 75.09   L 1345.02 75.31   L 1345.17 0.00   L 1349.62 0.00   Z"
              fill="#b06e2d"
            />
          </g>
          <g id="item-334" onClick={() => handleClick('item-334')}>
            <path
              d="   M 1441.40 0.00   Q 1441.00 4.17 1440.99 6.31   Q 1440.89 40.79 1440.84 75.30   L 1349.61 75.09   L 1349.62 0.00   L 1441.40 0.00   Z"
              fill="#be7936"
            />
          </g>
          <g id="item-335" onClick={() => handleClick('item-335')}>
            <path
              d="   M 1445.00 0.00   Q 1445.77 5.49 1445.78 6.91   Q 1445.82 32.09 1445.93 57.27   Q 1445.97 68.90 1444.46 78.61   Q 1443.01 76.20 1440.84 75.30   Q 1440.89 40.79 1440.99 6.31   Q 1441.00 4.17 1441.40 0.00   L 1445.00 0.00   Z"
              fill="#b06e2d"
            />
          </g>
          <g id="item-336" onClick={() => handleClick('item-336')}>
            <path
              d="   M 1508.50 0.00   L 1508.29 185.68   A 1.15 1.14 -89.5 0 1 1507.14 186.82   Q 1479.57 186.73 1451.06 186.94   Q 1449.48 186.95 1444.82 187.44   L 1444.46 78.61   Q 1445.97 68.90 1445.93 57.27   Q 1445.82 32.09 1445.78 6.91   Q 1445.77 5.49 1445.00 0.00   L 1508.50 0.00   Z"
              fill="#be7936"
            />
          </g>
          <g id="item-337" onClick={() => handleClick('item-337')}>
            <path
              d="   M 1512.93 0.00   C 1513.27 3.07 1513.62 6.24 1513.56 9.31   C 1513.04 34.21 1513.70 55.83 1513.42 80.19   C 1513.08 108.59 1513.82 129.18 1513.32 156.95   Q 1513.17 164.98 1513.27 188.22   Q 1513.45 230.52 1513.38 312.39   Q 1513.36 326.25 1513.43 328.14   C 1513.91 341.51 1513.38 353.77 1513.47 367.40   C 1513.64 392.49 1513.98 415.69 1513.55 438.42   C 1513.10 462.30 1513.72 480.68 1513.46 509.16   C 1513.27 531.11 1513.61 564.78 1513.40 594.60   Q 1513.32 606.30 1513.44 626.24   A 0.35 0.35 0.0 0 0 1513.83 626.59   C 1520.80 625.96 1529.30 625.42 1536.00 627.75   L 1536.00 631.22   C 1528.76 632.20 1521.30 631.85 1514.41 632.09   A 1.34 1.34 0.0 0 0 1513.11 633.44   L 1513.75 895.09   Q 1510.76 895.57 1507.54 894.91   C 1509.25 885.31 1508.04 875.35 1508.20 865.51   Q 1508.78 830.11 1508.27 801.04   A 1.09 1.08 -0.3 0 0 1507.18 799.97   L 1445.64 799.97   A 0.60 0.59 90.0 0 1 1445.05 799.37   L 1445.05 794.67   A 0.59 0.58 -87.8 0 1 1445.68 794.08   Q 1455.80 794.73 1461.89 794.64   Q 1485.12 794.30 1507.02 794.61   A 1.36 1.36 0.0 0 0 1508.40 793.24   C 1508.07 748.19 1508.50 699.18 1508.39 651.63   Q 1508.37 642.64 1508.85 633.02   A 1.09 1.08 -88.7 0 0 1507.77 631.88   L 1445.51 631.88   A 0.61 0.61 0.0 0 1 1444.90 631.27   L 1444.90 626.86   A 0.98 0.97 -88.3 0 1 1445.93 625.88   Q 1461.42 626.71 1480.17 626.24   C 1489.46 626.00 1496.80 626.29 1507.48 626.31   A 0.95 0.95 0.0 0 0 1508.43 625.36   L 1508.43 420.54   A 0.83 0.83 0.0 0 0 1507.58 419.71   Q 1485.44 420.27 1454.06 420.09   C 1451.49 420.07 1447.94 420.51 1445.80 420.62   A 0.78 0.77 88.6 0 1 1444.99 419.84   L 1444.99 415.45   A 0.67 0.67 0.0 0 1 1445.67 414.78   Q 1465.77 415.00 1488.94 414.62   C 1494.10 414.54 1501.43 414.91 1507.47 415.41   A 0.83 0.83 0.0 0 0 1508.37 414.58   L 1508.37 193.71   A 0.95 0.95 0.0 0 0 1507.42 192.76   L 1444.73 192.58   L 1444.82 187.44   Q 1449.48 186.95 1451.06 186.94   Q 1479.57 186.73 1507.14 186.82   A 1.15 1.14 -89.5 0 0 1508.29 185.68   L 1508.50 0.00   L 1512.93 0.00   Z"
              fill="#b06e2d"
            />
          </g>
          <g id="item-338" onClick={() => handleClick('item-338')}>
            <path
              d="   M 1536.00 0.00   L 1536.00 627.75   C 1529.30 625.42 1520.80 625.96 1513.83 626.59   A 0.35 0.35 0.0 0 1 1513.44 626.24   Q 1513.32 606.30 1513.40 594.60   C 1513.61 564.78 1513.27 531.11 1513.46 509.16   C 1513.72 480.68 1513.10 462.30 1513.55 438.42   C 1513.98 415.69 1513.64 392.49 1513.47 367.40   C 1513.38 353.77 1513.91 341.51 1513.43 328.14   Q 1513.36 326.25 1513.38 312.39   Q 1513.45 230.52 1513.27 188.22   Q 1513.17 164.98 1513.32 156.95   C 1513.82 129.18 1513.08 108.59 1513.42 80.19   C 1513.70 55.83 1513.04 34.21 1513.56 9.31   C 1513.62 6.24 1513.27 3.07 1512.93 0.00   L 1536.00 0.00   Z"
              fill="#be7936"
            />
          </g>
          <g id="item-339" onClick={() => handleClick('item-339')}>
            <path
              d="   M 318.19 75.05   L 312.85 75.20   L 312.84 1.69   A 1.47 1.47 0.0 0 1 314.31 0.22   L 316.08 0.22   A 1.22 1.21 87.4 0 1 317.29 1.33   Q 317.56 4.45 317.56 4.58   Q 317.93 29.29 317.55 61.45   Q 317.48 66.99 318.19 75.05   Z"
              fill="#b06e2d"
            />
          </g>
          <g id="item-340" onClick={() => handleClick('item-340')}>
            <path
              d="   M 1220.09 75.12   L 1215.97 75.13   L 1215.86 1.46   A 1.01 1.01 0.0 0 1 1216.40 0.55   Q 1218.27 -0.48 1219.45 0.70   A 1.40 1.37 23.0 0 1 1219.86 1.68   L 1220.09 75.12   Z"
              fill="#b06e2d"
            />
          </g>
          <g id="item-341" onClick={() => handleClick('item-341')}>
            <path
              d="   M 113.91 75.29   Q 115.74 75.87 117.38 75.33   L 184.87 75.13   L 190.36 75.14   L 259.66 75.07   L 264.63 75.17   L 312.85 75.20   L 318.19 75.05   L 392.89 75.20   Q 395.22 75.83 397.44 75.17   L 479.86 75.22   L 484.43 75.18   L 554.31 75.31   L 558.01 75.05   L 601.58 75.16   Q 604.39 75.68 606.95 75.03   L 657.72 75.11   Q 660.07 75.58 662.56 75.14   L 706.29 75.21   L 710.06 75.12   L 769.58 75.26   L 773.64 75.07   L 827.26 75.08   Q 830.14 75.66 833.03 75.16   L 879.78 75.25   Q 882.28 75.66 884.17 75.17   L 956.79 75.00   L 961.56 75.05   L 1036.31 75.30   Q 1037.15 74.91 1039.28 75.20   L 1084.04 75.22   L 1087.57 75.11   L 1145.92 75.34   L 1149.22 75.25   L 1215.97 75.13   L 1220.09 75.12   L 1293.35 75.22   Q 1295.84 75.45 1297.18 75.08   L 1345.02 75.31   L 1349.61 75.09   L 1440.84 75.30   Q 1443.01 76.20 1444.46 78.61   L 1444.82 187.44   L 1444.73 192.58   Q 1444.71 210.86 1444.63 229.25   C 1444.48 262.87 1444.81 296.75 1444.62 330.13   C 1444.52 349.23 1444.96 365.67 1444.75 382.09   C 1444.64 390.70 1445.01 399.54 1444.79 409.43   Q 1444.54 420.66 1444.63 425.59   Q 1444.69 429.28 1444.70 451.25   Q 1444.70 451.72 1444.61 557.96   C 1444.59 581.12 1445.01 602.42 1444.80 624.25   C 1444.78 626.19 1444.39 627.89 1444.62 629.71   Q 1444.83 631.37 1444.82 633.82   Q 1444.54 710.03 1444.74 770.59   C 1444.77 777.74 1445.16 782.52 1444.92 788.24   Q 1444.59 795.85 1444.69 801.47   Q 1445.02 820.80 1444.60 854.06   C 1444.42 868.10 1444.90 881.26 1444.42 893.77   A 0.99 0.98 8.4 0 0 1445.16 894.76   C 1449.01 895.73 1452.72 895.12 1457.18 895.11   Q 1482.36 895.02 1507.54 894.91   Q 1510.76 895.57 1513.75 895.09   Q 1525.81 894.80 1535.01 895.45   Q 1535.59 895.49 1535.20 896.14   L 1443.95 895.97   A 0.39 0.39 0.0 0 1 1443.56 895.57   Q 1443.61 652.63 1443.55 80.75   Q 1443.54 76.44 1438.75 76.39   Q 1423.69 76.25 1401.50 76.25   Q 1261.41 76.26 50.84 76.24   C 45.93 76.24 44.16 76.52 44.69 81.98   Q 43.77 80.47 43.44 78.69   L 43.93 76.49   Q 46.59 75.09 51.31 75.08   Q 82.71 75.01 113.91 75.29   Z"
              fill="#dd9a50"
            />
          </g>
          <g id="item-342" onClick={() => handleClick('item-342')}>
            <path
              d="   M 1535.20 896.14   Q 1535.46 896.34 1536.00 896.25   L 1536.00 902.75   L 1444.07 902.81   A 0.52 0.51 90.0 0 0 1443.56 903.33   L 1443.56 939.40   A 0.51 0.51 0.0 0 0 1444.07 939.91   L 1536.00 939.87   L 1536.00 946.44   L 1444.40 946.44   A 0.69 0.69 0.0 0 0 1443.74 946.93   Q 1443.27 948.44 1443.31 950.63   Q 1443.49 962.06 1443.32 981.25   C 1443.28 984.91 1442.53 986.42 1438.75 986.44   Q 1423.00 986.54 1410.50 986.53   Q 1407.00 986.52 1404.08 985.89   A 2.43 2.38 72.2 0 1 1402.94 985.29   L 1399.86 982.42   Q 1377.18 964.54 1353.77 948.06   C 1350.76 945.94 1349.01 945.35 1345.50 945.44   Q 1334.32 945.76 1319.37 945.66   C 1307.26 945.59 1295.68 946.07 1285.00 945.78   Q 1272.82 945.46 1206.09 945.80   A 1.60 1.60 0.0 0 0 1204.50 947.41   L 1204.82 982.97   Q 1204.93 984.37 1204.09 985.53   A 1.36 1.34 11.6 0 1 1203.29 986.05   Q 1201.51 986.42 1199.50 986.44   C 1184.98 986.57 1177.74 987.16 1170.07 986.06   A 2.00 1.92 66.6 0 1 1169.16 985.68   Q 1166.95 984.03 1166.24 982.13   L 1134.40 947.37   A 5.18 5.18 0.0 0 0 1130.58 945.69   L 937.10 945.69   A 2.34 2.34 0.0 0 0 934.76 948.03   L 934.76 983.54   Q 933.70 986.58 930.00 986.48   Q 922.76 986.27 911.25 986.48   Q 906.01 986.57 902.75 986.52   Q 900.99 986.50 899.37 985.87   A 1.93 1.91 -8.9 0 1 898.61 985.32   L 896.36 982.69   L 879.88 947.10   A 2.47 2.46 -12.3 0 0 877.64 945.67   L 673.17 945.67   A 2.72 2.72 0.0 0 0 670.72 947.21   L 653.58 982.95   Q 652.13 986.50 648.51 986.49   Q 636.68 986.47 622.75 986.51   C 620.22 986.52 615.75 986.82 615.39 983.04   L 615.17 946.31   A 0.66 0.66 0.0 0 0 614.51 945.65   L 418.09 945.65   A 4.53 4.51 21.3 0 0 414.77 947.10   L 381.79 982.68   Q 380.94 984.10 379.33 985.25   Q 377.62 986.46 375.53 986.48   Q 361.13 986.64 346.50 986.49   Q 342.50 986.45 342.97 982.85   L 343.07 946.85   A 1.06 1.05 -88.9 0 0 342.06 945.79   Q 336.60 945.57 330.70 945.62   C 313.63 945.75 295.66 945.46 285.13 945.82   Q 283.01 945.89 271.32 945.70   Q 259.78 945.51 257.50 945.61   Q 256.86 945.64 235.75 945.66   Q 186.83 945.72 174.09 945.57   C 164.13 945.45 156.37 945.66 142.75 945.46   Q 140.66 945.42 137.79 946.07   A 5.29 5.27 17.2 0 0 135.31 947.37   C 130.93 951.46 126.07 954.63 121.90 957.77   Q 105.76 969.96 89.53 982.32   L 86.28 985.16   A 5.39 5.39 0.0 0 1 82.79 986.49   Q 61.07 986.68 47.77 986.36   C 44.47 986.28 44.47 982.51 44.48 980.25   Q 44.49 973.29 44.69 948.76   Q 44.71 946.42 42.50 946.44   Q 21.25 946.63 0.00 946.74   L 0.00 940.51   L 0.24 939.65   Q 0.89 940.05 1.24 940.05   Q 19.59 940.00 43.80 940.00   A 0.91 0.91 0.0 0 0 44.71 939.09   L 44.71 903.92   A 1.18 1.17 90.0 0 0 43.54 902.74   L 0.31 902.83   L 0.00 901.58   L 0.00 896.26   L 44.25 896.09   A 0.40 0.40 0.0 0 0 44.65 895.69   L 44.69 81.98   C 44.16 76.52 45.93 76.24 50.84 76.24   Q 1261.41 76.26 1401.50 76.25   Q 1423.69 76.25 1438.75 76.39   Q 1443.54 76.44 1443.55 80.75   Q 1443.61 652.63 1443.56 895.57   A 0.39 0.39 0.0 0 0 1443.95 895.97   L 1535.20 896.14   Z   M 96.29 111.92   L 347.39 112.27   A 1.82 1.82 0.0 0 1 349.21 114.09   L 349.44 975.79   Q 349.11 977.95 349.44 979.46   A 0.67 0.66 -6.5 0 0 350.09 979.97   L 373.71 979.97   A 0.43 0.42 90.0 0 0 374.13 979.54   L 374.09 113.79   Q 374.50 112.23 376.22 112.18   Q 385.65 111.92 391.50 111.92   Q 504.00 111.91 616.50 111.93   C 618.07 111.93 620.82 111.85 621.60 113.30   L 621.68 979.75   A 0.22 0.21 0.0 0 0 621.90 979.96   L 645.76 979.99   L 646.24 113.41   A 1.08 1.08 0.0 0 1 647.20 112.34   Q 649.66 112.06 656.00 112.05   Q 813.56 111.92 899.50 111.84   Q 902.74 111.84 904.59 113.01   L 904.88 979.39   A 0.60 0.60 0.0 0 0 905.48 979.99   L 928.03 979.99   A 0.54 0.53 90.0 0 0 928.56 979.45   L 928.72 113.96   Q 928.45 112.04 931.24 112.04   Q 935.21 112.03 940.37 112.03   Q 1134.08 111.83 1167.75 112.11   Q 1171.74 112.15 1172.93 112.41   A 1.42 1.41 -83.6 0 1 1174.03 113.79   L 1174.03 979.29   A 0.72 0.72 0.0 0 0 1174.75 980.01   L 1198.36 980.01   A 0.27 0.26 0.0 0 0 1198.63 979.75   L 1198.63 113.09   A 0.78 0.78 0.0 0 1 1199.33 112.31   Q 1200.99 112.12 1208.50 112.08   Q 1226.95 111.97 1404.25 111.94   Q 1406.90 111.94 1408.29 113.24   L 1408.40 979.49   A 0.50 0.49 0.0 0 0 1408.90 979.98   L 1436.74 979.98   A 0.41 0.41 0.0 0 0 1437.15 979.57   L 1437.15 82.96   A 0.23 0.22 -90.0 0 0 1436.93 82.73   L 51.35 82.73   A 0.33 0.32 90.0 0 0 51.03 83.06   L 51.03 979.37   A 0.63 0.63 0.0 0 0 51.66 980.00   L 80.50 980.00   A 0.64 0.64 0.0 0 0 81.14 979.36   L 81.14 113.32   A 1.18 1.18 0.0 0 1 82.30 112.14   L 96.29 111.92   Z   M 343.14 118.75   A 0.31 0.31 0.0 0 0 342.83 118.44   L 92.45 118.44   A 0.31 0.31 0.0 0 0 92.24 118.98   L 123.37 146.88   A 0.31 0.31 0.0 0 0 123.58 146.96   L 342.83 146.96   A 0.31 0.31 0.0 0 0 343.14 146.65   L 343.14 118.75   Z   M 615.38 118.77   A 0.34 0.34 0.0 0 0 615.04 118.43   L 385.38 118.43   A 0.34 0.34 0.0 0 0 385.12 118.99   L 408.44 146.83   A 0.34 0.34 0.0 0 0 408.70 146.95   L 615.04 146.95   A 0.34 0.34 0.0 0 0 615.38 146.61   L 615.38 118.77   Z   M 671.19 146.70   A 0.47 0.47 0.0 0 0 671.60 146.95   L 879.71 146.95   A 0.47 0.47 0.0 0 0 880.12 146.70   L 895.12 119.11   A 0.47 0.47 0.0 0 0 894.71 118.42   L 656.60 118.42   A 0.47 0.47 0.0 0 0 656.19 119.11   L 671.19 146.70   Z   M 935.06 146.63   A 0.31 0.31 0.0 0 0 935.37 146.94   L 1141.42 146.94   A 0.31 0.31 0.0 0 0 1141.66 146.83   L 1164.60 118.94   A 0.31 0.31 0.0 0 0 1164.36 118.43   L 935.37 118.43   A 0.31 0.31 0.0 0 0 935.06 118.74   L 935.06 146.63   Z   M 1204.90 146.47   A 0.47 0.47 0.0 0 0 1205.37 146.94   L 1368.52 146.94   A 0.47 0.47 0.0 0 0 1368.85 146.81   L 1398.20 119.24   A 0.47 0.47 0.0 0 0 1397.88 118.43   L 1205.37 118.43   A 0.47 0.47 0.0 0 0 1204.90 118.90   L 1204.90 146.47   Z   M 120.16 249.75   A 0.33 0.33 0.0 0 0 120.49 249.42   L 120.49 153.21   A 0.33 0.33 0.0 0 0 120.38 152.96   L 88.41 124.31   A 0.33 0.33 0.0 0 0 87.86 124.56   L 87.86 249.42   A 0.33 0.33 0.0 0 0 88.19 249.75   L 120.16 249.75   Z   M 404.54 249.76   A 0.31 0.31 0.0 0 0 404.85 249.45   L 404.85 152.68   A 0.31 0.31 0.0 0 0 404.78 152.48   L 381.00 124.10   A 0.31 0.31 0.0 0 0 380.45 124.30   L 380.45 249.45   A 0.31 0.31 0.0 0 0 380.76 249.76   L 404.54 249.76   Z   M 1401.60 249.76   A 0.31 0.31 0.0 0 0 1401.91 249.45   L 1401.91 125.68   A 0.31 0.31 0.0 0 0 1401.39 125.45   L 1371.53 153.50   A 0.31 0.31 0.0 0 0 1371.43 153.72   L 1371.43 249.45   A 0.31 0.31 0.0 0 0 1371.74 249.76   L 1401.60 249.76   Z   M 1167.77 126.36   A 0.38 0.38 0.0 0 0 1167.10 126.12   Q 1153.74 142.42 1147.37 150.12   Q 1145.25 152.68 1145.26 156.25   Q 1145.31 223.97 1145.22 248.90   A 0.90 0.90 0.0 0 0 1146.12 249.80   L 1167.29 249.80   A 0.48 0.48 0.0 0 0 1167.77 249.32   L 1167.77 126.36   Z   M 665.91 249.71   A 0.34 0.34 0.0 0 0 666.25 249.37   L 666.25 151.46   A 0.34 0.34 0.0 0 0 666.21 151.29   L 652.96 126.93   A 0.34 0.34 0.0 0 0 652.32 127.10   L 652.32 249.37   A 0.34 0.34 0.0 0 0 652.66 249.71   L 665.91 249.71   Z   M 897.83 249.66   A 0.49 0.49 0.0 0 0 898.32 249.17   L 898.32 129.25   A 0.49 0.49 0.0 0 0 897.40 129.01   L 884.81 152.16   A 0.49 0.49 0.0 0 0 884.75 152.39   L 884.75 249.17   A 0.49 0.49 0.0 0 0 885.24 249.66   L 897.83 249.66   Z   M 343.06 153.79   A 0.60 0.60 0.0 0 0 342.46 153.19   L 127.68 153.19   A 0.60 0.60 0.0 0 0 127.08 153.79   L 127.08 249.15   A 0.60 0.60 0.0 0 0 127.68 249.75   L 342.46 249.75   A 0.60 0.60 0.0 0 0 343.06 249.15   L 343.06 153.79   Z   M 615.38 153.94   A 0.77 0.77 0.0 0 0 614.61 153.17   L 412.03 153.17   A 0.77 0.77 0.0 0 0 411.26 153.94   L 411.26 248.96   A 0.77 0.77 0.0 0 0 412.03 249.73   L 614.61 249.73   A 0.77 0.77 0.0 0 0 615.38 248.96   L 615.38 153.94   Z   M 878.35 153.76   A 0.56 0.56 0.0 0 0 877.79 153.20   L 673.43 153.20   A 0.56 0.56 0.0 0 0 672.87 153.76   L 672.87 249.20   A 0.56 0.56 0.0 0 0 673.43 249.76   L 877.79 249.76   A 0.56 0.56 0.0 0 0 878.35 249.20   L 878.35 153.76   Z   M 1138.84 153.93   A 0.74 0.74 0.0 0 0 1138.10 153.19   L 935.76 153.19   A 0.74 0.74 0.0 0 0 935.02 153.93   L 935.02 248.99   A 0.74 0.74 0.0 0 0 935.76 249.73   L 1138.10 249.73   A 0.74 0.74 0.0 0 0 1138.84 248.99   L 1138.84 153.93   Z   M 1365.01 154.06   A 0.87 0.87 0.0 0 0 1364.14 153.19   L 1205.80 153.19   A 0.87 0.87 0.0 0 0 1204.93 154.06   L 1204.93 248.86   A 0.87 0.87 0.0 0 0 1205.80 249.73   L 1364.14 249.73   A 0.87 0.87 0.0 0 0 1365.01 248.86   L 1365.01 154.06   Z   M 343.14 256.56   A 0.60 0.60 0.0 0 0 342.54 255.96   L 88.46 255.96   A 0.60 0.60 0.0 0 0 87.86 256.56   L 87.86 276.22   A 0.60 0.60 0.0 0 0 88.46 276.82   L 342.54 276.82   A 0.60 0.60 0.0 0 0 343.14 276.22   L 343.14 256.56   Z   M 615.38 256.28   A 0.32 0.32 0.0 0 0 615.06 255.96   L 380.86 255.96   A 0.32 0.32 0.0 0 0 380.54 256.28   L 380.54 276.50   A 0.32 0.32 0.0 0 0 380.86 276.82   L 615.06 276.82   A 0.32 0.32 0.0 0 0 615.38 276.50   L 615.38 256.28   Z   M 898.27 256.49   A 0.51 0.51 0.0 0 0 897.76 255.98   L 652.88 255.98   A 0.51 0.51 0.0 0 0 652.37 256.49   L 652.37 276.31   A 0.51 0.51 0.0 0 0 652.88 276.82   L 897.76 276.82   A 0.51 0.51 0.0 0 0 898.27 276.31   L 898.27 256.49   Z   M 1167.72 256.48   A 0.51 0.51 0.0 0 0 1167.21 255.97   L 935.49 255.97   A 0.51 0.51 0.0 0 0 934.98 256.48   L 934.98 276.32   A 0.51 0.51 0.0 0 0 935.49 276.83   L 1167.21 276.83   A 0.51 0.51 0.0 0 0 1167.72 276.32   L 1167.72 256.48   Z   M 1401.84 256.50   A 0.53 0.53 0.0 0 0 1401.31 255.97   L 1205.41 255.97   A 0.53 0.53 0.0 0 0 1204.88 256.50   L 1204.88 276.28   A 0.53 0.53 0.0 0 0 1205.41 276.81   L 1401.31 276.81   A 0.53 0.53 0.0 0 0 1401.84 276.28   L 1401.84 256.50   Z   M 88.52 756.83   L 119.38 734.08   A 2.74 2.74 0.0 0 0 120.49 731.88   L 120.49 338.73   A 0.63 0.62 -86.3 0 0 119.95 338.11   Q 114.61 337.36 110.00 339.75   A 4.09 3.54 -34.2 0 1 105.39 339.21   C 99.93 333.39 100.03 323.64 103.70 317.29   C 105.11 314.85 107.93 313.09 110.56 314.61   Q 111.24 315.00 113.46 316.42   A 1.77 1.76 -28.7 0 0 114.40 316.69   L 119.97 316.69   A 0.58 0.57 0.0 0 0 120.55 316.12   L 120.55 283.66   A 0.54 0.54 0.0 0 0 120.01 283.12   L 88.39 283.12   A 0.54 0.54 0.0 0 0 87.85 283.66   L 87.85 756.50   A 0.42 0.42 0.0 0 0 88.52 756.83   Z   M 343.12 283.56   A 0.47 0.47 0.0 0 0 342.65 283.09   L 127.51 283.09   A 0.47 0.47 0.0 0 0 127.04 283.56   L 127.04 316.28   A 0.47 0.47 0.0 0 0 127.51 316.75   L 342.65 316.75   A 0.47 0.47 0.0 0 0 343.12 316.28   L 343.12 283.56   Z   M 381.23 757.29   L 403.82 733.21   A 3.90 3.88 66.7 0 0 404.87 730.55   L 404.87 338.91   A 1.00 0.99 -2.4 0 0 403.79 337.92   L 400.56 338.20   A 1.49 1.40 -58.2 0 0 400.04 338.34   C 398.04 339.35 396.76 340.26 395.04 340.11   Q 392.24 339.88 390.79 336.71   C 388.09 330.82 387.71 321.31 391.90 315.88   C 393.52 313.78 396.20 313.59 398.48 315.32   Q 400.87 317.14 404.40 316.76   A 0.48 0.48 0.0 0 0 404.84 316.28   L 404.84 283.68   A 0.58 0.58 0.0 0 0 404.26 283.10   L 380.66 283.10   A 0.26 0.25 90.0 0 0 380.41 283.36   L 380.41 756.97   A 0.47 0.47 0.0 0 0 381.23 757.29   Z   M 615.44 283.75   A 0.65 0.65 0.0 0 0 614.79 283.10   L 411.91 283.10   A 0.65 0.65 0.0 0 0 411.26 283.75   L 411.26 316.09   A 0.65 0.65 0.0 0 0 411.91 316.74   L 614.79 316.74   A 0.65 0.65 0.0 0 0 615.44 316.09   L 615.44 283.75   Z   M 666.24 314.50   L 666.24 283.70   A 0.64 0.63 0.0 0 0 665.60 283.07   L 652.99 283.07   A 0.64 0.64 0.0 0 0 652.35 283.71   L 652.35 753.90   A 0.30 0.30 0.0 0 0 652.91 754.06   Q 658.53 744.95 664.41 736.01   C 666.23 733.26 666.28 731.29 666.28 728.00   Q 666.19 534.24 666.28 340.47   A 0.55 0.55 0.0 0 0 665.51 339.96   Q 661.66 341.59 659.58 337.59   Q 654.66 328.11 658.56 318.26   C 659.67 315.44 662.70 312.33 665.62 314.78   A 0.38 0.37 20.3 0 0 666.24 314.50   Z   M 878.38 283.76   A 0.66 0.66 0.0 0 0 877.72 283.10   L 673.56 283.10   A 0.66 0.66 0.0 0 0 672.90 283.76   L 672.90 316.08   A 0.66 0.66 0.0 0 0 673.56 316.74   L 877.72 316.74   A 0.66 0.66 0.0 0 0 878.38 316.08   L 878.38 283.76   Z   M 898.31 753.08   L 898.31 283.85   A 0.74 0.74 0.0 0 0 897.57 283.11   L 885.30 283.11   A 0.55 0.55 0.0 0 0 884.75 283.66   L 884.75 313.22   A 0.71 0.70 -87.8 0 0 885.40 313.93   Q 890.17 314.31 891.91 320.43   Q 894.34 328.95 891.37 336.09   Q 889.58 340.38 885.24 340.17   A 0.41 0.41 0.0 0 0 884.81 340.57   Q 884.65 367.40 884.67 401.02   Q 884.74 522.87 884.65 725.76   C 884.65 730.51 884.44 733.07 886.66 736.33   Q 893.81 746.86 897.90 753.20   A 0.22 0.22 0.0 0 0 898.31 753.08   Z   M 1138.85 283.78   A 0.69 0.69 0.0 0 0 1138.16 283.09   L 935.76 283.09   A 0.69 0.69 0.0 0 0 935.07 283.78   L 935.07 316.04   A 0.69 0.69 0.0 0 0 935.76 316.73   L 1138.16 316.73   A 0.69 0.69 0.0 0 0 1138.85 316.04   L 1138.85 283.78   Z   M 1167.79 755.12   L 1167.79 284.04   A 0.96 0.96 0.0 0 0 1166.83 283.08   L 1146.08 283.08   A 0.76 0.75 90.0 0 0 1145.33 283.84   L 1145.33 315.87   A 0.72 0.71 -83.4 0 0 1145.88 316.57   Q 1149.38 317.42 1151.83 315.81   C 1155.27 313.56 1157.39 313.07 1159.75 316.59   C 1163.49 322.18 1162.87 331.49 1160.21 336.92   C 1157.87 341.71 1154.73 340.12 1151.11 338.38   A 2.69 2.54 -29.1 0 0 1150.13 338.13   L 1146.38 337.88   A 1.03 1.02 -87.9 0 0 1145.29 338.90   Q 1145.21 351.28 1145.25 730.50   Q 1145.25 732.23 1146.56 733.68   Q 1156.86 744.98 1167.15 755.39   A 0.38 0.37 -67.7 0 0 1167.79 755.12   Z   M 1365.03 283.49   A 0.40 0.40 0.0 0 0 1364.63 283.09   L 1205.31 283.09   A 0.40 0.40 0.0 0 0 1204.91 283.49   L 1204.91 316.37   A 0.40 0.40 0.0 0 0 1205.31 316.77   L 1364.63 316.77   A 0.40 0.40 0.0 0 0 1365.03 316.37   L 1365.03 283.49   Z   M 1401.90 756.61   L 1401.90 283.91   A 0.79 0.78 90.0 0 0 1401.12 283.12   L 1372.45 283.12   A 0.94 0.94 0.0 0 0 1371.51 284.06   L 1371.51 315.97   A 0.59 0.58 7.9 0 0 1371.94 316.53   Q 1375.23 317.47 1377.63 315.87   C 1380.93 313.67 1383.61 312.83 1386.17 316.37   C 1390.06 321.74 1390.02 329.74 1387.69 335.44   C 1386.49 338.38 1383.28 341.93 1379.77 339.50   Q 1377.23 337.74 1372.84 337.97   A 1.49 1.48 88.6 0 0 1371.43 339.46   L 1371.43 731.41   A 2.47 2.46 19.4 0 0 1372.35 733.33   L 1401.71 756.70   A 0.12 0.12 0.0 0 0 1401.90 756.61   Z   M 343.11 324.31   A 0.76 0.76 0.0 0 0 342.35 323.55   L 108.83 323.55   A 0.76 0.76 0.0 0 0 108.07 324.31   L 108.07 330.41   A 0.76 0.76 0.0 0 0 108.83 331.17   L 342.35 331.17   A 0.76 0.76 0.0 0 0 343.11 330.41   L 343.11 324.31   Z   M 615.34 330.24   L 615.34 324.46   A 0.93 0.93 0.0 0 0 614.41 323.53   L 396.69 323.53   A 2.23 1.27 -90.0 0 0 395.42 325.76   L 395.42 328.94   A 2.23 1.27 -90.0 0 0 396.69 331.17   L 614.41 331.17   A 0.93 0.93 0.0 0 0 615.34 330.24   Z   M 886.24 324.86   A 1.32 1.32 0.0 0 0 884.92 323.54   L 665.24 323.54   A 1.32 1.32 0.0 0 0 663.92 324.86   L 663.92 329.86   A 1.32 1.32 0.0 0 0 665.24 331.18   L 884.92 331.18   A 1.32 1.32 0.0 0 0 886.24 329.86   L 886.24 324.86   Z   M 1155.40 324.30   A 0.77 0.77 0.0 0 0 1154.63 323.53   L 935.67 323.53   A 0.77 0.77 0.0 0 0 934.90 324.30   L 934.90 330.40   A 0.77 0.77 0.0 0 0 935.67 331.17   L 1154.63 331.17   A 0.77 0.77 0.0 0 0 1155.40 330.40   L 1155.40 324.30   Z   M 1382.35 324.30   A 0.75 0.75 0.0 0 0 1381.60 323.55   L 1205.56 323.55   A 0.75 0.75 0.0 0 0 1204.81 324.30   L 1204.81 330.48   A 0.75 0.75 0.0 0 0 1205.56 331.23   L 1381.60 331.23   A 0.75 0.75 0.0 0 0 1382.35 330.48   L 1382.35 324.30   Z   M 127.05 409.84   L 127.07 729.99   L 342.41 730.04   A 0.50 0.50 0.0 0 0 342.91 729.54   L 342.91 410.21   L 342.89 409.46   L 343.12 338.56   A 0.54 0.53 90.0 0 0 342.59 338.02   L 127.56 338.02   A 0.58 0.58 0.0 0 0 126.98 338.60   L 127.05 409.84   Z   M 411.27 409.85   L 411.27 728.90   L 411.34 729.83   A 0.29 0.28 87.8 0 0 411.62 730.10   L 614.66 730.10   A 0.54 0.54 0.0 0 0 615.20 729.56   L 615.24 409.78   L 615.35 338.56   A 0.54 0.53 -0.0 0 0 614.81 338.03   L 411.85 338.03   A 0.66 0.66 0.0 0 0 411.19 338.69   L 411.27 409.85   Z   M 673.03 409.78   L 672.95 729.82   A 0.29 0.29 0.0 0 0 673.24 730.11   L 878.02 730.11   A 0.26 0.26 0.0 0 0 878.28 729.85   L 878.32 409.17   L 878.34 338.59   A 0.56 0.56 0.0 0 0 877.78 338.03   L 673.40 338.03   A 0.52 0.51 -0.0 0 0 672.88 338.54   L 673.03 409.78   Z   M 935.03 409.82   L 935.20 427.00   L 935.11 729.57   A 0.54 0.53 -0.0 0 0 935.65 730.10   L 1138.42 730.10   A 0.47 0.47 0.0 0 0 1138.89 729.62   L 1138.72 722.22   L 1138.82 409.42   L 1138.81 338.52   A 0.49 0.49 0.0 0 0 1138.32 338.03   L 935.70 338.03   A 0.61 0.60 -0.0 0 0 935.09 338.63   L 935.03 409.82   Z   M 1205.17 409.40   L 1204.96 729.55   A 0.56 0.55 0.5 0 0 1205.52 730.11   L 1364.44 730.11   A 0.46 0.46 0.0 0 0 1364.90 729.65   L 1364.93 409.33   L 1365.03 338.45   A 0.43 0.43 0.0 0 0 1364.60 338.02   L 1205.46 338.02   A 0.54 0.53 -0.5 0 0 1204.92 338.56   L 1205.17 409.40   Z   M 104.45 753.50   L 90.22 764.29   A 0.27 0.27 0.0 0 0 90.38 764.77   L 342.46 764.77   A 0.60 0.59 -90.0 0 0 343.05 764.17   L 342.99 738.10   Q 343.12 737.45 342.93 737.01   A 0.41 0.41 0.0 0 0 342.55 736.75   L 128.20 736.75   A 4.55 4.50 26.1 0 0 125.46 737.67   L 104.45 753.50   Z   M 395.43 751.67   L 383.43 764.36   A 0.24 0.24 0.0 0 0 383.61 764.77   L 614.94 764.77   A 0.35 0.35 0.0 0 0 615.29 764.42   L 615.29 737.11   A 0.45 0.45 0.0 0 0 614.84 736.66   L 608.08 736.74   L 410.81 736.74   A 3.76 3.73 21.1 0 0 408.05 737.95   L 395.43 751.67   Z   M 664.16 748.25   L 653.77 764.36   A 0.25 0.25 0.0 0 0 653.98 764.74   L 877.54 764.74   L 897.13 764.70   A 0.19 0.19 0.0 0 0 897.29 764.41   L 880.13 738.11   A 2.97 2.94 73.2 0 0 877.66 736.77   L 673.07 736.77   A 2.77 2.74 16.2 0 0 670.75 738.03   L 664.16 748.25   Z   M 935.24 759.83   L 935.01 764.18   A 0.55 0.55 0.0 0 0 935.56 764.76   L 1166.20 764.76   A 0.29 0.28 -16.9 0 0 1166.44 764.32   Q 1164.25 761.03 1161.17 759.02   Q 1152.15 748.67 1142.72 738.95   C 1141.24 737.43 1140.02 736.72 1138.00 736.72   Q 1056.23 736.83 935.74 736.74   A 0.51 0.51 0.0 0 0 935.23 737.25   L 935.24 759.83   Z   M 1395.63 761.12   L 1367.65 737.97   A 5.38 5.33 64.6 0 0 1364.24 736.74   L 1207.57 736.79   Q 1206.51 736.53 1205.45 736.81   A 0.70 0.69 82.3 0 0 1204.94 737.48   L 1204.94 764.35   A 0.40 0.40 0.0 0 0 1205.34 764.75   L 1400.03 764.75   A 0.36 0.36 0.0 0 0 1400.28 764.13   Q 1398.04 761.96 1395.63 761.12   Z   M 343.18 771.92   A 0.67 0.67 0.0 0 0 342.51 771.25   L 88.57 771.25   A 0.67 0.67 0.0 0 0 87.90 771.92   L 87.90 790.70   A 0.67 0.67 0.0 0 0 88.57 791.37   L 342.51 791.37   A 0.67 0.67 0.0 0 0 343.18 790.70   L 343.18 771.92   Z   M 615.41 771.76   A 0.50 0.50 0.0 0 0 614.91 771.26   L 381.03 771.26   A 0.50 0.50 0.0 0 0 380.53 771.76   L 380.53 790.88   A 0.50 0.50 0.0 0 0 381.03 791.38   L 614.91 791.38   A 0.50 0.50 0.0 0 0 615.41 790.88   L 615.41 771.76   Z   M 898.35 771.83   A 0.57 0.57 0.0 0 0 897.78 771.26   L 652.98 771.26   A 0.57 0.57 0.0 0 0 652.41 771.83   L 652.41 790.79   A 0.57 0.57 0.0 0 0 652.98 791.36   L 897.78 791.36   A 0.57 0.57 0.0 0 0 898.35 790.79   L 898.35 771.83   Z   M 1167.85 772.02   A 0.76 0.76 0.0 0 0 1167.09 771.26   L 935.85 771.26   A 0.76 0.76 0.0 0 0 935.09 772.02   L 935.09 790.62   A 0.76 0.76 0.0 0 0 935.85 791.38   L 1167.09 791.38   A 0.76 0.76 0.0 0 0 1167.85 790.62   L 1167.85 772.02   Z   M 1401.86 771.70   A 0.45 0.45 0.0 0 0 1401.41 771.25   L 1205.35 771.25   A 0.45 0.45 0.0 0 0 1204.90 771.70   L 1204.90 790.92   A 0.45 0.45 0.0 0 0 1205.35 791.37   L 1401.41 791.37   A 0.45 0.45 0.0 0 0 1401.86 790.92   L 1401.86 771.70   Z   M 87.86 801.71   L 87.82 909.99   A 0.46 0.45 72.0 0 0 88.54 910.36   Q 109.51 894.91 129.57 880.06   Q 132.53 877.87 131.91 874.68   L 131.92 798.85   A 1.02 1.01 0.0 0 0 130.90 797.84   L 88.40 797.84   A 0.63 0.63 0.0 0 0 87.78 798.36   Q 87.46 800.05 87.86 801.71   Z   M 343.12 798.25   A 0.44 0.44 0.0 0 0 342.68 797.81   L 138.68 797.81   A 0.44 0.44 0.0 0 0 138.24 798.25   L 138.24 876.43   A 0.44 0.44 0.0 0 0 138.68 876.87   L 342.68 876.87   A 0.44 0.44 0.0 0 0 343.12 876.43   L 343.12 798.25   Z   M 380.52 816.61   L 380.52 907.97   A 0.50 0.50 0.0 0 0 381.38 908.32   Q 396.12 893.28 410.79 879.08   Q 411.21 878.67 411.28 878.24   Q 411.37 877.76 411.30 877.22   L 411.49 798.92   A 1.10 1.09 0.3 0 0 410.39 797.82   L 381.05 797.82   A 0.50 0.50 0.0 0 0 380.55 798.32   L 380.52 816.61   Z   M 615.43 798.45   A 0.64 0.64 0.0 0 0 614.79 797.81   L 418.43 797.81   A 0.64 0.64 0.0 0 0 417.79 798.45   L 417.79 876.21   A 0.64 0.64 0.0 0 0 418.43 876.85   L 614.79 876.85   A 0.64 0.64 0.0 0 0 615.43 876.21   L 615.43 798.45   Z   M 652.40 814.21   L 652.35 905.08   A 0.27 0.27 0.0 0 0 652.87 905.20   L 665.67 878.76   A 6.48 6.47 -32.3 0 0 666.32 875.89   L 666.21 856.45   L 666.36 798.35   A 0.59 0.59 0.0 0 0 665.77 797.75   L 652.86 797.75   A 0.49 0.49 0.0 0 0 652.37 798.25   L 652.40 814.21   Z   M 878.35 798.18   A 0.37 0.37 0.0 0 0 877.98 797.81   L 673.22 797.81   A 0.37 0.37 0.0 0 0 672.85 798.18   L 672.85 876.48   A 0.37 0.37 0.0 0 0 673.22 876.85   L 877.98 876.85   A 0.37 0.37 0.0 0 0 878.35 876.48   L 878.35 798.18   Z   M 885.00 862.11   L 884.80 878.51   A 6.27 6.26 32.5 0 0 885.41 881.25   L 897.73 906.67   A 0.21 0.21 0.0 0 0 898.12 906.58   L 898.12 812.91   L 898.29 798.33   A 0.52 0.52 0.0 0 0 897.77 797.80   L 885.33 797.80   A 0.42 0.42 0.0 0 0 884.91 798.22   L 885.00 862.11   Z   M 1130.88 798.18   A 0.36 0.36 0.0 0 0 1130.52 797.82   L 935.42 797.82   A 0.36 0.36 0.0 0 0 935.06 798.18   L 935.06 876.48   A 0.36 0.36 0.0 0 0 935.42 876.84   L 1130.52 876.84   A 0.36 0.36 0.0 0 0 1130.88 876.48   L 1130.88 798.18   Z   M 1137.37 871.31   L 1137.36 877.37   A 3.42 3.40 22.6 0 0 1138.36 879.78   L 1167.43 908.86   A 0.21 0.21 0.0 0 0 1167.79 908.71   L 1167.85 816.71   L 1167.67 798.45   A 0.64 0.64 0.0 0 0 1167.03 797.81   L 1137.84 797.81   A 0.58 0.58 0.0 0 0 1137.26 798.39   L 1137.37 871.31   Z   M 1351.91 798.23   A 0.41 0.41 0.0 0 0 1351.50 797.82   L 1205.32 797.82   A 0.41 0.41 0.0 0 0 1204.91 798.23   L 1204.91 876.45   A 0.41 0.41 0.0 0 0 1205.32 876.86   L 1351.50 876.86   A 0.41 0.41 0.0 0 0 1351.91 876.45   L 1351.91 798.23   Z   M 1359.10 878.76   L 1401.72 911.07   A 0.15 0.15 0.0 0 0 1401.96 910.95   L 1401.92 807.13   L 1401.67 798.36   A 0.58 0.57 -1.0 0 0 1401.09 797.81   L 1358.68 797.81   A 0.56 0.56 0.0 0 0 1358.12 798.38   Q 1358.40 834.48 1358.10 874.99   Q 1358.09 876.91 1359.10 878.76   Z   M 343.05 883.56   A 0.46 0.46 0.0 0 0 342.59 883.10   L 136.30 883.10   A 0.46 0.46 0.0 0 0 136.03 883.19   L 93.91 914.25   A 0.46 0.46 0.0 0 0 94.18 915.08   L 342.59 915.08   A 0.46 0.46 0.0 0 0 343.05 914.62   L 343.05 883.56   Z   M 615.38 883.44   A 0.33 0.33 0.0 0 0 615.05 883.11   L 415.90 883.11   A 0.33 0.33 0.0 0 0 415.66 883.21   L 384.35 914.52   A 0.33 0.33 0.0 0 0 384.59 915.08   L 615.05 915.08   A 0.33 0.33 0.0 0 0 615.38 914.75   L 615.38 883.44   Z   M 655.53 914.59   A 0.34 0.34 0.0 0 0 655.83 915.08   L 893.76 915.08   A 0.34 0.34 0.0 0 0 894.06 914.59   L 878.90 883.31   A 0.34 0.34 0.0 0 0 878.60 883.12   L 670.97 883.12   A 0.34 0.34 0.0 0 0 670.67 883.31   L 655.53 914.59   Z   M 1163.66 915.01   A 0.31 0.31 0.0 0 0 1163.69 914.55   Q 1146.43 896.65 1135.05 885.46   Q 1132.65 883.11 1130.32 883.11   Q 1020.37 883.07 935.62 883.17   A 0.60 0.60 0.0 0 0 935.02 883.77   L 935.02 914.61   A 0.46 0.46 0.0 0 0 935.48 915.07   L 1163.44 915.12   A 0.20 0.07 3.9 0 0 1163.60 915.08   Q 1163.63 915.03 1163.66 915.01   Z   M 1395.83 915.08   A 0.25 0.24 -26.4 0 0 1395.98 914.64   Q 1375.22 899.21 1357.73 885.73   C 1355.75 884.21 1353.63 883.08 1351.37 883.08   Q 1281.73 883.12 1205.65 883.14   A 0.73 0.73 0.0 0 0 1204.92 883.87   L 1204.92 914.47   A 0.61 0.61 0.0 0 0 1205.53 915.08   L 1395.83 915.08   Z   M 615.40 921.89   A 0.44 0.44 0.0 0 0 614.96 921.45   L 381.08 921.45   A 0.44 0.44 0.0 0 0 380.64 921.89   L 380.64 938.57   A 0.44 0.44 0.0 0 0 381.08 939.01   L 614.96 939.01   A 0.44 0.44 0.0 0 0 615.40 938.57   L 615.40 921.89   Z   M 1401.84 921.94   A 0.50 0.50 0.0 0 0 1401.34 921.44   L 1205.34 921.44   A 0.50 0.50 0.0 0 0 1204.84 921.94   L 1204.84 938.52   A 0.50 0.50 0.0 0 0 1205.34 939.02   L 1401.34 939.02   A 0.50 0.50 0.0 0 0 1401.84 938.52   L 1401.84 921.94   Z   M 343.12 922.02   A 0.57 0.57 0.0 0 0 342.55 921.45   L 88.45 921.45   A 0.57 0.57 0.0 0 0 87.88 922.02   L 87.88 938.44   A 0.57 0.57 0.0 0 0 88.45 939.01   L 342.55 939.01   A 0.57 0.57 0.0 0 0 343.12 938.44   L 343.12 922.02   Z   M 898.33 922.01   A 0.57 0.57 0.0 0 0 897.76 921.44   L 653.00 921.44   A 0.57 0.57 0.0 0 0 652.43 922.01   L 652.43 938.45   A 0.57 0.57 0.0 0 0 653.00 939.02   L 897.76 939.02   A 0.57 0.57 0.0 0 0 898.33 938.45   L 898.33 922.01   Z   M 1167.84 922.08   A 0.64 0.64 0.0 0 0 1167.20 921.44   L 935.74 921.44   A 0.64 0.64 0.0 0 0 935.10 922.08   L 935.10 938.38   A 0.64 0.64 0.0 0 0 935.74 939.02   L 1167.20 939.02   A 0.64 0.64 0.0 0 0 1167.84 938.38   L 1167.84 922.08   Z   M 380.96 945.52   A 0.49 0.49 0.0 0 0 380.47 946.01   L 380.47 973.50   A 0.49 0.49 0.0 0 0 381.32 973.84   L 407.09 946.35   A 0.49 0.49 0.0 0 0 406.73 945.52   L 380.96 945.52   Z   M 127.23 946.23   A 0.38 0.38 0.0 0 0 127.00 945.54   L 88.20 945.54   A 0.38 0.38 0.0 0 0 87.82 945.92   L 87.82 974.54   A 0.38 0.38 0.0 0 0 88.43 974.84   L 127.23 946.23   Z   M 652.49 970.35   L 664.26 946.06   A 0.39 0.39 0.0 0 0 663.91 945.50   L 653.18 945.50   A 0.82 0.82 0.0 0 0 652.36 946.32   L 652.36 970.32   A 0.07 0.07 0.0 0 0 652.49 970.35   Z   M 897.41 970.23   A 0.43 0.43 0.0 0 0 898.23 970.06   L 898.23 946.04   A 0.43 0.43 0.0 0 0 897.80 945.61   L 886.88 945.61   A 0.43 0.43 0.0 0 0 886.49 946.22   L 897.41 970.23   Z   M 1167.79 945.80   A 0.30 0.30 0.0 0 0 1167.49 945.50   L 1141.68 945.50   A 0.30 0.30 0.0 0 0 1141.46 946.01   L 1167.27 973.49   A 0.30 0.30 0.0 0 0 1167.79 973.28   L 1167.79 945.80   Z   M 1361.42 945.51   A 0.15 0.14 -26.6 0 0 1361.33 945.77   L 1401.26 975.22   A 0.37 0.37 0.0 0 0 1401.85 974.92   L 1401.85 946.05   A 0.54 0.54 0.0 0 0 1401.31 945.51   L 1361.42 945.51   Z"
              fill="#221d1a"
            />
          </g>
          <g id="item-343" onClick={() => handleClick('item-343')}>
            <path
              d="   M 1408.29 113.24   Q 1409.58 112.67 1409.68 115.94   Q 1410.00 126.13 1410.00 131.00   Q 1410.02 382.18 1409.97 927.95   Q 1409.97 963.93 1409.76 973.58   Q 1409.71 975.70 1409.38 977.83   A 1.00 1.00 0.0 0 0 1410.37 978.98   L 1435.18 978.98   A 1.02 1.01 90.0 0 0 1436.19 977.96   L 1436.19 84.81   A 1.00 1.00 0.0 0 0 1435.19 83.81   L 52.46 83.81   A 0.42 0.42 0.0 0 0 52.04 84.23   Q 51.93 373.72 51.90 749.75   Q 51.90 775.07 51.90 800.50   Q 51.94 952.68 51.89 952.74   Q 51.79 952.87 52.01 963.31   Q 52.17 970.95 51.65 977.97   A 0.93 0.92 -87.7 0 0 52.57 978.97   L 79.37 978.97   A 0.97 0.97 0.0 0 0 80.34 978.06   C 80.48 976.16 80.14 974.44 80.14 972.63   Q 80.30 820.97 80.10 790.50   C 80.04 781.30 80.18 776.05 80.19 769.17   Q 80.31 727.57 80.08 199.50   Q 80.07 175.74 80.10 115.28   Q 80.10 111.21 84.07 111.06   Q 92.34 110.76 96.09 110.86   A 0.48 0.48 0.0 0 1 96.49 111.59   L 96.29 111.92   L 82.30 112.14   A 1.18 1.18 0.0 0 0 81.14 113.32   L 81.14 979.36   A 0.64 0.64 0.0 0 1 80.50 980.00   L 51.66 980.00   A 0.63 0.63 0.0 0 1 51.03 979.37   L 51.03 83.06   A 0.33 0.32 -90.0 0 1 51.35 82.73   L 1436.93 82.73   A 0.23 0.22 90.0 0 1 1437.15 82.96   L 1437.15 979.57   A 0.41 0.41 0.0 0 1 1436.74 979.98   L 1408.90 979.98   A 0.50 0.49 0.0 0 1 1408.40 979.49   L 1408.29 113.24   Z"
              fill="#dd9a50"
            />
          </g>
          <g id="item-344" onClick={() => handleClick('item-344')}>
            <path
              d="   M 1408.29 113.24   Q 1406.90 111.94 1404.25 111.94   Q 1226.95 111.97 1208.50 112.08   Q 1200.99 112.12 1199.33 112.31   A 0.78 0.78 0.0 0 0 1198.63 113.09   L 1198.63 979.75   A 0.27 0.26 0.0 0 1 1198.36 980.01   L 1174.75 980.01   A 0.72 0.72 0.0 0 1 1174.03 979.29   L 1174.03 113.79   A 1.42 1.41 -83.6 0 0 1172.93 112.41   Q 1171.74 112.15 1167.75 112.11   Q 1134.08 111.83 940.37 112.03   Q 935.21 112.03 931.24 112.04   Q 928.45 112.04 928.72 113.96   Q 927.49 116.93 927.31 121.44   Q 927.04 128.23 927.01 137.50   Q 926.79 198.73 927.26 261.17   C 927.36 274.24 926.69 285.14 927.04 297.24   Q 927.26 304.96 927.12 324.35   Q 926.89 356.19 927.15 433.66   Q 927.38 500.90 927.31 636.93   Q 927.28 708.02 927.16 763.81   Q 927.15 770.28 927.36 774.53   C 927.81 783.45 927.05 791.85 927.06 801.30   Q 927.11 826.46 927.01 882.41   C 926.96 912.62 927.38 939.00 927.29 968.76   Q 927.28 970.48 927.47 977.43   A 1.45 1.45 0.0 0 1 926.02 978.92   L 907.02 978.92   A 1.41 1.41 0.0 0 1 905.61 977.45   Q 905.82 972.61 905.83 968.51   Q 906.07 895.10 905.74 853.08   Q 905.70 847.47 905.71 846.72   Q 906.20 819.16 905.65 766.42   Q 905.63 764.32 905.84 756.62   Q 905.94 752.95 905.88 746.80   Q 905.62 722.17 905.75 660.93   Q 905.86 606.36 905.93 539.75   Q 905.97 506.51 905.81 473.23   C 905.71 451.95 906.04 430.34 905.83 412.33   C 905.68 399.89 905.96 388.12 905.87 375.01   Q 905.77 360.63 905.82 347.01   Q 906.06 285.35 905.73 265.25   Q 905.60 257.66 905.74 248.74   C 905.99 231.96 905.89 216.71 905.78 205.75   C 905.72 199.86 906.05 194.59 905.94 188.47   Q 905.59 169.40 905.86 154.41   C 906.12 140.25 905.86 130.22 905.84 114.77   Q 905.84 113.80 904.59 113.01   Q 902.74 111.84 899.50 111.84   Q 813.56 111.92 656.00 112.05   Q 649.66 112.06 647.20 112.34   A 1.08 1.08 0.0 0 0 646.24 113.41   L 645.76 979.99   Q 646.02 978.68 645.51 978.68   C 644.67 978.69 643.88 979.00 643.13 979.00   Q 633.29 978.92 623.90 979.00   A 1.00 1.00 0.0 0 1 622.89 978.00   Q 622.97 913.24 622.91 865.75   Q 622.89 844.75 622.89 759.56   Q 622.89 742.09 622.92 736.25   Q 622.97 724.41 622.90 642.25   C 622.86 584.82 623.20 510.07 622.77 474.82   Q 622.70 469.15 622.88 452.61   C 623.12 430.83 622.85 407.94 622.91 387.25   Q 623.02 349.53 622.89 319.09   Q 622.88 316.61 622.89 309.84   Q 622.99 207.46 622.88 117.00   Q 622.88 116.10 622.40 113.41   A 0.37 0.37 0.0 0 0 622.01 113.11   Q 621.78 113.12 621.60 113.30   C 620.82 111.85 618.07 111.93 616.50 111.93   Q 504.00 111.91 391.50 111.92   Q 385.65 111.92 376.22 112.18   Q 374.50 112.23 374.09 113.79   L 373.75 113.85   A 0.47 0.46 85.7 0 0 373.36 114.31   L 373.36 978.16   A 0.92 0.91 -88.8 0 1 372.41 979.08   Q 362.63 978.73 351.86 979.16   Q 350.07 979.24 349.44 975.79   L 349.21 114.09   A 1.82 1.82 0.0 0 0 347.39 112.27   L 96.29 111.92   L 96.49 111.59   A 0.48 0.48 0.0 0 0 96.09 110.86   Q 92.34 110.76 84.07 111.06   Q 80.10 111.21 80.10 115.28   Q 80.07 175.74 80.08 199.50   Q 80.31 727.57 80.19 769.17   C 80.18 776.05 80.04 781.30 80.10 790.50   Q 80.30 820.97 80.14 972.63   C 80.14 974.44 80.48 976.16 80.34 978.06   A 0.97 0.97 0.0 0 1 79.37 978.97   L 52.57 978.97   A 0.93 0.92 -87.7 0 1 51.65 977.97   Q 52.17 970.95 52.01 963.31   Q 51.79 952.87 51.89 952.74   Q 51.94 952.68 51.90 800.50   Q 51.90 775.07 51.90 749.75   Q 51.93 373.72 52.04 84.23   A 0.42 0.42 0.0 0 1 52.46 83.81   L 1435.19 83.81   A 1.00 1.00 0.0 0 1 1436.19 84.81   L 1436.19 977.96   A 1.02 1.01 90.0 0 1 1435.18 978.98   L 1410.37 978.98   A 1.00 1.00 0.0 0 1 1409.38 977.83   Q 1409.71 975.70 1409.76 973.58   Q 1409.97 963.93 1409.97 927.95   Q 1410.02 382.18 1410.00 131.00   Q 1410.00 126.13 1409.68 115.94   Q 1409.58 112.67 1408.29 113.24   Z"
              fill="#c67f3a"
            />
          </g>
          <g id="item-345" onClick={() => handleClick('item-345')}>
            <path
              d="   M 645.76 979.99   L 621.90 979.96   A 0.22 0.21 0.0 0 1 621.68 979.75   L 621.60 113.30   Q 621.78 113.12 622.01 113.11   A 0.37 0.37 0.0 0 1 622.40 113.41   Q 622.88 116.10 622.88 117.00   Q 622.99 207.46 622.89 309.84   Q 622.88 316.61 622.89 319.09   Q 623.02 349.53 622.91 387.25   C 622.85 407.94 623.12 430.83 622.88 452.61   Q 622.70 469.15 622.77 474.82   C 623.20 510.07 622.86 584.82 622.90 642.25   Q 622.97 724.41 622.92 736.25   Q 622.89 742.09 622.89 759.56   Q 622.89 844.75 622.91 865.75   Q 622.97 913.24 622.89 978.00   A 1.00 1.00 0.0 0 0 623.90 979.00   Q 633.29 978.92 643.13 979.00   C 643.88 979.00 644.67 978.69 645.51 978.68   Q 646.02 978.68 645.76 979.99   Z"
              fill="#dd9a50"
            />
          </g>
          <g id="item-346" onClick={() => handleClick('item-346')}>
            <path
              d="   M 928.72 113.96   L 928.56 979.45   A 0.54 0.53 -90.0 0 1 928.03 979.99   L 905.48 979.99   A 0.60 0.60 0.0 0 1 904.88 979.39   L 904.59 113.01   Q 905.84 113.80 905.84 114.77   C 905.86 130.22 906.12 140.25 905.86 154.41   Q 905.59 169.40 905.94 188.47   C 906.05 194.59 905.72 199.86 905.78 205.75   C 905.89 216.71 905.99 231.96 905.74 248.74   Q 905.60 257.66 905.73 265.25   Q 906.06 285.35 905.82 347.01   Q 905.77 360.63 905.87 375.01   C 905.96 388.12 905.68 399.89 905.83 412.33   C 906.04 430.34 905.71 451.95 905.81 473.23   Q 905.97 506.51 905.93 539.75   Q 905.86 606.36 905.75 660.93   Q 905.62 722.17 905.88 746.80   Q 905.94 752.95 905.84 756.62   Q 905.63 764.32 905.65 766.42   Q 906.20 819.16 905.71 846.72   Q 905.70 847.47 905.74 853.08   Q 906.07 895.10 905.83 968.51   Q 905.82 972.61 905.61 977.45   A 1.41 1.41 0.0 0 0 907.02 978.92   L 926.02 978.92   A 1.45 1.45 0.0 0 0 927.47 977.43   Q 927.28 970.48 927.29 968.76   C 927.38 939.00 926.96 912.62 927.01 882.41   Q 927.11 826.46 927.06 801.30   C 927.05 791.85 927.81 783.45 927.36 774.53   Q 927.15 770.28 927.16 763.81   Q 927.28 708.02 927.31 636.93   Q 927.38 500.90 927.15 433.66   Q 926.89 356.19 927.12 324.35   Q 927.26 304.96 927.04 297.24   C 926.69 285.14 927.36 274.24 927.26 261.17   Q 926.79 198.73 927.01 137.50   Q 927.04 128.23 927.31 121.44   Q 927.49 116.93 928.72 113.96   Z"
              fill="#dd9a50"
            />
          </g>
          <g id="item-347" onClick={() => handleClick('item-347')}>
            <path
              d="   M 374.09 113.79   L 374.13 979.54   A 0.43 0.42 90.0 0 1 373.71 979.97   L 350.09 979.97   A 0.67 0.66 -6.5 0 1 349.44 979.46   Q 349.11 977.95 349.44 975.79   Q 350.07 979.24 351.86 979.16   Q 362.63 978.73 372.41 979.08   A 0.92 0.91 -88.8 0 0 373.36 978.16   L 373.36 114.31   A 0.47 0.46 85.7 0 1 373.75 113.85   L 374.09 113.79   Z"
              fill="#dd9a50"
            />
          </g>
          <g id="item-348" onClick={() => handleClick('item-348')}>
            <path
              d="   M 343.14 118.75   L 343.14 146.65   A 0.31 0.31 0.0 0 1 342.83 146.96   L 123.58 146.96   A 0.31 0.31 0.0 0 1 123.37 146.88   L 92.24 118.98   A 0.31 0.31 0.0 0 1 92.45 118.44   L 342.83 118.44   A 0.31 0.31 0.0 0 1 343.14 118.75   Z"
              fill="#7a401b"
            />
          </g>
          <g id="item-349" onClick={() => handleClick('item-349')}>
            <path
              d="   M 615.38 118.77   L 615.38 146.61   A 0.34 0.34 0.0 0 1 615.04 146.95   L 408.70 146.95   A 0.34 0.34 0.0 0 1 408.44 146.83   L 385.12 118.99   A 0.34 0.34 0.0 0 1 385.38 118.43   L 615.04 118.43   A 0.34 0.34 0.0 0 1 615.38 118.77   Z"
              fill="#7a401b"
            />
          </g>
          <g id="item-350" onClick={() => handleClick('item-350')}>
            <path
              d="   M 671.19 146.70   L 656.19 119.11   A 0.47 0.47 0.0 0 1 656.60 118.42   L 894.71 118.42   A 0.47 0.47 0.0 0 1 895.12 119.11   L 880.12 146.70   A 0.47 0.47 0.0 0 1 879.71 146.95   L 671.60 146.95   A 0.47 0.47 0.0 0 1 671.19 146.70   Z"
              fill="#7a401b"
            />
          </g>
          <g id="item-351" onClick={() => handleClick('item-351')}>
            <path
              d="   M 935.06 146.63   L 935.06 118.74   A 0.31 0.31 0.0 0 1 935.37 118.43   L 1164.36 118.43   A 0.31 0.31 0.0 0 1 1164.60 118.94   L 1141.66 146.83   A 0.31 0.31 0.0 0 1 1141.42 146.94   L 935.37 146.94   A 0.31 0.31 0.0 0 1 935.06 146.63   Z"
              fill="#7a401b"
            />
          </g>
          <g id="item-352" onClick={() => handleClick('item-352')}>
            <path
              d="   M 1204.90 146.47   L 1204.90 118.90   A 0.47 0.47 0.0 0 1 1205.37 118.43   L 1397.88 118.43   A 0.47 0.47 0.0 0 1 1398.20 119.24   L 1368.85 146.81   A 0.47 0.47 0.0 0 1 1368.52 146.94   L 1205.37 146.94   A 0.47 0.47 0.0 0 1 1204.90 146.47   Z"
              fill="#7a401b"
            />
          </g>
          <g id="item-353" onClick={() => handleClick('item-353')}>
            <path
              d="   M 120.16 249.75   L 88.19 249.75   A 0.33 0.33 0.0 0 1 87.86 249.42   L 87.86 124.56   A 0.33 0.33 0.0 0 1 88.41 124.31   L 120.38 152.96   A 0.33 0.33 0.0 0 1 120.49 153.21   L 120.49 249.42   A 0.33 0.33 0.0 0 1 120.16 249.75   Z"
              fill="#7a401b"
            />
          </g>
          <g id="item-354" onClick={() => handleClick('item-354')}>
            <path
              d="   M 404.54 249.76   L 380.76 249.76   A 0.31 0.31 0.0 0 1 380.45 249.45   L 380.45 124.30   A 0.31 0.31 0.0 0 1 381.00 124.10   L 404.78 152.48   A 0.31 0.31 0.0 0 1 404.85 152.68   L 404.85 249.45   A 0.31 0.31 0.0 0 1 404.54 249.76   Z"
              fill="#7a401b"
            />
          </g>
          <g id="item-355" onClick={() => handleClick('item-355')}>
            <path
              d="   M 1401.60 249.76   L 1371.74 249.76   A 0.31 0.31 0.0 0 1 1371.43 249.45   L 1371.43 153.72   A 0.31 0.31 0.0 0 1 1371.53 153.50   L 1401.39 125.45   A 0.31 0.31 0.0 0 1 1401.91 125.68   L 1401.91 249.45   A 0.31 0.31 0.0 0 1 1401.60 249.76   Z"
              fill="#7a401b"
            />
          </g>
          <g id="item-356" onClick={() => handleClick('item-356')}>
            <path
              d="   M 1167.77 126.36   L 1167.77 249.32   A 0.48 0.48 0.0 0 1 1167.29 249.80   L 1146.12 249.80   A 0.90 0.90 0.0 0 1 1145.22 248.90   Q 1145.31 223.97 1145.26 156.25   Q 1145.25 152.68 1147.37 150.12   Q 1153.74 142.42 1167.10 126.12   A 0.38 0.38 0.0 0 1 1167.77 126.36   Z"
              fill="#7a401b"
            />
          </g>
          <g id="item-357" onClick={() => handleClick('item-357')}>
            <path
              d="   M 665.91 249.71   L 652.66 249.71   A 0.34 0.34 0.0 0 1 652.32 249.37   L 652.32 127.10   A 0.34 0.34 0.0 0 1 652.96 126.93   L 666.21 151.29   A 0.34 0.34 0.0 0 1 666.25 151.46   L 666.25 249.37   A 0.34 0.34 0.0 0 1 665.91 249.71   Z"
              fill="#7a401b"
            />
          </g>
          <g id="item-358" onClick={() => handleClick('item-358')}>
            <path
              d="   M 897.83 249.66   L 885.24 249.66   A 0.49 0.49 0.0 0 1 884.75 249.17   L 884.75 152.39   A 0.49 0.49 0.0 0 1 884.81 152.16   L 897.40 129.01   A 0.49 0.49 0.0 0 1 898.32 129.25   L 898.32 249.17   A 0.49 0.49 0.0 0 1 897.83 249.66   Z"
              fill="#7a401b"
            />
          </g>
          <g id="item-359" onClick={() => handleClick('item-359')}>
            <rect fill="#8b4c1f" height="96.56" rx="0.60" width="215.98" x="127.08" y="153.19" />
          </g>
          <g id="item-360" onClick={() => handleClick('item-360')}>
            <rect fill="#8b4c1f" height="96.56" rx="0.77" width="204.12" x="411.26" y="153.17" />
          </g>
          <g id="item-361" onClick={() => handleClick('item-361')}>
            <rect fill="#8b4c1f" height="96.56" rx="0.56" width="205.48" x="672.87" y="153.20" />
          </g>
          <g id="item-362" onClick={() => handleClick('item-362')}>
            <rect fill="#8b4c1f" height="96.54" rx="0.74" width="203.82" x="935.02" y="153.19" />
          </g>
          <g id="item-363" onClick={() => handleClick('item-363')}>
            <rect fill="#8b4c1f" height="96.54" rx="0.87" width="160.08" x="1204.93" y="153.19" />
          </g>
          <g id="item-364" onClick={() => handleClick('item-364')}>
            <path
              d="   M 0.00 190.51   L 0.00 185.38   L 42.27 185.33   A 0.80 0.80 0.0 0 1 43.07 186.13   L 43.07 190.10   A 0.77 0.76 -89.6 0 1 42.30 190.87   L 0.00 190.51   Z"
              fill="#b06e2d"
            />
          </g>
          <g id="item-365" onClick={() => handleClick('item-365')}>
            <path
              d="   M 1507.54 894.91   Q 1482.36 895.02 1457.18 895.11   C 1452.72 895.12 1449.01 895.73 1445.16 894.76   A 0.99 0.98 8.4 0 1 1444.42 893.77   C 1444.90 881.26 1444.42 868.10 1444.60 854.06   Q 1445.02 820.80 1444.69 801.47   Q 1444.59 795.85 1444.92 788.24   C 1445.16 782.52 1444.77 777.74 1444.74 770.59   Q 1444.54 710.03 1444.82 633.82   Q 1444.83 631.37 1444.62 629.71   C 1444.39 627.89 1444.78 626.19 1444.80 624.25   C 1445.01 602.42 1444.59 581.12 1444.61 557.96   Q 1444.70 451.72 1444.70 451.25   Q 1444.69 429.28 1444.63 425.59   Q 1444.54 420.66 1444.79 409.43   C 1445.01 399.54 1444.64 390.70 1444.75 382.09   C 1444.96 365.67 1444.52 349.23 1444.62 330.13   C 1444.81 296.75 1444.48 262.87 1444.63 229.25   Q 1444.71 210.86 1444.73 192.58   L 1507.42 192.76   A 0.95 0.95 0.0 0 1 1508.37 193.71   L 1508.37 414.58   A 0.83 0.83 0.0 0 1 1507.47 415.41   C 1501.43 414.91 1494.10 414.54 1488.94 414.62   Q 1465.77 415.00 1445.67 414.78   A 0.67 0.67 0.0 0 0 1444.99 415.45   L 1444.99 419.84   A 0.78 0.77 88.6 0 0 1445.80 420.62   C 1447.94 420.51 1451.49 420.07 1454.06 420.09   Q 1485.44 420.27 1507.58 419.71   A 0.83 0.83 0.0 0 1 1508.43 420.54   L 1508.43 625.36   A 0.95 0.95 0.0 0 1 1507.48 626.31   C 1496.80 626.29 1489.46 626.00 1480.17 626.24   Q 1461.42 626.71 1445.93 625.88   A 0.98 0.97 -88.3 0 0 1444.90 626.86   L 1444.90 631.27   A 0.61 0.61 0.0 0 0 1445.51 631.88   L 1507.77 631.88   A 1.09 1.08 -88.7 0 1 1508.85 633.02   Q 1508.37 642.64 1508.39 651.63   C 1508.50 699.18 1508.07 748.19 1508.40 793.24   A 1.36 1.36 0.0 0 1 1507.02 794.61   Q 1485.12 794.30 1461.89 794.64   Q 1455.80 794.73 1445.68 794.08   A 0.59 0.58 -87.8 0 0 1445.05 794.67   L 1445.05 799.37   A 0.60 0.59 90.0 0 0 1445.64 799.97   L 1507.18 799.97   A 1.09 1.08 -0.3 0 1 1508.27 801.04   Q 1508.78 830.11 1508.20 865.51   C 1508.04 875.35 1509.25 885.31 1507.54 894.91   Z"
              fill="#be7936"
            />
          </g>
          <g id="item-366" onClick={() => handleClick('item-366')}>
            <rect fill="#c67f3a" height="20.86" rx="0.60" width="255.28" x="87.86" y="255.96" />
          </g>
          <g id="item-367" onClick={() => handleClick('item-367')}>
            <rect fill="#c67f3a" height="20.86" rx="0.32" width="234.84" x="380.54" y="255.96" />
          </g>
          <g id="item-368" onClick={() => handleClick('item-368')}>
            <rect fill="#c67f3a" height="20.84" rx="0.51" width="245.90" x="652.37" y="255.98" />
          </g>
          <g id="item-369" onClick={() => handleClick('item-369')}>
            <rect fill="#c67f3a" height="20.86" rx="0.51" width="232.74" x="934.98" y="255.97" />
          </g>
          <g id="item-370" onClick={() => handleClick('item-370')}>
            <rect fill="#c67f3a" height="20.84" rx="0.53" width="196.96" x="1204.88" y="255.97" />
          </g>
          <g id="item-371" onClick={() => handleClick('item-371')}>
            <path
              d="   M 10.71 280.02   Q 11.44 285.44 11.55 291.70   C 12.08 321.29 11.22 352.77 11.61 381.28   Q 11.90 402.77 11.61 452.11   Q 11.58 458.89 9.88 464.94   A 0.54 0.54 0.0 0 1 8.84 464.92   Q 7.16 457.80 7.11 449.60   Q 6.85 404.21 7.07 360.57   C 7.18 336.59 6.84 313.74 7.17 289.43   Q 7.18 288.46 7.93 282.47   A 1.25 1.23 -19.9 0 1 8.27 281.76   L 10.19 279.84   A 0.31 0.31 0.0 0 1 10.71 280.02   Z"
              fill="#b06e2d"
            />
          </g>
          <g id="item-372" onClick={() => handleClick('item-372')}>
            <path
              d="   M 88.52 756.83   A 0.42 0.42 0.0 0 1 87.85 756.50   L 87.85 283.66   A 0.54 0.54 0.0 0 1 88.39 283.12   L 120.01 283.12   A 0.54 0.54 0.0 0 1 120.55 283.66   L 120.55 316.12   A 0.58 0.57 -0.0 0 1 119.97 316.69   L 114.40 316.69   A 1.77 1.76 -28.7 0 1 113.46 316.42   Q 111.24 315.00 110.56 314.61   C 107.93 313.09 105.11 314.85 103.70 317.29   C 100.03 323.64 99.93 333.39 105.39 339.21   A 4.09 3.54 -34.2 0 0 110.00 339.75   Q 114.61 337.36 119.95 338.11   A 0.63 0.62 -86.3 0 1 120.49 338.73   L 120.49 731.88   A 2.74 2.74 0.0 0 1 119.38 734.08   L 88.52 756.83   Z"
              fill="#7a401b"
            />
          </g>
          <g id="item-373" onClick={() => handleClick('item-373')}>
            <rect fill="#7a401b" height="33.66" rx="0.47" width="216.08" x="127.04" y="283.09" />
          </g>
          <g id="item-374" onClick={() => handleClick('item-374')}>
            <path
              d="   M 381.23 757.29   A 0.47 0.47 0.0 0 1 380.41 756.97   L 380.41 283.36   A 0.26 0.25 -90.0 0 1 380.66 283.10   L 404.26 283.10   A 0.58 0.58 0.0 0 1 404.84 283.68   L 404.84 316.28   A 0.48 0.48 0.0 0 1 404.40 316.76   Q 400.87 317.14 398.48 315.32   C 396.20 313.59 393.52 313.78 391.90 315.88   C 387.71 321.31 388.09 330.82 390.79 336.71   Q 392.24 339.88 395.04 340.11   C 396.76 340.26 398.04 339.35 400.04 338.34   A 1.49 1.40 -58.2 0 1 400.56 338.20   L 403.79 337.92   A 1.00 0.99 -2.4 0 1 404.87 338.91   L 404.87 730.55   A 3.90 3.88 66.7 0 1 403.82 733.21   L 381.23 757.29   Z"
              fill="#7a401b"
            />
          </g>
          <g id="item-375" onClick={() => handleClick('item-375')}>
            <rect fill="#7a401b" height="33.64" rx="0.65" width="204.18" x="411.26" y="283.10" />
          </g>
          <g id="item-376" onClick={() => handleClick('item-376')}>
            <path
              d="   M 666.24 314.50   A 0.38 0.37 20.3 0 1 665.62 314.78   C 662.70 312.33 659.67 315.44 658.56 318.26   Q 654.66 328.11 659.58 337.59   Q 661.66 341.59 665.51 339.96   A 0.55 0.55 0.0 0 1 666.28 340.47   Q 666.19 534.24 666.28 728.00   C 666.28 731.29 666.23 733.26 664.41 736.01   Q 658.53 744.95 652.91 754.06   A 0.30 0.30 0.0 0 1 652.35 753.90   L 652.35 283.71   A 0.64 0.64 0.0 0 1 652.99 283.07   L 665.60 283.07   A 0.64 0.63 -0.0 0 1 666.24 283.70   L 666.24 314.50   Z"
              fill="#7a401b"
            />
          </g>
          <g id="item-377" onClick={() => handleClick('item-377')}>
            <rect fill="#7a401b" height="33.64" rx="0.66" width="205.48" x="672.90" y="283.10" />
          </g>
          <g id="item-378" onClick={() => handleClick('item-378')}>
            <path
              d="   M 898.31 753.08   A 0.22 0.22 0.0 0 1 897.90 753.20   Q 893.81 746.86 886.66 736.33   C 884.44 733.07 884.65 730.51 884.65 725.76   Q 884.74 522.87 884.67 401.02   Q 884.65 367.40 884.81 340.57   A 0.41 0.41 0.0 0 1 885.24 340.17   Q 889.58 340.38 891.37 336.09   Q 894.34 328.95 891.91 320.43   Q 890.17 314.31 885.40 313.93   A 0.71 0.70 -87.8 0 1 884.75 313.22   L 884.75 283.66   A 0.55 0.55 0.0 0 1 885.30 283.11   L 897.57 283.11   A 0.74 0.74 0.0 0 1 898.31 283.85   L 898.31 753.08   Z"
              fill="#7a401b"
            />
          </g>
          <g id="item-379" onClick={() => handleClick('item-379')}>
            <rect fill="#7a401b" height="33.64" rx="0.69" width="203.78" x="935.07" y="283.09" />
          </g>
          <g id="item-380" onClick={() => handleClick('item-380')}>
            <path
              d="   M 1167.79 755.12   A 0.38 0.37 -67.7 0 1 1167.15 755.39   Q 1156.86 744.98 1146.56 733.68   Q 1145.25 732.23 1145.25 730.50   Q 1145.21 351.28 1145.29 338.90   A 1.03 1.02 -87.9 0 1 1146.38 337.88   L 1150.13 338.13   A 2.69 2.54 -29.1 0 1 1151.11 338.38   C 1154.73 340.12 1157.87 341.71 1160.21 336.92   C 1162.87 331.49 1163.49 322.18 1159.75 316.59   C 1157.39 313.07 1155.27 313.56 1151.83 315.81   Q 1149.38 317.42 1145.88 316.57   A 0.72 0.71 -83.4 0 1 1145.33 315.87   L 1145.33 283.84   A 0.76 0.75 -90.0 0 1 1146.08 283.08   L 1166.83 283.08   A 0.96 0.96 0.0 0 1 1167.79 284.04   L 1167.79 755.12   Z"
              fill="#7a401b"
            />
          </g>
          <g id="item-381" onClick={() => handleClick('item-381')}>
            <rect fill="#7a401b" height="33.68" rx="0.40" width="160.12" x="1204.91" y="283.09" />
          </g>
          <g id="item-382" onClick={() => handleClick('item-382')}>
            <path
              d="   M 1401.90 756.61   A 0.12 0.12 0.0 0 1 1401.71 756.70   L 1372.35 733.33   A 2.47 2.46 19.4 0 1 1371.43 731.41   L 1371.43 339.46   A 1.49 1.48 88.6 0 1 1372.84 337.97   Q 1377.23 337.74 1379.77 339.50   C 1383.28 341.93 1386.49 338.38 1387.69 335.44   C 1390.02 329.74 1390.06 321.74 1386.17 316.37   C 1383.61 312.83 1380.93 313.67 1377.63 315.87   Q 1375.23 317.47 1371.94 316.53   A 0.59 0.58 7.9 0 1 1371.51 315.97   L 1371.51 284.06   A 0.94 0.94 0.0 0 1 1372.45 283.12   L 1401.12 283.12   A 0.79 0.78 90.0 0 1 1401.90 283.91   L 1401.90 756.61   Z"
              fill="#7a401b"
            />
          </g>
          <g id="item-383" onClick={() => handleClick('item-383')}>
            <rect fill="#a28e7f" height="7.62" rx="0.76" width="235.04" x="108.07" y="323.55" />
          </g>
          <g id="item-384" onClick={() => handleClick('item-384')}>
            <path
              d="   M 615.34 330.24   A 0.93 0.93 0.0 0 1 614.41 331.17   L 396.69 331.17   A 2.23 1.27 -90.0 0 1 395.42 328.94   L 395.42 325.76   A 2.23 1.27 90.0 0 1 396.69 323.53   L 614.41 323.53   A 0.93 0.93 0.0 0 1 615.34 324.46   L 615.34 330.24   Z"
              fill="#a28e7f"
            />
          </g>
          <g id="item-385" onClick={() => handleClick('item-385')}>
            <rect fill="#a28e7f" height="7.64" rx="1.32" width="222.32" x="663.92" y="323.54" />
          </g>
          <g id="item-386" onClick={() => handleClick('item-386')}>
            <rect fill="#a28e7f" height="7.64" rx="0.77" width="220.50" x="934.90" y="323.53" />
          </g>
          <g id="item-387" onClick={() => handleClick('item-387')}>
            <rect fill="#a28e7f" height="7.68" rx="0.75" width="177.54" x="1204.81" y="323.55" />
          </g>
          <g id="item-388" onClick={() => handleClick('item-388')}>
            <path
              d="   M 342.89 409.46   L 341.26 409.86   A 0.88 0.77 -48.9 0 1 341.04 409.89   L 127.05 409.84   L 126.98 338.60   A 0.58 0.58 0.0 0 1 127.56 338.02   L 342.59 338.02   A 0.54 0.53 90.0 0 1 343.12 338.56   L 342.89 409.46   Z"
              fill="#8b4c1f"
            />
          </g>
          <g id="item-389" onClick={() => handleClick('item-389')}>
            <path
              d="   M 615.24 409.78   L 615.05 409.51   A 0.36 0.36 0.0 0 0 614.57 409.42   L 613.90 409.87   L 461.69 409.85   L 459.13 409.82   L 413.11 409.84   A 1.46 0.20 24.2 0 1 412.18 409.57   Q 411.67 409.36 411.27 409.85   L 411.19 338.69   A 0.66 0.66 0.0 0 1 411.85 338.03   L 614.81 338.03   A 0.54 0.53 0.0 0 1 615.35 338.56   L 615.24 409.78   Z"
              fill="#8b4c1f"
            />
          </g>
          <g id="item-390" onClick={() => handleClick('item-390')}>
            <path
              d="   M 878.32 409.17   Q 877.75 409.02 876.92 409.72   A 0.70 0.70 0.0 0 1 876.45 409.90   L 673.03 409.78   L 672.88 338.54   A 0.52 0.51 0.0 0 1 673.40 338.03   L 877.78 338.03   A 0.56 0.56 0.0 0 1 878.34 338.59   L 878.32 409.17   Z"
              fill="#8b4c1f"
            />
          </g>
          <g id="item-391" onClick={() => handleClick('item-391')}>
            <path
              d="   M 1138.82 409.42   Q 1136.09 409.89 1132.00 409.89   Q 1033.65 409.88 935.03 409.82   L 935.09 338.63   A 0.61 0.60 -0.0 0 1 935.70 338.03   L 1138.32 338.03   A 0.49 0.49 0.0 0 1 1138.81 338.52   L 1138.82 409.42   Z"
              fill="#8b4c1f"
            />
          </g>
          <g id="item-392" onClick={() => handleClick('item-392')}>
            <path
              d="   M 1364.93 409.33   Q 1363.69 409.75 1362.75 409.75   Q 1327.01 409.96 1291.32 409.85   L 1288.99 409.87   Q 1249.78 409.89 1210.50 409.82   Q 1207.04 409.81 1205.17 409.40   L 1204.92 338.56   A 0.54 0.53 -0.5 0 1 1205.46 338.02   L 1364.60 338.02   A 0.43 0.43 0.0 0 1 1365.03 338.45   L 1364.93 409.33   Z"
              fill="#8b4c1f"
            />
          </g>
          <g id="item-393" onClick={() => handleClick('item-393')}>
            <path
              d="   M 878.32 409.17   L 878.28 729.85   A 0.26 0.26 0.0 0 1 878.02 730.11   L 673.24 730.11   A 0.29 0.29 0.0 0 1 672.95 729.82   L 673.03 409.78   L 876.45 409.90   A 0.70 0.70 0.0 0 0 876.92 409.72   Q 877.75 409.02 878.32 409.17   Z   M 717.22 729.28   A 0.80 0.80 0.0 0 0 718.02 728.48   L 718.02 413.03   A 1.42 1.42 0.0 0 0 717.23 411.76   L 714.84 410.60   A 0.84 0.84 0.0 0 0 713.63 411.36   Q 713.44 470.47 713.64 529.51   Q 713.66 535.25 713.69 558.26   Q 713.73 589.44 713.36 725.07   Q 713.36 726.80 712.80 728.38   A 0.68 0.67 9.7 0 0 713.44 729.28   L 717.22 729.28   Z   M 771.35 729.07   Q 773.08 729.07 773.71 728.90   A 0.52 0.52 0.0 0 0 774.07 728.27   Q 773.74 726.89 773.77 721.87   C 773.94 680.62 773.63 639.03 773.77 598.38   Q 773.90 558.27 773.84 508.47   Q 773.81 480.58 773.66 418.28   Q 773.64 412.69 773.52 412.35   A 4.64 3.53 70.6 0 1 773.33 411.72   Q 773.12 410.81 771.38 410.81   Q 769.63 410.81 769.42 411.72   A 4.64 3.53 -70.6 0 1 769.23 412.35   Q 769.11 412.69 769.09 418.28   Q 768.93 480.58 768.89 508.47   Q 768.82 558.27 768.95 598.38   C 769.08 639.03 768.76 680.62 768.92 721.87   Q 768.95 726.89 768.62 728.27   A 0.52 0.52 0.0 0 0 768.98 728.90   Q 769.61 729.07 771.35 729.07   Z   M 824.60 729.01   A 0.56 0.56 0.0 0 0 825.16 728.42   Q 825.00 725.85 824.94 722.72   Q 824.61 707.00 824.66 597.70   Q 824.69 527.44 824.79 452.30   C 824.81 437.73 824.43 426.17 824.68 413.14   A 2.19 2.18 -0.6 0 0 822.40 410.92   L 822.29 410.93   A 2.36 2.35 -1.2 0 0 820.04 413.27   Q 819.91 665.20 820.22 721.58   Q 820.24 723.83 820.63 728.59   A 0.46 0.45 87.2 0 0 821.08 729.01   L 824.60 729.01   Z"
              fill="#be7936"
            />
          </g>
          <g id="item-394" onClick={() => handleClick('item-394')}>
            <path
              d="   M 342.89 409.46   L 342.91 410.21   Q 342.56 410.20 342.35 410.45   A 0.32 0.27 69.5 0 0 342.28 410.65   Q 342.03 424.63 342.03 443.03   Q 342.03 513.60 342.08 589.49   C 342.09 596.97 341.84 603.32 341.93 610.33   Q 342.12 624.57 342.12 625.94   Q 341.91 692.87 342.09 723.60   C 342.10 725.40 342.39 726.57 342.33 728.29   A 1.13 1.12 -88.7 0 1 341.20 729.38   L 306.04 729.17   Q 306.53 724.22 306.50 722.23   Q 306.15 697.69 306.36 665.52   Q 306.50 645.68 306.00 560.84   C 305.98 558.22 305.58 555.07 305.16 551.73   A 0.77 0.77 0.0 0 0 303.69 551.53   Q 302.17 555.08 302.11 559.41   Q 301.54 601.03 301.88 697.07   Q 301.93 713.19 301.78 729.10   L 268.05 729.05   L 267.52 412.57   A 0.66 0.66 0.0 0 0 267.14 411.97   L 265.26 411.06   A 1.20 1.19 15.0 0 0 263.54 412.05   Q 262.77 423.24 262.91 435.53   Q 263.38 476.86 263.12 510.25   Q 262.90 539.15 263.14 720.43   Q 263.14 724.83 264.31 729.20   L 190.95 729.11   C 190.59 725.77 190.24 722.29 190.31 718.98   Q 190.64 702.03 190.40 687.94   Q 190.12 670.85 190.23 656.88   Q 190.55 618.59 190.28 556.26   C 190.10 512.22 190.44 470.58 190.26 423.53   Q 190.25 419.96 189.89 412.67   A 1.34 1.33 88.6 0 0 188.56 411.39   L 187.09 411.39   A 1.30 1.29 -89.3 0 0 185.80 412.66   Q 185.69 418.42 185.69 421.50   Q 185.65 479.38 185.64 618.40   C 185.64 642.10 186.00 653.54 185.52 673.19   Q 185.25 684.50 185.58 716.44   Q 185.66 724.17 186.63 729.04   C 178.81 729.27 172.10 729.16 163.13 729.35   Q 157.23 729.48 149.19 729.29   Q 141.02 729.10 127.07 729.99   L 127.05 409.84   L 341.04 409.89   A 0.88 0.77 -48.9 0 0 341.26 409.86   L 342.89 409.46   Z   M 226.92 494.30   Q 224.94 502.85 224.97 511.55   Q 225.00 522.61 225.03 605.72   C 225.03 613.57 225.06 620.43 227.84 626.00   A 0.68 0.68 0.0 0 0 229.12 625.72   C 230.01 596.58 229.42 561.26 229.57 530.28   Q 229.67 508.52 228.89 499.85   Q 228.49 495.42 228.34 494.36   A 0.72 0.72 0.0 0 0 226.92 494.30   Z"
              fill="#be7936"
            />
          </g>
          <g id="item-395" onClick={() => handleClick('item-395')}>
            <path
              d="   M 459.13 409.82   L 458.80 729.27   L 415.72 729.39   Q 415.69 729.39 415.66 729.39   L 411.27 728.90   L 411.27 409.85   Q 411.67 409.36 412.18 409.57   A 1.46 0.20 24.2 0 0 413.11 409.84   L 459.13 409.82   Z"
              fill="#be7936"
            />
          </g>
          <g id="item-396" onClick={() => handleClick('item-396')}>
            <path
              d="   M 615.24 409.78   L 615.20 729.56   A 0.54 0.54 0.0 0 1 614.66 730.10   L 411.62 730.10   A 0.29 0.28 87.8 0 1 411.34 729.83   L 411.27 728.90   L 415.66 729.39   Q 415.69 729.39 415.72 729.39   L 458.80 729.27   L 463.51 729.23   Q 474.10 729.29 484.64 729.26   Q 484.74 729.26 496.85 729.52   Q 503.09 729.66 509.31 729.13   L 512.95 729.29   L 553.73 729.28   Q 555.66 729.76 557.48 729.19   L 613.06 729.56   A 1.40 1.40 0.0 0 0 614.46 728.02   C 613.67 720.08 614.77 712.52 614.43 704.98   Q 613.96 694.57 614.36 669.08   Q 614.61 652.89 614.22 556.83   Q 614.21 554.19 614.37 548.71   C 614.57 541.95 614.09 534.60 614.36 528.42   C 614.68 521.18 614.25 513.52 614.36 506.19   C 614.71 483.73 614.13 460.53 614.20 437.50   Q 614.23 428.94 614.12 417.75   A 3.81 3.59 52.8 0 1 614.22 416.81   Q 615.01 413.27 613.90 409.87   L 614.57 409.42   A 0.36 0.36 0.0 0 1 615.05 409.51   L 615.24 409.78   Z"
              fill="#dd9a50"
            />
          </g>
          <g id="item-397" onClick={() => handleClick('item-397')}>
            <path
              d="   M 1138.82 409.42   L 1138.72 722.22   L 1138.54 721.64   A 0.44 0.43 36.2 0 0 1137.69 721.77   L 1137.69 728.78   A 0.55 0.55 0.0 0 1 1137.14 729.33   L 1088.38 729.26   L 1088.06 413.29   A 1.27 1.27 0.0 0 0 1086.79 412.02   L 1085.46 412.02   A 1.27 1.27 0.0 0 0 1084.19 413.29   L 1083.74 729.19   L 1032.28 729.25   Q 1032.56 726.77 1032.58 724.36   Q 1032.67 708.16 1032.62 632.28   Q 1032.54 506.24 1032.65 431.16   Q 1032.66 423.93 1031.91 412.89   A 1.37 1.36 88.0 0 0 1030.55 411.62   L 1029.31 411.62   A 1.36 1.36 0.0 0 0 1027.95 412.98   L 1028.10 729.19   L 984.00 729.08   C 984.30 700.98 983.98 673.04 984.19 644.72   C 984.46 606.78 984.14 577.70 983.97 534.24   C 983.91 520.83 984.29 510.91 984.03 498.31   Q 983.86 490.35 984.17 434.91   C 984.21 427.53 983.76 417.89 983.62 412.70   A 1.21 1.21 0.0 0 0 982.44 411.52   L 980.95 411.48   A 1.25 1.24 1.6 0 0 979.67 412.68   C 978.85 435.69 979.81 459.57 979.22 480.11   Q 979.04 486.13 979.36 523.44   Q 979.45 533.56 979.17 672.00   Q 979.15 679.37 979.29 690.44   C 979.45 703.06 979.17 714.38 979.80 729.08   Q 959.66 729.16 939.55 729.45   Q 937.89 729.47 936.50 728.77   A 0.87 0.86 -76.5 0 1 936.03 728.00   Q 936.08 671.03 936.11 612.75   Q 936.15 550.90 936.01 496.00   Q 936.01 495.89 936.20 469.15   Q 936.35 448.05 935.20 427.00   L 935.03 409.82   Q 1033.65 409.88 1132.00 409.89   Q 1136.09 409.89 1138.82 409.42   Z"
              fill="#be7936"
            />
          </g>
          <g id="item-398" onClick={() => handleClick('item-398')}>
            <path
              d="   M 1364.93 409.33   L 1364.90 729.65   A 0.46 0.46 0.0 0 1 1364.44 730.11   L 1205.52 730.11   A 0.56 0.55 0.5 0 1 1204.96 729.55   L 1205.17 409.40   Q 1207.04 409.81 1210.50 409.82   Q 1249.78 409.89 1288.99 409.87   Q 1287.92 413.06 1287.93 417.53   Q 1288.00 594.44 1287.94 696.46   C 1287.93 710.54 1288.28 719.21 1287.82 728.20   A 0.73 0.73 0.0 0 0 1288.55 728.97   L 1292.25 728.97   A 0.71 0.71 0.0 0 0 1292.96 728.22   C 1292.47 719.70 1292.88 709.84 1292.88 700.11   Q 1292.76 505.79 1292.85 416.48   Q 1292.85 412.71 1291.32 409.85   Q 1327.01 409.96 1362.75 409.75   Q 1363.69 409.75 1364.93 409.33   Z   M 1241.03 729.18   L 1245.60 728.77   A 0.26 0.25 86.5 0 0 1245.83 728.50   Q 1245.74 725.02 1245.58 721.75   Q 1245.58 721.70 1245.57 679.67   Q 1245.55 556.36 1245.71 422.75   Q 1245.72 418.04 1245.09 412.81   A 2.06 2.06 0.0 0 0 1243.10 410.99   L 1242.77 410.98   A 1.71 1.71 0.0 0 0 1240.99 412.69   L 1240.99 729.15   A 0.04 0.03 0.0 0 0 1241.03 729.18   Z   M 1324.72 509.27   C 1322.85 515.23 1322.98 520.29 1322.87 527.63   Q 1322.70 538.19 1322.85 551.12   C 1322.94 558.44 1322.37 565.40 1322.58 573.25   Q 1322.75 579.35 1322.70 589.29   Q 1322.62 603.87 1322.65 636.52   Q 1322.66 644.50 1323.30 651.44   A 0.98 0.97 87.4 0 0 1324.27 652.33   L 1326.02 652.33   A 1.11 1.11 0.0 0 0 1327.13 651.25   Q 1327.99 625.38 1327.76 598.35   Q 1327.37 553.16 1327.40 550.48   C 1327.58 534.75 1328.05 522.81 1326.17 509.39   A 0.75 0.75 0.0 0 0 1324.72 509.27   Z"
              fill="#be7936"
            />
          </g>
          <g id="item-399" onClick={() => handleClick('item-399')}>
            <path
              d="   M 613.90 409.87   Q 615.01 413.27 614.22 416.81   A 3.81 3.59 52.8 0 0 614.12 417.75   Q 614.23 428.94 614.20 437.50   C 614.13 460.53 614.71 483.73 614.36 506.19   C 614.25 513.52 614.68 521.18 614.36 528.42   C 614.09 534.60 614.57 541.95 614.37 548.71   Q 614.21 554.19 614.22 556.83   Q 614.61 652.89 614.36 669.08   Q 613.96 694.57 614.43 704.98   C 614.77 712.52 613.67 720.08 614.46 728.02   A 1.40 1.40 0.0 0 1 613.06 729.56   L 557.48 729.19   Q 558.18 724.63 558.19 723.23   Q 558.26 710.03 558.20 599.35   Q 558.13 470.41 558.18 418.09   Q 558.18 417.22 557.63 411.73   A 1.15 1.15 0.0 0 0 555.98 410.81   L 555.12 411.23   A 2.24 2.24 0.0 0 0 553.85 413.25   L 553.73 729.28   L 512.95 729.29   Q 513.55 725.91 513.56 722.48   Q 513.61 677.10 513.57 620.12   C 513.56 600.27 513.88 583.19 513.66 565.66   C 513.20 527.58 513.84 493.93 513.49 453.98   Q 513.37 439.82 513.91 420.41   Q 513.96 418.49 513.26 412.26   A 0.70 0.66 11.0 0 0 512.88 411.73   L 510.26 410.46   A 0.88 0.88 0.0 0 0 509.00 411.25   L 509.31 729.13   Q 503.09 729.66 496.85 729.52   Q 484.74 729.26 484.64 729.26   Q 474.10 729.29 463.51 729.23   Q 463.80 679.51 463.69 629.83   Q 463.59 590.83 463.70 554.66   Q 463.81 517.06 463.71 479.46   Q 463.63 449.02 463.62 418.29   Q 463.62 414.60 461.69 409.85   L 613.90 409.87   Z"
              fill="#be7936"
            />
          </g>
          <g id="item-400" onClick={() => handleClick('item-400')}>
            <path
              d="   M 461.69 409.85   Q 463.62 414.60 463.62 418.29   Q 463.63 449.02 463.71 479.46   Q 463.81 517.06 463.70 554.66   Q 463.59 590.83 463.69 629.83   Q 463.80 679.51 463.51 729.23   L 458.80 729.27   L 459.13 409.82   L 461.69 409.85   Z"
              fill="#b06e2d"
            />
          </g>
          <g id="item-401" onClick={() => handleClick('item-401')}>
            <path
              d="   M 1291.32 409.85   Q 1292.85 412.71 1292.85 416.48   Q 1292.76 505.79 1292.88 700.11   C 1292.88 709.84 1292.47 719.70 1292.96 728.22   A 0.71 0.71 0.0 0 1 1292.25 728.97   L 1288.55 728.97   A 0.73 0.73 0.0 0 1 1287.82 728.20   C 1288.28 719.21 1287.93 710.54 1287.94 696.46   Q 1288.00 594.44 1287.93 417.53   Q 1287.92 413.06 1288.99 409.87   L 1291.32 409.85   Z"
              fill="#b06e2d"
            />
          </g>
          <g id="item-402" onClick={() => handleClick('item-402')}>
            <path
              d="   M 342.91 410.21   L 342.91 729.54   A 0.50 0.50 0.0 0 1 342.41 730.04   L 127.07 729.99   Q 141.02 729.10 149.19 729.29   Q 157.23 729.48 163.13 729.35   C 172.10 729.16 178.81 729.27 186.63 729.04   L 190.95 729.11   L 264.31 729.20   L 268.05 729.05   L 301.78 729.10   L 306.04 729.17   L 341.20 729.38   A 1.13 1.12 -88.7 0 0 342.33 728.29   C 342.39 726.57 342.10 725.40 342.09 723.60   Q 341.91 692.87 342.12 625.94   Q 342.12 624.57 341.93 610.33   C 341.84 603.32 342.09 596.97 342.08 589.49   Q 342.03 513.60 342.03 443.03   Q 342.03 424.63 342.28 410.65   A 0.32 0.27 69.5 0 1 342.35 410.45   Q 342.56 410.20 342.91 410.21   Z"
              fill="#dd9a50"
            />
          </g>
          <g id="item-403" onClick={() => handleClick('item-403')}>
            <path
              d="   M 712.80 728.38   Q 713.36 726.80 713.36 725.07   Q 713.73 589.44 713.69 558.26   Q 713.66 535.25 713.64 529.51   Q 713.44 470.47 713.63 411.36   A 0.84 0.84 0.0 0 1 714.84 410.60   L 717.23 411.76   A 1.42 1.42 0.0 0 1 718.02 413.03   L 718.02 728.48   A 0.80 0.80 0.0 0 1 717.22 729.28   L 713.44 729.28   A 0.68 0.67 9.7 0 1 712.80 728.38   Z"
              fill="#b06e2d"
            />
          </g>
          <g id="item-404" onClick={() => handleClick('item-404')}>
            <path
              d="   M 512.95 729.29   L 509.31 729.13   L 509.00 411.25   A 0.88 0.88 0.0 0 1 510.26 410.46   L 512.88 411.73   A 0.70 0.66 11.0 0 1 513.26 412.26   Q 513.96 418.49 513.91 420.41   Q 513.37 439.82 513.49 453.98   C 513.84 493.93 513.20 527.58 513.66 565.66   C 513.88 583.19 513.56 600.27 513.57 620.12   Q 513.61 677.10 513.56 722.48   Q 513.55 725.91 512.95 729.29   Z"
              fill="#b06e2d"
            />
          </g>
          <g id="item-405" onClick={() => handleClick('item-405')}>
            <path
              d="   M 557.48 729.19   Q 555.66 729.76 553.73 729.28   L 553.85 413.25   A 2.24 2.24 0.0 0 1 555.12 411.23   L 555.98 410.81   A 1.15 1.15 0.0 0 1 557.63 411.73   Q 558.18 417.22 558.18 418.09   Q 558.13 470.41 558.20 599.35   Q 558.26 710.03 558.19 723.23   Q 558.18 724.63 557.48 729.19   Z"
              fill="#b06e2d"
            />
          </g>
          <g id="item-406" onClick={() => handleClick('item-406')}>
            <path
              d="   M 771.38 410.81   Q 773.12 410.81 773.33 411.72   A 4.64 3.53 70.6 0 0 773.52 412.35   Q 773.64 412.69 773.66 418.28   Q 773.81 480.58 773.84 508.47   Q 773.90 558.27 773.77 598.38   C 773.63 639.03 773.94 680.62 773.77 721.87   Q 773.74 726.89 774.07 728.27   A 0.52 0.52 0.0 0 1 773.71 728.90   Q 773.08 729.07 771.35 729.07   Q 769.61 729.07 768.98 728.90   A 0.52 0.52 0.0 0 1 768.62 728.27   Q 768.95 726.89 768.92 721.87   C 768.76 680.62 769.08 639.03 768.95 598.38   Q 768.82 558.27 768.89 508.47   Q 768.93 480.58 769.09 418.28   Q 769.11 412.69 769.23 412.35   A 4.64 3.53 -70.6 0 0 769.42 411.72   Q 769.63 410.81 771.38 410.81   Z"
              fill="#b06e2d"
            />
          </g>
          <g id="item-407" onClick={() => handleClick('item-407')}>
            <path
              d="   M 820.63 728.59   Q 820.24 723.83 820.22 721.58   Q 819.91 665.20 820.04 413.27   A 2.36 2.35 -1.2 0 1 822.29 410.93   L 822.40 410.92   A 2.19 2.18 -0.6 0 1 824.68 413.14   C 824.43 426.17 824.81 437.73 824.79 452.30   Q 824.69 527.44 824.66 597.70   Q 824.61 707.00 824.94 722.72   Q 825.00 725.85 825.16 728.42   A 0.56 0.56 0.0 0 1 824.60 729.01   L 821.08 729.01   A 0.46 0.45 87.2 0 1 820.63 728.59   Z"
              fill="#b06e2d"
            />
          </g>
          <g id="item-408" onClick={() => handleClick('item-408')}>
            <path
              d="   M 1241.03 729.18   A 0.04 0.03 -0.0 0 1 1240.99 729.15   L 1240.99 412.69   A 1.71 1.71 0.0 0 1 1242.77 410.98   L 1243.10 410.99   A 2.06 2.06 0.0 0 1 1245.09 412.81   Q 1245.72 418.04 1245.71 422.75   Q 1245.55 556.36 1245.57 679.67   Q 1245.58 721.70 1245.58 721.75   Q 1245.74 725.02 1245.83 728.50   A 0.26 0.25 86.5 0 1 1245.60 728.77   L 1241.03 729.18   Z"
              fill="#b06e2d"
            />
          </g>
          <g id="item-409" onClick={() => handleClick('item-409')}>
            <path
              d="   M 268.05 729.05   L 264.31 729.20   Q 263.14 724.83 263.14 720.43   Q 262.90 539.15 263.12 510.25   Q 263.38 476.86 262.91 435.53   Q 262.77 423.24 263.54 412.05   A 1.20 1.19 15.0 0 1 265.26 411.06   L 267.14 411.97   A 0.66 0.66 0.0 0 1 267.52 412.57   L 268.05 729.05   Z"
              fill="#b06e2d"
            />
          </g>
          <g id="item-410" onClick={() => handleClick('item-410')}>
            <path
              d="   M 190.95 729.11   L 186.63 729.04   Q 185.66 724.17 185.58 716.44   Q 185.25 684.50 185.52 673.19   C 186.00 653.54 185.64 642.10 185.64 618.40   Q 185.65 479.38 185.69 421.50   Q 185.69 418.42 185.80 412.66   A 1.30 1.29 -89.3 0 1 187.09 411.39   L 188.56 411.39   A 1.34 1.33 88.6 0 1 189.89 412.67   Q 190.25 419.96 190.26 423.53   C 190.44 470.58 190.10 512.22 190.28 556.26   Q 190.55 618.59 190.23 656.88   Q 190.12 670.85 190.40 687.94   Q 190.64 702.03 190.31 718.98   C 190.24 722.29 190.59 725.77 190.95 729.11   Z"
              fill="#b06e2d"
            />
          </g>
          <g id="item-411" onClick={() => handleClick('item-411')}>
            <path
              d="   M 984.00 729.08   L 979.80 729.08   C 979.17 714.38 979.45 703.06 979.29 690.44   Q 979.15 679.37 979.17 672.00   Q 979.45 533.56 979.36 523.44   Q 979.04 486.13 979.22 480.11   C 979.81 459.57 978.85 435.69 979.67 412.68   A 1.25 1.24 1.6 0 1 980.95 411.48   L 982.44 411.52   A 1.21 1.21 0.0 0 1 983.62 412.70   C 983.76 417.89 984.21 427.53 984.17 434.91   Q 983.86 490.35 984.03 498.31   C 984.29 510.91 983.91 520.83 983.97 534.24   C 984.14 577.70 984.46 606.78 984.19 644.72   C 983.98 673.04 984.30 700.98 984.00 729.08   Z"
              fill="#b06e2d"
            />
          </g>
          <g id="item-412" onClick={() => handleClick('item-412')}>
            <path
              d="   M 1032.28 729.25   L 1028.10 729.19   L 1027.95 412.98   A 1.36 1.36 0.0 0 1 1029.31 411.62   L 1030.55 411.62   A 1.37 1.36 88.0 0 1 1031.91 412.89   Q 1032.66 423.93 1032.65 431.16   Q 1032.54 506.24 1032.62 632.28   Q 1032.67 708.16 1032.58 724.36   Q 1032.56 726.77 1032.28 729.25   Z"
              fill="#b06e2d"
            />
          </g>
          <g id="item-413" onClick={() => handleClick('item-413')}>
            <path
              d="   M 1088.38 729.26   L 1083.74 729.19   L 1084.19 413.29   A 1.27 1.27 0.0 0 1 1085.46 412.02   L 1086.79 412.02   A 1.27 1.27 0.0 0 1 1088.06 413.29   L 1088.38 729.26   Z"
              fill="#b06e2d"
            />
          </g>
          <g id="item-414" onClick={() => handleClick('item-414')}>
            <path
              d="   M 979.80 729.08   L 984.00 729.08   L 1028.10 729.19   L 1032.28 729.25   L 1083.74 729.19   L 1088.38 729.26   L 1137.14 729.33   A 0.55 0.55 0.0 0 0 1137.69 728.78   L 1137.69 721.77   A 0.44 0.43 36.2 0 1 1138.54 721.64   L 1138.72 722.22   L 1138.89 729.62   A 0.47 0.47 0.0 0 1 1138.42 730.10   L 935.65 730.10   A 0.54 0.53 0.0 0 1 935.11 729.57   L 935.20 427.00   Q 936.35 448.05 936.20 469.15   Q 936.01 495.89 936.01 496.00   Q 936.15 550.90 936.11 612.75   Q 936.08 671.03 936.03 728.00   A 0.87 0.86 -76.5 0 0 936.50 728.77   Q 937.89 729.47 939.55 729.45   Q 959.66 729.16 979.80 729.08   Z"
              fill="#dd9a50"
            />
          </g>
          <g id="item-415" onClick={() => handleClick('item-415')}>
            <path
              d="   M 226.92 494.30   A 0.72 0.72 0.0 0 1 228.34 494.36   Q 228.49 495.42 228.89 499.85   Q 229.67 508.52 229.57 530.28   C 229.42 561.26 230.01 596.58 229.12 625.72   A 0.68 0.68 0.0 0 1 227.84 626.00   C 225.06 620.43 225.03 613.57 225.03 605.72   Q 225.00 522.61 224.97 511.55   Q 224.94 502.85 226.92 494.30   Z"
              fill="#b06e2d"
            />
          </g>
          <g id="item-416" onClick={() => handleClick('item-416')}>
            <path
              d="   M 1324.72 509.27   A 0.75 0.75 0.0 0 1 1326.17 509.39   C 1328.05 522.81 1327.58 534.75 1327.40 550.48   Q 1327.37 553.16 1327.76 598.35   Q 1327.99 625.38 1327.13 651.25   A 1.11 1.11 0.0 0 1 1326.02 652.33   L 1324.27 652.33   A 0.98 0.97 87.4 0 1 1323.30 651.44   Q 1322.66 644.50 1322.65 636.52   Q 1322.62 603.87 1322.70 589.29   Q 1322.75 579.35 1322.58 573.25   C 1322.37 565.40 1322.94 558.44 1322.85 551.12   Q 1322.70 538.19 1322.87 527.63   C 1322.98 520.29 1322.85 515.23 1324.72 509.27   Z"
              fill="#b06e2d"
            />
          </g>
          <g id="item-417" onClick={() => handleClick('item-417')}>
            <path
              d="   M 306.04 729.17   L 301.78 729.10   Q 301.93 713.19 301.88 697.07   Q 301.54 601.03 302.11 559.41   Q 302.17 555.08 303.69 551.53   A 0.77 0.77 0.0 0 1 305.16 551.73   C 305.58 555.07 305.98 558.22 306.00 560.84   Q 306.50 645.68 306.36 665.52   Q 306.15 697.69 306.50 722.23   Q 306.53 724.22 306.04 729.17   Z"
              fill="#b06e2d"
            />
          </g>
          <g id="item-418" onClick={() => handleClick('item-418')}>
            <path
              d="   M 0.00 631.35   L 0.00 627.00   C 3.04 626.54 6.21 626.10 9.24 626.09   Q 25.19 626.04 41.78 625.93   A 1.34 1.34 0.0 0 1 43.13 627.27   L 43.13 630.45   A 1.01 1.01 0.0 0 1 42.12 631.46   L 0.00 631.35   Z"
              fill="#b06e2d"
            />
          </g>
          <g id="item-419" onClick={() => handleClick('item-419')}>
            <path
              d="   M 1536.00 631.22   L 1536.00 896.25   Q 1535.46 896.34 1535.20 896.14   Q 1535.59 895.49 1535.01 895.45   Q 1525.81 894.80 1513.75 895.09   L 1513.11 633.44   A 1.34 1.34 0.0 0 1 1514.41 632.09   C 1521.30 631.85 1528.76 632.20 1536.00 631.22   Z"
              fill="#be7936"
            />
          </g>
          <g id="item-420" onClick={() => handleClick('item-420')}>
            <path
              d="   M 342.99 738.10   L 128.04 737.81   A 2.53 2.51 26.8 0 0 126.56 738.29   L 105.16 754.07   A 0.42 0.41 -23.2 0 1 104.50 753.81   Q 104.49 753.72 104.45 753.50   L 125.46 737.67   A 4.55 4.50 26.1 0 1 128.20 736.75   L 342.55 736.75   A 0.41 0.41 0.0 0 1 342.93 737.01   Q 343.12 737.45 342.99 738.10   Z"
              fill="#dd9a50"
            />
          </g>
          <g id="item-421" onClick={() => handleClick('item-421')}>
            <path
              d="   M 608.08 736.74   Q 610.76 737.74 605.50 737.76   Q 503.07 737.99 483.25 737.91   Q 451.74 737.77 410.06 737.93   A 2.41 2.37 -69.8 0 0 408.23 738.79   Q 402.42 745.75 396.52 751.89   Q 396.22 752.19 395.79 752.18   Q 395.60 752.18 395.43 751.67   L 408.05 737.95   A 3.76 3.73 21.1 0 1 410.81 736.74   L 608.08 736.74   Z"
              fill="#dd9a50"
            />
          </g>
          <g id="item-422" onClick={() => handleClick('item-422')}>
            <path
              d="   M 395.43 751.67   Q 395.60 752.18 395.79 752.18   Q 396.22 752.19 396.52 751.89   Q 402.42 745.75 408.23 738.79   A 2.41 2.37 -69.8 0 1 410.06 737.93   Q 451.74 737.77 483.25 737.91   Q 503.07 737.99 605.50 737.76   Q 610.76 737.74 608.08 736.74   L 614.84 736.66   A 0.45 0.45 0.0 0 1 615.29 737.11   L 615.29 764.42   A 0.35 0.35 0.0 0 1 614.94 764.77   L 383.61 764.77   A 0.24 0.24 0.0 0 1 383.43 764.36   L 395.43 751.67   Z"
              fill="#c67f3a"
            />
          </g>
          <g id="item-423" onClick={() => handleClick('item-423')}>
            <path
              d="   M 877.54 764.74   L 875.99 764.14   A 0.36 0.36 0.0 0 1 876.12 763.45   L 893.51 763.45   A 0.84 0.84 0.0 0 0 894.34 762.46   C 893.95 760.23 892.49 759.13 891.43 757.43   Q 885.13 747.33 879.40 738.83   A 2.09 2.09 0.0 0 0 877.67 737.91   L 672.52 737.91   A 1.82 1.80 14.8 0 0 670.95 738.81   L 664.99 749.14   A 0.37 0.37 0.0 0 1 664.38 749.19   Q 664.11 748.86 664.16 748.25   L 670.75 738.03   A 2.77 2.74 16.2 0 1 673.07 736.77   L 877.66 736.77   A 2.97 2.94 73.2 0 1 880.13 738.11   L 897.29 764.41   A 0.19 0.19 0.0 0 1 897.13 764.70   L 877.54 764.74   Z"
              fill="#dd9a50"
            />
          </g>
          <g id="item-424" onClick={() => handleClick('item-424')}>
            <path
              d="   M 1161.17 759.02   Q 1151.17 750.03 1142.38 739.88   Q 1140.36 737.55 1138.78 737.63   Q 1133.36 737.90 1128.36 737.89   Q 1059.54 737.82 936.90 737.93   A 1.04 1.03 81.8 0 0 935.91 739.26   Q 936.27 740.47 936.31 742.00   Q 936.55 751.06 935.24 759.83   L 935.23 737.25   A 0.51 0.51 0.0 0 1 935.74 736.74   Q 1056.23 736.83 1138.00 736.72   C 1140.02 736.72 1141.24 737.43 1142.72 738.95   Q 1152.15 748.67 1161.17 759.02   Z"
              fill="#dd9a50"
            />
          </g>
          <g id="item-425" onClick={() => handleClick('item-425')}>
            <path
              d="   M 1207.57 736.79   Q 1209.64 738.15 1213.10 738.01   Q 1215.88 737.89 1215.97 737.89   Q 1282.78 737.82 1364.94 737.87   A 1.04 1.00 54.4 0 1 1365.31 737.94   Q 1367.42 738.83 1369.16 740.34   Q 1381.83 751.36 1395.63 761.12   Q 1398.04 761.96 1400.28 764.13   A 0.36 0.36 0.0 0 1 1400.03 764.75   L 1205.34 764.75   A 0.40 0.40 0.0 0 1 1204.94 764.35   L 1204.94 737.48   A 0.70 0.69 82.3 0 1 1205.45 736.81   Q 1206.51 736.53 1207.57 736.79   Z"
              fill="#c67f3a"
            />
          </g>
          <g id="item-426" onClick={() => handleClick('item-426')}>
            <path
              d="   M 1395.63 761.12   Q 1381.83 751.36 1369.16 740.34   Q 1367.42 738.83 1365.31 737.94   A 1.04 1.00 54.4 0 0 1364.94 737.87   Q 1282.78 737.82 1215.97 737.89   Q 1215.88 737.89 1213.10 738.01   Q 1209.64 738.15 1207.57 736.79   L 1364.24 736.74   A 5.38 5.33 64.6 0 1 1367.65 737.97   L 1395.63 761.12   Z"
              fill="#dd9a50"
            />
          </g>
          <g id="item-427" onClick={() => handleClick('item-427')}>
            <path
              d="   M 342.99 738.10   L 343.05 764.17   A 0.60 0.59 90.0 0 1 342.46 764.77   L 90.38 764.77   A 0.27 0.27 0.0 0 1 90.22 764.29   L 104.45 753.50   Q 104.49 753.72 104.50 753.81   A 0.42 0.41 -23.2 0 0 105.16 754.07   L 126.56 738.29   A 2.53 2.51 26.8 0 1 128.04 737.81   L 342.99 738.10   Z"
              fill="#c67f3a"
            />
          </g>
          <g id="item-428" onClick={() => handleClick('item-428')}>
            <path
              d="   M 877.54 764.74   L 653.98 764.74   A 0.25 0.25 0.0 0 1 653.77 764.36   L 664.16 748.25   Q 664.11 748.86 664.38 749.19   A 0.37 0.37 0.0 0 0 664.99 749.14   L 670.95 738.81   A 1.82 1.80 14.8 0 1 672.52 737.91   L 877.67 737.91   A 2.09 2.09 0.0 0 1 879.40 738.83   Q 885.13 747.33 891.43 757.43   C 892.49 759.13 893.95 760.23 894.34 762.46   A 0.84 0.84 0.0 0 1 893.51 763.45   L 876.12 763.45   A 0.36 0.36 0.0 0 0 875.99 764.14   L 877.54 764.74   Z"
              fill="#c67f3a"
            />
          </g>
          <g id="item-429" onClick={() => handleClick('item-429')}>
            <path
              d="   M 1161.17 759.02   Q 1164.25 761.03 1166.44 764.32   A 0.29 0.28 -16.9 0 1 1166.20 764.76   L 935.56 764.76   A 0.55 0.55 0.0 0 1 935.01 764.18   L 935.24 759.83   Q 936.55 751.06 936.31 742.00   Q 936.27 740.47 935.91 739.26   A 1.04 1.03 81.8 0 1 936.90 737.93   Q 1059.54 737.82 1128.36 737.89   Q 1133.36 737.90 1138.78 737.63   Q 1140.36 737.55 1142.38 739.88   Q 1151.17 750.03 1161.17 759.02   Z"
              fill="#c67f3a"
            />
          </g>
          <g id="item-430" onClick={() => handleClick('item-430')}>
            <path
              d="   M 6.66 895.16   A 0.93 0.93 0.0 0 1 5.73 894.23   L 5.73 764.88   A 8.14 1.25 -90.0 0 1 6.98 756.74   L 8.66 756.74   A 8.14 1.25 90.0 0 1 9.91 764.88   L 9.91 894.23   A 0.93 0.93 0.0 0 1 8.98 895.16   L 6.66 895.16   Z"
              fill="#b06e2d"
            />
          </g>
          <g id="item-431" onClick={() => handleClick('item-431')}>
            <rect fill="#c67f3a" height="20.12" rx="0.67" width="255.28" x="87.90" y="771.25" />
          </g>
          <g id="item-432" onClick={() => handleClick('item-432')}>
            <rect fill="#c67f3a" height="20.12" rx="0.50" width="234.88" x="380.53" y="771.26" />
          </g>
          <g id="item-433" onClick={() => handleClick('item-433')}>
            <rect fill="#c67f3a" height="20.10" rx="0.57" width="245.94" x="652.41" y="771.26" />
          </g>
          <g id="item-434" onClick={() => handleClick('item-434')}>
            <rect fill="#c67f3a" height="20.12" rx="0.76" width="232.76" x="935.09" y="771.26" />
          </g>
          <g id="item-435" onClick={() => handleClick('item-435')}>
            <rect fill="#c67f3a" height="20.12" rx="0.45" width="196.96" x="1204.90" y="771.25" />
          </g>
          <g id="item-436" onClick={() => handleClick('item-436')}>
            <path
              d="   M 131.91 874.68   Q 128.02 873.06 125.70 868.53   Q 123.73 864.68 117.80 854.63   Q 113.88 847.98 109.99 840.70   Q 99.45 820.97 87.86 801.71   Q 87.46 800.05 87.78 798.36   A 0.63 0.63 0.0 0 1 88.40 797.84   L 130.90 797.84   A 1.02 1.01 -0.0 0 1 131.92 798.85   L 131.91 874.68   Z"
              fill="#7a401b"
            />
          </g>
          <g id="item-437" onClick={() => handleClick('item-437')}>
            <rect fill="#7a401b" height="79.06" rx="0.44" width="204.88" x="138.24" y="797.81" />
          </g>
          <g id="item-438" onClick={() => handleClick('item-438')}>
            <path
              d="   M 411.30 877.22   Q 409.10 875.70 408.59 874.38   Q 407.30 870.99 404.07 864.69   Q 396.19 849.29 387.54 828.74   Q 385.32 823.48 380.52 816.61   L 380.55 798.32   A 0.50 0.50 0.0 0 1 381.05 797.82   L 410.39 797.82   A 1.10 1.09 0.3 0 1 411.49 798.92   L 411.30 877.22   Z"
              fill="#7a401b"
            />
          </g>
          <g id="item-439" onClick={() => handleClick('item-439')}>
            <rect fill="#7a401b" height="79.04" rx="0.64" width="197.64" x="417.79" y="797.81" />
          </g>
          <g id="item-440" onClick={() => handleClick('item-440')}>
            <path
              d="   M 666.21 856.45   C 664.20 857.56 664.80 862.32 664.91 864.38   A 0.20 0.20 0.0 0 1 664.71 864.60   L 664.38 864.60   A 0.36 0.36 0.0 0 1 664.03 864.31   C 662.71 857.69 660.66 850.85 659.61 845.05   Q 658.59 839.42 657.34 834.99   C 655.14 827.23 654.14 820.74 653.95 813.51   A 0.55 0.55 0.0 0 0 652.92 813.27   L 652.40 814.21   L 652.37 798.25   A 0.49 0.49 0.0 0 1 652.86 797.75   L 665.77 797.75   A 0.59 0.59 0.0 0 1 666.36 798.35   L 666.21 856.45   Z"
              fill="#7a401b"
            />
          </g>
          <g id="item-441" onClick={() => handleClick('item-441')}>
            <rect fill="#7a401b" height="79.04" rx="0.37" width="205.50" x="672.85" y="797.81" />
          </g>
          <g id="item-442" onClick={() => handleClick('item-442')}>
            <path
              d="   M 898.12 812.91   Q 893.13 836.21 888.37 854.13   Q 887.35 857.94 885.00 862.11   L 884.91 798.22   A 0.42 0.42 0.0 0 1 885.33 797.80   L 897.77 797.80   A 0.52 0.52 0.0 0 1 898.29 798.33   L 898.12 812.91   Z"
              fill="#7a401b"
            />
          </g>
          <g id="item-443" onClick={() => handleClick('item-443')}>
            <rect fill="#7a401b" height="79.02" rx="0.36" width="195.82" x="935.06" y="797.82" />
          </g>
          <g id="item-444" onClick={() => handleClick('item-444')}>
            <path
              d="   M 1167.85 816.71   Q 1165.96 818.53 1164.84 820.84   Q 1160.76 829.32 1155.96 838.87   C 1151.23 848.29 1144.85 859.48 1139.79 870.13   A 1.21 1.19 -86.1 0 1 1139.10 870.74   L 1137.37 871.31   L 1137.26 798.39   A 0.58 0.58 0.0 0 1 1137.84 797.81   L 1167.03 797.81   A 0.64 0.64 0.0 0 1 1167.67 798.45   L 1167.85 816.71   Z"
              fill="#7a401b"
            />
          </g>
          <g id="item-445" onClick={() => handleClick('item-445')}>
            <rect fill="#7a401b" height="79.04" rx="0.41" width="147.00" x="1204.91" y="797.82" />
          </g>
          <g id="item-446" onClick={() => handleClick('item-446')}>
            <path
              d="   M 1401.92 807.13   Q 1400.78 809.29 1400.03 811.54   Q 1398.98 814.65 1398.17 815.91   C 1395.75 819.72 1393.73 823.47 1390.97 827.77   Q 1375.66 851.60 1371.14 859.64   C 1366.14 868.51 1363.23 873.68 1359.10 878.76   Q 1358.09 876.91 1358.10 874.99   Q 1358.40 834.48 1358.12 798.38   A 0.56 0.56 0.0 0 1 1358.68 797.81   L 1401.09 797.81   A 0.58 0.57 -1.0 0 1 1401.67 798.36   L 1401.92 807.13   Z"
              fill="#7a401b"
            />
          </g>
          <g id="item-447" onClick={() => handleClick('item-447')}>
            <path
              d="   M 131.91 874.68   Q 132.53 877.87 129.57 880.06   Q 109.51 894.91 88.54 910.36   A 0.46 0.45 72.0 0 1 87.82 909.99   L 87.86 801.71   Q 99.45 820.97 109.99 840.70   Q 113.88 847.98 117.80 854.63   Q 123.73 864.68 125.70 868.53   Q 128.02 873.06 131.91 874.68   Z"
              fill="#8b4c1f"
            />
          </g>
          <g id="item-448" onClick={() => handleClick('item-448')}>
            <path
              d="   M 1401.92 807.13   L 1401.96 910.95   A 0.15 0.15 0.0 0 1 1401.72 911.07   L 1359.10 878.76   C 1363.23 873.68 1366.14 868.51 1371.14 859.64   Q 1375.66 851.60 1390.97 827.77   C 1393.73 823.47 1395.75 819.72 1398.17 815.91   Q 1398.98 814.65 1400.03 811.54   Q 1400.78 809.29 1401.92 807.13   Z"
              fill="#8b4c1f"
            />
          </g>
          <g id="item-449" onClick={() => handleClick('item-449')}>
            <path
              d="   M 666.21 856.45   L 666.32 875.89   A 6.48 6.47 -32.3 0 1 665.67 878.76   L 652.87 905.20   A 0.27 0.27 0.0 0 1 652.35 905.08   L 652.40 814.21   L 652.92 813.27   A 0.55 0.55 0.0 0 1 653.95 813.51   C 654.14 820.74 655.14 827.23 657.34 834.99   Q 658.59 839.42 659.61 845.05   C 660.66 850.85 662.71 857.69 664.03 864.31   A 0.36 0.36 0.0 0 0 664.38 864.60   L 664.71 864.60   A 0.20 0.20 0.0 0 0 664.91 864.38   C 664.80 862.32 664.20 857.56 666.21 856.45   Z"
              fill="#8b4c1f"
            />
          </g>
          <g id="item-450" onClick={() => handleClick('item-450')}>
            <path
              d="   M 898.12 812.91   L 898.12 906.58   A 0.21 0.21 0.0 0 1 897.73 906.67   L 885.41 881.25   A 6.27 6.26 32.5 0 1 884.80 878.51   L 885.00 862.11   Q 887.35 857.94 888.37 854.13   Q 893.13 836.21 898.12 812.91   Z"
              fill="#8b4c1f"
            />
          </g>
          <g id="item-451" onClick={() => handleClick('item-451')}>
            <path
              d="   M 411.30 877.22   Q 411.37 877.76 411.28 878.24   Q 411.21 878.67 410.79 879.08   Q 396.12 893.28 381.38 908.32   A 0.50 0.50 0.0 0 1 380.52 907.97   L 380.52 816.61   Q 385.32 823.48 387.54 828.74   Q 396.19 849.29 404.07 864.69   Q 407.30 870.99 408.59 874.38   Q 409.10 875.70 411.30 877.22   Z"
              fill="#8b4c1f"
            />
          </g>
          <g id="item-452" onClick={() => handleClick('item-452')}>
            <path
              d="   M 1167.85 816.71   L 1167.79 908.71   A 0.21 0.21 0.0 0 1 1167.43 908.86   L 1138.36 879.78   A 3.42 3.40 22.6 0 1 1137.36 877.37   L 1137.37 871.31   L 1139.10 870.74   A 1.21 1.19 -86.1 0 0 1139.79 870.13   C 1144.85 859.48 1151.23 848.29 1155.96 838.87   Q 1160.76 829.32 1164.84 820.84   Q 1165.96 818.53 1167.85 816.71   Z"
              fill="#8b4c1f"
            />
          </g>
          <g id="item-453" onClick={() => handleClick('item-453')}>
            <path
              d="   M 343.05 883.56   L 343.05 914.62   A 0.46 0.46 0.0 0 1 342.59 915.08   L 94.18 915.08   A 0.46 0.46 0.0 0 1 93.91 914.25   L 136.03 883.19   A 0.46 0.46 0.0 0 1 136.30 883.10   L 342.59 883.10   A 0.46 0.46 0.0 0 1 343.05 883.56   Z"
              fill="#8b4c1f"
            />
          </g>
          <g id="item-454" onClick={() => handleClick('item-454')}>
            <path
              d="   M 615.38 883.44   L 615.38 914.75   A 0.33 0.33 0.0 0 1 615.05 915.08   L 384.59 915.08   A 0.33 0.33 0.0 0 1 384.35 914.52   L 415.66 883.21   A 0.33 0.33 0.0 0 1 415.90 883.11   L 615.05 883.11   A 0.33 0.33 0.0 0 1 615.38 883.44   Z"
              fill="#8b4c1f"
            />
          </g>
          <g id="item-455" onClick={() => handleClick('item-455')}>
            <path
              d="   M 655.53 914.59   L 670.67 883.31   A 0.34 0.34 0.0 0 1 670.97 883.12   L 878.60 883.12   A 0.34 0.34 0.0 0 1 878.90 883.31   L 894.06 914.59   A 0.34 0.34 0.0 0 1 893.76 915.08   L 655.83 915.08   A 0.34 0.34 0.0 0 1 655.53 914.59   Z"
              fill="#8b4c1f"
            />
          </g>
          <g id="item-456" onClick={() => handleClick('item-456')}>
            <path
              d="   M 1163.66 915.01   Q 1163.63 915.03 1163.60 915.08   A 0.20 0.07 3.9 0 1 1163.44 915.12   L 935.48 915.07   A 0.46 0.46 0.0 0 1 935.02 914.61   L 935.02 883.77   A 0.60 0.60 0.0 0 1 935.62 883.17   Q 1020.37 883.07 1130.32 883.11   Q 1132.65 883.11 1135.05 885.46   Q 1146.43 896.65 1163.69 914.55   A 0.31 0.31 0.0 0 1 1163.66 915.01   Z"
              fill="#8b4c1f"
            />
          </g>
          <g id="item-457" onClick={() => handleClick('item-457')}>
            <path
              d="   M 1395.83 915.08   L 1205.53 915.08   A 0.61 0.61 0.0 0 1 1204.92 914.47   L 1204.92 883.87   A 0.73 0.73 0.0 0 1 1205.65 883.14   Q 1281.73 883.12 1351.37 883.08   C 1353.63 883.08 1355.75 884.21 1357.73 885.73   Q 1375.22 899.21 1395.98 914.64   A 0.25 0.24 -26.4 0 1 1395.83 915.08   Z"
              fill="#8b4c1f"
            />
          </g>
          <g id="item-458" onClick={() => handleClick('item-458')}>
            <path
              d="   M 0.31 902.83   L 0.00 904.07   L 0.00 901.58   L 0.31 902.83   Z"
              fill="#be7936"
            />
          </g>
          <g id="item-459" onClick={() => handleClick('item-459')}>
            <path
              d="   M 1536.00 902.75   L 1536.00 939.87   L 1444.07 939.91   A 0.51 0.51 0.0 0 1 1443.56 939.40   L 1443.56 903.33   A 0.52 0.51 90.0 0 1 1444.07 902.81   L 1536.00 902.75   Z"
              fill="#7a401b"
            />
          </g>
          <g id="item-460" onClick={() => handleClick('item-460')}>
            <path
              d="   M 0.24 939.65   Q 0.21 938.98 0.00 938.62   L 0.00 904.07   L 0.31 902.83   L 43.54 902.74   A 1.18 1.17 90.0 0 1 44.71 903.92   L 44.71 939.09   A 0.91 0.91 0.0 0 1 43.80 940.00   Q 19.59 940.00 1.24 940.05   Q 0.89 940.05 0.24 939.65   Z"
              fill="#7a401b"
            />
          </g>
          <g id="item-461" onClick={() => handleClick('item-461')}>
            <rect fill="#c67f3a" height="17.56" rx="0.44" width="234.76" x="380.64" y="921.45" />
          </g>
          <g id="item-462" onClick={() => handleClick('item-462')}>
            <rect fill="#c67f3a" height="17.58" rx="0.50" width="197.00" x="1204.84" y="921.44" />
          </g>
          <g id="item-463" onClick={() => handleClick('item-463')}>
            <rect fill="#c67f3a" height="17.56" rx="0.57" width="255.24" x="87.88" y="921.45" />
          </g>
          <g id="item-464" onClick={() => handleClick('item-464')}>
            <rect fill="#c67f3a" height="17.58" rx="0.57" width="245.90" x="652.43" y="921.44" />
          </g>
          <g id="item-465" onClick={() => handleClick('item-465')}>
            <rect fill="#c67f3a" height="17.58" rx="0.64" width="232.74" x="935.10" y="921.44" />
          </g>
          <g id="item-466" onClick={() => handleClick('item-466')}>
            <path
              d="   M 0.24 939.65   L 0.00 940.51   L 0.00 938.62   Q 0.21 938.98 0.24 939.65   Z"
              fill="#b06e2d"
            />
          </g>
          <g id="item-467" onClick={() => handleClick('item-467')}>
            <path
              d="   M 380.96 945.52   L 406.73 945.52   A 0.49 0.49 0.0 0 1 407.09 946.35   L 381.32 973.84   A 0.49 0.49 0.0 0 1 380.47 973.50   L 380.47 946.01   A 0.49 0.49 0.0 0 1 380.96 945.52   Z"
              fill="#8b4c1f"
            />
          </g>
          <g id="item-468" onClick={() => handleClick('item-468')}>
            <path
              d="   M 127.23 946.23   L 88.43 974.84   A 0.38 0.38 0.0 0 1 87.82 974.54   L 87.82 945.92   A 0.38 0.38 0.0 0 1 88.20 945.54   L 127.00 945.54   A 0.38 0.38 0.0 0 1 127.23 946.23   Z"
              fill="#8b4c1f"
            />
          </g>
          <g id="item-469" onClick={() => handleClick('item-469')}>
            <path
              d="   M 342.97 982.85   Q 340.45 983.08 338.40 983.07   Q 239.55 982.88 139.91 983.02   C 126.62 983.04 109.93 982.75 95.31 982.82   Q 92.67 982.83 89.53 982.32   Q 105.76 969.96 121.90 957.77   C 126.07 954.63 130.93 951.46 135.31 947.37   A 5.29 5.27 17.2 0 1 137.79 946.07   Q 140.66 945.42 142.75 945.46   C 156.37 945.66 164.13 945.45 174.09 945.57   Q 186.83 945.72 235.75 945.66   Q 256.86 945.64 257.50 945.61   Q 259.78 945.51 271.32 945.70   Q 283.01 945.89 285.13 945.82   C 295.66 945.46 313.63 945.75 330.70 945.62   Q 336.60 945.57 342.06 945.79   A 1.06 1.05 -88.9 0 1 343.07 946.85   L 342.97 982.85   Z"
              fill="#152f46"
            />
          </g>
          <g id="item-470" onClick={() => handleClick('item-470')}>
            <path
              d="   M 615.39 983.04   Q 606.95 983.20 598.75 983.19   Q 500.84 983.00 402.92 982.96   C 396.88 982.96 389.05 983.31 381.79 982.68   L 414.77 947.10   A 4.53 4.51 21.3 0 1 418.09 945.65   L 614.51 945.65   A 0.66 0.66 0.0 0 1 615.17 946.31   L 615.39 983.04   Z"
              fill="#152f46"
            />
          </g>
          <g id="item-471" onClick={() => handleClick('item-471')}>
            <path
              d="   M 652.49 970.35   A 0.07 0.07 0.0 0 1 652.36 970.32   L 652.36 946.32   A 0.82 0.82 0.0 0 1 653.18 945.50   L 663.91 945.50   A 0.39 0.39 0.0 0 1 664.26 946.06   L 652.49 970.35   Z"
              fill="#7a401b"
            />
          </g>
          <g id="item-472" onClick={() => handleClick('item-472')}>
            <path
              d="   M 896.36 982.69   L 653.58 982.95   L 670.72 947.21   A 2.72 2.72 0.0 0 1 673.17 945.67   L 877.64 945.67   A 2.47 2.46 -12.3 0 1 879.88 947.10   L 896.36 982.69   Z"
              fill="#152f46"
            />
          </g>
          <g id="item-473" onClick={() => handleClick('item-473')}>
            <path
              d="   M 897.41 970.23   L 886.49 946.22   A 0.43 0.43 0.0 0 1 886.88 945.61   L 897.80 945.61   A 0.43 0.43 0.0 0 1 898.23 946.04   L 898.23 970.06   A 0.43 0.43 0.0 0 1 897.41 970.23   Z"
              fill="#7a401b"
            />
          </g>
          <g id="item-474" onClick={() => handleClick('item-474')}>
            <path
              d="   M 1166.24 982.13   Q 1161.64 983.09 1157.15 983.09   Q 1051.09 983.01 945.03 982.96   Q 941.62 982.96 934.76 983.54   L 934.76 948.03   A 2.34 2.34 0.0 0 1 937.10 945.69   L 1130.58 945.69   A 5.18 5.18 0.0 0 1 1134.40 947.37   L 1166.24 982.13   Z"
              fill="#152f46"
            />
          </g>
          <g id="item-475" onClick={() => handleClick('item-475')}>
            <path
              d="   M 1167.79 945.80   L 1167.79 973.28   A 0.30 0.30 0.0 0 1 1167.27 973.49   L 1141.46 946.01   A 0.30 0.30 0.0 0 1 1141.68 945.50   L 1167.49 945.50   A 0.30 0.30 0.0 0 1 1167.79 945.80   Z"
              fill="#8b4c1f"
            />
          </g>
          <g id="item-476" onClick={() => handleClick('item-476')}>
            <path
              d="   M 1399.86 982.42   Q 1395.89 982.97 1390.98 982.97   Q 1298.13 982.94 1204.82 982.97   L 1204.50 947.41   A 1.60 1.60 0.0 0 1 1206.09 945.80   Q 1272.82 945.46 1285.00 945.78   C 1295.68 946.07 1307.26 945.59 1319.37 945.66   Q 1334.32 945.76 1345.50 945.44   C 1349.01 945.35 1350.76 945.94 1353.77 948.06   Q 1377.18 964.54 1399.86 982.42   Z"
              fill="#152f46"
            />
          </g>
          <g id="item-477" onClick={() => handleClick('item-477')}>
            <path
              d="   M 1361.42 945.51   L 1401.31 945.51   A 0.54 0.54 0.0 0 1 1401.85 946.05   L 1401.85 974.92   A 0.37 0.37 0.0 0 1 1401.26 975.22   L 1361.33 945.77   A 0.15 0.14 -26.6 0 1 1361.42 945.51   Z"
              fill="#8b4c1f"
            />
          </g>
          <g id="item-478" onClick={() => handleClick('item-478')}>
            <path
              d="   M 1536.00 946.44   L 1536.00 1024.00   L 0.00 1024.00   L 0.00 946.74   Q 21.25 946.63 42.50 946.44   Q 44.71 946.42 44.69 948.76   Q 44.49 973.29 44.48 980.25   C 44.47 982.51 44.47 986.28 47.77 986.36   Q 61.07 986.68 82.79 986.49   A 5.39 5.39 0.0 0 0 86.28 985.16   L 89.53 982.32   Q 92.67 982.83 95.31 982.82   C 109.93 982.75 126.62 983.04 139.91 983.02   Q 239.55 982.88 338.40 983.07   Q 340.45 983.08 342.97 982.85   Q 342.50 986.45 346.50 986.49   Q 361.13 986.64 375.53 986.48   Q 377.62 986.46 379.33 985.25   Q 380.94 984.10 381.79 982.68   C 389.05 983.31 396.88 982.96 402.92 982.96   Q 500.84 983.00 598.75 983.19   Q 606.95 983.20 615.39 983.04   C 615.75 986.82 620.22 986.52 622.75 986.51   Q 636.68 986.47 648.51 986.49   Q 652.13 986.50 653.58 982.95   L 896.36 982.69   L 898.61 985.32   A 1.93 1.91 -8.9 0 0 899.37 985.87   Q 900.99 986.50 902.75 986.52   Q 906.01 986.57 911.25 986.48   Q 922.76 986.27 930.00 986.48   Q 933.70 986.58 934.76 983.54   Q 941.62 982.96 945.03 982.96   Q 1051.09 983.01 1157.15 983.09   Q 1161.64 983.09 1166.24 982.13   Q 1166.95 984.03 1169.16 985.68   A 2.00 1.92 66.6 0 0 1170.07 986.06   C 1177.74 987.16 1184.98 986.57 1199.50 986.44   Q 1201.51 986.42 1203.29 986.05   A 1.36 1.34 11.6 0 0 1204.09 985.53   Q 1204.93 984.37 1204.82 982.97   Q 1298.13 982.94 1390.98 982.97   Q 1395.89 982.97 1399.86 982.42   L 1402.94 985.29   A 2.43 2.38 72.2 0 0 1404.08 985.89   Q 1407.00 986.52 1410.50 986.53   Q 1423.00 986.54 1438.75 986.44   C 1442.53 986.42 1443.28 984.91 1443.32 981.25   Q 1443.49 962.06 1443.31 950.63   Q 1443.27 948.44 1443.74 946.93   A 0.69 0.69 0.0 0 1 1444.40 946.44   L 1536.00 946.44   Z"
              fill="#243b56"
            />
          </g>
        </g>
      </g>
      {/* Overlay content zones last */}
      {Object.entries(zoneContent).map(([zoneId, content]) => (
        <g key={zoneId}>{content}</g>
      ))}
    </svg>
  )
}

