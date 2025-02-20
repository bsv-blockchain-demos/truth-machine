/**
 * WhatsOnChain API Client Module
 * 
 * This module provides a client for interacting with the WhatsOnChain API service,
 * which offers access to Bitcoin SV blockchain data. The client includes rate limiting
 * and queue management to prevent API throttling.
 * 
 * API Documentation: https://api.whatsonchain.com/v1/bsv/
 */

import { MerklePath, Transaction } from '@bsv/sdk'
import dotenv from 'dotenv'
dotenv.config()

const { NETWORK } = process.env

/**
 * WhatsOnChain API Client
 * @class
 * @classdesc A class for interacting with the WhatsOnChain API with built-in rate limiting
 * and queue management. Supports both mainnet and testnet queries.
 * 
 * Features:
 * - Automatic rate limiting (350ms between requests)
 * - Request queue management
 * - Support for confirmed and unconfirmed transactions
 * - UTXO management
 * - Merkle proof verification
 * 
 * @example
 * const woc = new WocClient()
 * const utxos = await woc.getUtxos('1BpEi6DfDAUFd7GtittLSdBeYJvcoaVggu')
 */
class WocClient {
    /**
     * Initialize WocClient with mainnet API endpoint
     */
    constructor() {
        this.api = 'https://api.whatsonchain.com/v1/bsv/main'
    }

    /**
     * Set the network for API queries
     * @param {string} network - Network type ('main', 'test', or 'stn')
     */
    setNetwork(network) {
        this.api = `https://api.whatsonchain.com/v1/bsv/${network}`
    }

    /** @private Request queue for rate limiting */
    requestQueue = [];
    /** @private Flag to track queue processing state */
    isProcessingQueue = false;

    /**
     * Process queued API requests with rate limiting
     * Ensures 350ms delay between requests to prevent throttling
     * @private
     */
    async processQueue() {
        if (this.isProcessingQueue) return;
        this.isProcessingQueue = true;
        while (this.requestQueue.length > 0) {
            const { resolve, request } = this.requestQueue.shift();
            try {
                console.log({ url: request.url, options: request.options })
                const response = await fetch(request.url, request.options, { cache: 'no-store', next: { revalidate: 3600 } });
                if (request.options.headers.Accept === 'plain/text') {
                    const text = await response.text();
                    resolve(text);
                } else {
                    const data = await response.json();
                    resolve(data);
                }
            } catch (error) {
                console.log({ error })
                resolve(null);
            }
            await new Promise(resolve => setTimeout(resolve, 350));
        }
        this.isProcessingQueue = false;
    }

    /**
     * Queue a new API request
     * @private
     * @param {string} url - API endpoint URL
     * @param {Object} options - Fetch options
     * @returns {Promise} Request result
     */
    queueRequest(url, options) {
        return new Promise((resolve, reject) => {
            this.requestQueue.push({ resolve, reject, request: { url, options } });
            this.processQueue();
        });
    }

