import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const session = await auth()

  if (!session) redirect('/login')

  // Protege contra session.user sem papel (ex: durante testes E2E ou cold start)
  if (!session.user) redirect('/login')

  if (session.user.papel === 'TUTOR') redirect('/professor/dashboard')

  redirect('/aluno/dashboard')
}
