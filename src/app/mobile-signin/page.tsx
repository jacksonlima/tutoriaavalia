import { signIn } from '@/lib/auth'

export default function MobileSigninPage() {
  async function doSignin() {
    'use server'
    await signIn('google', { redirectTo: '/api/auth/mobile-token' })
  }

  return (
    <html>
      <body style={{ margin: 0, fontFamily: 'system-ui', background: '#FAFAF8', display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 72, height: 72, borderRadius: 20, background: '#1A1A2E', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: '#fff', fontSize: 24, fontWeight: 700 }}>TA</div>
          <h2 style={{ color: '#1A1A2E', margin: '0 0 8px', fontSize: 24 }}>TutoriaAvalia</h2>
          <p style={{ color: '#888', margin: '0 0 32px', fontSize: 14 }}>CESUPA · Medicina · PBL</p>
          <form action={doSignin}>
            <button type="submit" style={{ background: '#1A1A2E', color: '#fff', border: 'none', padding: '14px 32px', borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
              Entrar com Google Institucional
            </button>
          </form>
          <p style={{ color: '#AAA', fontSize: 12, marginTop: 16 }}>Use seu e-mail @cesupa.br ou @aluno.cesupa.br</p>
        </div>
      </body>
    </html>
  )
}
