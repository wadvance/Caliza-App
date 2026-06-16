const API = (() => {
  const BASE = '/api/v1'
  let token = localStorage.getItem('admin_token') || null

  function headers() {
    const h = { 'Content-Type': 'application/json' }
    if (token) h['Authorization'] = `Bearer ${token}`
    return h
  }

  async function request(method, path, body) {
    const opts = { method, headers: headers() }
    if (body) opts.body = JSON.stringify(body)
    const res = await fetch(`${BASE}${path}`, opts)
    if (res.status === 401) { token = null; localStorage.removeItem('admin_token'); render() }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }))
      throw new Error(err.detail || 'Error del servidor')
    }
    return res.json()
  }

  return {
    setToken: (t) => { token = t; localStorage.setItem('admin_token', t) },
    getToken: () => token,
    clearToken: () => { token = null; localStorage.removeItem('admin_token') },
    hasToken: () => !!token,
    login: (email, password) => request('POST', '/auth/login', { email, password }),
    register: (email, password, full_name, role) => request('POST', '/auth/register', { email, password, full_name, role }),
    me: () => request('GET', '/auth/me'),
    getSamples: (params) => request('GET', '/samples' + (params ? '?' + new URLSearchParams(params) : '')),
    getSample: (id) => request('GET', `/samples/${id}`),
    createSample: (data) => request('POST', '/samples', data),
    updateSampleStatus: (id, status) => request('PATCH', `/samples/${id}/status`, { status }, true),
    getNearby: (lat, lng, radius) => request('GET', `/samples/nearby?latitude=${lat}&longitude=${lng}&radius_km=${radius}`),
    sync: (data) => request('POST', '/sync', data),
    pendingSync: () => request('GET', '/sync/pending'),
    analyzeSatellite: (data) => request('POST', '/satellite/analyze', data),
    getReports: () => request('GET', '/reports'),
    generateReport: () => request('POST', '/reports/generate'),
  }
})()

const STATE = {
  view: 'dashboard',
  samples: [],
  users: [],
  reports: [],
  pending: [],
  selectedSample: null,
  loading: false,
  user: null,
}

// --- Helpers ---
function $(sel) { return document.querySelector(sel) }
function el(tag, attrs = {}, children = []) {
  const e = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'className') e.className = v
    else if (k === 'innerHTML') e.innerHTML = v
    else if (k.startsWith('on')) e.addEventListener(k.slice(2).toLowerCase(), v)
    else e.setAttribute(k, v)
  }
  for (const c of children) { if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c) }
  return e
}
function badge(status) {
  const m = { validado: 'badge-success', descartado: 'badge-danger', pendiente: 'badge-warning', success: 'badge-success', partial: 'badge-warning', alta: 'badge-success', media: 'badge-warning', baja: 'badge-danger' }
  return el('span', { className: `badge ${m[status] || 'badge-info'}` }, [status])
}
function fmtDate(ts) {
  if (!ts) return '—'
  const d = new Date(ts)
  return d.toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function fmtNum(n, d = 1) { return Number(n || 0).toFixed(d) }

// --- API request with form-urlencoded fix ---
async function request(method, path, body, isForm) {
  const h = { 'Authorization': `Bearer ${API.getToken()}` }
  if (!isForm) h['Content-Type'] = 'application/json'
  const opts = { method, headers: h }
  if (body) opts.body = isForm ? new URLSearchParams(body) : JSON.stringify(body)
  const res = await fetch(`/api/v1${path}`, opts)
  if (res.status === 401) { API.clearToken(); render() }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Error del servidor')
  }
  return res.json()
}

// --- Views ---

function renderLogin() {
  const app = document.getElementById('app')
  app.innerHTML = ''
  const box = el('div', { className: 'login-page' }, [
    el('div', { className: 'login-box' }, [
      el('h1', {}, ['🗺️ GeoCaliza']),
      el('p', {}, ['Panel de administración']),
      el('div', { className: 'form-group' }, [
        el('label', {}, ['Correo electrónico']),
        el('input', { type: 'email', id: 'login-email', placeholder: 'admin@ejemplo.com', autocomplete: 'email' }),
      ]),
      el('div', { className: 'form-group' }, [
        el('label', {}, ['Contraseña']),
        el('input', { type: 'password', id: 'login-pass', placeholder: '••••••••', autocomplete: 'current-password' }),
      ]),
      el('div', { id: 'login-error', className: 'error' }),
      el('button', { className: 'btn btn-primary', id: 'login-btn', onclick: handleLogin }, ['Iniciar sesión']),
      el('p', { style: 'margin-top:12px;font-size:12px;color:var(--text-muted);text-align:center' }, ['Demo: admin@caliza.com / admin123']),
    ]),
  ])
  app.appendChild(box)
}

