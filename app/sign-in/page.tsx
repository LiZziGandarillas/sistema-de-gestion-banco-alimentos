import { redirect } from 'next/navigation'
import { AuthForm } from '@/components/auth-form'
import { getCurrentVolunteer } from '@/lib/session'

export default async function SignInPage() {
  const v = await getCurrentVolunteer()
  if (v) redirect(v.active ? '/' : '/pendiente')
  return <AuthForm mode="sign-in" />
}
