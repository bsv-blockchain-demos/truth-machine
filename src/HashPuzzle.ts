import { ScriptTemplate, Transaction, LockingScript, UnlockingScript, OP, Random, Hash } from '@bsv/sdk'

export default class HashPuzzle implements ScriptTemplate {

    lock(hash: number[]): LockingScript {
        return new LockingScript([
            { op: OP.OP_SHA256 },
            { op: hash.length, data: hash },
            { op: OP.OP_EQUAL }
        ])
    }

    unlock(secret: number[]): {
        sign: (tx: Transaction, inputIndex: number) => Promise<UnlockingScript>
        estimateLength: () => Promise<33>
      } {
        return {
          sign: async (tx: Transaction, inputIndex: number) => {
            return new UnlockingScript([
                { op: secret.length, data: secret }
            ])
          },
          estimateLength: async () => 33
        }
    }

    static generateSecretPair() {
        const secret = Random(32)
        const hash = Hash.sha256(secret)
        return { secret, hash }
    }
}