async function handleLogin() {
  const email = document.getElementById('login-email').value
  const pass = document.getElementById('login-pass').value
  const err = document.getElementById('login-error')
  const btn = document.getElementById('login-btn')
  if (!email || !pass) { err.textContent = 'Complete todos los campos'; err.style.display = 'block'; return }
  btn.disabled = true; btn.textContent = 'Ingresando...'
  try {
    const data = await API.login(email, pass)
    API.setToken(data.access_token)
    STATE.user = await API.me()
    render()
  } catch (e) {
    err.textContent = e.message; err.style.display = 'block'
    btn.disabled = false; btn.textContent = 'Iniciar sesión'
  }
}

function renderLayout(content) {
  const app = document.getElementById('app')
  app.innerHTML = ''
  const nav = [
    { id: 'dashboard', icon: '📊', label: 'Dashboard' },
    { id: 'samples', icon: '📋', label: 'Muestras' },
    { id: 'users', icon: '👥', label: 'Usuarios' },
    { id: 'sync', icon: '🔄', label: 'Sincronización' },
    { id: 'reports', icon: '📄', label: 'Reportes' },
    { id: 'satellite', icon: '🛰️', label: 'Satélite' },
  ]
  const sidebar = el('div', { className: 'sidebar' }, [
    el('h1', { innerHTML: '🗺️ <span>GeoCaliza</span>' }),
    el('div', { className: 'user-info', innerHTML: `<strong>${STATE.user?.full_name || ''}</strong><br>${STATE.user?.email || ''} — ${STATE.user?.role || ''}` }),
    ...nav.map(n => el('div', {
      className: `nav-item ${STATE.view === n.id ? 'active' : ''}`,
      onclick: () => { STATE.view = n.id; render() }
    }, [el('span', { className: 'nav-icon' }, [n.icon]), el('span', {}, [n.label])])),
    el('div', { className: 'nav-item', onclick: handleLogout, style: 'margin-top:auto;border-top:1px solid var(--border);padding-top:16px' }, ['🚪 <span>Cerrar sesión</span>']),
  ])
  const main = el('div', { className: 'main' }, [content])
  app.appendChild(sidebar)
  app.appendChild(main)
}

function handleLogout() {
  API.clearToken(); STATE.user = null; render()
}

function Loading() { return el('div', { className: 'loading' }, [el('div', { className: 'spinner' }), el('br'), 'Cargando...']) }

// --- Dashboard ---
async function renderDashboard() {
  renderLayout(el('div', {}, [
    el('h2', { style: 'margin-bottom:16px' }, ['📊 Dashboard']),
    el('div', { id: 'dash-stats', innerHTML: '<div class="loading"><div class="spinner"></div></div>' }),
    el('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px' }, [
      el('div', { className: 'card', id: 'dash-recent' }, [el('h3', {}, ['Últimas muestras']), el('div', { innerHTML: '<div class="loading"><div class="spinner"></div></div>' })]),
      el('div', { className: 'card', id: 'dash-pending' }, [el('h3', {}, ['Sincronización pendiente']), el('div', { innerHTML: '<div class="loading"><div class="spinner"></div></div>' })]),
    ]),
  ]))
  try {
    const [samples, pending] = await Promise.all([
      API.getSamples({ limit: '100' }).catch(() => []),
      API.pendingSync().catch(() => ({ pending: 0, samples: [] })),
    ])
    STATE.samples = Array.isArray(samples) ? samples : []
    STATE.pending = pending.samples || []
    const stats = [
      { value: STATE.samples.length, label: 'Total muestras' },
      { value: STATE.samples.filter(s => s.status === 'validado').length, label: 'Validadas' },
      { value: STATE.samples.filter(s => s.status === 'pendiente').length, label: 'Pendientes' },
      { value: pending.pending || 0, label: 'Por sincronizar' },
    ]
    document.getElementById('dash-stats').innerHTML = ''
    document.getElementById('dash-stats').appendChild(el('div', { className: 'stat-grid' },
      stats.map(s => el('div', { className: 'stat-card' }, [el('div', { className: 'value' }, [String(s.value)]), el('div', { className: 'label' }, [s.label])]))
    ))
    document.getElementById('dash-recent').innerHTML = '<h3>Últimas muestras</h3>' + renderSampleTable(STATE.samples.slice(0, 10))
    document.getElementById('dash-pending').innerHTML = '<h3>Pendientes de sincronizar</h3>' + (pending.pending > 0
      ? `<p style="color:var(--warning)">${pending.pending} muestras esperando sincronización</p>`
      : '<p style="color:var(--success)">✓ Todas las muestras sincronizadas</p>')
  } catch (e) { console.error(e) }
}

