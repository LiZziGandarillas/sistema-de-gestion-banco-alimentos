import { AppNav } from '@/components/app-nav'
import { requireVolunteerPage } from '@/lib/session'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const v = await requireVolunteerPage()
  return (
    <div className="min-h-dvh">
      <AppNav name={v.name} isCoordinator={v.role === 'coordinador'} />
      <main className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">{children}</main>
    </div>
  )
}
