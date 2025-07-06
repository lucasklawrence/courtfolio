import React from 'react'
import { SlideSection } from './data/project'

interface Props {
  section: SlideSection
}

export const SlideRenderer: React.FC<Props> = ({ section }) => {
  const { type, content, heading, subtext } = section

  return (
    <div className="w-full mb-8 last:mb-0 px-4">
      {heading && (
        <h3 className="text-2xl font-semibold text-center mb-2 text-white drop-shadow-md">
          {heading}
        </h3>
      )}
      {subtext && (
        <p className="text-center text-gray-400 mb-4 italic">{subtext}</p>
      )}

      {(() => {
        switch (type) {
          case 'text':
            return (
              <p className="text-lg text-center text-gray-200 whitespace-pre-line leading-relaxed">
                {content}
              </p>
            )

          case 'image':
            return (
              <div className="flex justify-center">
                <img
                  src={content}
                  alt={heading || 'Slide image'}
                  className="rounded shadow-lg max-h-[500px] object-contain"
                />
              </div>
            )

          case 'code':
            return (
              <div className="bg-black/80 text-green-200 text-sm rounded-md overflow-auto p-4 font-mono shadow-inner">
                <pre>
                  <code>{content}</code>
                </pre>
              </div>
            )

          case 'demo':
            return (
              <div className="w-full h-[400px] border border-gray-600 rounded overflow-hidden">
                <iframe
                  src={content}
                  className="w-full h-full"
                  allow="autoplay; fullscreen"
                />
              </div>
            )

          case 'quote':
            return (
              <blockquote className="text-xl italic text-center text-gray-300 border-l-4 border-white/30 pl-4">
                “{content}”
              </blockquote>
            )

          default:
            return (
              <p className="text-red-500 text-sm text-center italic">
                Unknown slide type: {type}
              </p>
            )
        }
      })()}
    </div>
  )
}
