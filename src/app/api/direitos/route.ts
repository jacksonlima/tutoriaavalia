/**
 * Notas da Tutoria v2 — API: Canal de Exercício de Direitos LGPD
 * Autor: Jackson Lima — CESUPA
 *
 * POST /api/direitos
 * Recebe solicitações de exercício de direitos (LGPD Art. 18°).
 *
 * CORREÇÕES CodeQL:
 *   js/polynomial-redos: regex de email → z.string().email()
 *   js/log-injection ×2: PII removida dos logs de console
 *     → nome, email e descrição NÃO são logados (são PII)
 *     → apenas protocolo, tipo (validado) e timestamp vão para o log
 *     → dados completos devem ser salvos em tabela de auditoria no banco
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const TIPOS_VALIDOS = ['acesso', 'correcao', 'exclusao', 'portabilidade', 'oposicao', 'outro'] as const

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

    // Valida tipo contra lista fixa (sem input do usuário no log)
    if (!TIPOS_VALIDOS.includes(tipo)) {
      return NextResponse.json(
        { error: 'Tipo de solicitação inválido' },
        { status: 400 }
      )
    }

    // Fix js/polynomial-redos: z.string().email() usa algoritmo linear
    // Regex anterior /^[^\@]+@[^\@]+\.[^\@]+$/ era vulnerável a ReDoS
    const emailResult = z.string().email().safeParse(email)
    if (!emailResult.success) {
      return NextResponse.json(
        { error: 'E-mail inválido' },
        { status: 400 }
      )
    }

    const protocolo = `LGPD-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`

    // Fix js/log-injection: PII (nome, email, descrição) NÃO é logada.
    // Apenas dados não controlados pelo usuário vão para o console:
    //   - protocolo: gerado pelo servidor (Math.random + Date.now)
    //   - tipo: validado contra TIPOS_VALIDOS (lista fixa)
    //   - timestamp: gerado pelo servidor
    // Dados completos devem ser salvos em tabela de auditoria no banco.
    console.log(`[LGPD][DIREITOS] protocolo=${protocolo} | tipo=${tipo} | ${new Date().toISOString()}`)

    // TODO (produção): salvar em tabela de auditoria LGPD no banco
    // await prisma.solicitacaoLgpd.create({
    //   data: { protocolo, tipo, nome, email, descricao, criadoEm: new Date() }
    // })

    // TODO (produção): notificar DPO por e-mail
    // await resend.emails.send({
    //   from:    'noreply@notasdatutoria.com.br',
    //   to:      'jackson.lima@prof.cesupa.br',
    //   subject: `[LGPD] ${tipo} — ${protocolo}`,
    //   text:    `Nome: ${nome}\nEmail: ${email}\nTipo: ${tipo}\nDescrição: ${descricao}`,
    // })

    return NextResponse.json({ sucesso: true, protocolo })

  } catch (error: any) {
    console.error('[api/direitos]', error?.message ?? error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
