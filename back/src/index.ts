import express, { Application } from 'express'
import { upload, download, callback, integrity, fund, checkTreasury, utxoStatusUpdate, allFunds } from './functions'
import dotenv from 'dotenv'
import cors from 'cors'
dotenv.config()
const { PORT } = process.env

const app: Application = express()

app.use(cors({ origin: '*' }))

// ADD THIS LINE - Handle preflight requests
app.options('*', cors())

// Fund the treasury by splitting funds associated 
// with a regular address into a number of 1 sat outputs.
app.get('/fund/:number', fund)

// Fund the treasury by splitting funds associated 
// with a regular address into a number of 1 sat outputs.
app.get('/allFunds', allFunds)

// Upload a file to the BSV Blockchain.
app.use(express.raw()).post('/upload', upload)

// Download the file data
app.get('/download/:id', download)

// Check the integrity of the file data
app.get('/integrity/:id', integrity)

// Callbacks from ARC will deliver Merkle Paths to this endpoint.
app.use(express.json()).post('/callback', callback)

// Checks the available number of utxos in the treasury.
app.use(express.json()).get('/checkTreasury', checkTreasury)

// Update utxo status
app.get('/utxoStatusUpdate', utxoStatusUpdate)

app.listen(PORT, () => {
  console.log(`http://localhost:${PORT}`);
})