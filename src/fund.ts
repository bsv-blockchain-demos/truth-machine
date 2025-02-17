import { Request, Response } from 'express'
import { PrivateKey } from '@bsv/sdk'
import WocClient from './woc'
import dotenv from 'dotenv'
dotenv.config()

const woc = new WocClient()

const { FUNDING_WIF } = process.env
const address = PrivateKey.fromWif(FUNDING_WIF).toAddress().toString()

export default async function (req: Request, res: Response) {
  const { number } = req.params

  // grab any available utxos
  const utxo = new woc.getUtxos(address)
  
  res.send({ number })
}