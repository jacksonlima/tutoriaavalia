/**
 * Notas da Tutoria v2 — API: Canal de Exercício de Direitos LGPD
 * Autor: Jackson Lima — CESUPA
 *
 * POST /api/direitos
 * Recebe solicitações de exercício de direitos (LGPD Art. 18°).
 * Registra no banco e envia notificação ao DPO.
 *
 * CORREÇÕES CodeQL:
 *   js/polynomial-redos: regex de email substituída por z.string().email()
 *   js/log-injection (×2): dados do usuário sanitizados antes de logar
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const TIPOS_VALIDOS = ['acesso', 'correcao', 'exclusao', 'portabilidade', 'oposicao', 'outro']

// ── Helper: remove quebras de linha de dados antes de logar ───────────────────
// Fix js/log-injection (CWE-117): impede que usuário forge entradas de log
// injetando \n ou \r para criar linhas falsas no log de auditoria.
const sanitizeLog = (s: unknown): string =>
  String(s ?? '').replace(/[\r\n\t]/g, ' ').trim()

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { nome, email, tipo, descricao } = body

    if (!nome || !email || !tipo || !descricao) {
      return NextResponse.json(
        { error: 'Campos obrigatórios ausentes' },
        { status: 400 }
      )
    }

    if (!TIPOS_VALIDOS.includes(tipo)) {
      return NextResponse.json(
        { error: 'Tipo de solicitação inválido' },
        { status: 400 }
      )
    }

    // Fix js/polynomial-redos: substituí regex manual vulnerável a ReDoS
    // pela validação do Zod (z.string().email()) que usa algoritmo linear.
    // Regex anterior: /^[^\@]+@[^\@]+\.[^\@]+$/  ← quadratic backtracking
    const emailResult = z.string().email().safeParse(email)
    if (!emailResult.success) {
      return NextResponse.json(
        { error: 'E-mail inválido' },
        { status: 400 }
      )
    }

    const protocolo = `LGPD-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`

    // Fix js/log-injection: sanitizeLog() remove \r e \n de todos os campos
    // fornecidos pelo usuário antes de incluí-los nas entradas de log.
    console.log(
      `[LGPD][DIREITOS] ${protocolo} | tipo=${sanitizeLog(tipo)} | nome=${sanitizeLog(nome)} | email=${sanitizeLog(email)} | ${new Date().toISOString()}`
    )
    console.log(`[LGPD][DIREITOS] Descrição: ${sanitizeLog(descricao.slice(0, 200))}`)

    // Em produção, aqui enviaria e-mail para jackson.lima@prof.cesupa.br
    // usando Resend, SendGrid, ou Nodemailer configurado com SMTP institucional
    // Exemplo com Resend:
    // await resend.emails.send({
    //   from: 'noreply@notasdatutoria.com.br',
    //   to:   'jackson.lima@prof.cesupa.br',
    //   subject: `[LGPD] ${tipo} — ${protocolo}`,
    //   text: `Nome: ${nome}\nEmail: ${email}\nTipo: ${tipo}\nDescrição: ${descricao}`,
    // })

    return NextResponse.json({ sucesso: true, protocolo })

  } catch (error: any) {
    console.error('[api/direitos]', error?.message ?? error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
