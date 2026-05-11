const express = require('express');
const router = express.Router();
const pool = require('../db/connection');

const ah = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// GET /api/cells?state=Passed&batch=BATCH-2024-A&page=1&limit=20
router.get('/', ah(async (req, res) => {
  const { state, batch, page = 1, limit = 20 } = req.query;
  const pageNum  = Math.max(1, Number(page));
  const limitNum = Math.min(100, Math.max(1, Number(limit)));
  const offset   = (pageNum - 1) * limitNum;

  let where = 'WHERE 1=1';
  const params = [];
  if (state) { where += ' AND current_state = ?';       params.push(state); }
  if (batch) { where += ' AND batch_number LIKE ?';     params.push(`%${batch}%`); }

  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM cells ${where}`, params);
  const [rows] = await pool.query(
    `SELECT * FROM cells ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, limitNum, offset]
  );

  res.json({ data: rows, total: Number(total), page: pageNum, limit: limitNum });
}));

// GET /api/cells/export?state=&batch=
router.get('/export', ah(async (req, res) => {
  const { state, batch } = req.query;
  let where = 'WHERE 1=1';
  const params = [];
  if (state) { where += ' AND current_state = ?';   params.push(state); }
  if (batch) { where += ' AND batch_number LIKE ?'; params.push(`%${batch}%`); }

  const [rows] = await pool.query(
    `SELECT cell_id, manufacturer, chemistry, capacity_mah, voltage_nominal,
            batch_number, received_date, current_state, notes
     FROM cells ${where} ORDER BY created_at DESC`,
    params
  );

  const escape = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const header = 'cell_id,manufacturer,chemistry,capacity_mah,voltage_nominal,batch_number,received_date,current_state,notes';
  const lines  = rows.map(r => [
    r.cell_id, r.manufacturer, r.chemistry, r.capacity_mah, r.voltage_nominal,
    r.batch_number, r.received_date ? new Date(r.received_date).toISOString().slice(0, 10) : '',
    r.current_state, r.notes,
  ].map(escape).join(','));

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="cells-${Date.now()}.csv"`);
  res.send([header, ...lines].join('\n'));
}));

// GET /api/cells/:cellId
router.get('/:cellId', ah(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM cells WHERE cell_id = ?', [req.params.cellId]);
  if (rows.length === 0) return res.status(404).json({ error: 'Cell not found' });
  res.json(rows[0]);
}));

// GET /api/cells/:cellId/events
router.get('/:cellId/events', ah(async (req, res) => {
  const [rows] = await pool.query(
    'SELECT * FROM cell_events WHERE cell_id = ? ORDER BY created_at ASC',
    [req.params.cellId]
  );
  res.json(rows);
}));

// POST /api/cells
router.post('/', ah(async (req, res) => {
  const { cell_id, manufacturer, chemistry, capacity_mah, voltage_nominal, batch_number, received_date, notes } = req.body;

  if (!cell_id || !manufacturer || !chemistry || !capacity_mah || !voltage_nominal || !received_date) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(
      'INSERT INTO cells (cell_id, manufacturer, chemistry, capacity_mah, voltage_nominal, batch_number, received_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [cell_id, manufacturer.trim(), chemistry.toUpperCase(), capacity_mah, voltage_nominal, batch_number || null, received_date, notes || null]
    );

    await conn.query(
      'INSERT INTO cell_events (cell_id, event_type, from_state, to_state, logged_by, notes) VALUES (?, ?, ?, ?, ?, ?)',
      [cell_id, 'state_change', null, 'Received', 'system', `Cell created. ${notes || ''}`.trim()]
    );

    await conn.commit();
    res.status(201).json({ message: 'Cell created', cell_id });
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: `cell_id ${cell_id} already exists` });
    throw err;
  } finally {
    conn.release();
  }
}));

// State transition rules:
// - 'Disposed' is a terminal state, no transitions out
// - 'Passed' and 'Failed' cannot go back to early intake stages
const FORBIDDEN_FROM = {
  'Disposed': () => true,
  'Passed':   (to) => ['Received', 'Incoming QC'].includes(to),
  'Failed':   (to) => ['Received', 'Incoming QC'].includes(to),
}

// PATCH /api/cells/:cellId/state
router.patch('/:cellId/state', ah(async (req, res) => {
  const { state, logged_by, notes } = req.body;
  const { cellId } = req.params;

  if (!notes) {
    return res.status(400).json({ error: 'notes is required when updating state' });
  }

  const [validRows] = await pool.query('SELECT name FROM states');
  const validStateNames = validRows.map(r => r.name);
  if (!state || !validStateNames.includes(state)) {
    return res.status(400).json({ error: `state must be one of: ${validStateNames.join(', ')}` });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query('SELECT current_state FROM cells WHERE cell_id = ?', [cellId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Cell not found' });

    const fromState = rows[0].current_state;

    const isForbidden = FORBIDDEN_FROM[fromState]?.(state)
    if (isForbidden) {
      conn.release();
      return res.status(422).json({
        error: `Cannot transition from "${fromState}" to "${state}"`,
      });
    }

    await conn.query('UPDATE cells SET current_state = ? WHERE cell_id = ?', [state, cellId]);

    await conn.query(
      'INSERT INTO cell_events (cell_id, event_type, from_state, to_state, logged_by, notes) VALUES (?, ?, ?, ?, ?, ?)',
      [cellId, 'state_change', fromState, state, logged_by || 'system', notes]
    );

    await conn.commit();
    res.json({ message: 'State updated', from: fromState, to: state });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}));

module.exports = router;
