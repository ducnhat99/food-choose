import { useBodyScrollLock } from '../hooks/useBodyScrollLock'

interface LoadingModalProps {
  message: string
}

/** A blocking overlay with a spinner, for actions with a real wait (an AI call, a multi-step search). */
export function LoadingModal({ message }: LoadingModalProps) {
  useBodyScrollLock(true)

  return (
    <div className="fixed inset-0 z-50 flex h-dvh w-dvw items-center justify-center bg-black/40 p-4">
      <div className="flex flex-col items-center gap-4 rounded-lg bg-white px-8 py-6 shadow-lg">
        <div
          className="h-10 w-10 animate-spin rounded-full border-4 border-teal-100 border-t-teal-600"
          role="status"
          aria-label={message}
        />
        <p className="text-sm font-medium text-neutral-700">{message}</p>
      </div>
    </div>
  )
}
