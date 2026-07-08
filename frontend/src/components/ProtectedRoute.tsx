import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore, type UserRole } from '@/store/authStore'

interface ProtectedRouteProps {
  /** Roles allowed to access this route. If omitted, any authenticated user can access. */
  roles?: UserRole[]
}

/**
 * Renders children (via <Outlet>) only when the user is authenticated
 * and, optionally, has one of the required roles.
 *
 * - Not authenticated → redirect to /login (req 10.3)
 * - Wrong role → redirect to /login (req 10.1, 10.2)
 */
export default function ProtectedRoute({ roles }: ProtectedRouteProps) {
  const { user, accessToken } = useAuthStore()

  if (!accessToken || !user) {
    return <Navigate to="/login" replace />
  }

  if (roles && !roles.includes(user.role)) {
    // Authenticated but wrong role — send back to login rather than showing a blank page
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
