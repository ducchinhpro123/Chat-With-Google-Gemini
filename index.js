import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { aiRouter } from './routes/aiApi.js';
import { router } from './routes/index.js';

import session from 'express-session';

import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;


app.use(session({
  secret: process.env.SECRECT_KEY || 'secret',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: true } //
}));

app.use(express.json());
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use('/js', express.static(path.join(__dirname, 'public', 'js')));

app.use('/api', aiRouter);
app.use('/', router);

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
