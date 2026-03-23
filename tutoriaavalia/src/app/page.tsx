import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function Home() {
  const session = await auth()

  if (!session) redirect('/login')

  if (session.user.papel === 'TUTOR') redirect('/professor/dashboard')

  redirect('/aluno/dashboard')
}
