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
import { Utils, Hash, Transaction, SatoshisPerKilobyte } from '@bsv/sdk';
import db from '../db';
import { OpReturn } from '@bsv/templates';
import HashPuzzle from '../HashPuzzle';
import Arc from '../arc';
var Data = OpReturn.default;
export default function (req, res) {
    return __awaiter(this, void 0, void 0, function () {
        var time, r, length, fileHash, fees, utxos, sourceTransactions, tx, _loop_1, _i, utxos_1, utxo, initialResponse, txid, document;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    time = Date.now();
                    r = new Utils.Reader();
                    r.read(req.body);
                    length = r.bin.length;
                    fileHash = Utils.toHex(Hash.sha256(r.bin));
                    fees = Math.ceil((length - 200) / 1000);
                    return [4 /*yield*/, Promise.all(Array(fees).fill(0).map(function () { return __awaiter(_this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, db.collection('utxos').findOneAndUpdate({ fileHash: null }, { $set: { fileHash: fileHash } })];
                                    case 1: return [2 /*return*/, _a.sent()];
                                }
                            });
                        }); }))
                        // build the data commitment transaction
                    ];
                case 1:
                    utxos = _a.sent();
                    return [4 /*yield*/, db.collection('txs').find({ txid: { $in: utxos.map(function (utxo) { return utxo.txid; }) } }).toArray()];
                case 2:
                    sourceTransactions = _a.sent();
                    tx = new Transaction();
                    _loop_1 = function (utxo) {
                        tx.addInput({
                            sourceTransaction: Transaction.fromHex(sourceTransactions.find(function (d) { return d.txid === utxo.txid; }).rawtx),
                            sourceOutputIndex: utxo.vout,
                            unlockingScriptTemplate: new HashPuzzle().unlock(utxo.secret),
                        });
                    };
                    for (_i = 0, utxos_1 = utxos; _i < utxos_1.length; _i++) {
                        utxo = utxos_1[_i];
                        _loop_1(utxo);
                    }
                    // add the hash of the file to an output
                    tx.addOutput({
                        satoshis: 0,
                        lockingScript: new Data().lock(fileHash)
                    });
                    // tx.broadcast and get a txid
                    return [4 /*yield*/, tx.fee(new SatoshisPerKilobyte(1))];
                case 3:
                    // tx.broadcast and get a txid
                    _a.sent();
                    return [4 /*yield*/, tx.sign()];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, tx.broadcast(Arc)];
                case 5:
                    initialResponse = _a.sent();
                    txid = tx.id('hex');
                    document = {
                        txid: txid,
                        fileHash: fileHash,
                        beef: tx.toHexBEEF(),
                        arc: [initialResponse],
                        file: r.bin,
                        fileType: req.headers['content-type'],
                        time: time,
                    };
                    return [4 /*yield*/, db.collection('files').insertOne(document)
                        // respond to client with confirmation
                    ];
                case 6:
                    _a.sent();
                    // respond to client with confirmation
                    res.send({ txid: txid, fileHash: fileHash });
                    return [2 /*return*/];
            }
        });
    });
}
