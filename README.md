# Truth Machine

Truth Machine is a BSV blockchain demo for storing a file, recording its SHA-256 fingerprint in a transaction, and checking that the stored file still matches that commitment.

File contents stay in MongoDB. Only the fingerprint is written to the blockchain. Once a transaction is mined and its Merkle proof is verified, the application can show that the fingerprint was included in a block. This establishes evidence of existence, not the file's original creation time, authorship or truthfulness.

## What you can do

- Upload a non-empty file up to 10 MB, using one write token.
- Find and verify a file by transaction ID or SHA-256 hash.
- Download the original bytes, with another hash check before saving.
- Fund the treasury, mint write tokens and consolidate confirmed, unused tokens.
- Follow clear success, pending and failure messages throughout each journey.
- Use the interface on desktop or mobile, in light or dark mode.

## Run locally with Docker

The Compose stack includes the frontend, backend and MongoDB. Docker with Compose is sufficient to run it; local Node.js is only needed for development or the legacy setup script.

```bash
git clone https://github.com/bsv-blockchain-demos/truth-machine.git
cd truth-machine
docker compose up -d --build
```

| Service | Local address |
| --- | --- |
| Frontend | http://localhost:3000 |
| Backend | http://localhost:3030 |
| MongoDB | `mongodb://localhost:28017` |

For an existing installation, this rebuilds the application from the checkout and keeps the existing database volume. Pulling source changes alone does not update running containers.

The checked-in Compose configuration uses **mainnet** and demo credentials. For a new instance, configure your own `FUNDING_WIF` and `CALLBACK_TOKEN` before funding it. For an existing funded instance, preserve its key and database. You can keep local settings in an automatically loaded `docker-compose.override.yml`, excluded from Git:

```bash
printf '\ndocker-compose.override.yml\n' >> .git/info/exclude
```

Example override, with placeholders to replace:

```yaml
services:
  truth-machine:
    environment:
      NETWORK: main
      FUNDING_WIF: "<your-private-WIF>"
      CALLBACK_TOKEN: "<your-callback-secret>"
      DOMAIN: ""
```

Apply configuration changes with `docker compose up -d`. Keep private keys and callback secrets out of commits.

Useful commands:

```bash
# Inspect all services, including stopped containers.
docker compose ps -a

# Follow backend logs.
docker compose logs -f truth-machine

# Restart the stack without rebuilding images.
docker compose up -d

# Stop and remove containers while retaining the database volume.
docker compose down
```

MongoDB uses the named `mongo_data` volume. Removing that volume also removes stored files, transaction records and token secrets.

### Legacy setup script

`quickstart.sh` is a first-time helper, not a restart command. It installs dependencies, generates a new wallet key, rewrites the frontend and backend environment files, updates the Compose wallet key and starts containers. It uses macOS-style `sed -i ''` and does not build the images by default.

Do not rerun it to start an existing funded installation. It also writes `NETWORK=test` to `back/.env`, while the Compose file selects `main`; choose the intended network explicitly for the mode you use.

## User journeys

### 1. Fund the treasury and mint tokens

1. Open **Treasury** in the header.
2. Deposit BSV at the displayed address, or use its QR code.
3. Select **Refresh balance** after depositing.
4. Choose between 1 and 1,000 tokens and select **Mint Tokens**.
5. Wait for **Tokens ready**, or follow the pending-action message.

A wallet balance alone does not enable uploads. Each upload needs one available write token. The current implementation creates 13-satoshi token outputs and calculates minting and consolidation fees at 100 satoshis per kilobyte. These are application settings, not a guarantee of acceptance by every broadcaster.

**Consolidate Tokens** returns the remaining value of confirmed, unused tokens to the treasury after the transaction fee. Those tokens are then unavailable for uploads. Pending, reserved or invalid tokens are excluded.

### 2. Upload a file

1. Select a file or drag it onto the upload area.
2. Select **Upload** and wait for the outcome.
3. Save the transaction ID and file hash from the receipt.
4. Select **Verify this file** to continue directly to verification.