function renderSampleTable(samples) {
  if (!samples || samples.length === 0) return '<div class="empty">No hay muestras registradas</div>'
  const table = el('table', {},
    [el('thead', {}, [el('tr', {}, ['ID', 'Tipo', 'Coordenadas', 'Confianza', 'Estado', 'Fecha'].map(h => el('th', {}, [h])))]),
    el('tbody', {}, samples.map(s => el('tr', { style: 'cursor:pointer', onclick: () => { STATE.selectedSample = s; showSampleDetail(s) } }, [
      el('td', { style: 'font-family:monospace;font-size:11px' }, [s.id?.slice(0, 8) + '…']),
      el('td', { style: 'text-transform:capitalize' }, [s.estimated_rock_type || '—']),
      el('td', { style: 'font-size:11px' }, [`${fmtNum(s.latitude, 4)}, ${fmtNum(s.longitude, 4)}`]),
      el('td', {}, [s.confidence_level ? `${(s.confidence_level * 100).toFixed(0)}%` : '—']),
      el('td', {}, [badge(s.status)]),
      el('td', { style: 'font-size:11px;color:var(--text-muted)' }, [fmtDate(s.timestamp)]),
    ])))]),
  )
  return table.outerHTML
}

async function showSampleDetail(sample) {
  let full = sample
  try { full = await API.getSample(sample.id) } catch {}
  const overlay = el('div', { className: 'modal-overlay', onclick: (e) => { if (e.target === overlay) overlay.remove() } })
  const modal = el('div', { className: 'modal' }, [
    el('h2', {}, [`📍 Muestra ${full.id?.slice(0, 8)}…`]),
    el('div', { className: 'form-row' }, [
      el('div', {}, [el('label', {}, ['Tipo de roca']), el('div', { style: 'text-transform:capitalize;margin-bottom:12px' }, [full.estimated_rock_type || '—'])]),
      el('div', {}, [el('label', {}, ['Estado']), el('div', {}, [badge(full.status)])]),
    ]),
    el('div', { className: 'form-row' }, [
      el('div', {}, [el('label', {}, ['Latitud']), el('div', {}, [fmtNum(full.latitude, 6)])]),
      el('div', {}, [el('label', {}, ['Longitud']), el('div', {}, [fmtNum(full.longitude, 6)])]),
    ]),
    el('div', { className: 'form-row' }, [
      el('div', {}, [el('label', {}, ['Confianza']), el('div', {}, [full.confidence_level ? `${(full.confidence_level * 100).toFixed(0)}%` : '—'])]),
      el('div', {}, [el('label', {}, ['Operador']), el('div', {}, [full.operator_name || '—'])]),
    ]),
    el('div', {}, [el('label', {}, ['Notas']), el('div', { style: 'color:var(--text-sec);font-size:13px;margin-bottom:8px' }, [full.notes || '—'])]),
    el('div', { className: 'form-row' }, [
      el('div', {}, [el('label', {}, ['Reacción HCl']), el('div', { style: 'text-transform:capitalize' }, [full.acid_reaction || '—'])]),
      el('div', {}, [el('label', {}, ['Dureza']), el('div', {}, [full.hardness ? `${full.hardness} Mohs` : '—'])]),
    ]),
    full.stratification ? el('div', {}, [el('label', {}, ['Estratificación']), el('div', { style: 'margin-bottom:8px' }, [full.stratification])]) : null,
    el('div', { className: 'form-actions' }, [
      full.status !== 'validado' ? el('button', { className: 'btn btn-success btn-sm', onclick: async () => { try { await request('PATCH', `/samples/${full.id}/status`, { status: 'validado' }, true); overlay.remove(); render() } catch(e) { alert(e.message) } } }, ['✓ Validar']) : null,
      full.status !== 'descartado' ? el('button', { className: 'btn btn-danger btn-sm', onclick: async () => { try { await request('PATCH', `/samples/${full.id}/status`, { status: 'descartado' }, true); overlay.remove(); render() } catch(e) { alert(e.message) } } }, ['✗ Descartar']) : null,
      el('button', { className: 'btn btn-outline btn-sm', onclick: () => overlay.remove() }, ['Cerrar']),
    ]),
  ])
  overlay.appendChild(modal)
  document.body.appendChild(overlay)
}

