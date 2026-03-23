'use client'

import { useState, useCallback } from 'react'

type Toast = { id: string; title: string; description?: string; variant?: 'default' | 'destructive' }
type ToastInput = Omit<Toast, 'id'>
type ToastFn = (t: ToastInput) => void

let toastFn: ToastFn | null = null

export function useToast() {
  const toast: ToastFn = useCallback((t: ToastInput) => {
    if (toastFn) toastFn(t)
  }, [])
  return { toast }
}

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([])

  toastFn = useCallback((t: ToastInput) => {
    const id = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev, { ...t, id }])
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 3500)
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm w-full px-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`rounded-xl px-4 py-3 shadow-lg text-sm font-medium flex items-start gap-2 ${
            t.variant === 'destructive'
              ? 'bg-red-600 text-white'
              : 'bg-[#1F4E79] text-white'
          }`}
        >
          <span className="flex-1">
            <span className="block font-semibold">{t.title}</span>
            {t.description && (
              <span className="block text-xs opacity-80 mt-0.5">{t.description}</span>
            )}
          </span>
          <button
            onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
            className="opacity-60 hover:opacity-100 text-lg leading-none mt-0.5"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
