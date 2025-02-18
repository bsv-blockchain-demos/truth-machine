import { ARC } from "@bsv/sdk";
import dotenv from 'dotenv';
dotenv.config();
var _a = process.env, NETWORK = _a.NETWORK, DOMAIN = _a.DOMAIN, CALLBACK_TOKEN = _a.CALLBACK_TOKEN;
var options = {
    callbackUrl: 'https://' + DOMAIN + '/callback',
    callbackToken: CALLBACK_TOKEN,
};
var Arc = (NETWORK === 'main')
    ? new ARC('https://arc.taal.com', options)
    : new ARC('https://arc-test.taal.com', options);
export default Arc;
