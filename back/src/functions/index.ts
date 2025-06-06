/**
 * Truth Machine API Functions Index
 * 
 * This module exports all the API endpoint handlers for the Truth Machine system.
 * It serves as a central point for importing and managing the application's routes.
 * 
 * Available Endpoints:
 * - callback: Handles ARC service callbacks for transaction status
 * - download: Serves file downloads by txid or hash
 * - fund: Creates new tokens for file storage
 * - integrity: Verifies file and transaction integrity
 * - upload: Handles file uploads and blockchain commitments
 * - checkTreasury: Reports treasury status and balance
 * 
 * @module functions
 */

export { default as callback } from './callback'
export { default as download } from './download'
export { default as fund } from './fund'
export { default as integrity } from './integrity'
export { default as upload } from './upload'
export { default as checkTreasury } from './checkTreasury'
export { default as utxoStatusUpdate } from './utxoStatusUptate'
export { default as allFunds } from './allFunds'
