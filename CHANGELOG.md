# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),  
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

- **Film Room** – Project deep dives
- **Hall of Strategy** – Architecture write-ups
- **Press Room** – Blog & media entries, changelog, etc


## [0.2.7] - 2026-01-12

### Changed
- Refactored static SVG components (logo + contact frames) to external symbol assets rendered via `SvgUse`.

### Fixed
- Forwarded SVG props to locker room SVG wrappers using `SvgUse`.

## [0.2.6] - 2025-12-31

### Added
- React/Next principles guide docs.

### Fixed
- Locker Room: restored jersey tooltip, typed zone IDs, cleaned stray mojibake, and removed debug logs.
- Accessibility: locker zones now support keyboard activation and aria-labels from tooltips.
- Banners/Projects pages: fixed dynamic import/serialization issues and cleaned banner copy.

### Changed
- Converted shared layout wrappers to server components where possible; dynamic imports for heavy client bundles (binder, banners).

## [0.2.5] - 2025-12-30

### Fixed
- Fixed security vulnerability.

### Changed
- Updated fifth locker room to represent Snapchat.

## [0.2.3] - 2025-07-19

### Added
- More Banners to rafters
- OCR and R-Learning Snake Projects

### Fixed
- Fixed blur on project cards on hover due to gpu acceleration with motion div
- Words around court logo overlapped to look like there was a typo
- Laptop and Canoga clickable areas in locker room

### Changed
- Updated resume, lead engineer instead of acting lead
- Updated contact page to match /in/ for LinkedIn links

## [0.2.2] - 2025-07-13

### Fixed
- Fixed pinch to zoom on mobile for locker room and contact page

## [0.2.1] - 2025-07-12

### Fixed
- Fixed pinch to zoom on mobile for home page during tutorial and during free roam

## [0.2.0] - 2025-07-07

### Changed
- Project page is now binder with trading cards for high level overview
- Update tour and entry point button to reflect change

## [0.1.3] – 2025-07-07

### Changed
- Changed button layout for navigating to new zones based on feedback
- Changed location of contact me section, make navigating to front office stand out more
- Updated tour to match changed layout

## [0.1.2] – 2025-07-06
### Fixed
- Readme cleanup

---

## [0.1.1] – 2025-07-06
### Fixed
- Restored correct layout sizing and `className` syntax in `CourtContainer.tsx`
- Ensured correct mobile scaling using `svh` and working `isLandscape` fallback

---

## [0.1.0] – 2025-07-06

### Added
- Full-court SVG layout with interactive zone navigation
- Mobile + desktop layout, orientation-aware with zoom/pan support

#### Intro Experience
- `TunnelHero` animated intro with CTA
- `CourtTutorialSprite`: guided tour with highlights and speech bubbles

#### Locker Room
- Stylized SVG locker wall with themed categories:
  - Hoops
  - Personal
  - Wildcard
  - Canoga
  - Next Team

#### Front Office (Contact Page)
- Scouting-room metaphor with:
  - Scouting report and "shot range" skills list
  - Resume download clipboard
  - Email and LinkedIn contact
  - Framed jersey and LA skyline artwork

#### Banner Wall ("The Rafters")
- Achievement zones for:
  - Tech
  - Personal
  - Basketball