// --- Samples view ---
async function renderSamples() {
  renderLayout(el('div', {}, [
    el('h2', { style: 'margin-bottom:16px' }, ['📋 Muestras']),
    el('div', { className: 'toolbar' }, [
      el('input', { type: 'text', id: 'sample-search', placeholder: 'Buscar por tipo, operador...', oninput: filterSamples }),
      el('select', { id: 'sample-status', onchange: filterSamples }, [
        el('option', { value: '' }, ['Todos los estados']),
        el('option', { value: 'pendiente' }, ['Pendiente']),
        el('option', { value: 'validado' }, ['Validado']),
        el('option', { value: 'descartado' }, ['Descartado']),
      ]),
      el('span', { className: 'spacer' }),
      el('span', { id: 'sample-count', style: 'color:var(--text-muted);font-size:13px' }),
    ]),
    el('div', { id: 'sample-list', innerHTML: '<div class="loading"><div class="spinner"></div></div>' }),
  ]))
  try {
    STATE.samples = await API.getSamples({ limit: '200' })
    renderSampleList()
  } catch (e) { document.getElementById('sample-list').innerHTML = `<div class="empty">Error: ${e.message}</div>` }
}

function filterSamples() {
  renderSampleList()
}

function renderSampleList() {
  const q = document.getElementById('sample-search')?.value?.toLowerCase() || ''
  const st = document.getElementById('sample-status')?.value || ''
  let filtered = STATE.samples.filter(s => {
    if (st && s.status !== st) return false
    if (q && !(s.estimated_rock_type || '').toLowerCase().includes(q) && !(s.operator_name || '').toLowerCase().includes(q) && !(s.id || '').toLowerCase().includes(q)) return false
    return true
  })
  document.getElementById('sample-count').textContent = `${filtered.length} muestras`
  document.getElementById('sample-list').innerHTML = renderSampleTable(filtered)
}

// --- Users view ---
async function renderUsers() {
  const content = el('div', {}, [
    el('h2', { style: 'margin-bottom:16px' }, ['👥 Usuarios']),
    el('button', { className: 'btn btn-primary', style: 'margin-bottom:16px', onclick: showCreateUser }, ['+ Nuevo usuario']),
    el('div', { id: 'user-list', innerHTML: '<div class="loading"><div class="spinner"></div></div>' }),
  ])
  renderLayout(content)
  try {
    const users = await API.getSamples().then(() => [])
    document.getElementById('user-list').innerHTML = '<div class="empty">La gestión de usuarios requiere privilegios de administrador. Inicia sesión con una cuenta admin.</div>'
    // For now show the current user
  } catch {}
}

