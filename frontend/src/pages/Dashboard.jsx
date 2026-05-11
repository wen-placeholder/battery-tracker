import { useEffect, useState } from 'react'
import { Typography, Card, CardContent, Paper, Alert, Skeleton, LinearProgress, Box, Tooltip } from '@mui/material'
import { fetchDashboard } from '../api'

const STATE_STYLES = {
  'Received':    { color: '#64748b', emoji: '📦' },
  'Incoming QC': { color: '#8b5cf6', emoji: '🔍' },
  'Storage':     { color: '#3b82f6', emoji: '🏭' },
  'Under Test':  { color: '#f59e0b', emoji: '⚗️'  },
  'Passed':      { color: '#22c55e', emoji: '✅' },
  'Failed':      { color: '#ef4444', emoji: '❌' },
  'Disposed':    { color: '#94a3b8', emoji: '🗑️' },
}

const ALL_STATES = Object.keys(STATE_STYLES)

export default function Dashboard() {
  const [stats, setStats] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchDashboard()
      .then(setStats)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const countMap = Object.fromEntries(stats.map(s => [s.state, Number(s.count)]))
  const total = Object.values(countMap).reduce((a, b) => a + b, 0)

  return (
    <>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>Dashboard</Typography>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      <Box sx={{ display: 'flex', gap: '16px', mb: 3 }}>
        {ALL_STATES.map(state => {
          const { color, emoji } = STATE_STYLES[state]
          return (
            <Box key={state} flex={1} minWidth={0}>
              <Card sx={{ borderTop: `4px solid ${color}`, textAlign: 'center', height: '100%' }}>
                <CardContent sx={{ pb: '12px !important' }}>
                  {loading
                    ? <Skeleton variant="text" width={40} height={56} sx={{ mx: 'auto' }} />
                    : <Typography sx={{ fontSize: 40, fontWeight: 700, lineHeight: 1 }}>{countMap[state] ?? 0}</Typography>
                  }
                  <Typography color="text.secondary" sx={{ fontSize: 13, mt: 0.5, mb: 1.5 }}>{emoji} {state}</Typography>
                  <Tooltip title={`${total > 0 ? ((countMap[state] ?? 0) / total * 100).toFixed(1) : 0}%`} placement="bottom">
                    <Box>
                      <LinearProgress
                        variant={loading ? 'indeterminate' : 'determinate'}
                        value={total > 0 ? (countMap[state] ?? 0) / total * 100 : 0}
                        sx={{
                          height: 6, borderRadius: 3,
                          bgcolor: `${color}22`,
                          '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 3 },
                        }}
                      />
                    </Box>
                  </Tooltip>
                </CardContent>
              </Card>
            </Box>
          )
        })}
      </Box>

      <Paper sx={{ p: 2, mt: 3 }}>
        {loading
          ? <Skeleton variant="text" width={200} />
          : <Typography fontWeight={600}>Total cells in system: {total}</Typography>
        }
      </Paper>
    </>
  )
}
