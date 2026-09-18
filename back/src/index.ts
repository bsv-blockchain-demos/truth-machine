import express, { Application, ErrorRequestHandler } from 'express'
import { rateLimit } from 'express-rate-limit'
import { upload, download, callback, integrity, fund, checkTreasury, utxoStatusUpdate, allFunds, consolidate } from './functions'
import dotenv from 'dotenv'
import cors from 'cors'
dotenv.config()
const { PORT } = process.env

const app: Application = express()

// CORS — lock down to an allowlist in production via CORS_ORIGINS
// (comma-separated). When unset, any origin is allowed so the public
// demo keeps working; the API has no cookie-based auth, so this carries
// no credential-theft risk.
const corsAllowlist = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
    : null
const corsMiddleware = cors({
    exposedHeaders: ['Content-Disposition'],
    origin(origin, callback) {
        if (!corsAllowlist || !origin || corsAllowlist.includes(origin)) {
            callback(null, true)
        } else {
            callback(new Error('Not allowed by CORS'))
        }
    },
})
app.use(corsMiddleware)

// Handle preflight requests
app.options('/{*splat}', corsMiddleware)

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
app.post('/upload', express.raw({ type: '*/*', limit: '10mb' }), upload)

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

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error.type === 'entity.too.large') {
        res.status(413).json({ error: 'This file is too large. Choose a file smaller than 10 MB.' })
        return
    }
    res.status(500).json({ error: 'We could not complete this request. Please try again shortly.' })
}
app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`http://localhost:${PORT}`);
})
