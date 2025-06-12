import React from 'react'

/**
 * SVG component for Scouting Report.
 * Can be styled or positioned using Tailwind or inline props.
 */
export const ScoutingReportSvg: React.FC<React.SVGProps<SVGSVGElement>> = props => {
  return (
    <svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" {...props}>
      <defs>
        <style>
          {`
            .title { font: bold 16px "Arial", sans-serif; fill: #1a1a1a; }
            .label { font: 14px "Arial", sans-serif; fill: #1a1a1a; }
            .value { font: 14px "Arial", sans-serif; fill: #1a1a1a; text-anchor: end; }
            .sticky-text { font: bold 12px "Arial", sans-serif; fill: #1a1a1a; }
          `}
        </style>
      </defs>

      {/* Brown clipboard background */}
      <rect x="0" y="0" width="400" height="300" rx="12" ry="12" fill="#5c3b1e" />

      {/* White paper inset */}
      <rect x="20" y="20" width="360" height="260" rx="6" ry="6" fill="white" />

      {/* Clipboard clip */}
      <rect x="160" y="5" width="80" height="25" rx="6" ry="6" fill="#333" />
      <circle cx="200" cy="17.5" r="4" fill="#fdf6ec" />

      {/* Title */}
      <text className="title" x="200" y="60" textAnchor="middle">
        SCOUTING REPORT: LUCAS LAWRENCE
      </text>

      {/* Labels and values */}
      <text className="label" x="40" y="100">
        Tech Stack IQ:
      </text>
      <text className="value" x="360" y="100">
        Elite
      </text>

      <text className="label" x="40" y="130">
        Court Vision:
      </text>
      <text className="value" x="360" y="130">
        Full Stack Flow
      </text>

      <text className="label" x="40" y="160">
        Communication:
      </text>
      <text className="value" x="360" y="160">
        Coachable
      </text>

      <text className="label" x="40" y="190">
        Intangibles:
      </text>
      <text className="value" x="360" y="190">
        Team Culture Builder
      </text>

      {/* Sticky note with slight rotation */}
      <g transform="rotate(-3, 290, 235)">
        <rect
          x="230"
          y="200"
          width="130"
          height="70"
          rx="4"
          ry="4"
          fill="#fff176"
          stroke="#222"
          strokeWidth="2"
        />
        <text className="sticky-text" x="240" y="220">
          High upside.
        </text>
        <text className="sticky-text" x="240" y="240">
          Proven leader.
        </text>
        <text className="sticky-text" x="240" y="260">
          Ready now.
        </text>
      </g>
    </svg>
  )
}
