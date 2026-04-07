import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { cookies } from 'next/headers'

export default async function MobileCallbackPage() {
  const session = await auth()
  const cookieStore = await cookies()

  const sessionToken =
    cookieStore.get('authjs.session-token')?.value ??
    cookieStore.get('next-auth.session-token')?.value ??
    ''

  if (!session?.user || !sessionToken) {
    redirect('tutoriaavalia://auth/callback?error=unauthorized')
  }

  const token = encodeURIComponent(sessionToken)
  redirect(`tutoriaavalia://auth/callback?token=${token}`)
}
