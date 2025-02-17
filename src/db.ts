import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'
dotenv.config()

const { MONGO_URI } = process.env

const client = new MongoClient(MONGO_URI)

async function connectToDatabase() {
    try {
        await client.connect()
    } catch (err) {
        console.error('Failed to connect to MongoDB', err)
        process.exit(1)
    }
}

connectToDatabase()

export default client.db('data-timestamper')