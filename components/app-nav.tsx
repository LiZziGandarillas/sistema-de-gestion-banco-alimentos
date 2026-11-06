'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { BarChart3, Boxes, HandHeart, Home, LogOut, PackagePlus, Settings, Users } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { cn } from '@/lib/utils'

const links = [
  { href: '/', label: 'Inicio', Icon: Home },
  { href: '/donaciones/nueva', label: 'Donación', Icon: PackagePlus },
  { href: '/inventario', label: 'Inventario', Icon: Boxes },
  { href: '/entregas/nueva', label: 'Entrega', Icon: HandHeart },
  { href: '/familias', label: 'Familias', Icon: Users },
  { href: '/resumen', label: 'Resumen', Icon: BarChart3 },
]

export function AppNav({ name, isCoordinator }: { name: string; isCoordinator: boolean }) {
  const pathname = usePathname()
  const router = useRouter()
  const [leaving, setLeaving] = useState(false)
  const items = isCoordinator ? [...links, { href: '/ajustes', label: 'Ajustes', Icon: Settings }] : links

  async function signOut() {
    setLeaving(true)
    await authClient.signOut()
    router.push('/sign-in')
    router.refresh()
  }

  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="flex min-h-12 items-center gap-2 text-xl font-bold">
            <span className="flex size-12 items-center justify-center rounded-lg bg-primary text-primary-foreground" aria-hidden="true">
              <HandHeart className="size-6" />
            </span>
            Banco de Alimentos
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-base text-muted-foreground sm:inline">{name}</span>
            <button
              type="button"
              onClick={signOut}
              disabled={leaving}
              className="inline-flex h-12 items-center gap-2 rounded-lg border-2 border-border px-3 text-base font-bold hover:bg-muted disabled:opacity-60"
            >
              <LogOut className="size-5" aria-hidden="true" />
              Salir
            </button>
          </div>
        </div>
        <nav aria-label="Secciones">
          <ul className="flex gap-1 overflow-x-auto pb-1">
            {items.map(({ href, label, Icon }) => {
              const active = href === '/' ? pathname === '/' : pathname.startsWith(href.split('/').slice(0, 2).join('/'))
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex h-12 items-center gap-2 whitespace-nowrap rounded-lg px-3 text-base font-bold',
                      active ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted',
                    )}
                  >
                    <Icon className="size-5" aria-hidden="true" />
                    {label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      </div>
    </header>
  )
}
