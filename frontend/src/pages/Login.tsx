import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { login as loginApi, extractUser } from '@/api/auth'
import { useAuthStore } from '@/store/authStore'
import { toast } from '@/store/toastStore'

const schema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'La contraseña es requerida'),
})

type FormValues = z.infer<typeof schema>

const ROLE_HOME: Record<string, string> = {
  patient: '/appointments',
  therapist: '/therapist/agenda',
  admin: '/admin/slots',
}

export default function Login() {
  const navigate = useNavigate()
  const storeLogin = useAuthStore((s) => s.login)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function onSubmit(values: FormValues) {
    try {
      const tokens = await loginApi(values)
      const user = extractUser(tokens.access_token)
      storeLogin(user, tokens.access_token, tokens.refresh_token)
      navigate(ROLE_HOME[user.role] ?? '/')
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail
      toast({
        title: 'Error al iniciar sesión',
        description: detail ?? 'Ocurrió un error, intenta de nuevo.',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-4">
          <img src="/logo.png" alt="MORAD Fisioterapia" className="h-36 w-auto mx-auto" />
          <h1 className="text-2xl font-semibold text-morad-gray">Iniciar sesión</h1>
          <p className="text-sm text-morad-gray/60 mt-1">
            ¿No tienes cuenta?{' '}
            <Link to="/register" className="text-morad-turquoise hover:underline">
              Regístrate
            </Link>
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1">
            <label htmlFor="email" className="text-sm text-morad-gray">
              Email
            </label>
            <Input
              id="email"
              type="email"
              placeholder="juan@ejemplo.com"
              aria-invalid={!!errors.email}
              {...register('email')}
            />
            {errors.email && (
              <p role="alert" className="text-xs text-red-500">
                {errors.email.message}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label htmlFor="password" className="text-sm text-morad-gray">
              Contraseña
            </label>
            <Input
              id="password"
              type="password"
              placeholder="Tu contraseña"
              aria-invalid={!!errors.password}
              {...register('password')}
            />
            {errors.password && (
              <p role="alert" className="text-xs text-red-500">
                {errors.password.message}
              </p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Entrando...' : 'Iniciar sesión'}
          </Button>
        </form>
      </div>
    </div>
  )
}
