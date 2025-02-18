import express, { Application } from 'express'
import { upload, download, callback, integrity, fund } from './functions'
import frontend from './frontend'
import dotenv from 'dotenv'
dotenv.config()
const { PORT } = process.env

const app: Application = express()

app.get('/', frontend)
app.get('/fund/:number', fund)
app.use(express.raw()).post('/upload', upload)
app.get('/download/:id', download)
app.use(express.json()).post('/callback', callback)
app.get('/integrity/:id', integrity)

app.listen(PORT, () => {
  console.log(`http://localhost:${PORT}`);
})