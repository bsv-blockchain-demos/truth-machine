import { ARC, WhatsOnChainBroadcaster, Broadcaster, Transaction, BroadcastResponse, BroadcastFailure } from "@bsv/sdk"
import BitailsBroadcaster from "./BitailsBroadcaster"
import dotenv from 'dotenv'
dotenv.config()

// Environment variables for ARC configuration
export const { NETWORK, DOMAIN, CALLBACK_TOKEN, ARC_API_KEY, TEST_ARC_API_KEY } = process.env

export const ARC_URL = NETWORK !== 'main' ? 'https://arc-test.taal.com' : 'https://arc.taal.com'

class SuperArc implements Broadcaster {
    private broadcasters: Broadcaster[]

    constructor() {
        const taal = new ARC('https://arc.taal.com', {
            callbackUrl: 'https://' + DOMAIN + '/callback',
            callbackToken: CALLBACK_TOKEN,
            apiKey: ARC_API_KEY,
        })
        const gorillaPool = new ARC('https://arc.gorillapool.io', {
            callbackUrl: 'https://' + DOMAIN + '/callback',
            callbackToken: CALLBACK_TOKEN
        })
        const bsva = new ARC('https://arc-mainnet-staging-eu-1.bsvb.tech', {
            callbackUrl: 'https://' + DOMAIN + '/callback',
            callbackToken: CALLBACK_TOKEN
        })
        const WoC = new WhatsOnChainBroadcaster('main')
        const bitails = new BitailsBroadcaster()
        this.broadcasters = [taal, gorillaPool, bsva, WoC, bitails]
    }

    // this function tries each of the available broadcaster options in order, returning on first success. 
    // This is done sequentially such that if ARC TAAL works, no other options are used, but if ARC TAAL fails, then we try other options.
    async broadcast(tx: Transaction): Promise<BroadcastResponse | BroadcastFailure> {
        for (const broadcaster of this.broadcasters) {
            const response = await broadcaster.broadcast(tx)
            if (response.status === 'success') {
                return response
            }
        }
        return {
            status: 'error',
            code: 'ERR_UNKNOWN',
            description: 'Failed to broadcast transaction to any of the configured broadcasters'
        }
    }
}

function createBroadcaster() {
    // if we're on testnet just use TAAL
    if (NETWORK !== 'main') {
        return new ARC('https://arc-test.taal.com', {
            callbackUrl: 'https://' + DOMAIN + '/callback',
            callbackToken: CALLBACK_TOKEN,
            apiKey: TEST_ARC_API_KEY,
        })
    }
    // otherwise set up a failover which tries a bunch of ways to broadcast the tx
    return new SuperArc()
}


const broadcaster = createBroadcaster()

export const ArcTaal = new ARC(ARC_URL, {
    callbackUrl: 'https://' + DOMAIN + '/callback',
    callbackToken: CALLBACK_TOKEN,
    apiKey: ARC_API_KEY,
})

export default broadcaster  