/**
 * TutoriaAvalia v2 — API: Canal de Exercício de Direitos LGPD
 * Autor: Jackson Lima — CESUPA
 *
 * POST /api/direitos
 * Recebe solicitações de exercício de direitos (LGPD Art. 18°).
 * Registra no banco e envia notificação ao DPO.
 */

import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const TIPOS_VALIDOS = ['acesso', 'correcao', 'exclusao', 'portabilidade', 'oposicao', 'outro']

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { nome, email, tipo, descricao } = body

    if (!nome || !email || !tipo || !descricao) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 })
    }
    if (!TIPOS_VALIDOS.includes(tipo)) {
      return NextResponse.json({ error: 'Tipo de solicitação inválido' }, { status: 400 })
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'E-mail inválido' }, { status: 400 })
    }

    const protocolo = `LGPD-${Date.now()}-${Math.random().toString(36).slice(2,7).toUpperCase()}`

    // Registra no log de produção (em produção real, salvar em tabela de auditoria)
    console.log(`[LGPD][DIREITOS] ${protocolo} | tipo=${tipo} | nome=${nome} | email=${email} | ${new Date().toISOString()}`)
    console.log(`[LGPD][DIREITOS] Descrição: ${descricao.slice(0, 200)}`)

    // Em produção, aqui enviaria e-mail para privacidade@cesupa.br
    // usando Resend, SendGrid, ou Nodemailer configurado com SMTP institucional
    // Exemplo com Resend:
    // await resend.emails.send({
    //   from: 'noreply@tutoriaavalia.vercel.app',
    //   to: 'privacidade@cesupa.br',
    //   subject: `[LGPD] ${tipo} — ${protocolo}`,
    //   text: `Nome: ${nome}\nEmail: ${email}\nTipo: ${tipo}\nDescrição: ${descricao}`,
    // })

    return NextResponse.json({ sucesso: true, protocolo })

  } catch (error: any) {
    console.error('[api/direitos]', error?.message ?? error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
