'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { TopBar } from '@/components/ui/TopBar'
import { OPCOES_TUTORIA, OPCOES_TURMA } from '@/lib/validations'
import { EmailAutocomplete } from '@/components/ui/EmailAutocomplete'

type Problema  = { id: string; numero: number; nome: string | null; temSaltoTriplo: boolean }
type Matricula = { id: string; usuario: { id: string; nome: string; email: string }; numeraNaTurma: number }
type Modulo = {
  id:            string
  nome:          string
  ano:           number
  tutoria:       string
  turma:         string
  problemas:     Problema[]
  matriculas:    Matricula[]
}

export default function EditarModuloPage() {
  const router          = useRouter()
  const { id: moduloId} = useParams<{ id: string }>()
  const { data: session } = useSession()

  const [modulo,         setModulo]         = useState<Modulo | null>(null)
  const [nome,           setNome]           = useState('')
  const [ano,            setAno]            = useState(new Date().getFullYear())
  const [tutoria,        setTutoria]        = useState('')
  const [turma,          setTurma]          = useState('')
  const [emailsAlunos,   setEmailsAlunos]   = useState<string[]>([])
  const [nomesProblemas, setNomesProblemas] = useState<string[]>([])
  const [emailDigitado,  setEmailDigitado]  = useState('')

  const [carregando, setCarregando] = useState(true)
  const [salvando,   setSalvando]   = useState(false)
  const [erro,       setErro]       = useState<string | null>(null)
  const [sucesso,    setSucesso]    = useState(false)

  // ── Carrega dados do módulo ────────────────────────────────────
  useEffect(() => {
    if (!moduloId) return
    fetch(`/api/modulos/${moduloId}`)
      .then((r) => r.json())
      .then((data: Modulo) => {
        setModulo(data)
        setNome(data.nome)
        setAno(data.ano)
        setTutoria(data.tutoria)
        setTurma(data.turma)
        setEmailsAlunos(data.matriculas.map((m) => m.usuario.email))
        setNomesProblemas(data.problemas.map((p) => p.nome ?? ''))
        setCarregando(false)
      })
      .catch(() => { setErro('Erro ao carregar módulo'); setCarregando(false) })
  }, [moduloId])

  // ── Alunos ────────────────────────────────────────────────────
  const adicionarAluno = () => {
    const email = emailDigitado.trim().toLowerCase()
    if (!email || !email.includes('@')) return
    if (emailsAlunos.includes(email)) { setErro(`${email} já está na lista`); return }
    if (emailsAlunos.length >= 11) return
    setEmailsAlunos([...emailsAlunos, email])
    setEmailDigitado('')
    setErro(null)
  }

  const removerAluno = (email: string) =>
    setEmailsAlunos(emailsAlunos.filter((e) => e !== email))

  const moverAluno = (idx: number, dir: -1 | 1) => {
    const arr  = [...emailsAlunos]
    const dest = idx + dir
    if (dest < 0 || dest >= arr.length) return
    ;[arr[idx], arr[dest]] = [arr[dest], arr[idx]]
    setEmailsAlunos(arr)
  }

  // ── Salvar ────────────────────────────────────────────────────
  const salvar = async () => {
    if (!nome || nome.length < 3) { setErro('Nome do módulo muito curto'); return }
    if (!tutoria)                  { setErro('Selecione a tutoria'); return }
    if (!turma)                    { setErro('Selecione a turma'); return }
    if (emailsAlunos.length === 0) { setErro('Adicione pelo menos 1 aluno'); return }

    setSalvando(true)
    setErro(null)

    try {
      const res = await fetch(`/api/modulos/${moduloId}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ nome, ano, tutoria, turma, emailsAlunos, nomesProblemas }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `Erro ${res.status}`)
      setSucesso(true)
      setTimeout(() => router.push('/professor/dashboard'), 1200)
    } catch (e: any) {
      setErro(e.message)
    } finally {
      setSalvando(false)
    }
  }

  // ── Telas ─────────────────────────────────────────────────────
  if (carregando) {
    return (
      <div className="min-h-screen bg-gray-50">
        <TopBar nome={session?.user?.nome ?? ''} papel="TUTOR" backHref="/professor/dashboard" backLabel="Voltar ao painel" />
        <main className="max-w-2xl mx-auto px-4 py-16 text-center">
          <div className="w-8 h-8 border-4 border-[#2E75B6] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-400 mt-4 text-sm">Carregando módulo...</p>
        </main>
      </div>
    )
  }

  if (sucesso) {
    return (
      <div className="min-h-screen bg-gray-50">
        <TopBar nome={session?.user?.nome ?? ''} papel="TUTOR" backHref="/professor/dashboard" backLabel="Voltar ao painel" />
        <main className="max-w-lg mx-auto px-4 py-20 text-center">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-xl font-bold text-gray-800">Módulo atualizado!</h1>
          <p className="text-sm text-gray-400 mt-2">Redirecionando para o painel...</p>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar nome={session?.user?.nome ?? ''} papel="TUTOR" backHref="/professor/dashboard" backLabel="Voltar ao painel" />

      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="mb-5">
          <h1 className="text-xl font-bold text-[#1F4E79]">Editar Módulo</h1>
          <p className="text-sm text-gray-500">Altere as informações e clique em Salvar</p>
        </div>

        {erro && (
          <div className="bg-red-50 border border-red-300 rounded-xl p-4 mb-5 flex gap-3 items-start">
            <span className="text-red-500 text-lg mt-0.5">⚠️</span>
            <p className="text-sm text-red-700 font-medium">{erro}</p>
          </div>
        )}

        <div className="space-y-5">

          {/* ── 1. Dados básicos ─────────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h2 className="font-semibold text-gray-800">Dados do Módulo</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nome do Módulo <span className="text-red-400">*</span>
              </label>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Módulo de Saúde Coletiva"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E75B6]"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ano *</label>
                <input
                  type="number"
                  value={ano}
                  onChange={(e) => setAno(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E75B6]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nº da Tutoria *</label>
                <select
                  value={tutoria}
                  onChange={(e) => setTutoria(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#2E75B6]"
                >
                  <option value="">Selecione...</option>
                  {OPCOES_TUTORIA.map((op) => (
                    <option key={op} value={op}>{op}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Turma *</label>
                <select
                  value={turma}
                  onChange={(e) => setTurma(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#2E75B6]"
                >
                  <option value="">Selecione...</option>
                  {OPCOES_TURMA.map((op) => (
                    <option key={op} value={op}>{op}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* ── 2. Alunos ─────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-800 mb-1">
              Alunos{' '}
              <span className="text-gray-400 font-normal text-sm">({emailsAlunos.length}/11) *</span>
            </h2>
            <p className="text-xs text-gray-400 mb-3">
              Use as setas para reordenar. A ordem define o número do aluno nas avaliações.
            </p>

            <div className="mb-3">
              <EmailAutocomplete
                emailsJaAdicionados={emailsAlunos}
                onAdicionar={(email) => {
                  if (!emailsAlunos.includes(email) && emailsAlunos.length < 11) {
                    setEmailsAlunos([...emailsAlunos, email])
                    setErro(null)
                  }
                }}
                disabled={emailsAlunos.length >= 11}
              />
            </div>

            {emailsAlunos.length === 0 ? (
              <div className="border-2 border-dashed border-gray-200 rounded-lg p-5 text-center">
                <p className="text-sm text-gray-400">Nenhum aluno na lista</p>
              </div>
            ) : (
              <ul className="space-y-1.5">
                {emailsAlunos.map((email, idx) => {
                  const matricula = modulo?.matriculas.find((m) => m.usuario.email === email)
                  const nome      = matricula?.usuario.nome ?? email.split('@')[0]
                  const ehNovo    = !modulo?.matriculas.find((m) => m.usuario.email === email)

                  return (
                    <li
                      key={email}
                      className={`flex items-center gap-2 rounded-lg px-3 py-2 border ${
                        ehNovo
                          ? 'bg-green-50 border-green-200'
                          : 'bg-blue-50 border-blue-100'
                      }`}
                    >
                      {/* Botões de reordenação */}
                      <div className="flex flex-col gap-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => moverAluno(idx, -1)}
                          disabled={idx === 0}
                          className="text-gray-400 hover:text-gray-700 disabled:opacity-20 text-xs leading-none"
                          title="Mover para cima"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          onClick={() => moverAluno(idx, 1)}
                          disabled={idx === emailsAlunos.length - 1}
                          className="text-gray-400 hover:text-gray-700 disabled:opacity-20 text-xs leading-none"
                          title="Mover para baixo"
                        >
                          ▼
                        </button>
                      </div>

                      {/* Número e info */}
                      <span className="text-xs text-gray-400 w-5 text-center shrink-0">{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 truncate">{nome}</p>
                        <p className="text-xs text-gray-400 truncate">{email}</p>
                      </div>

                      {/* Badge novo */}
                      {ehNovo && (
                        <span className="text-xs bg-green-600 text-white px-1.5 py-0.5 rounded shrink-0">
                          Novo
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => removerAluno(email)}
                        className="text-red-400 hover:text-red-600 text-xs shrink-0 ml-1"
                      >
                        remover
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}

            {/* Lista de alunos que serão removidos */}
            {modulo && modulo.matriculas.some((m) => !emailsAlunos.includes(m.usuario.email)) && (
              <div className="mt-3 bg-red-50 border border-red-100 rounded-lg p-3">
                <p className="text-xs font-semibold text-red-700 mb-1">Serão removidos do módulo:</p>
                <ul className="space-y-0.5">
                  {modulo.matriculas
                    .filter((m) => !emailsAlunos.includes(m.usuario.email))
                    .map((m) => (
                      <li key={m.id} className="text-xs text-red-600">
                        {m.usuario.nome} ({m.usuario.email})
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </div>

          {/* ── 3. Nomes dos problemas ────────────────────────── */}
          {modulo && modulo.problemas.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-800 mb-1">Nomes dos Problemas</h2>
              <p className="text-xs text-gray-400 mb-3">
                A quantidade e configuração de salto triplo não podem ser alteradas após a criação.
              </p>
              <div className="space-y-2">
                {modulo.problemas.map((prob, i) => (
                  <div key={prob.id} className="flex items-center gap-2">
                    <div className="flex items-center gap-1 w-24 shrink-0">
                      <span className="text-xs text-gray-400">P{String(prob.numero).padStart(2, '0')}</span>
                      {prob.temSaltoTriplo && (
                        <span className="text-xs bg-[#1F4E79] text-white px-1.5 py-0.5 rounded font-bold">ST</span>
                      )}
                    </div>
                    <input
                      value={nomesProblemas[i] ?? ''}
                      onChange={(e) => {
                        const arr = [...nomesProblemas]
                        arr[i]    = e.target.value
                        setNomesProblemas(arr)
                      }}
                      placeholder={`Problema ${String(prob.numero).padStart(2, '0')}`}
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#2E75B6]"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Botões ──────────────────────────────────────────── */}
          <div className="flex gap-3 pb-6">
            <button
              type="button"
              onClick={() => router.back()}
              disabled={salvando}
              className="flex-1 border border-gray-300 text-gray-700 px-4 py-3 rounded-xl text-sm font-medium disabled:opacity-40"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={salvar}
              disabled={salvando}
              className="flex-1 bg-[#1F4E79] text-white px-4 py-3 rounded-xl text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {salvando ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Salvando...
                </>
              ) : 'Salvar Alterações'}
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
