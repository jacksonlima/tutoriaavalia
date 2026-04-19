/**
 * TutoriaAvalia v2 — Canal de Exercício de Direitos LGPD
 * Autor: Jackson Lima — CESUPA
 *
 * Formulário para que titulares solicitem acesso, correção,
 * portabilidade ou exclusão de seus dados (LGPD Art. 18°).
 *
 * Acessível em: /direitos (público, sem login)
 */
'use client'

import { useState } from 'react'
import Link from 'next/link'

const EMAIL_DPO = 'privacidade@cesupa.br'

type Tipo = 'acesso' | 'correcao' | 'exclusao' | 'portabilidade' | 'oposicao' | 'outro'

const TIPOS: { valor: Tipo; label: string; desc: string }[] = [
  { valor: 'acesso',       label: 'Acesso aos meus dados',      desc: 'Quero saber quais dados estão armazenados sobre mim' },
  { valor: 'correcao',     label: 'Correção de dados',          desc: 'Meus dados estão incorretos e quero corrigir' },
  { valor: 'exclusao',     label: 'Exclusão de dados',          desc: 'Quero que meus dados sejam removidos do sistema' },
  { valor: 'portabilidade',label: 'Portabilidade',              desc: 'Quero receber meus dados em formato CSV ou JSON' },
  { valor: 'oposicao',     label: 'Oposição ao tratamento',     desc: 'Quero me opor a determinado uso dos meus dados' },
  { valor: 'outro',        label: 'Outro',                      desc: 'Outra solicitação relacionada aos meus dados' },
]

export default function DireitosPage() {
  const [nome,        setNome]        = useState('')
  const [email,       setEmail]       = useState('')
  const [tipo,        setTipo]        = useState<Tipo | ''>('')
  const [descricao,   setDescricao]   = useState('')
  const [enviando,    setEnviando]    = useState(false)
  const [enviado,     setEnviado]     = useState(false)
  const [erro,        setErro]        = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome || !email || !tipo || !descricao) {
      setErro('Preencha todos os campos.')
      return
    }
    setErro('')
    setEnviando(true)

    try {
      const res = await fetch('/api/direitos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, email, tipo, descricao }),
      })
      if (!res.ok) throw new Error()
      setEnviado(true)
    } catch {
      setErro('Erro ao enviar. Tente novamente ou envie diretamente para ' + EMAIL_DPO)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#1F4E79] text-white px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
              <span className="text-xs font-bold">TA</span>
            </div>
            <span className="font-semibold">TutoriaAvalia</span>
          </div>
          <Link href="/privacidade" className="text-sm text-blue-200 hover:text-white">
            Política de Privacidade
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-10">

        {enviado ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
            <div className="text-5xl mb-4">✅</div>
            <h1 className="text-xl font-bold text-gray-800 mb-2">Solicitação recebida</h1>
            <p className="text-sm text-gray-500 mb-6">
              Sua solicitação foi registrada. Responderemos em até{' '}
              <strong>15 dias úteis</strong> no e-mail informado.
            </p>
            <p className="text-xs text-gray-400">
              Protocolo enviado para: <strong>{EMAIL_DPO}</strong>
            </p>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-[#1F4E79] mb-2">
                Exercício de Direitos LGPD
              </h1>
              <p className="text-sm text-gray-500">
                Formulário para solicitações de acesso, correção, exclusão ou portabilidade
                de dados pessoais — Art. 18° da Lei 13.709/2018.
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-sm text-blue-800">
              Você também pode enviar sua solicitação diretamente para{' '}
              <a href={`mailto:${EMAIL_DPO}`} className="underline font-medium">{EMAIL_DPO}</a>{' '}
              com o assunto <strong>"Exercício de Direitos LGPD"</strong>.
              Responderemos em até 15 dias úteis.
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome completo *
                  </label>
                  <input
                    type="text"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Seu nome completo"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F4E79]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    E-mail institucional *
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu.email@cesupa.br"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F4E79]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tipo de solicitação *
                  </label>
                  <div className="space-y-2">
                    {TIPOS.map((t) => (
                      <label key={t.valor} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${tipo === t.valor ? 'border-[#1F4E79] bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                        <input
                          type="radio"
                          name="tipo"
                          value={t.valor}
                          checked={tipo === t.valor}
                          onChange={() => setTipo(t.valor)}
                          className="mt-0.5"
                        />
                        <div>
                          <p className="text-sm font-medium text-gray-800">{t.label}</p>
                          <p className="text-xs text-gray-500">{t.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descrição da solicitação *
                  </label>
                  <textarea
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    rows={4}
                    placeholder="Descreva sua solicitação com detalhes..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F4E79] resize-none"
                  />
                </div>
              </div>

              {erro && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  {erro}
                </div>
              )}

              <button
                type="submit"
                disabled={enviando}
                className="w-full bg-[#1F4E79] text-white py-3 rounded-xl font-bold text-sm hover:bg-[#163d61] disabled:opacity-50 transition-colors"
              >
                {enviando ? 'Enviando...' : 'Enviar solicitação'}
              </button>

              <p className="text-xs text-gray-400 text-center">
                Sua solicitação será respondida em até 15 dias úteis no e-mail informado.
              </p>
            </form>
          </>
        )}

      </main>
    </div>
  )
}
