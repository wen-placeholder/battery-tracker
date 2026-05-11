const express = require('express');
const router = express.Router();
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const fs = require('fs');
const pool = require('../db/connection');

const upload = multer({ dest: '/Users/wenjing/Desktop/battery-tracker/backend/uploads/' });

const VALID_CHEMISTRY = ['NMC', 'NCA', 'LFP'];

function validateRow(row, lineNum, seenIds) {
  const errors = [];

  if (!row.cell_id) {
    errors.push({ line: lineNum, field: 'cell_id', msg: 'Required' });
  } else if (seenIds.has(row.cell_id)) {
    errors.push({ line: lineNum, field: 'cell_id', msg: `Duplicate cell_id within file: ${row.cell_id}` });
  }

  if (!row.manufacturer) errors.push({ line: lineNum, field: 'manufacturer', msg: 'Required' });

  const chem = (row.chemistry || '').toUpperCase();
  if (!chem || !VALID_CHEMISTRY.includes(chem)) {
    errors.push({ line: lineNum, field: 'chemistry', msg: `Must be one of: ${VALID_CHEMISTRY.join(', ')}` });
  }

  const cap = Number(row.capacity_mah);
  if (!row.capacity_mah || isNaN(cap) || cap <= 0) {
    errors.push({ line: lineNum, field: 'capacity_mah', msg: 'Must be a positive number' });
  }

  const volt = Number(row.voltage_nominal);
  if (!row.voltage_nominal || isNaN(volt) || volt <= 0) {
    errors.push({ line: lineNum, field: 'voltage_nominal', msg: 'Must be a positive number' });
  }

  if (!row.received_date || isNaN(Date.parse(row.received_date))) {
    errors.push({ line: lineNum, field: 'received_date', msg: 'Must be a valid date (YYYY-MM-DD)' });
  }

  return errors;
}

// POST /api/import
router.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const content = fs.readFileSync(req.file.path, 'utf8');
  fs.unlinkSync(req.file.path);

  let rows;
  try {
    rows = parse(content, { columns: true, skip_empty_lines: true, trim: true });
  } catch (err) {
    return res.status(400).json({ error: 'Failed to parse CSV', detail: err.message });
  }

  const allErrors = [];
  const validRows = [];
  const seenIds = new Set();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const lineNum = i + 2;
    const rowErrors = validateRow(row, lineNum, seenIds);

    if (rowErrors.length > 0) {
      allErrors.push(...rowErrors);
    } else {
      seenIds.add(row.cell_id);
      validRows.push({ ...row, lineNum });
    }

    if (row.cell_id) seenIds.add(row.cell_id);
  }

  // Insert valid rows, catch per-row DB errors (e.g. duplicate in DB)
  const imported = [];
  const dbErrors = [];

  const conn = await pool.getConnection();
  try {
    for (const row of validRows) {
      try {
        await conn.beginTransaction();

        await conn.query(
          'INSERT INTO cells (cell_id, manufacturer, chemistry, capacity_mah, voltage_nominal, batch_number, received_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [
            row.cell_id,
            row.manufacturer.trim(),
            row.chemistry.toUpperCase(),
            Number(row.capacity_mah),
            Number(row.voltage_nominal),
            row.batch_number || null,
            row.received_date,
            row.notes || null,
          ]
        );

        await conn.query(
          'INSERT INTO cell_events (cell_id, event_type, from_state, to_state, logged_by, notes) VALUES (?, ?, ?, ?, ?, ?)',
          [row.cell_id, 'state_change', null, 'Received', 'system', `Imported via CSV. ${row.notes || ''}`.trim()]
        );

        await conn.commit();
        imported.push(row.cell_id);
      } catch (err) {
        await conn.rollback();
        if (err.code === 'ER_DUP_ENTRY') {
          dbErrors.push({ line: row.lineNum, field: 'cell_id', msg: `cell_id ${row.cell_id} already exists in database` });
        } else {
          dbErrors.push({ line: row.lineNum, field: 'unknown', msg: err.message });
        }
      }
    }
  } finally {
    conn.release();
  }

  res.status(allErrors.length + dbErrors.length > 0 ? 207 : 200).json({
    imported: imported.length,
    failed: allErrors.length + dbErrors.length,
    errors: [...allErrors, ...dbErrors].sort((a, b) => a.line - b.line),
  });
});

module.exports = router;
