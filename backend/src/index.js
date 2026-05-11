const express = require('express');
const cors = require('cors');
require('dotenv').config();

const cellsRouter  = require('./routes/cells');
const importRouter = require('./routes/import');
const statesRouter = require('./routes/states');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/cells',  cellsRouter);
app.use('/api/import', importRouter);
app.use('/api/states', statesRouter);

const ah = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

app.get('/api/dashboard', ah(async (_req, res) => {
  const pool = require('./db/connection');
  const [rows] = await pool.query(
    'SELECT current_state AS state, COUNT(*) AS count FROM cells GROUP BY current_state'
  );
  res.json(rows);
}));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
