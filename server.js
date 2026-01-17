require('dotenv').config();
const path = require('path');
const express = require('express');
const apiRoutes = require('./server/api');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api', apiRoutes);

app.use(express.static(path.join(__dirname)));

app.use((req, res) => {
  res.status(404).json({ error: 'Rota não encontrada.' });
});

app.listen(port, () => {
  console.log(`Servidor ativo em http://localhost:${port}`);
});
