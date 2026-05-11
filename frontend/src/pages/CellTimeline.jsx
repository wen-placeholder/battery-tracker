import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Typography, Box, Paper, Grid, Button, TextField, Select, MenuItem,
  FormControl, InputLabel, Chip, Alert, Stack,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { fetchStates, fetchCell, fetchEvents, updateState } from '../api'

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

const EVENT_COLOR = { state_change: '#3b82f6', correction: '#f59e0b', note: '#8b5cf6' }

const FORBIDDEN_FROM = {
  'Disposed': () => true,
  'Passed':   (to) => ['Received', 'Incoming QC'].includes(to),
  'Failed':   (to) => ['Received', 'Incoming QC'].includes(to),
}

function getAllowedStates(currentState, allStates) {
  const rule = FORBIDDEN_FROM[currentState]
  return allStates.filter(s => s !== currentState && !rule?.(s))
}

function formatTime(ts) {
  return new Date(ts).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function CellTimeline() {
  const { cellId } = useParams()
  const navigate = useNavigate()
  const [cell, setCell] = useState(null)
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [states, setStates] = useState([])
  const [newState, setNewState] = useState('')
  const [loggedBy, setLoggedBy] = useState('')
  const [notes, setNotes] = useState('')
  const [updating, setUpdating] = useState(false)
  const [updateMsg, setUpdateMsg] = useState(null)

  useEffect(() => { fetchStates().then(setStates) }, [])

  async function loadData() {
    setError(null)
    try {
      const [c, e] = await Promise.all([fetchCell(cellId), fetchEvents(cellId)])
      setCell(c)
      setEvents(e)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [cellId])

  async function handleUpdateState(e) {
    e.preventDefault()
    if (!newState || !notes) return
    setUpdating(true)
    setUpdateMsg(null)
    try {
      await updateState(cellId, { state: newState, logged_by: loggedBy || 'operator', notes })
      setUpdateMsg({ ok: true, text: `State updated to "${newState}"` })
      setNewState(''); setLoggedBy(''); setNotes('')
      await loadData()
    } catch (err) {
      setUpdateMsg({ ok: false, text: err.message })
    } finally {
      setUpdating(false)
    }
  }

  if (loading) return <Typography color="text.secondary" sx={{ textAlign: 'center', py: 8 }}>Loading…</Typography>
  if (error)   return <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>
  if (!cell)   return <Typography color="text.secondary" sx={{ textAlign: 'center', py: 8 }}>Cell not found.</Typography>

  return (
    <>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/cells')} sx={{ mb: 2 }}>
        Back to Cell List
      </Button>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: '16px', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>{cell.cell_id}</Typography>
        <Chip label={cell.current_state} color={STATE_COLOR[cell.current_state] ?? 'default'} sx={STATE_SX[cell.current_state]} />
      </Box>

      <Grid container spacing={1.5} sx={{ mb: 3 }}>
        {[
          ['Manufacturer', cell.manufacturer],
          ['Chemistry', cell.chemistry],
          ['Capacity', `${Number(cell.capacity_mah).toLocaleString()} mAh`],
          ['Voltage', `${cell.voltage_nominal} V`],
          ['Batch', cell.batch_number || '—'],
          ['Received', cell.received_date?.slice(0, 10)],
        ].map(([label, value]) => (
          <Grid item xs={6} sm={4} md={2} key={label}>
            <Paper sx={{ p: 1.5 }}>
              <Typography color="text.secondary" sx={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.5 }}>{label}</Typography>
              <Typography sx={{ fontSize: 15, fontWeight: 600 }}>{value}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Paper sx={{ p: 2.5, mb: 3 }}>
        <Typography sx={{ fontWeight: 600, mb: 1.5 }}>Update State</Typography>
        {cell.current_state === 'Disposed' ? (
          <Alert severity="info">This cell has been disposed and cannot be updated.</Alert>
        ) : (
          <Stack component="form" onSubmit={handleUpdateState} direction="row" spacing={2} flexWrap="wrap" useFlexGap alignItems="center">
            <FormControl size="small" sx={{ minWidth: 160 }} required>
              <InputLabel>New State</InputLabel>
              <Select value={newState} label="New State" onChange={e => setNewState(e.target.value)}>
                {getAllowedStates(cell.current_state, states).map(s => (
                  <MenuItem key={s} value={s}>{s}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField size="small" label="Logged By" value={loggedBy} onChange={e => setLoggedBy(e.target.value)} sx={{ width: 160 }} />
            <TextField size="small" label="Notes *" value={notes} onChange={e => setNotes(e.target.value)} required sx={{ flex: 1, minWidth: 200 }} />
            <Button type="submit" variant="contained" size="small" disabled={updating} sx={{ height: 40, whiteSpace: 'nowrap' }}>
              {updating ? 'Saving…' : 'Update'}
            </Button>
          </Stack>
        )}
        {updateMsg && (
          <Alert severity={updateMsg.ok ? 'success' : 'error'} sx={{ mt: 1.5 }}>{updateMsg.text}</Alert>
        )}
      </Paper>

      <Typography color="text.secondary" sx={{ fontSize: 15, mb: 2 }}>
        Event History ({events.length} events)
      </Typography>

      {events.length === 0
        ? <Typography color="text.secondary" sx={{ textAlign: 'center', py: 6 }}>No events yet.</Typography>
        : (
          <Box sx={{ position: 'relative', pl: 3.5 }}>
            <Box sx={{ position: 'absolute', left: 8, top: 0, bottom: 0, width: 2, bgcolor: '#e2e8f0' }} />
            {[...events].reverse().map(ev => {
              const dotColor = ev.to_state === 'Passed' ? '#22c55e'
                : ev.to_state === 'Failed' ? '#ef4444'
                : EVENT_COLOR[ev.event_type] ?? '#94a3b8'
              const borderColor = ev.to_state === 'Passed' ? '#22c55e'
                : ev.to_state === 'Failed' ? '#ef4444'
                : EVENT_COLOR[ev.event_type] ?? '#e2e8f0'
              return (
                <Box key={ev.id} sx={{ position: 'relative', mb: 3 }}>
                  <Box sx={{
                    position: 'absolute', left: -22, top: 6,
                    width: 12, height: 12, borderRadius: '50%',
                    bgcolor: dotColor, border: '2px solid #fff',
                    boxShadow: `0 0 0 2px ${dotColor}44`,
                  }} />
                  <Paper sx={{ p: 2, borderLeft: `4px solid ${borderColor}` }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', mb: 0.5 }}>
                      <Typography sx={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        {ev.event_type.replace('_', ' ')}
                      </Typography>
                      {ev.from_state && <Chip label={ev.from_state} size="small" color={STATE_COLOR[ev.from_state] ?? 'default'} sx={STATE_SX[ev.from_state]} />}
                      {ev.from_state && ev.to_state && <Typography color="text.secondary">→</Typography>}
                      {ev.to_state && <Chip label={ev.to_state} size="small" color={STATE_COLOR[ev.to_state] ?? 'default'} sx={STATE_SX[ev.to_state]} />}
                      <Typography color="text.secondary" sx={{ fontSize: 12, ml: 'auto' }}>{formatTime(ev.created_at)}</Typography>
                    </Box>
                    <Typography color="text.secondary" sx={{ fontSize: 12 }}>by {ev.logged_by}</Typography>
                    {ev.notes && <Typography color="text.primary" sx={{ fontSize: 14, mt: 0.5 }}>{ev.notes}</Typography>}
                  </Paper>
                </Box>
              )
            })}
          </Box>
        )
      }
    </>
  )
}
