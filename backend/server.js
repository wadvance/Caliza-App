const http = require('http')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const PORT = 8000
const ADMIN_DIR = path.join(__dirname, 'static', 'admin')
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
}

// --- In-memory store ---
const store = {
  users: [],
  samples: [],
  reports: [],
  syncLogs: [],
  tokens: {},
}
let sampleSeq = 0

// Seed demo user
store.users.push({
  id: crypto.randomUUID(),
  email: 'admin@caliza.com',
  password: 'admin123',
  full_name: 'Admin GeoCaliza',
  role: 'admin',
  is_active: true,
})

// --- JWT-like token (simple signed token) ---
const JWT_SECRET = 'geocaliza-dev-secret-2026'
function signToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 86400000 })).toString('base64url')
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url')
  return `${header}.${body}.${sig}`
}
function verifyToken(token) {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${parts[0]}.${parts[1]}`).digest('base64url')
    if (sig !== parts[2]) return null
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString())
    if (payload.exp < Date.now()) return null
    return payload
  } catch { return null }
}

// --- Helpers ---
function json(data, status = 200) {
  return { status, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }
}
function html(body) {
  return { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' }, body }
}
function error(msg, status = 400) {
  return json({ detail: msg }, status)
}
function parseUrl(url) {
  const [p, qs] = url.split('?')
  const params = {}
  if (qs) qs.split('&').forEach(p => { const [k, v] = p.split('='); params[decodeURIComponent(k)] = decodeURIComponent(v || '') })
  return { path: p, params }
}
function getUser(token) {
  const payload = verifyToken(token)
  if (!payload) return null
  return store.users.find(u => u.id === payload.sub) || null
}
function requireAuth(headers) {
  const auth = headers['authorization'] || headers['Authorization'] || ''
  const token = auth.replace('Bearer ', '')
  const user = getUser(token)
  if (!user) return null
  return user
}

// --- Route handlers ---
function handleStatic(url) {
  let filePath = path.join(ADMIN_DIR, url === '/' ? 'index.html' : url)
  if (!fs.existsSync(filePath)) { filePath = path.join(ADMIN_DIR, 'index.html') }
  const ext = path.extname(filePath)
  const content = fs.readFileSync(filePath)
  return { status: 200, headers: { 'Content-Type': MIME[ext] || 'text/plain', 'Cache-Control': 'no-cache' }, body: content }
}

function handleLogin(body) {
  const { email, password } = body
  const user = store.users.find(u => u.email === email && u.password === password)
  if (!user) return error('Credenciales inválidas', 401)
  const token = signToken({ sub: user.id, email: user.email, role: user.role })
  store.tokens[token] = user.id
  return json({ access_token: token, token_type: 'bearer', expires_in: 86400 })
}

function handleRegister(body) {
  const { email, password, full_name, role } = body
  if (store.users.find(u => u.email === email)) return error('El correo ya está registrado', 409)
  const user = {
    id: crypto.randomUUID(),
    email,
    password,
    full_name: full_name || email.split('@')[0],
    role: role || 'operator',
    is_active: true,
  }
  store.users.push(user)
  return json({ id: user.id, email: user.email, full_name: user.full_name, role: user.role, is_active: true }, 201)
}

function handleMe(headers) {
  const user = requireAuth(headers)
  if (!user) return error('No autorizado', 401)
  return json({ id: user.id, email: user.email, full_name: user.full_name, role: user.role, is_active: user.is_active })
}

function handleGetSamples(headers, params) {
  const user = requireAuth(headers)
  if (!user) return error('No autorizado', 401)
  let list = store.samples
  if (params.status) list = list.filter(s => s.status === params.status)
  const skip = parseInt(params.skip || '0')
  const limit = parseInt(params.limit || '50')
  return json(list.slice(skip, skip + limit))
}

function handleGetSample(headers, id) {
  const user = requireAuth(headers)
  if (!user) return error('No autorizado', 401)
  const sample = store.samples.find(s => s.id === id)
  if (!sample) return error('Muestra no encontrada', 404)
  return json(sample)
}

function handleCreateSample(headers, body) {
  const user = requireAuth(headers)
  if (!user) return error('No autorizado', 401)
  sampleSeq++
  const sample = {
    id: `GC-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${String(sampleSeq).padStart(4,'0')}`,
    latitude: body.latitude || 0,
    longitude: body.longitude || 0,
    altitude: body.altitude || 0,
    timestamp: new Date().toISOString(),
    notes: body.notes || '',
    operator_name: body.operator_name || user.full_name,
    estimated_rock_type: body.estimated_rock_type || 'desconocido',
    confidence_level: body.confidence_level || 0.5,
    status: body.status || 'pendiente',
    photo_urls: [],
    acid_reaction: null,
    hardness: null,
    color: null,
    texture: null,
    stratification: null,
    fossil_presence: false,
    estimated_caco3: null,
    ml_prediction_class: body.estimated_rock_type || 'desconocido',
    ml_prediction_probability: body.confidence_level || 0.5,
    owner_id: user.id,
    synced: true,
  }
  store.samples.unshift(sample)
  return json(sample, 201)
}

function handleUpdateStatus(headers, id, body) {
  const user = requireAuth(headers)
  if (!user) return error('No autorizado', 401)
  const sample = store.samples.find(s => s.id === id)
  if (!sample) return error('Muestra no encontrada', 404)
  const status = body.status
  if (!['pendiente', 'validado', 'descartado'].includes(status)) return error('Estado inválido')
  sample.status = status
  return json({ status })
}

function handleNearby(headers, params) {
  const user = requireAuth(headers)
  if (!user) return error('No autorizado', 401)
  const lat = parseFloat(params.latitude)
  const lng = parseFloat(params.longitude)
  const radius = parseFloat(params.radius_km || '5')
  const results = store.samples.filter(s => {
    const d = Math.sqrt((s.latitude - lat) ** 2 + (s.longitude - lng) ** 2) * 111
    return d < radius
  })
  return json(results)
}

function handleSyncPost(headers, body) {
  const user = requireAuth(headers)
  if (!user) return error('No autorizado', 401)
  const samples = body.samples || []
  let synced = 0
  const errors = []
  for (const s of samples) {
    try {
      sampleSeq++
      const sample = {
        id: s.id || `GC-${Date.now()}-${String(sampleSeq).padStart(4,'0')}`,
        latitude: s.latitude || 0,
        longitude: s.longitude || 0,
        altitude: s.altitude || 0,
        timestamp: new Date().toISOString(),
        notes: s.notes || '',
        operator_name: s.operator_name || user.full_name,
        estimated_rock_type: s.estimated_rock_type || 'desconocido',
        confidence_level: s.confidence_level || 0.5,
        status: s.status || 'pendiente',
        photo_urls: [],
        owner_id: user.id,
        synced: true,
      }
      const existing = store.samples.findIndex(x => x.id === sample.id)
      if (existing >= 0) store.samples[existing] = sample
      else store.samples.unshift(sample)
      synced++
    } catch (e) { errors.push(`Error con ${s.id}: ${e.message}`) }
  }
  store.syncLogs.push({ user: user.id, synced, errors, time: new Date().toISOString(), status: errors.length ? 'partial' : 'success' })
  return json({ synced, errors, server_time: new Date().toISOString() })
}

function handleSyncPending(headers) {
  const user = requireAuth(headers)
  if (!user) return error('No autorizado', 401)
  const pending = store.samples.filter(s => s.owner_id === user.id && !s.synced)
  return json({ pending: pending.length, samples: pending })
}

function handleSatelliteAnalyze(headers, body) {
  const user = requireAuth(headers)
  if (!user) return error('No autorizado', 401)
  const { latitude, longitude } = body
  const sim = {
    location: { latitude, longitude },
    date: new Date().toISOString(),
    source: 'sentinel2',
    ndvi: +(0.2 + Math.random() * 0.5).toFixed(3),
    carbonate_index: +(0.3 + Math.random() * 0.6).toFixed(3),
    clay_ratio: +(0.1 + Math.random() * 0.4).toFixed(3),
    quartz_index: +(0.1 + Math.random() * 0.3).toFixed(3),
    zones: [
      { name: 'Zona Norte', probability: Math.random() > 0.5 ? 'alta' : 'media', confidence: +(0.6 + Math.random() * 0.3).toFixed(2) },
      { name: 'Zona Centro', probability: Math.random() > 0.4 ? 'media' : 'alta', confidence: +(0.5 + Math.random() * 0.4).toFixed(2) },
      { name: 'Zona Sur', probability: Math.random() > 0.6 ? 'baja' : 'media', confidence: +(0.3 + Math.random() * 0.4).toFixed(2) },
    ],
  }
  return json(sim)
}

function handleGetReports(headers) {
  const user = requireAuth(headers)
  if (!user) return error('No autorizado', 401)
  return json(store.reports)
}

function handleGenerateReport(headers) {
  const user = requireAuth(headers)
  if (!user) return error('No autorizado', 401)
  const validated = store.samples.filter(s => s.status === 'validado')
  const stats = {
    totalSamples: store.samples.length,
    validatedSamples: validated.length,
    highProbabilityZones: 3,
    averageConfidence: store.samples.length ? +(store.samples.reduce((a, s) => a + s.confidence_level, 0) / store.samples.length).toFixed(2) : 0,
    dominantRockType: 'caliza',
    areaCoveredKm2: +(Math.random() * 50).toFixed(2),
  }
  const report = {
    id: `REP-${Date.now()}`,
    title: `Reporte de exploración - ${new Date().toLocaleDateString('es-MX')}`,
    author: user.full_name,
    generated_at: new Date().toISOString(),
    date_range: { start: new Date(Date.now() - 86400000 * 30).toISOString(), end: new Date().toISOString() },
    sample_count: store.samples.length,
    statistics: stats,
    status: 'success',
  }
  store.reports.unshift(report)
  return json(report, 201)
}

// --- Router ---
function route(method, url, headers, body) {
  const { path: p, params } = parseUrl(url)

  // API routes (must come BEFORE static fallback)
  if (method === 'GET' && p === '/health') return json({ status: 'ok', service: 'GeoCaliza API (dev)' })

  // Auth
  if (method === 'POST' && p === '/api/v1/auth/login') return handleLogin(body)
  if (method === 'POST' && p === '/api/v1/auth/register') return handleRegister(body)
  if (method === 'GET' && p === '/api/v1/auth/me') return handleMe(headers)

  // Samples
  if (method === 'GET' && p === '/api/v1/samples') return handleGetSamples(headers, params)
  if (method === 'POST' && p === '/api/v1/samples') return handleCreateSample(headers, body)
  if (method === 'GET' && p.match(/^\/api\/v1\/samples\/nearby$/)) return handleNearby(headers, params)
  const sampleMatch = p.match(/^\/api\/v1\/samples\/([^/]+)$/)
  if (sampleMatch) {
    if (method === 'GET') return handleGetSample(headers, sampleMatch[1])
  }
  const statusMatch = p.match(/^\/api\/v1\/samples\/([^/]+)\/status$/)
  if (statusMatch && method === 'PATCH') return handleUpdateStatus(headers, statusMatch[1], body)

  // Sync
  if (method === 'POST' && p === '/api/v1/sync') return handleSyncPost(headers, body)
  if (method === 'GET' && p === '/api/v1/sync/pending') return handleSyncPending(headers)

  // Satellite
  if (method === 'POST' && p === '/api/v1/satellite/analyze') return handleSatelliteAnalyze(headers, body)

  // Reports
  if (method === 'GET' && p === '/api/v1/reports') return handleGetReports(headers)
  if (method === 'POST' && p === '/api/v1/reports/generate') return handleGenerateReport(headers)

  // Static files (admin panel) — only for non-API paths
  if (method === 'GET' && !p.startsWith('/api/') && p !== '/health') {
    const sp = p === '/' ? '/admin/' : p.replace('/admin', '') || '/'
    return handleStatic(sp)
  }

  return json({ detail: 'Not Found' }, 404)
}

// --- Server ---
const server = http.createServer((req, res) => {
  const start = Date.now()
  let body = []
  req.on('data', chunk => body.push(chunk))
  req.on('end', () => {
    const raw = Buffer.concat(body).toString()
    let parsed = {}
    const ct = (req.headers['content-type'] || '').toLowerCase()
    if (ct.includes('application/json') && raw) {
      try { parsed = JSON.parse(raw) } catch {}
    } else if (ct.includes('application/x-www-form-urlencoded') && raw) {
      raw.split('&').forEach(p => { const [k, v] = p.split('='); parsed[decodeURIComponent(k)] = decodeURIComponent(v || '') })
    }

    try {
      const result = route(req.method, req.url, req.headers, parsed)
      res.writeHead(result.status, {
        ...result.headers,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      })
      res.end(result.body)
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
      res.end(JSON.stringify({ detail: e.message }))
    }
    console.log(`${req.method} ${req.url} ${res.statusCode} ${Date.now() - start}ms`)
  })
})

server.on('request', (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    })
    res.end()
  }
})

server.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════╗
  ║     🗺️  GeoCaliza - Mock API Server     ║
  ║                                          ║
  ║  Admin panel: http://localhost:${PORT}    ║
  ║  API:         http://localhost:${PORT}/api ║
  ║  Health:      http://localhost:${PORT}/health ║
  ║                                          ║
  ║  Demo: admin@caliza.com / admin123       ║
  ║                                          ║
  ║  Samples in memory: ${store.samples.length}             ║
  ║  Users: ${store.users.length} (1 demo)                ║
  ╚══════════════════════════════════════════╝
  `)
})
