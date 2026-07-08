import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { register as registerApi, extractUser } from '@/api/auth'
import { useAuthStore } from '@/store/authStore'
import { toast } from '@/store/toastStore'

const schema = z
  .object({
    first_name: z.string().min(1, 'El nombre es requerido'),
    last_name: z.string().min(1, 'El apellido es requerido'),
    email: z.string().email('Email inválido'),
    password: z.string().min(8, 'Mínimo 8 caracteres'),
    password_confirm: z.string().min(1, 'Confirma tu contraseña'),
  })
  .refine((d) => d.password === d.password_confirm, {
    message: 'Las contraseñas no coinciden',
    path: ['password_confirm'],
  })

type FormValues = z.infer<typeof schema>

export default function Register() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function onSubmit(values: FormValues) {
    try {
      const tokens = await registerApi(values)
      const user = extractUser(tokens.access_token)
      login(user, tokens.access_token, tokens.refresh_token)
      navigate('/appointments')
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail
      toast({
        title: 'Error al registrarse',
        description: detail ?? 'Ocurrió un error, intenta de nuevo.',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-4">
          <img src="/logo.png" alt="MORAD Fisioterapia" className="h-36 w-auto mx-auto" />
          <h1 className="text-2xl font-semibold text-morad-gray">Crear cuenta</h1>
          <p className="text-sm text-morad-gray/60 mt-1">
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" className="text-morad-turquoise hover:underline">
              Inicia sesión
            </Link>
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="first_name" className="text-sm text-morad-gray">
                Nombre
              </label>
              <Input
                id="first_name"
                placeholder="Juan"
                aria-invalid={!!errors.first_name}
                {...register('first_name')}
              />
              {errors.first_name && (
                <p role="alert" className="text-xs text-red-500">
                  {errors.first_name.message}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <label htmlFor="last_name" className="text-sm text-morad-gray">
                Apellido
              </label>
              <Input
                id="last_name"
                placeholder="Pérez"
                aria-invalid={!!errors.last_name}
                {...register('last_name')}
              />
              {errors.last_name && (
                <p role="alert" className="text-xs text-red-500">
                  {errors.last_name.message}
                </p>
              )}
            </div>
          </div>

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
              placeholder="Mínimo 8 caracteres"
              aria-invalid={!!errors.password}
              {...register('password')}
            />
            {errors.password && (
              <p role="alert" className="text-xs text-red-500">
                {errors.password.message}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label htmlFor="password_confirm" className="text-sm text-morad-gray">
              Confirmar contraseña
            </label>
            <Input
              id="password_confirm"
              type="password"
              placeholder="Repite tu contraseña"
              aria-invalid={!!errors.password_confirm}
              {...register('password_confirm')}
            />
            {errors.password_confirm && (
              <p role="alert" className="text-xs text-red-500">
                {errors.password_confirm.message}
              </p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Creando cuenta...' : 'Crear cuenta'}
          </Button>
        </form>
      </div>
    </div>
  )
}
