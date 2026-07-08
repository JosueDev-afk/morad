import { create } from 'zustand'

interface ToastItem {
  id: string
  title: string
  description?: string
  variant?: 'default' | 'destructive'
}

interface ToastState {
  toasts: ToastItem[]
  toast: (item: Omit<ToastItem, 'id'>) => void
  dismiss: (id: string) => void
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  toast: ({ title, description, variant = 'default' }) => {
    const id = crypto.randomUUID()
    set((s) => ({ toasts: [...s.toasts, { id, title, description, variant }] }))
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
    }, 4000)
  },
  dismiss: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

// Convenience helper usable outside React components
export const toast = (item: Omit<ToastItem, 'id'>) =>
  useToastStore.getState().toast(item)
