# Court Vision

**Court Vision** – A basketball-themed portfolio that blends design, interaction, and technical storytelling.

🏀 [Live Site → lucasklawrence.com](https://lucasklawrence.com)

---

## 📸 Overview

This portfolio reimagines the developer showcase as a full-court experience. Explore zones like the Locker Room, Rafters, and Front Office — each revealing a different side of the story: technical depth, creativity, and personality.

---

## 🎯 Features

- **Interactive Court Layout** – SVG-based basketball court with zone navigation
- **TunnelHero Intro** – Animated onboarding with motion and typewriter text
- **Court Tutorial Sprite** – Speech bubbles and guided highlights walk you through the site
- **Locker Room** – Themed lockers represent work history, creativity, and future plans
  - Hoops: trophies, jerseys, gear
  - Personal: passions and style
  - Wildcard: tribute, games, Zoe the cat
  - Canoga: current company with patent and product dashboards
  - Next Team: placeholder jersey, open to new opportunities
- **Banner Wall ("The Rafters")** – Achievements across:
  - Tech: Patent, internal platforms, production-grade launches
  - Personal: Launch of *Bars of the Day*
  - Basketball: League titles, Mythical 5, All-Star selections
- **Front Office (Contact Page)** – A scouting-room metaphor:
  - Resume clipboard, coffee table, framed jersey
  - Scouting report, shot range (React, Spring Boot, Kafka, SVG, etc.)
  - LinkedIn/email contact
- **Mobile-First UX** – Touch gestures, orientation handling, zoom support
- **Accessible** – Pointer-safe buttons, motion preferences, keyboard support

> 🎬 **Film Room** – *Coming Soon*

---

## 💻 Tech Stack

- **Next.js** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **Framer Motion**
- **Custom SVGs**
- **shadcn/ui** (select components)
- No external DB (yet) — all content is static/local

---

## 📦 Folder Structure

```
.
├── app/              # Next.js routes
├── components/       # Court, overlays, locker room, contact, etc.
├── constants/        # Tour steps, zone definitions
├── public/           # Static assets (SVGs, images)
├── utils/            # Hooks (useIsMobile, useTourState, etc.)
```

---

## Running Locally

```bash
npm install
npm run dev
```

Then visit [http://localhost:3000](http://localhost:3000)

No `.env` needed — everything lives in the repo.

---

## Contact

Connect via the Front Office in the site, or directly:

- 📧 [lucasklawrence@gmail.com](mailto:lucasklawrence@gmail.com)
- 💼 [linkedin.com/in/lucaslawrence](https://linkedin.com/in/lucaslawrence)

---

## License

This is a personal portfolio project by Lucas Lawrence, published publicly for transparency and inspiration.

All code, design assets, and content are **not licensed for reuse**.  
Please do not copy or republish without written permission.

© 2025 Lucas Lawrence. All rights reserved.