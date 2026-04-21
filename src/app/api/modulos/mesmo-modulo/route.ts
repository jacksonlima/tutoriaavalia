import { auth } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/modulos/mesmo-modulo?moduloId=X
// Retorna todas as tutorias do MESMO módulo/disciplina (mesmo nome+turma+ano)
// excluindo o módulo do professor que está fazendo a consulta.
// Usado na tela de realocação: Prof Jackson só vê as outras tutorias
// do mesmo módulo (Alexandre, Ciane, Ismari, Paloma, Rosana, Valdenira, Valéria)
export async function GET(req: NextRequest) {
  const { prisma } = await import('@/lib/db')
  const session = await auth()
  if (!session || session?.user?.papel !== 'TUTOR')
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const moduloId = new URL(req.url).searchParams.get('moduloId')
  if (!moduloId)
    return NextResponse.json({ error: 'moduloId obrigatório' }, { status: 400 })

  // Busca o módulo de referência
  const moduloRef = await prisma.modulo.findUnique({
    where: { id: moduloId },
  })
  if (!moduloRef || moduloRef.tutorId !== session?.user?.id)
    return NextResponse.json({ error: 'Módulo não encontrado' }, { status: 404 })

  // Busca todos os módulos com o mesmo nome + turma + ano (excluindo o próprio)
  const modulosPares = await prisma.modulo.findMany({
    where: {
      nome:      moduloRef.nome,
      turma:     moduloRef.turma,
      ano:       moduloRef.ano,
      arquivado: false,
      ativo:     true,
      id:        { not: moduloId },  // exclui o próprio módulo
    },
    include: {
      tutor:     { select: { id: true, nome: true, email: true } },
      problemas: { orderBy: { numero: 'asc' } },
    },
    orderBy: { tutoria: 'asc' },
  })

  return NextResponse.json(modulosPares)
}
