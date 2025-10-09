// API utility functions for authentication
const API_BASE_URL = process.env.NEXT_PUBLIC_HOST_NAME || 'http://localhost:8000'

export interface ApiResponse<T = any> {
  data?: T
  error?: string
  validationErrors?: Record<string, string>
}

export interface ValidationError {
  field: string
  message: string
}

export interface ApiError {
  detail: string
  validation_errors?: ValidationError[]
}

/**
 * Make an API request with proper error handling
 */
export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const url = `${API_BASE_URL}${endpoint}`
    
    const defaultHeaders = {
      'Content-Type': 'application/json',
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    })

    const data = await response.json()

    if (!response.ok) {
      const error = data as ApiError
      
      // Transform validation errors to a more convenient format
      const validationErrors: Record<string, string> = {}
      if (error.validation_errors) {
        error.validation_errors.forEach(({ field, message }) => {
          validationErrors[field] = message
        })
      }

      return {
        error: error.detail || `HTTP ${response.status}`,
        validationErrors: Object.keys(validationErrors).length > 0 ? validationErrors : undefined,
      }
    }

    return { data }
  } catch (error) {
    console.error('API request failed:', error)
    return {
      error: error instanceof Error ? error.message : 'Network error occurred',
    }
  }
}

/**
 * Authentication API calls
 */
export const authApi = {
  register: async (userData: {
    email: string
    password: string
    first_name: string
    last_name: string
    username?: string
    phone_number?: string
  }) => {
    return apiRequest('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    })
  },

  login: async (credentials: {
    email_or_username: string
    password: string
  }) => {
    return apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    })
  },

  refreshToken: async (refreshToken: string) => {
    return apiRequest('/api/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
  },

  logout: async (refreshToken: string, accessToken: string) => {
    return apiRequest('/api/auth/logout', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
  },

  getCurrentUser: async (accessToken: string) => {
    return apiRequest('/api/auth/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
  },
}

/**
 * Analytics API calls
 */
export const analyticsApi = {
  getSummary: async (
    accessToken: string,
    params?: {
      start_date?: string
      end_date?: string
      branch_id?: string
      item_type_id?: string
    }
  ) => {
    const searchParams = new URLSearchParams()
    if (params?.start_date) searchParams.append('start_date', params.start_date)
    if (params?.end_date) searchParams.append('end_date', params.end_date)
    if (params?.branch_id) searchParams.append('branch_id', params.branch_id)
    if (params?.item_type_id) searchParams.append('item_type_id', params.item_type_id)
    
    const query = searchParams.toString()
    const endpoint = `/api/analytics/summary${query ? `?${query}` : ''}`
    
    return apiRequest(endpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
  },

  getExportData: async (
    accessToken: string,
    params?: {
      start_date?: string
      end_date?: string
      format?: string
      branch_id?: string
      item_type_id?: string
    }
  ) => {
    const searchParams = new URLSearchParams()
    if (params?.start_date) searchParams.append('start_date', params.start_date)
    if (params?.end_date) searchParams.append('end_date', params.end_date)
    if (params?.format) searchParams.append('format', params.format)
    if (params?.branch_id) searchParams.append('branch_id', params.branch_id)
    if (params?.item_type_id) searchParams.append('item_type_id', params.item_type_id)
    
    const query = searchParams.toString()
    const endpoint = `/api/analytics/export-data${query ? `?${query}` : ''}`
    
    return apiRequest(endpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
  },

  getPerformanceMetrics: async (
    accessToken: string,
    period: string = '30d'
  ) => {
    return apiRequest(`/api/analytics/performance-metrics?period=${period}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
  },
}

export default authApi