Files must contain content and be no larger than 10 MB (10 × 1,024 × 1,024 bytes). The limit keeps file records within MongoDB's document size limit.

**File saved** means the file is stored and its transaction was accepted by a broadcaster. It does not mean the transaction has been mined. If the connection is interrupted, the interface preserves the locally calculated hash so you can look up the file before retrying.

### 3. Verify and download

1. Paste a transaction ID or file hash into **Verify & Download**.
2. Select **Verify file**. Uppercase letters and surrounding spaces are accepted.
3. Read the result, then select **Download file** when available.

Verification recalculates the stored file's hash and checks it against the transaction commitment. A confirmed result also requires a valid Merkle proof checked against blockchain headers. The original filename and content type are retained for downloads. The server checks the file again, and the browser verifies the downloaded bytes before saving them.

Changing the identifier clears the previous result. A pending file may be downloaded if its content matches, but that download does not establish blockchain confirmation.

### Outcomes and recovery

| Path | What the message means | Next step |
| --- | --- | --- |
| Happy: success | The named action completed, such as saving a file, making tokens available or verifying a mined proof. | Continue to verification, download the file or save its identifiers. |
| Medium: pending | Block confirmation is pending, a lookup service is unavailable or network acceptance is uncertain. | Use **Check again** for a file or **Check pending actions** in Treasury. Avoid repeating uncertain transactions. |
| Negative: failure | An identifier is invalid, a file was not found, file integrity failed or an action was rejected. | Correct the input or follow the message to refresh, choose another file or retry later. |

Signed transactions and upload data are saved before broadcasting. Tokens are reserved during submission. A definite rejection releases the reservation; an uncertain network outcome keeps it held until reconciliation observes the transaction. Minted tokens only become available after acceptance.

File verification and **Check pending actions** can reconcile transactions without broadcasting them again. The treasury check works through a bounded batch and reports when more actions need checking. If a transaction remains unknown to the network, its reservation stays held for review. A missing explorer result alone is not proof that the input is safe to spend again.

## Local development

The Dockerfiles use Node.js 22 and Compose uses MongoDB 6. Use Node.js 22.13 or later for a matching local development environment.

