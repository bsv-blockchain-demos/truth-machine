import express, { Application, Request, Response } from 'express'
import upload from './upload'
import download from './download'
import { PrivateKey } from '@bsv/sdk'
import db from './db'
import html from './frontend'
import dotenv from 'dotenv'
import callback from './callback'
import integrity from './integrity'
import fund from './fund'
dotenv.config()

const { FUNDING_WIF, PORT } = process.env

const key = PrivateKey.fromWif(FUNDING_WIF)

const app: Application = express()

app.use(express.json())

// frontend
app.get('/', async (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/html')
  const remainingFundingTokens = await db.collection('funding').countDocuments({ spendTxid: null })
  const address = key.toAddress().toString()
  res.send(html(address, remainingFundingTokens))
})

// functional endpoints
app.get('/fund/:number', fund)
app.post('/upload', upload)
app.get('/download/:id', download)
app.post('/callback', callback)
app.get('/integrity/:id', integrity)

app.listen(PORT, () => {
  console.log(`http://localhost:${PORT}`);
})