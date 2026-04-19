/**
 * TutoriaAvalia v2 — Política de Privacidade
 * Autor: Jackson Lima — CESUPA
 *
 * Página pública (sem autenticação) em conformidade com:
 *   - LGPD Art. 9°  (informação ao titular)
 *   - LGPD Art. 18° (direitos do titular)
 *   - LGPD Art. 41° (encarregado de dados)
 *
 * Acessível em: /privacidade
 */

import Link from 'next/link'

export const metadata = {
  title: 'Política de Privacidade — TutoriaAvalia',
  description: 'Política de Privacidade e proteção de dados do TutoriaAvalia conforme a LGPD.',
}

const ULTIMA_ATUALIZACAO = '18 de abril de 2026'
const EMAIL_DPO          = 'privacidade@cesupa.br'
const NOME_DPO           = 'Jackson Lima'
const INSTITUICAO        = 'CESUPA — Centro Universitário do Estado do Pará'
const ENDERECO           = 'Av. Alcindo Cacela, 287 — Umarizal, Belém-PA, CEP 66060-902'

export default function PoliticaPrivacidade() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Cabeçalho */}
      <header className="bg-[#1F4E79] text-white px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
              <span className="text-xs font-bold">TA</span>
            </div>
            <span className="font-semibold">TutoriaAvalia</span>
          </div>
          <Link href="/login" className="text-sm text-blue-200 hover:text-white transition-colors">
            ← Voltar ao login
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10">

        {/* Título */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#1F4E79] mb-2">
            Política de Privacidade
          </h1>
          <p className="text-sm text-gray-500">
            Última atualização: {ULTIMA_ATUALIZACAO}
          </p>
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
            Esta política explica como o <strong>TutoriaAvalia</strong> coleta, usa e protege seus
            dados pessoais, em conformidade com a Lei Geral de Proteção de Dados Pessoais
            (LGPD — Lei n° 13.709/2018).
          </div>
        </div>

        <div className="space-y-8 text-gray-700">

          {/* 1. Quem somos */}
          <section>
            <h2 className="text-xl font-bold text-[#1F4E79] mb-3">1. Quem somos</h2>
            <p className="leading-relaxed">
              O <strong>TutoriaAvalia</strong> é um sistema de avaliação formativa para o método
              de Aprendizagem Baseada em Problemas (ABP), desenvolvido por{' '}
              <strong>{NOME_DPO}</strong> para uso acadêmico no{' '}
              <strong>{INSTITUICAO}</strong>.
            </p>
            <p className="leading-relaxed mt-3">
              O controlador dos dados pessoais é o <strong>{INSTITUICAO}</strong>,{' '}
              situado na {ENDERECO}.
            </p>
          </section>

          {/* 2. Dados coletados */}
          <section>
            <h2 className="text-xl font-bold text-[#1F4E79] mb-3">2. Quais dados coletamos</h2>
            <div className="space-y-4">
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <h3 className="font-semibold text-gray-800 mb-2">Dados de identificação</h3>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Nome completo (obtido da conta Google institucional)</li>
                  <li>Endereço de e-mail institucional</li>
                  <li>Foto de perfil (obtida da conta Google, opcional)</li>
                  <li>Identificador único da conta Google (para autenticação)</li>
                </ul>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <h3 className="font-semibold text-gray-800 mb-2">Dados acadêmicos</h3>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Notas atribuídas pelo professor em cada critério de avaliação</li>
                  <li>Auto-avaliação do aluno por critério</li>
                  <li>Avaliação interpares (notas atribuídas entre colegas)</li>
                  <li>Registro de presença/ausência nos encontros</li>
                  <li>Nota formativa calculada ao final do módulo</li>
                </ul>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <h3 className="font-semibold text-gray-800 mb-2">Dados técnicos de auditoria</h3>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>
                    Endereço IP e tipo de dispositivo (User-Agent) registrados no momento da
                    submissão de avaliação — coletados para fins de segurança e prevenção de fraude
                  </li>
                  <li>Data e hora de cada submissão</li>
                </ul>
              </div>
            </div>
          </section>

          {/* 3. Finalidade */}
          <section>
            <h2 className="text-xl font-bold text-[#1F4E79] mb-3">3. Para que usamos seus dados</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-gray-200 rounded-xl overflow-hidden">
                <thead>
                  <tr className="bg-[#1F4E79] text-white">
                    <th className="text-left px-4 py-3">Dado</th>
                    <th className="text-left px-4 py-3">Finalidade</th>
                    <th className="text-left px-4 py-3">Base legal (LGPD)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {[
                    ['Nome e e-mail', 'Identificação e autenticação no sistema', 'Art. 7°, II — obrigação legal'],
                    ['Foto de perfil', 'Exibição opcional na interface', 'Art. 7°, V — legítimo interesse'],
                    ['Notas e avaliações', 'Avaliação formativa do processo pedagógico', 'Art. 7°, II — obrigação legal acadêmica'],
                    ['IP e User-Agent', 'Segurança, prevenção de fraude e auditoria', 'Art. 7°, II — legítimo interesse'],
                    ['Data de submissão', 'Registro de atividade e conformidade processual', 'Art. 7°, II — obrigação legal'],
                  ].map(([dado, fin, base]) => (
                    <tr key={dado} className="bg-white hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{dado}</td>
                      <td className="px-4 py-3 text-gray-600">{fin}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{base}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* 4. Compartilhamento */}
          <section>
            <h2 className="text-xl font-bold text-[#1F4E79] mb-3">4. Compartilhamento de dados</h2>
            <p className="leading-relaxed mb-3">
              Seus dados <strong>não são vendidos nem compartilhados com terceiros</strong> para
              fins comerciais. O sistema compartilha dados apenas nas seguintes situações:
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex gap-2">
                <span className="text-blue-500 font-bold mt-0.5">→</span>
                <span>
                  <strong>Google LLC:</strong> utilizado exclusivamente como provedor de autenticação
                  (Google OAuth). O Google possui sua própria Política de Privacidade e adequação
                  ao GDPR europeu.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-blue-500 font-bold mt-0.5">→</span>
                <span>
                  <strong>Neon (banco de dados):</strong> os dados são armazenados em
                  servidores na região us-east-1 (EUA) com criptografia em repouso e em trânsito.
                  O Neon assina cláusulas contratuais padrão de proteção de dados.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-blue-500 font-bold mt-0.5">→</span>
                <span>
                  <strong>Professor titular e co-tutores:</strong> dentro da própria plataforma,
                  o professor do módulo acessa as notas dos alunos matriculados em sua turma.
                  Nenhum professor acessa dados de outra turma.
                </span>
              </li>
            </ul>
          </section>

          {/* 5. Retenção */}
          <section>
            <h2 className="text-xl font-bold text-[#1F4E79] mb-3">5. Por quanto tempo guardamos seus dados</h2>
            <div className="space-y-3 text-sm">
              <div className="flex gap-3 bg-white border border-gray-200 rounded-xl p-4">
                <span className="text-2xl">📚</span>
                <div>
                  <p className="font-semibold">Dados acadêmicos (notas, avaliações)</p>
                  <p className="text-gray-600 mt-1">
                    Mantidos por <strong>5 anos</strong> após o término do módulo, conforme
                    prazo mínimo para recursos e revisões acadêmicas. Após esse período,
                    os dados são anonimizados ou excluídos.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 bg-white border border-gray-200 rounded-xl p-4">
                <span className="text-2xl">🔐</span>
                <div>
                  <p className="font-semibold">Dados técnicos (IP, User-Agent)</p>
                  <p className="text-gray-600 mt-1">
                    Mantidos por <strong>12 meses</strong> para fins de auditoria e segurança,
                    após o que são excluídos automaticamente.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 bg-white border border-gray-200 rounded-xl p-4">
                <span className="text-2xl">👤</span>
                <div>
                  <p className="font-semibold">Conta de usuário (nome, e-mail, foto)</p>
                  <p className="text-gray-600 mt-1">
                    Mantidos enquanto o vínculo institucional estiver ativo. Após o
                    desligamento ou a solicitação de exclusão, os dados são removidos em
                    até <strong>30 dias</strong>.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* 6. Direitos */}
          <section>
            <h2 className="text-xl font-bold text-[#1F4E79] mb-3">6. Seus direitos (Art. 18° da LGPD)</h2>
            <p className="text-sm leading-relaxed mb-4">
              Você tem os seguintes direitos em relação aos seus dados pessoais:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {[
                ['🔍', 'Acesso', 'Solicitar uma cópia de todos os seus dados armazenados'],
                ['✏️', 'Correção', 'Corrigir dados incompletos, inexatos ou desatualizados'],
                ['🗑️', 'Exclusão', 'Solicitar a exclusão dos seus dados pessoais'],
                ['📦', 'Portabilidade', 'Receber seus dados em formato estruturado (CSV/JSON)'],
                ['🚫', 'Oposição', 'Opor-se ao tratamento de dados em determinadas situações'],
                ['ℹ️', 'Informação', 'Ser informado sobre com quem seus dados são compartilhados'],
              ].map(([icon, titulo, desc]) => (
                <div key={titulo} className="bg-white border border-gray-200 rounded-xl p-4">
                  <p className="font-semibold mb-1">{icon} {titulo}</p>
                  <p className="text-gray-600 text-xs">{desc}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-4 text-sm">
              <p className="font-semibold text-green-800 mb-1">Como exercer seus direitos</p>
              <p className="text-green-700">
                Envie um e-mail para{' '}
                <a href={`mailto:${EMAIL_DPO}`} className="underline font-medium">
                  {EMAIL_DPO}
                </a>{' '}
                com o assunto <strong>"Exercício de Direitos LGPD"</strong> e descreva sua
                solicitação. Responderemos em até <strong>15 dias úteis</strong>.
              </p>
              <p className="text-green-700 mt-2">
                Você também pode solicitar a exclusão da sua conta diretamente nas{' '}
                <Link href="/conta/excluir" className="underline font-medium">
                  configurações de conta
                </Link>.
              </p>
            </div>
          </section>

          {/* 7. Segurança */}
          <section>
            <h2 className="text-xl font-bold text-[#1F4E79] mb-3">7. Como protegemos seus dados</h2>
            <ul className="space-y-2 text-sm">
              {[
                'Autenticação via Google OAuth — nenhuma senha é armazenada no sistema',
                'Comunicação criptografada com HTTPS/TLS em todas as telas',
                'Banco de dados com SSL obrigatório (conexão criptografada)',
                'Separação de acesso: cada professor acessa apenas sua própria turma',
                'Controle de papéis: alunos não acessam telas ou dados de professores',
                'Avaliações imutáveis após envio, garantindo integridade dos dados',
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-green-500 font-bold">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* 8. Encarregado */}
          <section>
            <h2 className="text-xl font-bold text-[#1F4E79] mb-3">8. Encarregado de Dados (DPO)</h2>
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-sm leading-relaxed">
                Nos termos do Art. 41° da LGPD, o Encarregado de Dados (DPO) responsável
                por este sistema é:
              </p>
              <div className="mt-4 space-y-1 text-sm">
                <p><strong>Nome:</strong> {NOME_DPO}</p>
                <p>
                  <strong>E-mail:</strong>{' '}
                  <a href={`mailto:${EMAIL_DPO}`} className="text-[#1F4E79] underline">
                    {EMAIL_DPO}
                  </a>
                </p>
                <p><strong>Instituição:</strong> {INSTITUICAO}</p>
                <p><strong>Endereço:</strong> {ENDERECO}</p>
              </div>
            </div>
          </section>

          {/* 9. Contato ANPD */}
          <section>
            <h2 className="text-xl font-bold text-[#1F4E79] mb-3">9. Contato com a ANPD</h2>
            <p className="text-sm leading-relaxed">
              Se você acredita que seus direitos não foram atendidos, você pode contatar a
              Autoridade Nacional de Proteção de Dados (ANPD) pelo portal{' '}
              <a href="https://www.gov.br/anpd" target="_blank" rel="noopener noreferrer"
                className="text-[#1F4E79] underline">
                www.gov.br/anpd
              </a>.
            </p>
          </section>

          {/* 10. Alterações */}
          <section>
            <h2 className="text-xl font-bold text-[#1F4E79] mb-3">10. Alterações nesta Política</h2>
            <p className="text-sm leading-relaxed">
              Esta política pode ser atualizada periodicamente. Alterações relevantes serão
              comunicadas aos usuários por e-mail institucional com pelo menos 10 dias de
              antecedência. A versão atual sempre estará disponível nesta página, com a
              data da última atualização indicada no topo.
            </p>
          </section>

        </div>

        {/* Rodapé */}
        <div className="mt-12 pt-6 border-t border-gray-200 text-center text-xs text-gray-400">
          TutoriaAvalia v2 · {INSTITUICAO} · Última atualização: {ULTIMA_ATUALIZACAO}
        </div>

      </main>
    </div>
  )
}
