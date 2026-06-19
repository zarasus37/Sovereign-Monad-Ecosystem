# Sovereign Monad Website

Production website for `sovereignmonad.xyz`.

This package is a standalone Next.js 14 + Tailwind landing page designed for Vercel deployment. It mirrors the deck language used in the Sovereign Monad briefing material: black schematic field, gold capital geometry, cyan intelligence rails, monospaced technical metadata, and live Monad mainnet proof links.

## Stack

- Next.js 14
- TypeScript
- Tailwind CSS
- Vercel

## Local Development

```powershell
cd C:\Users\crisc\Dev\agents\monad-mev\sovereign-site
npm install
npm run dev
```

Open `http://localhost:3000`.

## Production Build

```powershell
cd C:\Users\crisc\Dev\agents\monad-mev\sovereign-site
npm run build
npm run start
```

## Vercel Deployment

1. Import the repository into Vercel.
2. Set the project Root Directory to `sovereign-site`.
3. Leave the framework preset as `Next.js`.
4. Build command: `npm run build`
5. Output directory: leave blank so Vercel uses `.next`
6. Add the custom domain `sovereignmonad.xyz`

No environment variables are required for this site.

## Files

- `src/app/layout.tsx`: metadata, fonts, and shell
- `src/app/page.tsx`: the full one-page experience
- `src/app/globals.css`: schematic visual language and motion
- `src/components/schematic.tsx`: hero glyphs and section diagrams
- `vercel.json`: security headers for deployment

## Content Notes

- All mainnet addresses and transaction hashes are hard-linked to MonadScan.
- The live behavioral claim uses the mined on-chain decision hash, not the earlier prepared proof hash.
- The page is static by design for high performance and zero tracking.
