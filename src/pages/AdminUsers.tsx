import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { useAdminUsers, useSetUserRole } from '../hooks/useAdminUsers'
import type { UserRole } from '../lib/api'

export function AdminUsers() {
  const { t } = useLanguage()
  const { user } = useAuth()
  const { data, isLoading, error } = useAdminUsers()
  const setRole = useSetUserRole()
  const [pendingId, setPendingId] = useState<string | null>(null)

  function handleToggle(userId: string, email: string, currentRole: UserRole) {
    const nextRole: UserRole = currentRole === 'admin' ? 'user' : 'admin'
    const message = t(nextRole === 'admin' ? 'admin.confirmMakeAdmin' : 'admin.confirmRemoveAdmin').replace(
      '{email}',
      email,
    )
    if (!window.confirm(message)) return

    setPendingId(userId)
    setRole.mutate({ userId, role: nextRole }, { onSettled: () => setPendingId(null) })
  }

  if (isLoading) return <p className="text-neutral-500">{t('admin.loading')}</p>
  if (error) return <p className="text-sm text-red-600">{(error as Error).message}</p>

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-neutral-900">{t('admin.title')}</h1>

      {setRole.error && <p className="text-sm text-red-600">{(setRole.error as Error).message}</p>}

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-600">
            <tr>
              <th className="px-4 py-2 font-medium">{t('admin.email')}</th>
              <th className="px-4 py-2 font-medium">{t('admin.role')}</th>
              <th className="px-4 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {data?.map((u) => (
              <tr key={u.id} className="border-b border-neutral-100 last:border-0">
                <td className="px-4 py-2 text-neutral-800">{u.email}</td>
                <td className="px-4 py-2 capitalize text-neutral-600">{u.role}</td>
                <td className="px-4 py-2 text-right">
                  {u.id === user?.id ? (
                    <span className="text-xs text-neutral-400">{t('admin.you')}</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleToggle(u.id, u.email, u.role)}
                      disabled={pendingId === u.id}
                      className={`rounded-md px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                        u.role === 'admin'
                          ? 'border border-red-200 text-red-700 hover:bg-red-50'
                          : 'border border-teal-200 text-teal-700 hover:bg-teal-50'
                      }`}
                    >
                      {u.role === 'admin' ? t('admin.makeUser') : t('admin.makeAdmin')}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
