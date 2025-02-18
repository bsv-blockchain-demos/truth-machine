import express from 'express';
import { upload, download, callback, integrity, fund } from './functions';
import frontend from './frontend';
import dotenv from 'dotenv';
dotenv.config();
var PORT = process.env.PORT;
var app = express();
app.use(express.json());
app.get('/', frontend);
app.get('/fund/:number', fund);
app.post('/upload', upload);
app.get('/download/:id', download);
app.post('/callback', callback);
app.get('/integrity/:id', integrity);
app.listen(PORT, function () {
    console.log("http://localhost:".concat(PORT));
});
