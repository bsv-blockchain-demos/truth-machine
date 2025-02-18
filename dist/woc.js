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
import { MerklePath, Transaction } from '@bsv/sdk';
// https://api.whatsonchain.com/v1/bsv/main/exchangerate
/**
 *  WocClient
 * @class
 * @classdesc A class for interacting with the Whatsonchain API
 * @example
 * const woc = new WocClient()
 * const utxos = await woc.getUtxos('1BpEi6DfDAUFd7GtittLSdBeYJvcoaVggu')
 */
var WocClient = /** @class */ (function () {
    function WocClient() {
        this.requestQueue = [];
        this.isProcessingQueue = false;
        this.api = 'https://api.whatsonchain.com/v1/bsv/main';
    }
    WocClient.prototype.setNetwork = function (network) {
        this.api = "https://api.whatsonchain.com/v1/bsv/".concat(network);
    };
    WocClient.prototype.processQueue = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a, resolve, request, response, text, data, error_1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (this.isProcessingQueue)
                            return [2 /*return*/];
                        this.isProcessingQueue = true;
                        _b.label = 1;
                    case 1:
                        if (!(this.requestQueue.length > 0)) return [3 /*break*/, 11];
                        _a = this.requestQueue.shift(), resolve = _a.resolve, request = _a.request;
                        _b.label = 2;
                    case 2:
                        _b.trys.push([2, 8, , 9]);
                        console.log({ url: request.url, options: request.options });
                        return [4 /*yield*/, fetch(request.url, request.options, { cache: 'no-store', next: { revalidate: 3600 } })];
                    case 3:
                        response = _b.sent();
                        if (!(request.options.headers.Accept === 'plain/text')) return [3 /*break*/, 5];
                        return [4 /*yield*/, response.text()];
                    case 4:
                        text = _b.sent();
                        resolve(text);
                        return [3 /*break*/, 7];
                    case 5: return [4 /*yield*/, response.json()];
                    case 6:
                        data = _b.sent();
                        resolve(data);
                        _b.label = 7;
                    case 7: return [3 /*break*/, 9];
                    case 8:
                        error_1 = _b.sent();
                        console.log({ error: error_1 });
                        resolve(null);
                        return [3 /*break*/, 9];
                    case 9: return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 350); })];
                    case 10:
                        _b.sent();
                        return [3 /*break*/, 1];
                    case 11:
                        this.isProcessingQueue = false;
                        return [2 /*return*/];
                }
            });
        });
    };
    WocClient.prototype.queueRequest = function (url, options) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.requestQueue.push({ resolve: resolve, reject: reject, request: { url: url, options: options } });
            _this.processQueue();
        });
    };
    WocClient.prototype.getJson = function (route) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.queueRequest(this.api + route, {
                            method: 'GET',
                            headers: {
                                'Accept': 'application/json',
                            },
                        })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    WocClient.prototype.get = function (route) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.queueRequest(this.api + route, {
                            method: 'GET',
                            headers: {
                                'Accept': 'plain/text',
                            },
                        })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    WocClient.prototype.post = function (route, body) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.queueRequest(this.api + route, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Accept': 'application/json',
                            },
                            body: JSON.stringify(body)
                        })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    WocClient.prototype.getUtxos = function (address) {
        return __awaiter(this, void 0, void 0, function () {
            var confirmed, unconfirmed, error_2, error_3, combined, script, formatted;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        console.log({ getUtxo: address });
                        confirmed = { results: [] };
                        unconfirmed = { results: [] };
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.getJson("/address/".concat(address, "/confirmed/unspent"))];
                    case 2:
                        confirmed = _c.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        error_2 = _c.sent();
                        console.log({ error: error_2 });
                        return [3 /*break*/, 4];
                    case 4:
                        _c.trys.push([4, 6, , 7]);
                        return [4 /*yield*/, this.getJson("/address/".concat(address, "/unconfirmed/unspent"))];
                    case 5:
                        unconfirmed = _c.sent();
                        return [3 /*break*/, 7];
                    case 6:
                        error_3 = _c.sent();
                        console.log({ error: error_3 });
                        return [3 /*break*/, 7];
                    case 7:
                        combined = [];
                        (_a = confirmed === null || confirmed === void 0 ? void 0 : confirmed.result) === null || _a === void 0 ? void 0 : _a.map(function (utxo) { return combined.push(utxo); });
                        (_b = unconfirmed === null || unconfirmed === void 0 ? void 0 : unconfirmed.result) === null || _b === void 0 ? void 0 : _b.map(function (utxo) { return combined.push(utxo); });
                        script = (confirmed === null || confirmed === void 0 ? void 0 : confirmed.script) || (unconfirmed === null || unconfirmed === void 0 ? void 0 : unconfirmed.script) || '';
                        formatted = combined.map(function (u) { return ({ txid: u.tx_hash, vout: u.tx_pos, satoshis: u.value, script: script }); });
                        console.log({ confirmed: confirmed, unconfirmed: unconfirmed, combined: combined, formatted: formatted });
                        return [2 /*return*/, formatted];
                }
            });
        });
    };
    WocClient.prototype.getTx = function (txid) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.get("/tx/".concat(txid, "/hex"))];
            });
        });
    };
    WocClient.prototype.getMerklePath = function (txid) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.getJson("/tx/".concat(txid, "/proof/tsc"))];
            });
        });
    };
    WocClient.prototype.getHeader = function (hash) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.getJson("/block/".concat(hash, "/header"))];
            });
        });
    };
    WocClient.prototype.convertTSCtoBUMP = function (tsc) {
        return __awaiter(this, void 0, void 0, function () {
            var txid, header, bump, leafOfInterest, merklePath;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        txid = tsc.txOrId;
                        return [4 /*yield*/, this.getHeader(tsc.target)];
                    case 1:
                        header = _a.sent();
                        bump = {};
                        bump.blockHeight = header.height;
                        bump.path = [];
                        leafOfInterest = { hash: txid, txid: true, offset: tsc.index };
                        tsc.nodes.map(function (hash, idx) {
                            var offset = tsc.index >> idx ^ 1;
                            var leaf = { offset: offset };
                            if (hash === '*')
                                leaf.duplicate = true;
                            else
                                leaf.hash = hash;
                            if (idx === 0) {
                                if (tsc.index % 2)
                                    bump.path.push([leafOfInterest, leaf]);
                                else
                                    bump.path.push([leaf, leafOfInterest]);
                            }
                            else
                                bump.path.push([leaf]);
                        });
                        merklePath = new MerklePath(bump.blockHeight, bump.path);
                        if (header.merkleroot !== merklePath.computeRoot(txid))
                            throw new Error('Invalid Merkle Path');
                        return [2 /*return*/, merklePath];
                }
            });
        });
    };
    WocClient.prototype.getMerklePathOrParents = function (tx) {
        return __awaiter(this, void 0, void 0, function () {
            var tscRes, _a;
            var _this = this;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.getMerklePath(tx.id('hex'))];
                    case 1:
                        tscRes = _b.sent();
                        console.log({ tscRes: tscRes });
                        if (!(tscRes !== null)) return [3 /*break*/, 3];
                        _a = tx;
                        return [4 /*yield*/, this.convertTSCtoBUMP(tscRes)];
                    case 2:
                        _a.merklePath = _b.sent();
                        console.log({ bump: tx.merklePath });
                        return [2 /*return*/, tx];
                    case 3: return [4 /*yield*/, Promise.all(tx.inputs.map(function (input, idx) { return __awaiter(_this, void 0, void 0, function () {
                            var rawtx, inputTx, st;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, this.getTx(input.sourceTXID)];
                                    case 1:
                                        rawtx = _a.sent();
                                        inputTx = Transaction.fromHex(rawtx);
                                        return [4 /*yield*/, this.getMerklePathOrParents(inputTx)];
                                    case 2:
                                        st = _a.sent();
                                        tx.inputs[idx].sourceTransaction = st;
                                        return [2 /*return*/];
                                }
                            });
                        }); }))];
                    case 4:
                        _b.sent();
                        return [2 /*return*/, tx];
                }
            });
        });
    };
    return WocClient;
}());
export default WocClient;
