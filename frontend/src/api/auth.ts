import { apiClient } from './client'
import type { AuthUser } from '@/store/authStore'

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface RegisterPayload {
  first_name: string
  last_name: string
  email: string
  password: string
  password_confirm: string
}

export interface LoginPayload {
  email: string
  password: string
}

// Decode the JWT payload (no verification — server already verified)
function parseJwtPayload(token: string): Record<string, unknown> {
  const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
  return JSON.parse(atob(base64))
}

export function extractUser(token: string): AuthUser {
  const payload = parseJwtPayload(token)
  return {
    id: payload.sub as string,
    email: payload.email as string,
    role: payload.role as AuthUser['role'],
    first_name: payload.first_name as string,
    last_name: payload.last_name as string,
  }
}

export async function register(data: RegisterPayload): Promise<TokenResponse> {
  const res = await apiClient.post<TokenResponse>('/api/auth/register', data)
  return res.data
}

export async function login(data: LoginPayload): Promise<TokenResponse> {
  const res = await apiClient.post<TokenResponse>('/api/auth/login', data)
  return res.data
}

export async function logoutApi(refreshToken: string): Promise<void> {
  await apiClient.post('/api/auth/logout', { refresh_token: refreshToken })
}
