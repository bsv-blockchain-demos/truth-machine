import { Request, Response } from 'express'
import db from '../db'
import { MerklePath, Beef } from '@bsv/sdk'
import { ARC_URL, NETWORK } from '../arc'

async function updateRecords(txid: string, merklePath: string, arc: any = { status: 'WoC retrieved' }): Promise<void> {
    const document = await db.collection('txs').findOne({ txid })
    if (!document) return
    // Update transaction with Merkle path proof
    const beef = Beef.fromString(document.beef, 'hex')
    beef.mergeBump(MerklePath.fromHex(merklePath))
    const tx = beef.findAtomicTransaction(txid)
    const updated = tx.toHexBEEF()
    // set all the utxos associated to spendable
    await db.collection('txs').updateOne({ txid }, { $set: { beef: updated }, $addToSet: { arc } })
    await db.collection('utxos').updateMany({ txid }, { $set: { confirmed: true } })
}

async function getBeefFromWoc(txid: string): Promise<string | null> {
    try {
        const woc = await (await fetch(`https://api.whatsonchain.com/v1/bsv/${NETWORK}/tx/${txid}/beef`)).text()
        return woc
    } catch (error) {
        console.error('Failed to get Beef from WhatOnChain', error)
        return null
    }
}

async function setInvalid(txid: string): Promise<void> {
    await db.collection('utxos').updateMany({ txid }, { $set: { invalid: true } })
}

export default async function (req: Request, res: Response) {
    try {
        // Lookup any utxos which have not been confirmed to find out why
        const utxos = await db.collection('utxos').find({ confirmed: false, invalid: null }).toArray()
        const txids = Array.from(new Set<string>(utxos.map(u => u.txid)))
        console.info({ txids })

        const updated = await Promise.allSettled(txids.map(async txid => {
            let merklePath: string | undefined
            // first attempt to check status on ARC
            console.info('ARC BEEF retrieval for: ' + txid)
            const arc = await (await fetch(ARC_URL + '/v1/tx/' + txid)).json()
            merklePath = arc.merklePath
            
            if (!merklePath) {
                // Try to enrich the data using WhatOnChain - a block explorer
                console.info('WoC BEEF retrieval for: ' + txid)
                const woc = await getBeefFromWoc(txid)
                if (!woc || woc.startsWith('failed') || woc.startsWith('Internal')) {
                    console.error('Failed to get Merkle Path - setting invalid: ' + txid)
                    await setInvalid(txid)
                    return 'updated to invalid ' + txid
                }
                try {
                    const beef = Beef.fromString(woc, 'hex')
                    const tx = beef.findAtomicTransaction(txid)
                    merklePath = tx?.merklePath?.toHex()
                } catch (error) {
                    console.error('Failed to parse MerklePath from BEEF from WhatOnChain for: ' + txid)
                }
            }
            
            if (!merklePath) {
                return console.error('Transaction is not yet mined, just wait: ' + txid)
            }
            
            await updateRecords(txid, merklePath, arc)
            return txid
        }))

        res.send({ success: true, updated })
    } catch (error) {
        console.error('Failed to handle Utxo Status Update', error)
        res.status(500).send({ error: 'Internal Server Error' })
    }
}