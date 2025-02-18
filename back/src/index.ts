import express, { Application } from 'express'
import { upload, download, callback, integrity, fund } from './functions'
import dotenv from 'dotenv'
dotenv.config()
const { PORT } = process.env

const app: Application = express()

// Fund the treasury by splitting funds associated 
// with a regular address into a number of 1 sat outputs.
app.get('/fund/:number', fund)

// Upload a file to the BSV Blockchain.
app.use(express.raw()).post('/upload', upload)

// Download the file data
app.get('/download/:id', download)

// Check the integrity of the file data
app.get('/integrity/:id', integrity)

// Callbacks from ARC will deliver Merkle Paths to this endpoint.
app.use(express.json()).post('/callback', callback)

app.listen(PORT, () => {
  console.log(`http://localhost:${PORT}`);
})