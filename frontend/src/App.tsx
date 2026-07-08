import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from '@/components/ui/toaster'
import ProtectedRoute from '@/components/ProtectedRoute'
import Login from '@/pages/Login'
import Register from '@/pages/Register'
import MyAppointments from '@/pages/MyAppointments'
import BookAppointment from '@/pages/BookAppointment'
import TherapistAgenda from '@/pages/TherapistAgenda'
import AdminSlots from '@/pages/AdminSlots'
import AdminReports from '@/pages/AdminReports'
import Layout from '@/components/Layout'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
})

// App routes configuration

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected Area Layout */}
          <Route element={<Layout />}>
            {/* Patient routes */}
            <Route element={<ProtectedRoute roles={['patient']} />}>
              <Route path="/appointments" element={<MyAppointments />} />
              <Route path="/book" element={<BookAppointment />} />
            </Route>

            {/* Therapist routes */}
            <Route element={<ProtectedRoute roles={['therapist']} />}>
              <Route path="/therapist/agenda" element={<TherapistAgenda />} />
            </Route>

            {/* Admin routes */}
            <Route element={<ProtectedRoute roles={['admin']} />}>
              <Route path="/admin/slots" element={<AdminSlots />} />
              <Route path="/admin/reports" element={<AdminReports />} />
              <Route path="/admin/metrics" element={<AdminReports />} />
            </Route>
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster />
    </QueryClientProvider>
  )
}
