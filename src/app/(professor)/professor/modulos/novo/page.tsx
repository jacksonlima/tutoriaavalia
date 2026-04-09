'use client'

/**
 * TutoriaAvalia v2 — Página de criação de novo módulo
 * Autor: Jackson Lima — CESUPA
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { criarModuloSchema, CriarModuloInput, OPCOES_TUTORIA, OPCOES_TURMA, OPCOES_MODULO, OPCOES_SEMESTRE } from '@/lib/validations'
import { TopBar } from '@/components/ui/TopBar'
import { EmailAutocomplete } from '@/components/ui/EmailAutocomplete'
import { useSession } from 'next-auth/react'

// IMPORTANDO A SERVER ACTION
import { criarModuloAction } from './actions'

export default function NovoModuloPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const [salvando, setSalvando]           = useState(false)
  const [erro, setErro]                   = useState<string | null>(null)
  const [sucesso, setSucesso]             = useState(false)

  const { register, handleSubmit, watch, setValue, formState: { errors } } =
    useForm<CriarModuloInput>({
      resolver: zodResolver(criarModuloSchema),
      defaultValues: {
        ano:                  new Date().getFullYear(),
        emailsAlunos:         [],
        nomesProblemas:       [],
        quantidadeProblemas:  8,
        temSaltoTriplo:       false,
        quantidadeSaltos:     0,
        problemasSaltoTriplo: [],
      },
    })

  const emailsAlunos   = watch('emailsAlunos')         ?? []
  const qtdProblemas   = watch('quantidadeProblemas')  ?? 8
  const temSalto       = watch('temSaltoTriplo')       ?? false
  const qtdSaltos      = watch('quantidadeSaltos')     ?? 0
  const problemasSalto = watch('problemasSaltoTriplo') ?? []

  const removerAluno = (email: string) =>
    setValue('emailsAlunos', emailsAlunos.filter((e) => e !== email))

  const toggleSalto = (numProb: number) => {
    const atual   = problemasSalto ?? []
    const novoArr = atual.includes(numProb)
      ? atual.filter((n) => n !== numProb)
      : [...atual, numProb]
    setValue('problemasSaltoTriplo', novoArr)
  }

  // ----------------------------------------------------------------------
  // FUNÇÃO REFEITA: Usando a Server Action
  // ----------------------------------------------------------------------
  const onSubmit = async (data: CriarModuloInput) => {
    if (emailsAlunos.length === 0) { 
      setErro('Adicione pelo menos 1 aluno')
      return 
    }
    
    setSalvando(true)
    setErro(null)
    
    try {
      // Chama a ação no servidor e aguarda a resposta
      const resposta = await criarModuloAction(data)

      // Verifica se houve falha na validação ou autorização do servidor
      if (!resposta.sucesso) {
        throw new Error(resposta.erro || 'Não foi possível criar o módulo.')
      }

      // Tudo deu certo
      setSucesso(true)
      setTimeout(() => router.push('/professor/dashboard'), 1200)
      
    } catch (e: any) {
      setErro(e.message)
      setSalvando(false)
    }
  }

  const onError = (errosZod: any) => {
    const primeiro = Object.values(errosZod)[0] as any
    setErro(primeiro?.message ?? 'Verifique os campos e tente novamente')
  }

  if (sucesso) {
    return (
      <div className="min-h-screen bg-gray-50">
        <TopBar nome={session?.user?.nome ?? ''} papel="TUTOR" backHref="/professor/dashboard" backLabel="Voltar ao painel" />
        <main className="max-w-lg mx-auto px-4 py-20 text-center">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-xl font-bold text-gray-800">Módulo criado com sucesso!</h1>
          <p className="text-sm text-gray-400 mt-2">Redirecionando para o painel...</p>
        </main>
      </div>
    )
  }

  const selectClass = (hasError?: boolean) =>
    `w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#2E75B6] ${
      hasError ? 'border-red-400 bg-red-50' : 'border-gray-300'
    }`

  const inputClass = (hasError?: boolean) =>
    `w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E75B6] ${
      hasError ? 'border-red-400 bg-red-50' : 'border-gray-300'
    }`

  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar nome={session?.user?.nome ?? ''} papel="TUTOR" backHref="/professor/dashboard" backLabel="Voltar ao painel" />
      <main className="max-w-2xl mx-auto px-4 py-6">

        <div className="mb-5">
          <h1 className="text-xl font-bold text-[#1F4E79]">Novo Módulo</h1>
          <p className="text-sm text-gray-500">Preencha os dados e configure o módulo</p>
        </div>

        {erro && (
          <div className="bg-red-50 border border-red-300 rounded-xl p-4 mb-5 flex gap-3 items-start">
            <span className="text-red-500 text-lg mt-0.5">⚠️</span>
            <p className="text-sm text-red-700 font-medium">{erro}</p>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit, onError)} className="space-y-5">

          {/* ── Dados do Módulo ── */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h2 className="font-semibold text-gray-800">Dados do Módulo</h2>

            {/* Nome do Módulo — dropdown */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nome do Módulo <span className="text-red-400">*</span>
              </label>
              <select
                {...register('nome')}
                className={selectClass(!!errors.nome)}
              >
                <option value="">Selecione o módulo...</option>
                {OPCOES_MODULO.map((op) => (
                  <option key={op} value={op}>{op}</option>
                ))}
              </select>
              {errors.nome && <p className="text-red-500 text-xs mt-1">{errors.nome.message}</p>}
            </div>

            {/* Ano · Semestre · Tutoria · Turma */}
            <div className="grid grid-cols-2 gap-3">
              {/* Ano */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ano <span className="text-red-400">*</span>
                </label>
                <input
                  {...register('ano', { valueAsNumber: true })}
                  type="number"
                  placeholder={String(new Date().getFullYear())}
                  className={inputClass(!!errors.ano)}
                />
                {errors.ano && <p className="text-red-500 text-xs mt-1">{errors.ano.message}</p>}
              </div>

              {/* Semestre */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Semestre <span className="text-red-400">*</span>
                </label>
                <select
                  {...register('semestre')}
                  className={selectClass(!!errors.semestre)}
                >
                  <option value="">Selecione...</option>
                  {OPCOES_SEMESTRE.map((op) => (
                    <option key={op} value={op}>{op}º Semestre</option>
                  ))}
                </select>
                {errors.semestre && <p className="text-red-500 text-xs mt-1">{errors.semestre.message}</p>}
              </div>

              {/* Nº da Tutoria */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nº da Tutoria <span className="text-red-400">*</span>
                </label>
                <select
                  {...register('tutoria')}
                  className={selectClass(!!errors.tutoria)}
                >
                  <option value="">Selecione...</option>
                  {OPCOES_TUTORIA.map((op) => (
                    <option key={op} value={op}>{op}</option>
                  ))}
                </select>
                {errors.tutoria && <p className="text-red-500 text-xs mt-1">{errors.tutoria.message}</p>}
              </div>

              {/* Turma */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Turma <span className="text-red-400">*</span>
                </label>
                <select
                  {...register('turma')}
                  className={selectClass(!!errors.turma)}
                >
                  <option value="">Selecione...</option>
                  {OPCOES_TURMA.map((op) => (
                    <option key={op} value={op}>{op}</option>
                  ))}
                </select>
                {errors.turma && <p className="text-red-500 text-xs mt-1">{errors.turma.message}</p>}
              </div>
            </div>
          </div>

          {/* ── Alunos ── */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-800 mb-1">
              Alunos{' '}
              <span className="text-gray-400 font-normal text-sm">
                ({emailsAlunos.length}/11) <span className="text-red-400">*</span>
              </span>
            </h2>
            <p className="text-xs text-gray-400 mb-3">
              Criados automaticamente. Perfil completado no primeiro login.
            </p>
            <div className="mb-3">
              <EmailAutocomplete
                emailsJaAdicionados={emailsAlunos}
                onAdicionar={(email) => {
                  if (!emailsAlunos.includes(email) && emailsAlunos.length < 11) {
                    setValue('emailsAlunos', [...emailsAlunos, email])
                    setErro(null)
                  }
                }}
                disabled={emailsAlunos.length >= 11}
              />
            </div>
            {emailsAlunos.length === 0 ? (
              <div className="border-2 border-dashed border-gray-200 rounded-lg p-5 text-center">
                <p className="text-sm text-gray-400">Nenhum aluno adicionado ainda</p>
              </div>
            ) : (
              <ul className="space-y-1.5">
                {emailsAlunos.map((email, idx) => (
                  <li key={email} className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                    <span className="text-sm text-gray-700">
                      <span className="text-gray-400 text-xs mr-2">{idx + 1}.</span>
                      {email}
                    </span>
                    <button
                      type="button"
                      onClick={() => removerAluno(email)}
                      className="text-red-400 hover:text-red-600 text-xs ml-3"
                    >
                      remover
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ── Problemas ── */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-5">
            <h2 className="font-semibold text-gray-800">Problemas</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quantos problemas este módulo possui? <span className="text-red-400">*</span>
              </label>
              <input
                {...register('quantidadeProblemas', { valueAsNumber: true })}
                type="number" min={1} max={20}
                className={`w-32 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E75B6] ${
                  errors.quantidadeProblemas ? 'border-red-400' : 'border-gray-300'
                }`}
              />
              {qtdProblemas > 0 && (
                <p className="text-xs text-gray-400 mt-1.5">
                  {qtdProblemas} problema{qtdProblemas > 1 ? 's' : ''} — cada um com 1 abertura e 1 fechamento
                </p>
              )}
            </div>

            {/* Salto Triplo */}
            <div className="border border-amber-200 bg-amber-50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-800">
                  Este módulo possui Salto Triplo?
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setValue('temSaltoTriplo', !temSalto)
                    if (temSalto) {
                      setValue('quantidadeSaltos', 0)
                      setValue('problemasSaltoTriplo', [])
                    }
                  }}
                  className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${
                    temSalto ? 'bg-[#1F4E79]' : 'bg-gray-300'
                  }`}
                >
                  <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    temSalto ? 'translate-x-6' : ''
                  }`} />
                </button>
              </div>
              <p className="text-xs text-amber-700">
                {temSalto
                  ? 'Problemas com Salto Triplo terão: Abertura + Fechamento A + Fechamento B'
                  : 'Sem Salto Triplo: cada problema terá Abertura e Fechamento'}
              </p>

              {temSalto && (
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Quantos Saltos Triplos terá?
                    </label>
                    <input
                      {...register('quantidadeSaltos', { valueAsNumber: true })}
                      type="number" min={1} max={qtdProblemas}
                      className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E75B6]"
                    />
                  </div>

                  {qtdSaltos > 0 && qtdProblemas > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Em qual(is) problema(s) será(ão) o(s) Salto(s) Triplo(s)?
                      </label>
                      <p className="text-xs text-gray-500 mb-3">
                        Clique nos números para selecionar (azul = selecionado).
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {Array.from({ length: Number(qtdProblemas) }, (_, i) => {
                          const numProb     = i + 1
                          const selecionado = (problemasSalto ?? []).includes(numProb)
                          return (
                            <button
                              key={numProb} type="button"
                              onClick={() => toggleSalto(numProb)}
                              className={`w-10 h-10 rounded-lg text-sm font-bold border-2 transition-all ${
                                selecionado
                                  ? 'bg-[#1F4E79] text-white border-[#1F4E79] shadow-sm'
                                  : 'bg-white text-gray-600 border-gray-300 hover:border-[#2E75B6]'
                              }`}
                            >
                              {numProb}
                            </button>
                          )
                        })}
                      </div>
                      {(problemasSalto ?? []).length > 0 && (
                        <p className="text-xs text-[#1F4E79] mt-2 font-medium">
                          Salto Triplo nos problemas: {[...(problemasSalto ?? [])].sort((a, b) => a - b).join(', ')}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Nomes dos problemas */}
            {Number(qtdProblemas) > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nomes dos Problemas{' '}
                  <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <p className="text-xs text-gray-400 mb-3">
                  Se vazio, serão nomeados automaticamente.
                </p>
                <div className="space-y-2">
                  {Array.from({ length: Number(qtdProblemas) }, (_, i) => {
                    const numProb  = i + 1
                    const comSalto = temSalto && (problemasSalto ?? []).includes(numProb)
                    return (
                      <div key={i} className="flex items-center gap-2">
                        <div className="flex items-center gap-1 w-20 shrink-0">
                          <span className="text-xs text-gray-400">
                            P{String(numProb).padStart(2, '0')}
                          </span>
                          {comSalto && (
                            <span className="text-xs bg-[#1F4E79] text-white px-1.5 py-0.5 rounded font-bold">
                              ST
                            </span>
                          )}
                        </div>
                        <input
                          {...register(('nomesProblemas.' + i) as any)}
                          placeholder={'Problema ' + String(numProb).padStart(2, '0')}
                          className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#2E75B6]"
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ── Botões ── */}
          <div className="flex gap-3 pb-6">
            <button
              type="button" onClick={() => router.back()} disabled={salvando}
              className="flex-1 border border-gray-300 text-gray-700 px-4 py-3 rounded-xl text-sm font-medium disabled:opacity-40 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit" disabled={salvando}
              className="flex-1 bg-[#1F4E79] text-white px-4 py-3 rounded-xl text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2 hover:bg-[#163d61] transition-colors"
            >
              {salvando ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Criando módulo...
                </span>
              ) : 'Criar Módulo'}
            </button>
          </div>

        </form>
      </main>
    </div>
  )
}