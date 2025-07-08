/**
 * Overlay animation for "foil" trading cards.
 * Used when a project is marked as `featured`.
 */
export const FoilShineOverlay: React.FC = () => (
  <>
    <div className="absolute inset-0 pointer-events-none">
      <div className="foil-shine w-full h-full absolute top-0 left-0" />
    </div>
    <style jsx>{`
      .foil-shine {
        background: linear-gradient(
          120deg,
          rgba(255, 255, 255, 0.05) 0%,
          rgba(255, 255, 255, 0.4) 50%,
          rgba(255, 255, 255, 0.05) 100%
        );
        transform: rotate(25deg);
        animation: shine 2.5s infinite linear;
        opacity: 0.6;
        mix-blend-mode: screen;
      }
      @keyframes shine {
        0% {
          transform: translateX(-100%) rotate(25deg);
        }
        100% {
          transform: translateX(100%) rotate(25deg);
        }
      }
    `}</style>
  </>
)
