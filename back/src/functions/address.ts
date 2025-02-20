/**
 * Bitcoin Address Configuration Module
 * 
 * This module manages the Bitcoin address and private key configuration for the application.
 * It handles network-specific address generation (mainnet vs testnet) from a WIF private key.
 * 
 * Environment Variables Required:
 * - NETWORK: 'main' or 'test' to determine the network type
 * - FUNDING_WIF: WIF-formatted private key for the funding address
 */

import { PrivateKey } from '@bsv/sdk'
import dotenv from 'dotenv'
dotenv.config()

const { NETWORK, FUNDING_WIF } = process.env

/**
 * Private key instance derived from WIF format
 * Used for signing transactions and deriving the public address
 */
const key = PrivateKey.fromWif(FUNDING_WIF)

/**
 * Bitcoin address derived from the private key
 * Uses different version byte (0x6f) for testnet addresses
 */
const address = NETWORK === 'test' ? key.toAddress([0x6f]) : key.toAddress()

export { key, address }