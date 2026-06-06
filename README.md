# Movie Taste Tracker

A beautiful web app to track your movie tastes over time, log what you've seen, and get personalized + shared recommendations.

## Features

- Rate movies (1–10) and mark as seen
- Live movie catalog powered by [TMDB](https://www.themoviedb.org/)
- Live taste profile with radar charts (genres, actors, directors, decades)
- Smart recommendations using your ratings + TMDB discover/similar titles
- Shared "Date Night" suggestions based on taste overlap
- Fully persistent in the browser (localStorage)
- Responsive and clean UI

## Getting Started

### 1. Get a TMDB API key

1. Create a free account at [themoviedb.org](https://www.themoviedb.org/)
2. Open [API settings](https://www.themoviedb.org/settings/api)
3. Request an API key and copy the **API Key (v3 auth)** value

### 2. Configure locally

```bash
cp .env.example .env.local
```

Edit `.env.local` with a **server-only** key (no `NEXT_PUBLIC_` prefix):

```bash
TMDB_API_KEY=your_key_here
```

This is read only by Next.js API routes and is **not** included in the browser bundle.

### 3. Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000/](http://localhost:3000/).

## Deploy to Vercel

This app uses Next.js API routes as a TMDB proxy, so it deploys as a standard Vercel Next.js project.

### Option A: Vercel dashboard (GitHub)

1. Push this repo to GitHub
2. [Import the project](https://vercel.com/new) in Vercel
3. **Environment Variables** — add for Production (and Preview if desired):

   | Name | Required |
   |---|---|
   | `TMDB_API_KEY` | Yes |

4. Deploy
5. Optional: add a custom domain under **Project → Settings → Domains**

### Option B: Vercel CLI

```bash
npm i -g vercel   # once
vercel login      # once
vercel link       # link this folder to a Vercel project
vercel env add TMDB_API_KEY
vercel --prod
```

After the first `vercel link`, future deploys are just `vercel --prod`.

## How data is stored

| Data | Source | Stored where |
|---|---|---|
| Movie catalog | TMDB API via server proxy | Fetched on demand |
| Ratings & seen status | You | Browser `localStorage` |
| Rated movie details | TMDB + cache | Browser `localStorage` (`movieCache`) |
| Dismissal rules | You | Browser `localStorage` |
| API keys | Deployer | Vercel environment only |

Use **Export** in the app to back up your ratings and cached movie metadata.

## Tech Stack

- Next.js 16 (App Router + React 19)
- TypeScript
- Tailwind CSS
- Recharts (for radar charts)
- TMDB API (server-side proxy)
- Vercel

Made with ❤️ for tracking movie memories together.
