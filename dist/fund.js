var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
import { P2PKH, PrivateKey, SatoshisPerKilobyte, Transaction } from '@bsv/sdk';
import WocClient from './woc';
import dotenv from 'dotenv';
import HashPuzzle from './HashPuzzle';
import db from './db';
import Arc from './arc';
dotenv.config();
var _a = process.env, NETWORK = _a.NETWORK, FUNDING_WIF = _a.FUNDING_WIF;
var woc = new WocClient();
woc.setNetwork(NETWORK);
var key = PrivateKey.fromWif(FUNDING_WIF);
var address = NETWORK === 'test' ? key.toAddress([0x6f]) : key.toAddress();
export default function (req, res) {
    return __awaiter(this, void 0, void 0, function () {
        var strNum, number, utxos, rawtx, max, secretPairs, i, pair, sourceTransaction, tx_1, _i, secretPairs_1, pair, initialResponse, txid_1, rawtxHex, txDbResponse, utxosDbResponse, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 8, , 9]);
                    strNum = req.params.number;
                    number = parseInt(strNum);
                    console.log({ number: number });
                    if (number > 1000) {
                        res.send({ error: 'too many outputs, keep it to 1000 max', number: number });
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, woc.getUtxos(address)];
                case 1:
                    utxos = _a.sent();
                    return [4 /*yield*/, woc.getTx(utxos[0].txid)];
                case 2:
                    rawtx = _a.sent();
                    max = utxos.reduce(function (a, b) { return a + b.satoshis - 1; }, 0);
                    if (max < number) {
                        res.send({ error: 'not enough satoshis', number: number, utxos: utxos });
                        return [2 /*return*/];
                    }
                    secretPairs = [];
                    for (i = 0; i < number; i++) {
                        pair = HashPuzzle.generateSecretPair();
                        secretPairs.push(pair);
                    }
                    sourceTransaction = Transaction.fromHex(rawtx);
                    tx_1 = new Transaction();
                    tx_1.addInput({
                        sourceTransaction: sourceTransaction,
                        sourceOutputIndex: utxos[0].vout,
                        unlockingScriptTemplate: new P2PKH().unlock(key)
                    });
                    for (_i = 0, secretPairs_1 = secretPairs; _i < secretPairs_1.length; _i++) {
                        pair = secretPairs_1[_i];
                        tx_1.addOutput({
                            satoshis: 1,
                            lockingScript: new HashPuzzle().lock(pair.hash)
                        });
                    }
                    tx_1.addOutput({
                        change: true,
                        lockingScript: new P2PKH().lock(address)
                    });
                    return [4 /*yield*/, tx_1.fee(new SatoshisPerKilobyte(1))];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, tx_1.sign()];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, tx_1.broadcast(Arc)];
                case 5:
                    initialResponse = _a.sent();
                    console.log({ initialResponse: initialResponse });
                    txid_1 = tx_1.id('hex');
                    rawtxHex = tx_1.toHex();
                    return [4 /*yield*/, db.collection('txs').insertOne({
                            txid: txid_1,
                            rawtx: rawtxHex,
                            beef: tx_1.toHexBEEF(),
                            arc: [initialResponse],
                            number: number,
                        })];
                case 6:
                    txDbResponse = _a.sent();
                    console.log({ secretPairs: secretPairs });
                    return [4 /*yield*/, db.collection('utxos').insertMany(secretPairs.map(function (secret, vout) { return ({
                            txid: txid_1,
                            vout: vout,
                            script: tx_1.outputs[vout].lockingScript.toHex(),
                            satoshis: 1,
                            secret: secret,
                            fileHash: null,
                        }); }))];
                case 7:
                    utxosDbResponse = _a.sent();
                    res.send({ txid: txid_1, number: number, txDbResponse: txDbResponse, utxosDbResponse: utxosDbResponse });
                    return [3 /*break*/, 9];
                case 8:
                    error_1 = _a.sent();
                    console.log(error_1);
                    res.status(500);
                    res.send({ error: error_1 });
                    return [3 /*break*/, 9];
                case 9: return [2 /*return*/];
            }
        });
    });
}
