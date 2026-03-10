# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Truth Machine is a blockchain-based data integrity system on BSV Blockchain. Files are hashed (SHA-256), the hash is committed to the blockchain via an OP_RETURN transaction, and the file is stored in MongoDB alongside the transaction in BEEF format. Integrity verification uses SPV proofs (merkle paths) via Chaintracks.

## Essential Commands

### Backend (`back/`)
```bash
npm run dev    # tsx watch ./src/index.ts (hot-reload)
npm run build  # tsc → ./dist/
npm run start  # node ./dist/index.js
```

### Frontend (`front/`)
```bash
npm run dev      # Vite dev server on :3000
npm run build    # tsc -b && vite build
npm run lint     # ESLint
npm run preview  # Preview production build on :3000
```

### Docker (full stack)
```bash
docker compose up     # Backend :3030, Frontend :3000, MongoDB :28017
docker compose build  # Rebuild images
sh quickstart.sh      # Automated setup and launch
```

No automated tests exist. Manual testing: upload a file via the UI, verify on a block explorer, download and check integrity.

## Architecture

```
back/
  src/
    index.ts              # Express app, all route definitions
    arc.ts                # Broadcaster setup (SuperArc failover on mainnet, single ARC on testnet)
    db.ts                 # MongoDB connection (appends '-mainnet' to DB_NAME on mainnet)
    HashPuzzle.ts         # ScriptTemplate: OP_SHA256 <hash> OP_EQUAL locking/unlocking
    BitailsBroadcaster.ts # Bitails API broadcaster (fallback)
    woc.js                # WhatsOnChain API client with rate-limiting queue (350ms between requests)
    functions/
      address.ts          # Derives PrivateKey and address from FUNDING_WIF
      fund.ts             # GET /fund/:number — splits P2PKH UTXO into N hash-puzzle-locked 13-sat UTXOs
      upload.ts           # POST /upload — hashes file, spends one UTXO, broadcasts OP_RETURN tx
      download.ts         # GET /download/:id — retrieves file by txid or fileHash
      integrity.ts        # GET /integrity/:id — SPV verification via Chaintracks + script verification
      callback.ts         # POST /callback — ARC callback: merges merkle paths into BEEF, marks UTXOs confirmed
      checkTreasury.ts    # GET /checkTreasury — available tokens + balance
      consolidate.ts      # GET /consolidate — merges all unused UTXOs back to treasury address
      allFunds.ts         # GET /allFunds
      utxoStatusUptate.ts # GET /utxoStatusUpdate

front/
  src/
    App.tsx               # Main layout: Treasury, Upload, Download sections
    Funding.tsx           # QR code + token creation UI
    useFunding.tsx        # React context/hook for funding state
    Upload.tsx            # File upload UI
    Download.tsx          # File download + integrity check UI
```

## Key Patterns

**Treasury/Token System**: The funding address holds P2PKH UTXOs. `/fund/:number` splits one into N small (13-sat) hash-puzzle-locked UTXOs stored in the `utxos` collection. Each upload consumes one UTXO. `/consolidate` reclaims unused UTXOs back to the treasury address.

**BEEF Format**: All transactions are stored as BEEF hex strings. ARC callbacks deliver merkle paths which get merged into the BEEF via `Beef.mergeBump()`, upgrading unconfirmed transactions to SPV-verifiable proofs.

**Broadcasting**: Mainnet uses `SuperArc` — a sequential failover across TAAL ARC, GorillaPool ARC, BSVA ARC, WhatsOnChain, and Bitails. Testnet uses TAAL ARC only.

**MongoDB Collections**: `txs` (transactions + files in BEEF format), `utxos` (hash-puzzle-locked outputs with secrets). DB name is `{DB_NAME}` on testnet, `{DB_NAME}-mainnet` on mainnet.

## Environment Variables

See `back/.example.env`. Key vars: `FUNDING_WIF`, `NETWORK` (test|main), `MONGO_URI`, `DOMAIN` (for ARC callbacks), `CALLBACK_TOKEN`, `ARC_API_KEY`, `TEST_ARC_API_KEY`.

## BSV SDK Usage

- `@bsv/sdk` v2.x — Transaction building, P2PKH, Hash, MerklePath, Beef, ARC
- `@bsv/templates` — OpReturn template (aliased as `Data` in upload.ts)
- `@bsv/wallet-toolbox` — ChaintracksChainTracker for SPV verification in integrity.ts
- Custom `HashPuzzle` ScriptTemplate in `back/src/HashPuzzle.ts`

## Backend Notes

- TypeScript compiled to CommonJS (`module: "commonjs"` in tsconfig)
- `woc.js` is plain JavaScript (not TypeScript) — the only JS file in the backend
- Backend uses `tsx watch` for dev (not `ts-node`)
- Express middleware: `express.raw()` on the upload route, `express.json()` on callback/checkTreasury
- No authentication on most endpoints; only `/callback` validates a Bearer token
