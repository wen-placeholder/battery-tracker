import axios from 'axios'

const api = axios.create({ baseURL: 'http://localhost:3001/api' })

api.interceptors.response.use(
  r => r,
  err => {
    const message = err.response?.data?.error ?? 'Network error, please try again'
    return Promise.reject(new Error(message))
  }
)

export const fetchStates    = ()           => api.get('/states').then(r => r.data)
export const fetchCells     = (params)     => api.get('/cells', { params }).then(r => r.data)
// returns { data, total, page, limit }

export async function exportCells(params) {
  const data = await api.get('/cells/export', {
    params: Object.fromEntries(Object.entries(params).filter(([, v]) => v)),
    responseType: 'blob',
  }).then(r => r.data)
  const url = URL.createObjectURL(data)
  const a = document.createElement('a')
  a.href = url
  a.download = `cells-${Date.now()}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export const fetchCell      = (cellId)     => api.get(`/cells/${cellId}`).then(r => r.data)
export const fetchEvents    = (cellId)     => api.get(`/cells/${cellId}/events`).then(r => r.data)
export const fetchDashboard = ()           => api.get('/dashboard').then(r => r.data)
export const updateState    = (cellId, body) => api.patch(`/cells/${cellId}/state`, body).then(r => r.data)
export const importCsv      = (file)       => {
  const form = new FormData()
  form.append('file', file)
  return api.post('/import', form).then(r => r.data)
}