    /**
     * Make a GET request expecting JSON response
     * @private
     * @param {string} route - API route
     * @returns {Promise<Object>} JSON response
     */
    async getJson(route) {
        return await this.queueRequest(this.api + route, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            },
        });
    }

    /**
     * Make a GET request expecting plain text response
     * @private
     * @param {string} route - API route
     * @returns {Promise<string>} Text response
     */
    async get(route) {
        return await this.queueRequest(this.api + route, {
            method: 'GET',
            headers: {
                'Accept': 'plain/text',
            },
        });
    }

    /**
     * Make a POST request
     * @private
     * @param {string} route - API route
     * @param {Object} body - Request body
     * @returns {Promise<Object>} JSON response
     */
    async post(route, body) {
        return await this.queueRequest(this.api + route, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify(body)
        });
    }

    /**
     * Get all UTXOs (confirmed and unconfirmed) for an address
     * @param {string} address - Bitcoin address to query
     * @returns {Promise<Array>} Array of UTXOs with format:
     *          - txid: Transaction ID
     *          - vout: Output index
     *          - satoshis: Value in satoshis
     *          - script: Locking script
     */
    async getUtxos(address) {
        console.log({ getUtxo: address })
        let confirmed = { results: [] }
        let unconfirmed = { results: [] }
        try {
            confirmed = await this.getJson(`/address/${address}/confirmed/unspent`)
        } catch (error) {
            console.log({ error })
        }
        try {
            unconfirmed = await this.getJson(`/address/${address}/unconfirmed/unspent`)
        } catch (error) {
            console.log({ error })
        }
        const combined = []
        confirmed?.result?.map(utxo => combined.push(utxo))
        unconfirmed?.result?.map(utxo => combined.push(utxo))
        const script = confirmed?.script || unconfirmed?.script || ''
        const formatted = combined.map(u => ({ txid: u.tx_hash, vout: u.tx_pos, satoshis: u.value, script }))
        console.log({ confirmed, unconfirmed, combined, formatted })
        return formatted
    }

    /**
     * Get raw transaction hex
     * @param {string} txid - Transaction ID
     * @returns {Promise<string>} Raw transaction hex
     */
    async getTx(txid) {
        return this.get(`/tx/${txid}/hex`)
    }

    /**
     * Get Merkle proof in TSC format
     * @param {string} txid - Transaction ID
     * @returns {Promise<Object>} TSC format Merkle proof
     */
    async getMerklePath(txid) {
        return this.getJson(`/tx/${txid}/proof/tsc`)
    }

    /**
     * Get block header information
     * @param {string} hash - Block hash
     * @returns {Promise<Object>} Block header data
     */
    async getHeader(hash) {
        return this.getJson(`/block/${hash}/header`)
    }

    /**
     * Convert TSC (Transaction State Cryptography) proof to BUMP format
     * @param {Object} tsc - TSC format Merkle proof
     * @returns {Promise<MerklePath>} BUMP format Merkle proof
     * @throws {Error} If Merkle path validation fails
     */
    async convertTSCtoBUMP(tsc) {
        const txid = tsc.txOrId
        const header = await this.getHeader(tsc.target)
        const bump = {}
        bump.blockHeight = header.height
        bump.path = []
        const leafOfInterest = { hash: txid, txid: true, offset: tsc.index }
        tsc.nodes.map((hash, idx) => {
            const offset = tsc.index >> idx ^ 1
            const leaf = { offset }
            if (hash === '*') leaf.duplicate = true
            else leaf.hash = hash
            if (idx === 0) {
                if (tsc.index % 2) bump.path.push([leafOfInterest, leaf])
                else bump.path.push([leaf, leafOfInterest])
            }
            else bump.path.push([leaf])
        })
        const merklePath = new MerklePath(bump.blockHeight, bump.path)
        if (header.merkleroot !== merklePath.computeRoot(txid)) throw new Error('Invalid Merkle Path')
        return merklePath
    }

    /**
     * Get Merkle path or parent transactions recursively
     * Used for transaction verification and BEEF format construction
     * @param {Transaction} tx - Transaction to get proof for
     * @returns {Promise<Transaction>} Transaction with Merkle path or parent transactions
     */
    async getMerklePathOrParents(tx) {
        const tscRes = await this.getMerklePath(tx.id('hex'))
        console.log({tscRes})
        if (tscRes !== null) {
            tx.merklePath = await this.convertTSCtoBUMP(tscRes)
            console.log({ bump: tx.merklePath})
            return tx
        }
        await Promise.all(tx.inputs.map(async (input, idx) => {
            const rawtx = await this.getTx(input.sourceTXID)
            const inputTx = Transaction.fromHex(rawtx)
            const st = await this.getMerklePathOrParents(inputTx)
            tx.inputs[idx].sourceTransaction = st
        }))
        return tx
    }
}

// Create and export singleton instance
const woc = new WocClient()
woc.setNetwork(NETWORK)

export default woc