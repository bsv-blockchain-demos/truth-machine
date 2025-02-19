import { PrivateKey } from '@bsv/sdk'
import dotenv from 'dotenv'
dotenv.config()

const { NETWORK, FUNDING_WIF } = process.env

const key = PrivateKey.fromWif(FUNDING_WIF)
const address = NETWORK === 'test' ? key.toAddress([0x6f]) : key.toAddress()

export { key, address }