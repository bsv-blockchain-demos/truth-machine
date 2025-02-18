import express, { Application } from 'express'
import { upload, download, callback, integrity, fund } from './functions'
import frontend from './frontend'
import dotenv from 'dotenv'
dotenv.config()
const { PORT } = process.env

const app: Application = express()

app.use(express.json())

app.get('/', frontend)
app.get('/fund/:number', fund)
app.post('/upload', upload)
app.get('/download/:id', download)
app.post('/callback', callback)
app.get('/integrity/:id', integrity)

app.listen(PORT, () => {
  console.log(`http://localhost:${PORT}`);
})