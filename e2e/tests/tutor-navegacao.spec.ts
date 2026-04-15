/**
 * E2E — Navegação do tutor a partir do dashboard.
 *
 * Verifica que o link "+ Novo Módulo" está acessível e leva ao formulário
 * de criação. Não submetemos o formulário aqui: a lógica de criação já
 * tem cobertura exaustiva nos testes de integração (Server Action +
 * Prisma). O objetivo aqui é apenas garantir que o caminho UI → rota →
 * render não quebrou.
 */
import { test, expect } from '@playwright/test'
import { loginAsTutor } from '../fixtures/auth'

test.describe('Navegação do tutor', () => {
  test('clica em "Novo Módulo" e vê o formulário de criação', async ({ page }) => {
    await loginAsTutor(page)

    await Promise.all([
      page.waitForURL(/\/professor\/modulos\/novo/, { timeout: 15_000 }),
      page.getByRole('link', { name: /Novo M[óo]dulo/i }).click(),
    ])

    // Cabeçalho e campo-chave do formulário
    await expect(page.getByRole('heading', { name: 'Novo Módulo' })).toBeVisible()
    // O <label> não usa htmlFor — checamos texto + presença do <select name="nome">
    await expect(page.getByText('Nome do Módulo', { exact: false }).first()).toBeVisible()
    await expect(page.locator('select[name="nome"]')).toBeVisible()
    await expect(page.getByRole('button', { name: /Criar Módulo/i })).toBeVisible()
  })

  test('acessa a lista de arquivados a partir do dashboard', async ({ page }) => {
    await loginAsTutor(page)

    await Promise.all([
      page.waitForURL(/\/professor\/arquivados/, { timeout: 15_000 }),
      page.getByRole('link', { name: /Arquivados/i }).click(),
    ])
  })
})
