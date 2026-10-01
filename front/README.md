# Truth Machine Frontend

React interface for uploading files, checking their recorded fingerprints and downloading verified bytes. A treasury panel exposes the backend's funding, write-token and pending-action controls.

The frontend uses the Truth Machine API for storage and blockchain operations. See the [project README](../README.md) for backend, MongoDB and wallet configuration.

## Run locally

Use Node.js 22.13 or later in the 22.x release line, and npm. From the repository root:

```sh
cd front
npm ci
```

Create or update `front/.env.local`:

```dotenv
VITE_API_URL=http://localhost:3030
```

Start the backend separately, then run:

```sh
npm run dev -- --host 127.0.0.1
```

Open `http://localhost:3000`. Both development and preview use port 3000 with strict port selection, so stop an existing frontend container before starting either command.

The interface needs a running API for treasury information, uploads, verification and downloads. Local fingerprint comparison runs in the browser. No browser wallet extension is required; the backend manages the funding wallet.

## Main workflows

- **Upload:** select a non-empty file up to 10 MiB. The browser calculates a SHA-256 fingerprint and sends the file bytes to `/upload` when requested. Uploads consume write tokens managed by the backend.
- **Compare:** compare the selected file's fingerprint with another file or a pasted hash without uploading the comparison file.
- **Verify:** enter a transaction ID or fingerprint. The API reports file-hash matching, transaction commitment matching, broadcast acceptance and block inclusion separately.
- **Download:** retrieve the stored file; the browser recalculates its fingerprint before saving it.
- **Treasury:** inspect funds, mint tokens, check pending actions and consolidate unused tokens.

Minting, uploading and consolidation can create real transactions on the backend's configured network. An uncertain or pending result should be checked before repeating the action. Files uploaded to the demonstration are not private storage.

The frontend displays blockchain verification results supplied by the API. Its local byte comparison does not independently establish block inclusion, authorship or truthfulness of a file's contents.

## Build and hosting

For a local build:

```sh
VITE_API_URL=http://localhost:3030 npm run build
npm run preview -- --host 127.0.0.1
```

The checked-in `.env.production` targets the hosted API. Set `VITE_API_URL` explicitly for your intended deployment; its value is embedded in the bundle. Successful builds write `dist/`.

The build script invokes the TypeScript compiler through the `@typescript/native` package alias before running Vite. Preserve the compiler aliases in [package.json](package.json) when updating tooling. `npm run lint` is available; no frontend test script is defined.

## Source guide

- [Upload.tsx](src/Upload.tsx): file selection, local comparison and upload receipts.
- [Download.tsx](src/Download.tsx): verification checklist and download hash checks.
- [Funding.tsx](src/Funding.tsx) and [useFunding.tsx](src/useFunding.tsx): treasury controls and pending state.
- [api.ts](src/api.ts): API URL, request handling and file-size limit.
- [Dockerfile](Dockerfile): production build and static hosting.
