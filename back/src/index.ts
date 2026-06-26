import express, { Application } from 'express'
import { rateLimit } from 'express-rate-limit'
import { upload, download, callback, integrity, fund, checkTreasury, utxoStatusUpdate, allFunds, consolidate } from './functions'
import dotenv from 'dotenv'
import cors from 'cors'
dotenv.config()
const { PORT } = process.env

const app: Application = express()

app.use(cors({ origin: '*' }))

// ADD THIS LINE - Handle preflight requests
app.options('*', cors())

// Rate limiting — protect every endpoint from abuse / DoS.
// Generous window so normal demo usage is never throttled.
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000,                // per IP, per window
    standardHeaders: true,
    legacyHeaders: false,
})
app.use(limiter)

// Fund the treasury by splitting funds associated 
// with a regular address into a number of 1 sat outputs.
app.get('/fund/:number', fund)

// Fund the treasury by splitting funds associated 
// with a regular address into a number of 1 sat outputs.
app.get('/allFunds', allFunds)

// Upload a file to the BSV Blockchain.
app.post('/upload', express.raw({ type: '*/*', limit: '50mb' }), upload)

// Download the file data
app.get('/download/:id', download)

// Check the integrity of the file data
app.get('/integrity/:id', integrity)

// Callbacks from ARC will deliver Merkle Paths to this endpoint.
app.post('/callback', express.json(), callback)

// Checks the available number of utxos in the treasury.
app.get('/checkTreasury', checkTreasury)

// Update utxo status
app.get('/utxoStatusUpdate', utxoStatusUpdate)

// Consolidate all available utxos into a single output
app.get('/consolidate', consolidate)

app.listen(PORT, () => {
  console.log(`http://localhost:${PORT}`);
})