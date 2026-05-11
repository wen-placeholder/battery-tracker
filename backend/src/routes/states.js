const express = require('express');
const router = express.Router();
const pool = require('../db/connection');

// GET /api/states
router.get('/', async (req, res) => {
  const [rows] = await pool.query('SELECT name FROM states ORDER BY sort_order');
  res.json(rows.map(r => r.name));
});

module.exports = router;