function showCreateUser() {
  const overlay = el('div', { className: 'modal-overlay', onclick: (e) => { if (e.target === overlay) overlay.remove() } })
  const modal = el('div', { className: 'modal' }, [
    el('h2', {}, ['Crear usuario']),
    el('label', {}, ['Nombre completo']),
    el('input', { type: 'text', id: 'user-name', placeholder: 'Nombre del usuario' }),
    el('label', {}, ['Correo']),
    el('input', { type: 'email', id: 'user-email', placeholder: 'usuario@ejemplo.com' }),
    el('label', {}, ['Contraseña']),
    el('input', { type: 'password', id: 'user-pass', placeholder: '••••••••' }),
    el('label', {}, ['Rol']),
    el('select', { id: 'user-role' }, ['operator', 'supervisor', 'admin'].map(r => el('option', { value: r }, [r]))),
    el('div', { className: 'form-actions' }, [
      el('button', { className: 'btn btn-primary', onclick: async () => {
        const email = document.getElementById('user-email').value
        const pass = document.getElementById('user-pass').value
        const name = document.getElementById('user-name').value
        const role = document.getElementById('user-role').value
        if (!email || !pass) { alert('Correo y contraseña requeridos'); return }
        try {
          await API.register(email, pass, name, role)
          overlay.remove()
          render()
        } catch (e) { alert(e.message) }
      }}, ['Guardar']),
      el('button', { className: 'btn btn-outline', onclick: () => overlay.remove() }, ['Cancelar']),
    ]),
  ])
  overlay.appendChild(modal)
  document.body.appendChild(overlay)
}

// --- Sync view ---
async function renderSync() {
  renderLayout(el('div', {}, [
    el('h2', { style: 'margin-bottom:16px' }, ['🔄 Sincronización']),
    el('div', { className: 'toolbar' }, [
      el('button', { className: 'btn btn-primary', id: 'sync-btn', onclick: handleSync }, ['Forzar sincronización']),
      el('span', { id: 'sync-result', style: 'margin-left:12px;color:var(--text-muted);font-size:13px' }),
    ]),
    el('div', { id: 'sync-content', innerHTML: '<div class="loading"><div class="spinner"></div></div>' }),
  ]))
  try {
    const data = await API.pendingSync()
    STATE.pending = data.samples || []
    const totalSync = STATE.pending.length
    document.getElementById('sync-content').innerHTML = totalSync > 0
      ? `<div class="card"><h3>📦 ${totalSync} muestra(s) pendiente(s)</h3></div>` + renderSampleTable(STATE.pending)
      : '<div class="card" style="text-align:center;padding:40px"><span style="font-size:40px">✅</span><p style="color:var(--success);margin-top:8px">Todas las muestras están sincronizadas</p></div>'
  } catch (e) { document.getElementById('sync-content').innerHTML = `<div class="empty">Error: ${e.message}</div>` }
}

async function handleSync() {
  const btn = document.getElementById('sync-btn')
  const result = document.getElementById('sync-result')
  btn.disabled = true; btn.textContent = 'Sincronizando...'
  result.textContent = ''
  try {
    const data = await API.sync({ samples: STATE.pending.map(s => ({ id: s.id, latitude: s.latitude, longitude: s.longitude, estimated_rock_type: s.estimated_rock_type, confidence_level: s.confidence_level, status: s.status })) })
    result.textContent = `✓ ${data.synced || 0} sincronizadas`
    renderSync()
  } catch (e) { result.textContent = `✗ ${e.message}` }
  btn.disabled = false; btn.textContent = 'Forzar sincronización'
}

// --- Reports view ---
async function renderReports() {
  renderLayout(el('div', {}, [
    el('h2', { style: 'margin-bottom:16px' }, ['📄 Reportes']),
    el('div', { className: 'toolbar' },
      [el('button', { className: 'btn btn-primary', onclick: handleGenerateReport }, ['➕ Generar reporte']),
      el('span', { id: 'report-result', style: 'margin-left:12px;color:var(--text-muted);font-size:13px' })]),
    el('div', { id: 'report-list', innerHTML: '<div class="loading"><div class="spinner"></div></div>' }),
  ]))
  try {
    const reports = await API.getReports()
    const list = Array.isArray(reports) ? reports : []
    document.getElementById('report-list').innerHTML = list.length > 0
      ? renderReportTable(list)
      : '<div class="empty">No hay reportes generados. Crea uno desde el botón superior.</div>'
  } catch (e) { document.getElementById('report-list').innerHTML = `<div class="empty">Error: ${e.message}</div>` }
}

