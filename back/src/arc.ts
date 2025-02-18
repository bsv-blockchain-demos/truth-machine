import { ARC } from "@bsv/sdk"
import dotenv from 'dotenv'
dotenv.config()

const { NETWORK, DOMAIN, CALLBACK_TOKEN } = process.env

const options = {
    callbackUrl: 'https://' + DOMAIN + '/callback',
    callbackToken: CALLBACK_TOKEN,
}

const Arc = (NETWORK === 'main') 
    ? new ARC('https://arc.taal.com', options) 
    : new ARC('https://arc-test.taal.com', options)

export default Arc