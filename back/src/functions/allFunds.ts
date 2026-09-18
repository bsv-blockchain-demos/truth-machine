import { Request, Response } from 'express'
import { address } from './address'
import woc from '../woc'
import fund from './fund'

// Keep bulk funding on the same validated, recoverable path as normal minting.
export default async function (req: Request, res: Response) {
    try {
        const utxos = await woc.getUtxos(address)
        const largest = Math.max(0, ...utxos.map(utxo => utxo.satoshis))
        const number = Math.min(400, Math.floor((largest - 1000) / 13))
        if (number < 1) {
            res.status(409).json({ error: 'There are not enough available funds. Deposit BSV at the treasury address first.' }); return
        }
        req.params.number = String(number)
        await fund(req, res)
    } catch {
        res.status(503).json({ error: 'We could not prepare token creation. Please try again shortly.' })
    }
}
