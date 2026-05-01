import { auth }                from '@/lib/auth'
import { ativarEncontroSchema } from '@/lib/validations'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// PATCH /api/problemas — ativa ou desativa qualquer tipo de encontro
//
// Regras:
//   Titular  → pode togglear qualquer encontro de qualquer problema do módulo
//   Co-tutor → pode togglear APENAS os encontros que lhe foram concedidos em CoTutorPermissao
//   Outros   → 403
export async function PATCH(req: NextRequest) {
  const { prisma } = await import('@/lib/db')
  const session = await auth()
  if (!session || session?.user?.papel !== 'TUTOR') {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const body   = await req.json()
  const result = ativarEncontroSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 })
  }

  const { problemaId, tipoEncontro, ativo } = result.data

  const problema = await prisma.problema.findUnique({
    where:   { id: problemaId },
    include: { modulo: { select: { id: true, tutorId: true } } },
  })

  if (!problema) {
    return NextResponse.json({ error: 'Problema não encontrado' }, { status: 404 })
  }

  const userId    = session?.user?.id!
  const eTitular  = problema.modulo.tutorId === userId

  if (!eTitular) {
    // Co-tutor: verifica se tem permissão EXATA para este problema + tipoEncontro
    const permissao = await prisma.coTutorPermissao.findFirst({
      where: {
        tutorId:      userId,
        moduloId:     problema.modulo.id,
        problemaId:   problemaId,
        tipoEncontro: tipoEncontro as any,
      },
    })

    if (!permissao) {
      return NextResponse.json(
        { error: 'Você não tem permissão para controlar este encontro.' },
        { status: 403 },
      )
    }
  }

  const campoAtivo: Record<string, string> = {
    ABERTURA:     'aberturaAtiva',
    FECHAMENTO:   'fechamentoAtivo',
    FECHAMENTO_A: 'fechamentoAAtivo',
    FECHAMENTO_B: 'fechamentoBAtivo',
  }

  const campo = campoAtivo[tipoEncontro]
  if (!campo) {
    return NextResponse.json({ error: 'Tipo de encontro inválido' }, { status: 400 })
  }

  const atualizado = await prisma.problema.update({
    where: { id: problemaId },
    data:  { [campo]: ativo },
  })

  return NextResponse.json(atualizado)
}
