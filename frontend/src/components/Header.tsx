import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { LogOut, User, Calendar, FileSpreadsheet, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export default function Header() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuthStore()

  if (!user) return null

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  // Active state checker
  const isActive = (path: string) => location.pathname === path

  const ROLE_LABELS: Record<string, string> = {
    patient: 'Paciente',
    therapist: 'Fisioterapeuta',
    admin: 'Administrador',
  }

  const ROLE_COLORS: Record<string, string> = {
    patient: 'bg-morad-turquoise/10 text-morad-turquoise border-morad-turquoise/20',
    therapist: 'bg-morad-purple/10 text-morad-purple border-morad-purple/20',
    admin: 'bg-morad-pink/10 text-morad-pink border-morad-pink/20',
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-250/70 bg-white/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand Logo */}
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center shrink-0">
            <img src="/logo.png" alt="MORAD Fisioterapia" className="h-10 w-auto" />
          </Link>

          {/* Nav Links based on Role */}
          <nav className="hidden md:flex items-center gap-1">
            {user.role === 'patient' && (
              <>
                <Link
                  to="/appointments"
                  className={cn(
                    'px-3 py-2 rounded-lg text-sm font-semibold transition-all',
                    isActive('/appointments')
                      ? 'bg-slate-100 text-morad-purple'
                      : 'text-slate-600 hover:text-morad-purple hover:bg-slate-50',
                  )}
                >
                  Mis Citas
                </Link>
                <Link
                  to="/book"
                  className={cn(
                    'px-3 py-2 rounded-lg text-sm font-semibold transition-all',
                    isActive('/book')
                      ? 'bg-slate-100 text-morad-purple'
                      : 'text-slate-600 hover:text-morad-purple hover:bg-slate-50',
                  )}
                >
                  Reservar Cita
                </Link>
              </>
            )}

            {user.role === 'therapist' && (
              <Link
                to="/therapist/agenda"
                className={cn(
                  'px-3 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5',
                  isActive('/therapist/agenda')
                    ? 'bg-slate-100 text-morad-purple'
                    : 'text-slate-600 hover:text-morad-purple hover:bg-slate-50',
                )}
              >
                <Calendar className="h-4 w-4" />
                Mi Agenda
              </Link>
            )}

            {user.role === 'admin' && (
              <>
                <Link
                  to="/admin/slots"
                  className={cn(
                    'px-3 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5',
                    isActive('/admin/slots')
                      ? 'bg-slate-100 text-morad-purple'
                      : 'text-slate-600 hover:text-morad-purple hover:bg-slate-50',
                  )}
                >
                  <Clock className="h-4 w-4" />
                  Horarios (Slots)
                </Link>
                <Link
                  to="/admin/reports"
                  className={cn(
                    'px-3 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5',
                    isActive('/admin/reports') || isActive('/admin/metrics')
                      ? 'bg-slate-100 text-morad-purple'
                      : 'text-slate-600 hover:text-morad-purple hover:bg-slate-50',
                  )}
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Reportes & Métricas
                </Link>
              </>
            )}
          </nav>
        </div>

        {/* User Profile & Actions */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 border-l border-slate-200 pl-4">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-sm font-bold text-slate-800">
                {user.first_name} {user.last_name}
              </span>
              <span className="text-[10px] text-slate-400 font-medium truncate max-w-40">
                {user.email}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'text-[10px] font-bold px-2 py-0.5 rounded-full border hidden sm:inline-block',
                  ROLE_COLORS[user.role],
                )}
              >
                {ROLE_LABELS[user.role]}
              </span>

              <div className="h-9 w-9 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center border border-slate-200">
                <User className="h-4 w-4" />
              </div>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className="text-slate-400 hover:text-red-500 hover:bg-red-50 h-9 w-9"
            title="Cerrar Sesión"
          >
            <LogOut className="h-4.5 w-4.5" />
          </Button>
        </div>
      </div>
    </header>
  )
}
