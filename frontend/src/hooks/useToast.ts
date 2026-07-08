import { useState, useCallback } from 'react'

interface ToastItem {
  id: string
  title: string
  description?: string
  variant?: 'default' | 'destructive'
}

// Simple in-component toast state; wrap with a global store if needed later
export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const toast = useCallback(
    ({
      title,
      description,
      variant = 'default',
    }: Omit<ToastItem, 'id'>) => {
      const id = crypto.randomUUID()
      setToasts((prev) => [...prev, { id, title, description, variant }])
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, 4000)
    },
    [],
  )

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return { toasts, toast, dismiss }
}
