import { Request, Response } from 'express'
import db from '../db'
import { address } from '../functions/address'
import woc from '../woc'


export default async function (req: Request, res: Response) {
    try {
        const tokens = await db.collection('utxos').countDocuments({ fileHash: null })
        const utxos = await woc.getUtxos(address)
        const balance = utxos.reduce((a, b) => a + b.satoshis, 0)
        res.send({ address, balance, tokens })
    } catch (error) {
        console.error('Failed to get utxos', error)
        res.status(500).json({ error: error.message })
    }
}