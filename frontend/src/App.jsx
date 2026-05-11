import { Routes, Route } from 'react-router-dom'
import { NavLink } from 'react-router-dom'
import { AppBar, Toolbar, Typography, Box, Container, Button } from '@mui/material'
import Dashboard from './pages/Dashboard'
import CellList from './pages/CellList'
import CellTimeline from './pages/CellTimeline'

function Navbar() {
  return (
    <AppBar position="sticky" sx={{ bgcolor: '#1a1a2e' }}>
      <Toolbar sx={{ gap: '24px' }}>
        <Typography sx={{ fontWeight: 700, fontSize: 16, letterSpacing: 0.5, color: '#fff' }}>
          BMW <Box component="span" sx={{ color: '#4da6ff' }}>Cell Tracker</Box>
        </Typography>
        {[{ to: '/', label: 'Dashboard', end: true }, { to: '/cells', label: 'Cell List' }].map(({ to, label, end }) => (
          <NavLink key={to} to={to} end={end} style={{ textDecoration: 'none' }}>
            {({ isActive }) => (
              <Button
                sx={{
                  color: isActive ? '#fff' : '#94a3b8',
                  borderBottom: isActive ? '2px solid #4da6ff' : '2px solid transparent',
                  borderRadius: 0,
                  px: 0.5,
                  '&:hover': { color: '#fff', background: 'transparent' },
                }}
              >
                {label}
              </Button>
            )}
          </NavLink>
        ))}
      </Toolbar>
    </AppBar>
  )
}

export default function App() {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Navbar />
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/cells" element={<CellList />} />
          <Route path="/cells/:cellId" element={<CellTimeline />} />
        </Routes>
      </Container>
    </Box>
  )
}
