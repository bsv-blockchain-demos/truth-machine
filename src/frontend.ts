import { Request, Response } from 'express'
import { PrivateKey } from '@bsv/sdk'
import db from './db'

const { FUNDING_WIF, NETWORK } = process.env

const key = PrivateKey.fromWif(FUNDING_WIF)

const html = (address, balance) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Timestamp Microservice</title>
    <style>
        body {
            font-family: Helvetica, sans-serif;
            margin: 2rem;
        }
    </style>
</head>
<body>
    <h1>Data Timestamper</h1>
    <h2>Upload</h2>
    <p>Send data to /upload endpoint to store and timestamp on the BSV Blockchain.</p>
    <h2>Download</h2>
    <p>Retrieve stored data from /download/{hash} along with an integrity proof and timestamp.</p>
    <h2>Funding Service</h2>
    <p>This service has ${balance} write tokens remaining. To top up the balance, 
    make a BSV payment to ${address} and hit the <a href="/fund/10">/fund/{number}</a> endpoint.</p>
</body>
</html>
`

export default async function (req: Request, res: Response) {
  res.setHeader('Content-Type', 'text/html')
  const remainingFundingTokens = await db.collection('utxos').countDocuments({ spendTxid: null })
  const address = NETWORK === 'test' ? key.toAddress([0x6f]) : key.toAddress()
  res.send(html(address, remainingFundingTokens))
}