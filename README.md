# Movie Taste Tracker

A beautiful web app to track your (and your wife's) movie tastes over time, log what you've seen, and get personalized + shared recommendations.

## Features

- Rate movies (1–10) and mark as seen
- Live taste profile with radar charts (genres, actors, directors, decades)
- Smart recommendations using collaborative + content-based filtering
- Shared "Date Night" suggestions based on taste overlap
- Fully persistent in the browser (localStorage)
- Responsive and clean UI

## Getting Started

```bash
# Install dependencies
npm install

# Run locally
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy to GitHub Pages

```bash
# Build and deploy (one command)
npm run deploy
```

This will publish the app to `https://dmoniker.github.io/movies/`.

**Note:** GitHub Pages runs Jekyll by default, which ignores folders starting with `_` (like Next.js `_next/`). This project ships a `.nojekyll` file so CSS/JS assets are served correctly. After deploying, hard-refresh the site (Cmd/Ctrl + Shift + R) if styles look stale.

## Tech Stack

- Next.js 16 (App Router + React 19)
- TypeScript
- Tailwind CSS
- Recharts (for radar charts)
- Static export for GitHub Pages

Made with ❤️ for tracking movie memories together.