function renderReportTable(reports) {
  const table = el('table', {},
    [el('thead', {}, [el('tr', {}, ['Título', 'Autor', 'Muestras', 'Estado', 'Fecha'].map(h => el('th', {}, [h])))]),
    el('tbody', {}, reports.map(r => el('tr', { style: 'cursor:pointer' }, [
      el('td', {}, [r.title || 'Reporte']),
      el('td', {}, [r.author || '—']),
      el('td', {}, [String(r.sample_count || r.statistics?.totalSamples || 0)]),
      el('td', {}, [badge(r.status || r.statistics?.status || 'success')]),
      el('td', { style: 'font-size:11px;color:var(--text-muted)' }, [fmtDate(r.generated_at || r.generatedAt)]),
    ])))]),
  return table.outerHTML
}

async function handleGenerateReport() {
  const btn = event.target; const result = document.getElementById('report-result')
  btn.disabled = true; btn.textContent = 'Generando...'; result.textContent = ''
  try {
    const data = await API.generateReport()
    result.textContent = `✓ Reporte generado`
    renderReports()
  } catch (e) { result.textContent = `✗ ${e.message}` }
  btn.disabled = false; btn.textContent = '➕ Generar reporte'
}

// --- Satellite view ---
async function renderSatellite() {
  renderLayout(el('div', {}, [
    el('h2', { style: 'margin-bottom:16px' }, ['🛰️ Análisis satelital']),
    el('div', { className: 'card' }, [
      el('h3', {}, ['Analizar ubicación']),
      el('div', { className: 'form-row' }, [
        el('div', {}, [el('label', {}, ['Latitud']), el('input', { type: 'number', id: 'sat-lat', step: 'any', placeholder: '19.4326' })]),
        el('div', {}, [el('label', {}, ['Longitud']), el('input', { type: 'number', id: 'sat-lng', step: 'any', placeholder: '-99.1332' })]),
      ]),
      el('button', { className: 'btn btn-primary', onclick: handleAnalyzeSatellite }, ['Analizar']),
    ]),
    el('div', { id: 'sat-result' }),
  ]))
}

async function handleAnalyzeSatellite() {
  const lat = parseFloat(document.getElementById('sat-lat').value)
  const lng = parseFloat(document.getElementById('sat-lng').value)
  const result = document.getElementById('sat-result')
  if (isNaN(lat) || isNaN(lng)) { alert('Ingresa coordenadas válidas'); return }
  result.innerHTML = '<div class="loading"><div class="spinner"></div></div>'
  try {
    const data = await API.analyzeSatellite({ latitude: lat, longitude: lng })
    result.innerHTML = el('div', {}, [
      el('div', { className: 'stat-grid', style: 'margin-top:16px' },
        [
          { label: 'NDVI', value: fmtNum(data.ndvi, 3) },
          { label: 'Carbonate Index', value: fmtNum(data.carbonateIndex || data.carbonate_index, 3) },
          { label: 'Clay Ratio', value: fmtNum(data.clayRatio || data.clay_ratio, 3) },
          { label: 'Quartz Index', value: fmtNum(data.quartzIndex || data.quartz_index, 3) },
        ].map(s => el('div', { className: 'stat-card' }, [el('div', { className: 'value' }, [s.value]), el('div', { className: 'label' }, [s.label])]))
      ),
      data.zones?.length > 0 ? el('div', { className: 'card', style: 'margin-top:12px' }, [
        el('h3', {}, ['Zonas detectadas']),
        ...data.zones.map(z => el('div', { style: 'display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)' }, [
          el('span', {}, [`Zona ${z.name || z.probability || '—'}`]),
          el('span', {}, [badge(z.probability)]),
        ])),
      ]) : null,
    ]).outerHTML
  } catch (e) { result.innerHTML = `<div class="empty">Error: ${e.message}</div>` }
}

// --- Router ---
function render() {
  if (!API.hasToken()) { renderLogin(); return }
  switch (STATE.view) {
    case 'dashboard': renderDashboard(); break
    case 'samples': renderSamples(); break
    case 'users': renderUsers(); break
    case 'sync': renderSync(); break
    case 'reports': renderReports(); break
    case 'satellite': renderSatellite(); break
    default: renderDashboard()
  }
}

// --- Init ---
document.addEventListener('DOMContentLoaded', async () => {
  if (API.hasToken()) {
    try { STATE.user = await API.me() } catch { API.clearToken() }
  }
  render()
})
