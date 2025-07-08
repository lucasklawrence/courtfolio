/**
 * Displays a top-corner badge for "Featured" or "Experimental" cards.
 */
export const RarityBadge: React.FC<{ featured?: boolean; experimental?: boolean }> = ({
  featured,
  experimental,
}) => {
  if (featured) {
    return (
      <div className="absolute top-2 right-2 text-xs bg-yellow-300 text-black px-2 py-0.5 rounded shadow">
        ⭐ Featured
      </div>
    )
  }

  if (experimental) {
    return (
      <div className="absolute top-2 left-2 text-xs bg-purple-600 text-white px-2 py-0.5 rounded shadow">
        🧪 Experimental
      </div>
    )
  }

  return null
}
