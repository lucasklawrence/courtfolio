import 'react'

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      foreignObject: React.SVGProps<SVGForeignObjectElement>
    }
  }
}
