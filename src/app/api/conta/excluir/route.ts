/**
 * TutoriaAvalia v2 — API: Exclusão de Conta
 * Autor: Jackson Lima — CESUPA
 *
 * DELETE /api/conta/excluir
 *
 * Exclui a conta do usuário logado e todos os dados pessoais associados,
 * em conformidade com a LGPD Art. 18°, III e VI (direito à exclusão).
 *
 * Ordem de exclusão respeita as foreign keys do banco:
 *   1. Notificações
 *   2. Submissões
 *   3. Avaliações (como avaliador e como avaliado)
 *   4. Encontros especiais
 *   5. Co-tutor permissões (se professor)
 *   6. Co-tutores (se professor)
 *   7. Matrículas
 *   8. Usuário
 *
 * Módulos criados pelo tutor são ARQUIVADOS (não excluídos), pois
 * contêm dados de outros alunos que não podem ser removidos unilateralmente.
 */

import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function DELETE() {
  const { prisma } = await import('@/lib/db')
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const userId = session.user.id

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Notificações do usuário (como tutor)
      await tx.notificacao.deleteMany({ where: { tutorId: userId } })

      // 2. Submissões
      await tx.submissao.deleteMany({ where: { avaliadorId: userId } })

      // 3. Avaliações como avaliador (aluno que avaliou outros)
      await tx.avaliacaoAluno.deleteMany({ where: { avaliadorId: userId } })

      // 4. Avaliações recebidas (notas que outros atribuíram a este aluno)
      //    Mantemos as avaliações do tutor sobre este aluno (dados do módulo)
      //    mas removemos as interpares onde ele era o avaliado
      await tx.avaliacaoAluno.deleteMany({ where: { avaliadoId: userId } })

      // 5. Encontros especiais onde o aluno estava realocado
      await tx.encontroEspecial.deleteMany({ where: { alunoId: userId } })

      // 6. Co-tutor permissões (se era co-tutor em algum módulo)
      const coTutores = await tx.coTutor.findMany({
        where: { tutorId: userId },
        select: { id: true },
      })
      if (coTutores.length > 0) {
        const ids = coTutores.map((c) => c.id)
        await tx.coTutorPermissao.deleteMany({ where: { coTutorId: { in: ids } } })
        await tx.coTutor.deleteMany({ where: { tutorId: userId } })
      }

      // 7. Matrículas
      await tx.matricula.deleteMany({ where: { usuarioId: userId } })

      // 8. Se era professor titular, arquiva os módulos (não exclui — contêm dados de alunos)
      await tx.modulo.updateMany({
        where: { tutorId: userId },
        data:  { arquivado: true, ativo: false },
      })

      // 9. Registrar a solicitação de exclusão (para auditoria LGPD)
      // Usamos um log simples no console — em produção, salvar em tabela de auditoria
      console.log(`[LGPD] Conta excluída: userId=${userId} em ${new Date().toISOString()}`)

      // 10. Excluir o usuário
      await tx.usuario.delete({ where: { id: userId } })
    })

    return NextResponse.json({ sucesso: true })

  } catch (error: any) {
    console.error('[conta/excluir] Erro:', error?.message ?? error)
    return NextResponse.json(
      { error: 'Erro ao excluir conta. Tente novamente ou entre em contato com privacidade@cesupa.br' },
      { status: 500 }
    )
  }
}
