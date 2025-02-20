/**
 * HashPuzzle Script Template for Bitcoin SV Transactions
 * 
 * This class implements a hash puzzle locking mechanism for Bitcoin transactions.
 * A hash puzzle is a cryptographic challenge where funds are locked with a hash,
 * and can only be spent by providing the original preimage (secret) that produces that hash.
 * 
 * The script follows this pattern:
 * Locking Script: OP_SHA256 <hash> OP_EQUAL
 * Unlocking Script: <secret>
 * 
 * Use Cases:
 * - Creating time-locked transactions
 * - Implementing atomic swaps
 * - Securing funds with preimage challenges
 */

import { ScriptTemplate, Transaction, LockingScript, UnlockingScript, OP, Random, Hash } from '@bsv/sdk'

export default class HashPuzzle implements ScriptTemplate {

    /**
     * Creates a locking script that requires a specific preimage to spend
     * @param hash - The SHA256 hash that the preimage must match
     * @returns LockingScript that can only be unlocked with the correct preimage
     */
    lock(hash: number[]): LockingScript {
        return new LockingScript([
            { op: OP.OP_SHA256 },
            { op: hash.length, data: hash },
            { op: OP.OP_EQUAL }
        ])
    }

    /**
     * Creates an unlocking script with the preimage that satisfies the hash puzzle
     * @param secret - The preimage that produces the hash in the locking script
     * @returns Object containing signing function and length estimation
     */
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

    /**
     * Generates a new secret-hash pair for creating a hash puzzle
     * @returns Object containing the random secret and its SHA256 hash
     * @example
     * const { secret, hash } = HashPuzzle.generateSecretPair()
     * // Use hash in locking script
     * // Save secret for later unlocking
     */
    static generateSecretPair() {
        const secret = Random(32)
        const hash = Hash.sha256(secret)
        return { secret, hash }
    }
}