Both builds use TypeScript 7. The frontend also installs [Microsoft's TypeScript 6 compatibility package](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/#running-side-by-side-with-typescript-6-0) through an npm alias because the ESLint parser still requires its compiler API. Keep both aliases when updating dependencies. The frontend build invokes the TypeScript 7 compiler explicitly to avoid executable name conflicts.

The wallet toolbox includes a native SQLite dependency. Local backend installs need Python 3 and C/C++ build tools, such as Xcode Command Line Tools on macOS or `make` and `g++` on Linux. The backend Docker builder installs these tools automatically.

Install dependencies from the repository root:

```bash
npm ci --prefix back
npm ci --prefix front
```

Start MongoDB. If the application containers are already running, stop them first to free ports 3000 and 3030:

```bash
docker compose stop truth-machine truth-machine-demo
docker compose up -d mongo
```

Create or update `back/.env` without replacing an existing funded wallet key:

```dotenv
PORT=3030
NETWORK=main
DB_NAME=truth-machine
MONGO_URI=mongodb://localhost:28017
FUNDING_WIF=<your-private-WIF>
CALLBACK_TOKEN=<your-callback-secret>
DOMAIN=
```

Set `front/.env`:

```dotenv
VITE_API_URL=http://localhost:3030
```

Run each development server in its own terminal:

```bash
npm run dev --prefix back
```

```bash
npm run dev --prefix front
```

The frontend is at http://localhost:3000 and the API is at http://localhost:3030. When using a separate local MongoDB installation, set `MONGO_URI` to its address instead.

### Configuration

| Variable | Purpose |
| --- | --- |
| `PORT` | Backend HTTP port, normally `3030`. |
| `NETWORK` | `main` or `test`; keep the wallet, API configuration and network consistent. |
| `FUNDING_WIF` | Private wallet key used to fund token transactions. |
| `MONGO_URI` | MongoDB connection string. Use `mongodb://mongo:27017` inside Compose, or `mongodb://localhost:28017` from the host. |
| `DB_NAME` | Database base name. Mainnet uses `<DB_NAME>-mainnet`; testnet uses `<DB_NAME>`. |
| `DOMAIN` | Optional public callback hostname. Leave empty for local use without callbacks. |
| `CALLBACK_TOKEN` | Secret required as a bearer token for incoming callbacks. |
| `ARC_API_KEY` | Optional credential for the mainnet TAAL broadcaster. |
| `TEST_ARC_API_KEY` | Credential for the testnet TAAL broadcaster when required by the service. |
| `CORS_ORIGINS` | Optional comma-separated frontend origin allowlist. Unset allows any origin. |
| `VITE_API_URL` | Frontend API base URL. Read by Vite during development or at build time. |

Compose supplies backend variables through its `environment` section; it does not load `back/.env`. If you need additional broadcaster credentials in Docker, add them to your local Compose override.

The frontend build includes `VITE_API_URL` in its JavaScript. The checked-in `front/.env.production` targets the hosted API, so explicitly override it when building for local use:

```bash
npm run build --prefix back
VITE_API_URL=http://localhost:3030 npm run build --prefix front
```

Start the compiled backend and preview the frontend in separate terminals:

```bash
npm start --prefix back
```

```bash
npm run preview --prefix front
```

The Compose frontend build already passes the local API URL as a build argument. Rebuild the frontend whenever that URL changes.

### Optional callbacks

A public callback URL is optional for local verification. **Verify file** and **Check pending actions** retrieve available proofs from WhatsOnChain and validate them with the chain tracker. The placeholder `your-domain.com` is not sent to broadcasters.

For automatic updates, expose the backend through an HTTPS tunnel or reverse proxy and set `DOMAIN` to its hostname. Broadcasters send updates to `https://<DOMAIN>/callback` with `Authorization: Bearer <CALLBACK_TOKEN>`. Restart the backend after changing configuration. Callback proofs are verified before records are marked confirmed.

## API

The base URL is `http://localhost:3030`. Routes do **not** have an `/api` prefix.

| Method | Route | Behaviour |
| --- | --- | --- |
| `POST` | `/upload` | Accept raw file bytes; store the file and submit its hash commitment using one token. |
| `GET` | `/integrity/:id` | Find a file by transaction ID or hash and check its content and blockchain proof. |
| `GET` | `/download/:id` | Return the original file after checking its content against the recorded commitment. |
| `GET` | `/checkTreasury` | Return the address, balance, available token count and unresolved operation count. |
| `GET` | `/fund/:number` | Mint 1 to 1,000 tokens. This submits a transaction. |
| `GET` | `/utxoStatusUpdate` | Check pending transactions, retrieve proofs and reconcile local records. |
| `GET` | `/consolidate` | Consolidate up to 1,000 confirmed, unused tokens. This submits a transaction. |
| `GET` | `/allFunds` | Bulk-mint up to 400 tokens from the largest available funding output, subject to the funding buffer. This submits a transaction. |
| `POST` | `/callback` | Accept authenticated broadcaster status updates and Merkle proofs. |

Some treasury mutations currently use `GET`. Treat them as actions, not read-only health checks.

### Upload example

This request consumes a token and submits a transaction on the configured network:

```bash
curl --request POST http://localhost:3030/upload \
  --header 'Content-Type: application/octet-stream' \
  --header 'X-Original-Content-Type: text/plain' \
  --header 'X-Original-Filename: example.txt' \
  --data-binary @example.txt
```

Use URL encoding for `X-Original-Filename` when it contains spaces or non-ASCII characters. An accepted upload returns `txid`, `fileHash`, `network`, `status: "accepted"` and a message. An uncertain submission returns HTTP 202 with `status: "pending"` and recovery instructions.

### Verification and download examples

Replace the placeholder with an ID or hash from an upload receipt:

```bash
FILE_ID='<transaction-id-or-file-hash>'
curl "http://localhost:3030/integrity/${FILE_ID}"
curl --fail "http://localhost:3030/download/${FILE_ID}" --output downloaded-file
```

Successful integrity lookups include:

| Field | Meaning |
| --- | --- |
| `status` | `confirmed` or `pending`. |
| `valid` | True only when both file integrity and a mined proof are verified. |
| `matchedFile` | The current file bytes match the stored SHA-256 hash. |
| `matchedCommitment` | The transaction identity and hash commitment match the file. |
| `broadcast` | There is evidence of acceptance or network observation; this alone is not a mined proof. |
| `inBlock` | A Merkle proof was verified against blockchain headers. |
| `depth` | Block confirmations, or `null` when unavailable. |
| `downloadAllowed` | The matching stored file may be downloaded. |
| `message` | Explanation of the result and next step. |

Responses also include file metadata and identifiers. BEEF is stored internally for transaction and proof handling; the integrity response does not return the BEEF payload.

### HTTP outcomes

| Status | Meaning |
| --- | --- |
| `200` | The request completed. Read its outcome fields; an integrity lookup can still be pending. |
| `202` | A submitted action has an uncertain outcome and needs reconciliation. |
| `400` | Invalid identifier, token count or empty upload. |
| `404` | No matching file or callback transaction was found. |
| `409` | Insufficient available funds, a funding reservation conflict or no eligible tokens to consolidate. |
| `413` | Upload exceeds 10 MB. |
| `422` | Integrity/proof failure or a definite transaction rejection. |
| `503` | A service or preparation step is unavailable, or no upload tokens are available. |

Errors contain an `error` message. Callbacks also return 401 for invalid authentication, and rate limiting can return 429.

Integrations that previously treated `valid: true` as unconfirmed script validity must handle the new distinction between pending and confirmed results.

## Architecture and checks

- `front/`: React, TypeScript and Vite interface, including notices, treasury state and browser-side download checks.
- `back/src/functions/`: Express route handlers.
- `back/src/services/`: File validation, durable transaction operations and proof lookup.
- `back/tests/`: Regression tests using generated transactions and isolated service substitutes.
- MongoDB stores file bytes, BEEF transaction data, token secrets and funding reservations. Keep its data together with the wallet key when preserving an instance.

Run the available checks from the repository root:

```bash
npm test --prefix back
npm run build --prefix front
npm run lint --prefix front
```

The backend test command builds TypeScript and runs the Node.js regression suite. It does not spend funds or contact the blockchain. It covers file tampering, identifier handling, rejected broadcasts, uncertain outcomes, token reservation, reconciliation and proof validation. There is no frontend `npm test` script; the frontend checks above are supplemented by browser journey testing.

## Troubleshooting

| Symptom | Check or recovery |
| --- | --- |
| Frontend loads but treasury is unavailable | Run `docker compose ps -a`. Start MongoDB with `docker compose up -d mongo`, then inspect backend logs. |
| Source changed but the interface looks unchanged | Rebuild and recreate the app containers with `docker compose up -d --build`. |
| Balance is positive but uploads fail | Mint write tokens. Reserved or spent tokens are not available for new uploads. |
| File is found but confirmation is pending | Use **Check again** later. Network acceptance and file matching do not establish block inclusion. |
| A transaction remains uncertain | Use **Check pending actions**. Preserve the transaction ID and avoid submitting the same action again. |
| File not found | Check the copied ID or hash, API URL, network and database. Files are retrieved from this instance's database, not from arbitrary blockchain transactions. |
| Treasury figures are stale | Use **Refresh balance**. After an error, the interface labels retained figures as the last successful check. |
| Local frontend calls a hosted API | Set `VITE_API_URL` explicitly and rebuild the frontend. |
| Ports 3000 or 3030 are occupied | Stop the Compose frontend/backend before starting the local development servers. |

## Contributing and licence

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidance and [CHANGELOG.md](CHANGELOG.md) for historical changes. Report issues in the [repository issue tracker](https://github.com/bsv-blockchain-demos/truth-machine/issues).

The repository includes the **Open BSV License version 4** in [LICENSE.txt](LICENSE.txt).
