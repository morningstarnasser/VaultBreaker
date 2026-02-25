# VaultBreaker

## Project Overview
AES-256 offline wallet password recovery tool. Runs 100% in the browser — no server, no data leaves the machine.

## Tech Stack
- **Frontend:** React 18 + TypeScript
- **Build:** Vite 6
- **Styling:** TailwindCSS 3 + Framer Motion
- **Icons:** Lucide React
- **Crypto:** Web Crypto API (SubtleCrypto) via Web Workers
- **Language:** German UI

## Architecture
```
src/
  App.tsx                  # Main app shell, routing between upload & analysis view
  main.tsx                 # React entry point
  index.css                # TailwindCSS + glassmorphism utilities
  types.ts                 # Shared TypeScript types (WalletInfo, MasterKeyData, Worker messages)
  components/
    FileUpload.tsx         # Drag & drop wallet.dat upload
    WalletInfo.tsx         # Wallet analysis panel + hashcat/btcrecover export
    RecoveryPanel.tsx      # Password recovery UI with 6 attack modes
  lib/
    wallet-parser.ts       # Binary parser for wallet.dat (BDB + SQLite formats)
    recovery-worker.ts     # Web Worker for AES-256-CBC password testing
```

## Key Commands
- `npm run dev` — Start dev server
- `npm run build` — TypeScript check + production build
- `npm run preview` — Preview production build

## Conventions
- UI language: German
- Dark theme with glassmorphism (cyan/violet accents)
- All crypto operations run in Web Workers (never block main thread)
- No external API calls — everything is client-side
- File size limit: 500 MB for wallet uploads
