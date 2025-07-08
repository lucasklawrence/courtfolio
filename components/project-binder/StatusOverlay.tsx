/**
 * Displays animated overlays for project status:
 * "coming-soon" and "in-progress".
 */
export const StatusOverlay: React.FC<{ status: 'coming-soon' | 'in-progress' }> = ({ status }) => {
  if (!status) return null

  const isComingSoon = status === 'coming-soon'

  return (
    <>
      <div className="absolute inset-0 pointer-events-none z-10">
        <div
          className={`${isComingSoon ? 'coming-soon-shine' : 'in-progress-shine'} w-full h-full absolute top-0 left-0`}
        />
      </div>
      <div className="absolute top-2 right-2 text-xs bg-purple-600 text-white px-2 py-0.5 rounded shadow z-30">
        {isComingSoon ? '⏳ Coming Soon' : '🚧 In Progress'}
      </div>

      <style jsx>{`
        .coming-soon-shine {
          background: linear-gradient(
            90deg,
            rgba(180, 100, 255, 0.05) 0%,
            rgba(180, 100, 255, 0.3) 50%,
            rgba(180, 100, 255, 0.05) 100%
          );
          animation: comingSoonSweep 5s infinite ease-in-out;
          opacity: 0.25;
          mix-blend-mode: screen;
        }
        .in-progress-shine {
          background: linear-gradient(
            135deg,
            rgba(0, 120, 255, 0.05) 0%,
            rgba(0, 120, 255, 0.15) 50%,
            rgba(0, 120, 255, 0.05) 100%
          );
          transform: rotate(10deg);
          animation: inProgressShine 4s infinite linear;
          opacity: 0.3;
          mix-blend-mode: screen;
        }

        @keyframes comingSoonSweep {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }

        @keyframes inProgressShine {
          0% {
            transform: translateX(-100%) rotate(10deg);
          }
          100% {
            transform: translateX(100%) rotate(10deg);
          }
        }
      `}</style>
    </>
  )
}
