'use client'

/**
 * Notas da Tutoria v2 — Botão de Impressão
 * Client Component isolado para o window.print() na página de exportação.
 * Necessário porque exportar/page.tsx é um Server Component.
 */
export function PrintButton() {
  return (
    <button
      className="print-btn"
      onClick={() => window.print()}
    >
      🖨️ Imprimir / Salvar PDF
    </button>
  )
}
