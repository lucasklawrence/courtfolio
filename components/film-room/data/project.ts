export interface Project {
  slug: string               // URL-safe ID, e.g., 'bars-of-the-day'
  title: string              // Display title
  tagline?: string           // Short one-liner for selector UI
  description?: string       // Optional long description
  coverImage?: string        // Thumbnail/visual asset
  slides?: SlideSection[]    // Optional: array of sections to render in slideshow
}

export interface SlideSection {
  type: 'text' | 'image' | 'code' | 'demo' | 'quote'
  content: any               // Renderable content — can vary by type
  heading?: string
  subtext?: string
}