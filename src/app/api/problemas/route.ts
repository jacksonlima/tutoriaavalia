import { auth }                from '@/lib/auth'
import { ativarEncontroSchema } from '@/lib/validations'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// PATCH /api/problemas — ativa ou desativa qualquer tipo de encontro
// Regra de segurança: SOMENTE o tutor TITULAR pode habilitar/desabilitar encontros.
// Co-tutores têm acesso somente leitura/avaliação — nunca podem controlar o toggle.
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

  // Busca o problema para verificar o titular do módulo
  const problema = await prisma.problema.findUnique({
    where:   { id: problemaId },
    include: { modulo: { select: { tutorId: true } } },
  })

  if (!problema) {
    return NextResponse.json({ error: 'Problema não encontrado' }, { status: 404 })
  }

  // Somente o TITULAR pode habilitar/desabilitar encontros
  // Co-tutor fica bloqueado aqui mesmo que esteja autenticado como TUTOR
  if (problema.modulo.tutorId !== session?.user?.id) {
    return NextResponse.json(
      { error: 'Somente o tutor titular pode habilitar ou desabilitar encontros.' },
      { status: 403 },
    )
  }

  // Mapeia tipo de encontro para o campo correto no banco
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
