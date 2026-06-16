const API_CONFIG = {
  BASE_URL: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000',
  VERSION: 'v1',
  ENDPOINTS: {
    AUTH_LOGIN: '/api/v1/auth/login',
    AUTH_REGISTER: '/api/v1/auth/register',
    AUTH_ME: '/api/v1/auth/me',
    SAMPLES: '/api/v1/samples',
    SAMPLE_PHOTO: (id: string) => `/api/v1/samples/${id}/photo`,
    SAMPLE_NEARBY: '/api/v1/samples/nearby',
    SYNC: '/api/v1/sync',
    SYNC_PENDING: '/api/v1/sync/pending',
    SATELLITE_ANALYZE: '/api/v1/satellite/analyze',
    REPORTS: '/api/v1/reports',
    REPORT_GENERATE: '/api/v1/reports/generate',
  },
}

export function getApiUrl(endpoint: string): string {
  return `${API_CONFIG.BASE_URL}${endpoint}`
}

export function getAuthHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return headers
}

export default API_CONFIG
