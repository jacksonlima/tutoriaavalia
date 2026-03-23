'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

type Sugestao = { id: string; nome: string; email: string }

interface Props {
  emailsJaAdicionados: string[]
  onAdicionar: (email: string) => void
  disabled?: boolean
}

export function EmailAutocomplete({ emailsJaAdicionados, onAdicionar, disabled = false }: Props) {
  const [texto,       setTexto]       = useState('')
  const [sugestoes,   setSugestoes]   = useState<Sugestao[]>([])
  const [carregando,  setCarregando]  = useState(false)
  const [aberto,      setAberto]      = useState(false)
  const [indiceSel,   setIndiceSel]   = useState(-1) // índice da sugestão destacada com teclado

  const inputRef     = useRef<HTMLInputElement>(null)
  const listaRef     = useRef<HTMLDivElement>(null)
  const timerRef     = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Busca com debounce de 250ms ──────────────────────────────────
  const buscar = useCallback(
    (q: string) => {
      if (timerRef.current) clearTimeout(timerRef.current)

      if (q.length < 2) {
        setSugestoes([])
        setAberto(false)
        return
      }

      timerRef.current = setTimeout(async () => {
        setCarregando(true)
        try {
          const res  = await fetch(`/api/usuarios/buscar?q=${encodeURIComponent(q)}`)
          const data: Sugestao[] = await res.json()

          // Filtra os que já foram adicionados
          const filtrados = data.filter((u) => !emailsJaAdicionados.includes(u.email))
          setSugestoes(filtrados)
          setAberto(filtrados.length > 0)
          setIndiceSel(-1)
        } catch {
          setSugestoes([])
          setAberto(false)
        } finally {
          setCarregando(false)
        }
      }, 250)
    },
    [emailsJaAdicionados]
  )

  useEffect(() => {
    buscar(texto)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [texto, buscar])

  // ── Fecha dropdown ao clicar fora ────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        listaRef.current && !listaRef.current.contains(e.target as Node) &&
        inputRef.current  && !inputRef.current.contains(e.target as Node)
      ) {
        setAberto(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ── Seleciona uma sugestão ───────────────────────────────────────
  const selecionar = (sugestao: Sugestao) => {
    onAdicionar(sugestao.email)
    setTexto('')
    setSugestoes([])
    setAberto(false)
    setIndiceSel(-1)
    inputRef.current?.focus()
  }

  // ── Adiciona o email digitado manualmente (sem selecionar sugestão) ─
  const adicionarManual = () => {
    const email = texto.trim().toLowerCase()
    if (!email || !email.includes('@')) return
    if (emailsJaAdicionados.includes(email)) return
    onAdicionar(email)
    setTexto('')
    setSugestoes([])
    setAberto(false)
  }

  // ── Navegação por teclado na lista de sugestões ──────────────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setIndiceSel((prev) => Math.min(prev + 1, sugestoes.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setIndiceSel((prev) => Math.max(prev - 1, -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (indiceSel >= 0 && sugestoes[indiceSel]) {
        selecionar(sugestoes[indiceSel])
      } else {
        adicionarManual()
      }
    } else if (e.key === 'Escape') {
      setAberto(false)
      setIndiceSel(-1)
    }
  }

  return (
    <div className="relative">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => sugestoes.length > 0 && setAberto(true)}
            placeholder="Digite o nome ou email do aluno..."
            disabled={disabled}
            autoComplete="off"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E75B6] disabled:bg-gray-50 pr-8"
          />

          {/* Spinner de carregamento */}
          {carregando && (
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
              <span className="w-4 h-4 border-2 border-[#2E75B6] border-t-transparent rounded-full animate-spin block" />
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={adicionarManual}
          disabled={disabled || !texto.trim()}
          className="bg-[#2E75B6] text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40 whitespace-nowrap"
        >
          + Adicionar
        </button>
      </div>

      {/* ── Dropdown de sugestões ── */}
      {aberto && sugestoes.length > 0 && (
        <div
          ref={listaRef}
          className="absolute z-50 left-0 right-16 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden"
        >
          {sugestoes.map((s, idx) => (
            <button
              key={s.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); selecionar(s) }}
              className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors ${
                idx === indiceSel
                  ? 'bg-blue-50 text-[#1F4E79]'
                  : 'hover:bg-gray-50 text-gray-800'
              }`}
            >
              {/* Avatar com inicial */}
              <div className="w-8 h-8 rounded-full bg-[#1F4E79] flex items-center justify-center shrink-0">
                <span className="text-white text-xs font-bold">
                  {s.nome.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{s.nome}</p>
                <p className="text-xs text-gray-400 truncate">{s.email}</p>
              </div>
            </button>
          ))}

          {/* Opção de adicionar email digitado diretamente */}
          {texto.includes('@') && !emailsJaAdicionados.includes(texto.trim().toLowerCase()) && (
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); adicionarManual() }}
              className="w-full text-left px-4 py-2.5 flex items-center gap-3 border-t border-gray-100 hover:bg-gray-50 text-gray-600"
            >
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                <span className="text-gray-500 text-xs">+</span>
              </div>
              <div className="min-w-0">
                <p className="text-sm truncate">Adicionar <span className="font-medium text-[#2E75B6]">{texto.trim()}</span></p>
                <p className="text-xs text-gray-400">Email não cadastrado (será criado no primeiro login)</p>
              </div>
            </button>
          )}
        </div>
      )}

      {/* Hint de digitação mínima */}
      {texto.length === 1 && (
        <p className="text-xs text-gray-400 mt-1 ml-1">
          Digite mais um caractere para buscar...
        </p>
      )}
    </div>
  )
}
