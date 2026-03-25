import { auth } from '@/lib/auth'
import { ativarEncontroSchema } from '@/lib/validations'
import { NextRequest, NextResponse } from 'next/server'


// Verifica se o usuário logado é titular OU co-tutor do módulo do problema
async function isTutorOuCoTutor(
  prisma: any,
  problemaId: string,
  userId: string
): Promise<boolean> {
  const problema = await prisma.problema.findUnique({
    where: { id: problemaId },
    include: { modulo: { include: { coTutores: true } } },
  })
  if (!problema) return false
  const modulo = problema.modulo
  if (modulo.tutorId === userId) return true
  return modulo.coTutores.some((ct: any) => ct.tutorId === userId)
}


export const dynamic = 'force-dynamic'

// PATCH /api/problemas — ativa ou desativa qualquer tipo de encontro
export async function PATCH(req: NextRequest) {
  const { prisma } = await import('@/lib/db')
  const session = await auth()
  if (!session || session.user.papel !== 'TUTOR') {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const body   = await req.json()
  const result = ativarEncontroSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 })
  }

  const { problemaId, tipoEncontro, ativo } = result.data

  // Verifica que o problema pertence a um módulo deste tutor
  // Verifica que o usuário é titular OU co-tutor do módulo
  const autorizado = await isTutorOuCoTutor(prisma, problemaId, session.user.id)
  if (!autorizado) {
    return NextResponse.json({ error: 'Problema não encontrado' }, { status: 404 })
  }

  // Mapeia tipo de encontro para o campo correto no banco
  const campoAtivo: Record<string, string> = {
    ABERTURA:    'aberturaAtiva',
    FECHAMENTO:  'fechamentoAtivo',
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
