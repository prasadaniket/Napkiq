import axios from 'axios'
import { mockApi } from './mock-api'
import { getCookie } from './auth'

const realApi = axios.create({
  // Fail to the real production API, never a stray host. Set NEXT_PUBLIC_API_URL
  // per environment (e.g. http://localhost:8080/api in dev).
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'https://api.napkiq.in/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Attach JWT token to CMS requests
realApi.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = getCookie('cms_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

import { replaceStoneOven } from '../utils/normalize'
import { clearSession } from './auth'

// Redirect to login on 401
realApi.interceptors.response.use(
  (response) => {
    if (response.data) {
      response.data = replaceStoneOven(response.data)
    }
    return response
  },
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      const isCmsRoute = window.location.pathname.startsWith('/cms')
      if (isCmsRoute) {
        clearSession()
        window.location.href = '/cms/login'
      }
    }
    return Promise.reject(error)
  }
)

const isMock = process.env.NEXT_PUBLIC_MOCK_API === 'true'

export const api = (isMock ? mockApi : realApi) as typeof realApi
