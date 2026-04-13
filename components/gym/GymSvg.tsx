'use client'

import React from 'react'

type GymSvgProps = {
  className?: string
  zoneContent?: Record<string, React.ReactNode>
}

/**
 * GymSvg — inline SVG weight room scene.
 * Uses the same 1536×1024 viewBox as CourtSvg so SvgLayoutContainer works unchanged.
 * Zone content is injected via the zoneContent prop (same pattern as CourtSvg).
 */
export function GymSvg({ className = '', zoneContent = {} }: GymSvgProps) {
  return (
    <svg
      viewBox="0 0 1536 1024"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid meet"
      className={`w-full h-full touch-pan-x touch-pan-y touch-pinch-zoom ${className}`}
    >
      <defs>
        {/* Light glow gradient */}
        <radialGradient id="gymLightGlow" cx="50%" cy="0%" r="70%" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#fffde7" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#fffde7" stopOpacity="0" />
        </radialGradient>

        {/* Rubber mat tile pattern */}
        <pattern id="rubberMat" x="0" y="0" width="48" height="48" patternUnits="userSpaceOnUse">
          <rect width="48" height="48" fill="#222222" />
          <line x1="0" y1="0" x2="48" y2="0" stroke="#2d2d2d" strokeWidth="1.5" />
          <line x1="0" y1="0" x2="0" y2="48" stroke="#2d2d2d" strokeWidth="1.5" />
        </pattern>

        {/* Drop shadow for panels */}
        <filter id="panelShadow" x="-5%" y="-5%" width="110%" height="115%">
          <feDropShadow dx="0" dy="4" stdDeviation="8" floodColor="#000" floodOpacity="0.6" />
        </filter>

        {/* Whiteboard glow */}
        <filter id="boardGlow" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* ═══════════════════════════════════════════════
          BACKGROUND
      ═══════════════════════════════════════════════ */}
      <rect width="1536" height="1024" fill="#111111" />

      {/* Back wall — slightly lighter */}
      <rect x="0" y="62" width="1536" height="790" fill="#181818" />

      {/* Horizontal wall accent stripe */}
      <rect x="0" y="310" width="1536" height="3" fill="#252525" />
      <rect x="0" y="313" width="1536" height="1" fill="#333" opacity="0.5" />

      {/* ═══════════════════════════════════════════════
          CEILING
      ═══════════════════════════════════════════════ */}
      <rect x="0" y="0" width="1536" height="66" fill="#0c0c0c" />
      <line x1="0" y1="66" x2="1536" y2="66" stroke="#242424" strokeWidth="2" />

      {/* Ceiling pipes / conduit */}
      <rect x="0" y="20" width="1536" height="6" rx="3" fill="#161616" stroke="#222" strokeWidth="1" />

      {/* ─── Fluorescent light 1 ─── */}
      <rect x="155" y="8" width="270" height="40" rx="5" fill="#111" />
      <rect x="160" y="11" width="260" height="34" rx="4" fill="#fffde7" opacity="0.92" />
      <rect x="160" y="11" width="260" height="8" rx="3" fill="white" opacity="0.3" />
      {/* Glow spread */}
      <rect x="0" y="0" width="580" height="200" fill="url(#gymLightGlow)" opacity="0.8" />

      {/* ─── Fluorescent light 2 (center) ─── */}
      <rect x="633" y="8" width="270" height="40" rx="5" fill="#111" />
      <rect x="638" y="11" width="260" height="34" rx="4" fill="#fffde7" opacity="0.92" />
      <rect x="638" y="11" width="260" height="8" rx="3" fill="white" opacity="0.3" />
      <rect x="478" y="0" width="580" height="200" fill="url(#gymLightGlow)" opacity="0.8" />

      {/* ─── Fluorescent light 3 ─── */}
      <rect x="1111" y="8" width="270" height="40" rx="5" fill="#111" />
      <rect x="1116" y="11" width="260" height="34" rx="4" fill="#fffde7" opacity="0.92" />
      <rect x="1116" y="11" width="260" height="8" rx="3" fill="white" opacity="0.3" />
      <rect x="956" y="0" width="580" height="200" fill="url(#gymLightGlow)" opacity="0.8" />

      {/* ═══════════════════════════════════════════════
          FLOOR — rubber mat
      ═══════════════════════════════════════════════ */}
      <rect x="0" y="852" width="1536" height="172" fill="url(#rubberMat)" />
      <line x1="0" y1="852" x2="1536" y2="852" stroke="#3a3a3a" strokeWidth="3" />
      {/* Floor highlight at wall base */}
      <rect x="0" y="849" width="1536" height="4" fill="#2a2a2a" />

      {/* ═══════════════════════════════════════════════
          LEFT — SQUAT RACK (decorative, partially behind panel)
      ═══════════════════════════════════════════════ */}
      {/* Left upright column */}
      <rect x="28" y="190" width="12" height="662" fill="#242424" stroke="#383838" strokeWidth="1.5" />
      {/* Right upright column */}
      <rect x="110" y="190" width="12" height="662" fill="#242424" stroke="#383838" strokeWidth="1.5" />
      {/* Top crossbar */}
      <rect x="28" y="190" width="94" height="10" fill="#2d2d2d" stroke="#444" strokeWidth="1" />
      {/* Second crossbar */}
      <rect x="28" y="260" width="94" height="8" fill="#292929" stroke="#3a3a3a" strokeWidth="1" />
      {/* J-hooks */}
      <rect x="20" y="395" width="20" height="7" rx="2" fill="#505050" stroke="#666" strokeWidth="1" />
      <rect x="110" y="395" width="20" height="7" rx="2" fill="#505050" stroke="#666" strokeWidth="1" />
      {/* Safety pins */}
      <rect x="20" y="490" width="20" height="7" rx="2" fill="#404040" stroke="#555" strokeWidth="1" />
      <rect x="110" y="490" width="20" height="7" rx="2" fill="#404040" stroke="#555" strokeWidth="1" />
      {/* Barbell */}
      <rect x="-30" y="390" width="210" height="9" rx="4" fill="#888" stroke="#aaa" strokeWidth="1" />
      {/* Collars */}
      <rect x="-4" y="385" width="8" height="19" rx="2" fill="#999" />
      <rect x="146" y="385" width="8" height="19" rx="2" fill="#999" />
      {/* Plates - red 45s */}
      <rect x="-28" y="372" width="26" height="46" rx="3" fill="#9b2335" stroke="#c0392b" strokeWidth="1.5" />
      <rect x="152" y="372" width="26" height="46" rx="3" fill="#9b2335" stroke="#c0392b" strokeWidth="1.5" />

      {/* Weight plates leaning on wall (far left) */}
      <ellipse cx="60" cy="854" rx="6" ry="34" fill="#9b2335" stroke="#c0392b" strokeWidth="1.5" />
      <ellipse cx="75" cy="854" rx="6" ry="28" fill="#1a5276" stroke="#2980b9" strokeWidth="1.5" />
      <ellipse cx="89" cy="854" rx="5" ry="22" fill="#1d6a3a" stroke="#27ae60" strokeWidth="1.5" />

      {/* ═══════════════════════════════════════════════
          RIGHT — DUMBBELL RACK (decorative)
      ═══════════════════════════════════════════════ */}
      {/* Rack uprights */}
      <rect x="1406" y="380" width="10" height="472" fill="#232323" stroke="#383838" strokeWidth="1" />
      <rect x="1520" y="380" width="10" height="472" fill="#232323" stroke="#383838" strokeWidth="1" />
      {/* Shelf tiers */}
      <rect x="1406" y="380" width="124" height="8" fill="#2c2c2c" stroke="#3a3a3a" strokeWidth="1" />
      <rect x="1406" y="426" width="124" height="8" fill="#2c2c2c" stroke="#3a3a3a" strokeWidth="1" />
      <rect x="1406" y="472" width="124" height="8" fill="#2c2c2c" stroke="#3a3a3a" strokeWidth="1" />
      {/* Dumbbells row 1 — light */}
      <rect x="1414" y="364" width="36" height="10" rx="3" fill="#4a4a4a" />
      <ellipse cx="1414" cy="369" rx="7" ry="9" fill="#555" stroke="#666" strokeWidth="1" />
      <ellipse cx="1450" cy="369" rx="7" ry="9" fill="#555" stroke="#666" strokeWidth="1" />
      <rect x="1460" y="364" width="36" height="10" rx="3" fill="#4a4a4a" />
      <ellipse cx="1460" cy="369" rx="8" ry="10" fill="#505050" stroke="#666" strokeWidth="1" />
      <ellipse cx="1496" cy="369" rx="8" ry="10" fill="#505050" stroke="#666" strokeWidth="1" />
      {/* Dumbbells row 2 — medium */}
      <rect x="1414" y="409" width="36" height="10" rx="3" fill="#404040" />
      <ellipse cx="1414" cy="414" rx="9" ry="11" fill="#484848" stroke="#5a5a5a" strokeWidth="1" />
      <ellipse cx="1450" cy="414" rx="9" ry="11" fill="#484848" stroke="#5a5a5a" strokeWidth="1" />
      <rect x="1462" y="409" width="36" height="10" rx="3" fill="#404040" />
      <ellipse cx="1462" cy="414" rx="10" ry="12" fill="#444" stroke="#555" strokeWidth="1" />
      <ellipse cx="1498" cy="414" rx="10" ry="12" fill="#444" stroke="#555" strokeWidth="1" />
      {/* Dumbbells row 3 — heavy */}
      <rect x="1414" y="453" width="36" height="10" rx="3" fill="#383838" />
      <ellipse cx="1414" cy="458" rx="11" ry="13" fill="#3e3e3e" stroke="#4a4a4a" strokeWidth="1" />
      <ellipse cx="1450" cy="458" rx="11" ry="13" fill="#3e3e3e" stroke="#4a4a4a" strokeWidth="1" />
      <rect x="1462" y="453" width="36" height="10" rx="3" fill="#383838" />
      <ellipse cx="1462" cy="458" rx="12" ry="14" fill="#3a3a3a" stroke="#484848" strokeWidth="1" />
      <ellipse cx="1498" cy="458" rx="12" ry="14" fill="#3a3a3a" stroke="#484848" strokeWidth="1" />

      {/* Weight plates leaning (far right) */}
      <ellipse cx="1476" cy="854" rx="6" ry="34" fill="#9b2335" stroke="#c0392b" strokeWidth="1.5" />
      <ellipse cx="1461" cy="854" rx="6" ry="28" fill="#1a5276" stroke="#2980b9" strokeWidth="1.5" />
      <ellipse cx="1447" cy="854" rx="5" ry="22" fill="#1d6a3a" stroke="#27ae60" strokeWidth="1.5" />

      {/* ═══════════════════════════════════════════════
          GYM TITLE (centered at top)
      ═══════════════════════════════════════════════ */}
      <text
        x="768"
        y="46"
        textAnchor="middle"
        fontFamily="'Geist Sans', system-ui, sans-serif"
        fontSize="22"
        fontWeight="700"
        letterSpacing="6"
        fill="#e0e0e0"
        opacity="0.85"
      >
        🏋️  TRAINING FACILITY
      </text>

      {/* ═══════════════════════════════════════════════
          ZONE CONTENT OVERLAYS
      ═══════════════════════════════════════════════ */}
      {/* Workout Log — left panel */}
      {zoneContent['workout-log']}
      {/* PR Board — center whiteboard */}
      {zoneContent['pr-board']}
      {/* Body Weight — right panel */}
      {zoneContent['body-weight']}
      {/* Back button */}
      {zoneContent['back-button']}
    </svg>
  )
}
