import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Typography, Box, Paper, Stack, Table, TableHead, TableBody, TableRow, TableCell,
  Button, TextField, Select, MenuItem, FormControl, InputLabel, InputAdornment,
  IconButton, Chip, Pagination, Alert, Dialog, DialogTitle, DialogContent,
  DialogActions, LinearProgress,
} from '@mui/material'
import ClearIcon from '@mui/icons-material/Clear'
import FileUploadIcon from '@mui/icons-material/FileUpload'
import FileDownloadIcon from '@mui/icons-material/FileDownload'
import { fetchStates, fetchCells, exportCells, importCsv } from '../api'

const PAGE_SIZE_OPTIONS = [5, 10, 20]

const STATE_COLOR = {
  'Received':    'default',
  'Incoming QC': 'secondary',
  'Storage':     'primary',
  'Under Test':  'warning',
  'Passed':      'success',
  'Failed':      'error',
  'Disposed':    'default',
}

const STATE_SX = {
  'Disposed': { bgcolor: '#1a1a2e', color: '#fff' },
}

export default function CellList() {
  const [cells, setCells] = useState([])
  const [states, setStates] = useState([])
  const [stateFilter, setStateFilter] = useState('')
  const [batchFilter, setBatchFilter] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showImport, setShowImport] = useState(false)
  const navigate = useNavigate()

  const totalPages = Math.max(1, Math.ceil(total / limit))

  useEffect(() => { fetchStates().then(setStates) }, [])

  function handleStateFilter(val) { setStateFilter(val); setPage(1) }
  function handleBatchFilter(val) { setBatchFilter(val); setPage(1) }
  function handleLimit(val)       { setLimit(Number(val)); setPage(1) }

  function loadCells() {
    setLoading(true)
    setError(null)
    const params = { page, limit }
    if (stateFilter) params.state = stateFilter
    if (batchFilter) params.batch = batchFilter
    fetchCells(params)
      .then(({ data, total: t }) => { setCells(data); setTotal(t) })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadCells() }, [stateFilter, batchFilter, page, limit])

  return (
    <>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>Cell List</Typography>

      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>State</InputLabel>
          <Select value={stateFilter} label="State" onChange={e => handleStateFilter(e.target.value)}>
            <MenuItem value="">All States</MenuItem>
            {states.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </Select>
        </FormControl>

        <TextField
          size="small"
          placeholder="Filter by batch…"
          value={batchFilter}
          onChange={e => handleBatchFilter(e.target.value)}
          sx={{ width: 200 }}
          InputProps={{
            endAdornment: batchFilter && (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => handleBatchFilter('')}>
                  <ClearIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ),
          }}
        />

        <Stack direction="row" spacing={3} sx={{ ml: 'auto' }}>
          <Button
            variant="outlined"
            startIcon={<FileDownloadIcon />}
            onClick={() => exportCells({ state: stateFilter, batch: batchFilter })}
          >
            Export CSV
          </Button>
          <Button
            variant="contained"
            startIcon={<FileUploadIcon />}
            onClick={() => setShowImport(true)}
          >
            Import CSV
          </Button>
        </Stack>
      </Box>

      <Paper>
        {loading && <LinearProgress />}

        {error ? (
          <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>
        ) : cells.length === 0 && !loading ? (
          <Typography color="text.secondary" sx={{ textAlign: 'center', py: 8 }}>No cells found.</Typography>
        ) : (
          <>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ '& th': { fontWeight: 700, color: 'text.secondary', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 } }}>
                  <TableCell>Cell ID</TableCell>
                  <TableCell>Manufacturer</TableCell>
                  <TableCell>Chemistry</TableCell>
                  <TableCell>Capacity (mAh)</TableCell>
                  <TableCell>Batch</TableCell>
                  <TableCell>Received</TableCell>
                  <TableCell>State</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {cells.map(c => (
                  <TableRow key={c.cell_id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/cells/${c.cell_id}`)}>
                    <TableCell sx={{ color: 'primary.main', fontWeight: 600 }}>{c.cell_id}</TableCell>
                    <TableCell>{c.manufacturer}</TableCell>
                    <TableCell>{c.chemistry}</TableCell>
                    <TableCell>{Number(c.capacity_mah).toLocaleString()}</TableCell>
                    <TableCell>{c.batch_number || '—'}</TableCell>
                    <TableCell>{c.received_date?.slice(0, 10)}</TableCell>
                    <TableCell>
                      <Chip label={c.current_state} size="small" color={STATE_COLOR[c.current_state] ?? 'default'} sx={STATE_SX[c.current_state]} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Typography variant="body2" color="text.secondary">{total} cells · Show</Typography>
                <Select
                  size="small"
                  value={limit}
                  onChange={e => handleLimit(e.target.value)}
                  sx={{ fontSize: 13 }}
                >
                  {PAGE_SIZE_OPTIONS.map(n => <MenuItem key={n} value={n}>{n}</MenuItem>)}
                </Select>
                <Typography variant="body2" color="text.secondary">per page</Typography>
              </Box>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(_, p) => setPage(p)}
                size="small"
                color="primary"
              />
            </Box>
          </>
        )}
      </Paper>

      <ImportModal
        open={showImport}
        onClose={() => setShowImport(false)}
        onSuccess={() => { setShowImport(false); loadCells() }}
      />
    </>
  )
}

function ImportModal({ open, onClose, onSuccess }) {
  const [file, setFile] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [drag, setDrag] = useState(false)
  const inputRef = useRef()

  function handleClose() { setFile(null); setResult(null); onClose() }

  async function handleUpload() {
    if (!file) return
    setLoading(true)
    try {
      setResult(await importCsv(file))
    } catch (err) {
      setResult({ error: err.message, imported: 0, failed: 0 })
    } finally {
      setLoading(false)
    }
  }

  function handleDrop(e) {
    e.preventDefault()
    setDrag(false)
    const f = e.dataTransfer.files[0]
    if (f?.name.endsWith('.csv')) setFile(f)
  }

  const hasErrors = result?.errors?.length > 0

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Import CSV</DialogTitle>
      <DialogContent>
        <Box
          sx={{
            border: `2px dashed ${drag ? '#1c6ef3' : '#d0d5dd'}`,
            borderRadius: 2, p: 4, textAlign: 'center', cursor: 'pointer',
            color: drag ? 'primary.main' : 'text.secondary',
            transition: 'border-color 0.15s',
            '&:hover': { borderColor: 'primary.main', color: 'primary.main' },
          }}
          onClick={() => inputRef.current.click()}
          onDragOver={e => { e.preventDefault(); setDrag(true) }}
          onDragLeave={() => setDrag(false)}
          onDrop={handleDrop}
        >
          <input ref={inputRef} type="file" accept=".csv" hidden onChange={e => setFile(e.target.files[0])} />
          {file
            ? <Typography>📄 <strong>{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)</Typography>
            : <Typography>Click to select or drag & drop a CSV file</Typography>
          }
        </Box>

        {result && (
          <Box mt={2}>
            {result.error
              ? <Alert severity="error">{result.error}</Alert>
              : <Alert severity={!hasErrors ? 'success' : result.imported > 0 ? 'warning' : 'error'}>
                  ✓ {result.imported} rows imported · ✗ {result.failed ?? 0} rows failed
                </Alert>
            }
            {hasErrors && (
              <Table size="small" sx={{ mt: 1.5 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Line</TableCell>
                    <TableCell>Field</TableCell>
                    <TableCell>Error</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {result.errors.map((e, i) => (
                    <TableRow key={i}>
                      <TableCell>{e.line}</TableCell>
                      <TableCell><code>{e.field}</code></TableCell>
                      <TableCell>{e.msg}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Close</Button>
        {result?.imported > 0 && <Button variant="contained" color="success" onClick={onSuccess}>Done</Button>}
        {!result && <Button variant="contained" onClick={handleUpload} disabled={!file || loading}>{loading ? 'Uploading…' : 'Upload'}</Button>}
      </DialogActions>
    </Dialog>
  )
}
