/**
 * MongoDB Database Configuration and Connection Management
 * 
 * This module establishes and manages the MongoDB connection for the Truth Machine application.
 * It handles database initialization and provides a configured database instance for use
 * throughout the application.
 * 
 * The database is used to store:
 * - Transaction records (txs collection)
 * - UTXO tracking (utxos collection)
 * - File metadata and content
 */

import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'
import { NETWORK } from './arc'
dotenv.config()

// Load database configuration from environment variables
const { MONGO_URI, DB_NAME } = process.env

// Initialize MongoDB client with connection string
const client = new MongoClient(MONGO_URI)

/**
 * Establishes connection to MongoDB database
 * Exits process with status code 1 if connection fails
 * This ensures the application won't run without a valid database connection
 */
async function connectToDatabase() {
    try {
        await client.connect()
    } catch (err) {
        console.error('Failed to connect to MongoDB', err)
        process.exit(1)
    }
}

// Establish database connection on module load
connectToDatabase()

/**
 * Export configured database instance
 * This instance is used by other modules to interact with collections
 * @example
 * // In other files:
 * import db from '../db'
 * const result = await db.collection('txs').findOne({ txid })
 */
export default client.db(DB_NAME + (NETWORK === 'test' ? '' : '-mainnet'))