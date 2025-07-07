export const FilmRoomScreenContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-neutral-900 bg-opacity-95 p-6">
      <div className="flex flex-col items-center justify-center w-full max-w-4xl h-full text-white bg-neutral-800 bg-opacity-80 backdrop-blur-md rounded-md shadow-[0_0_40px_10px_rgba(255,255,255,0.1)] overflow-hidden p-6">
        {children}
      </div>
    </div>
  )
}