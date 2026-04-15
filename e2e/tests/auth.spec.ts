/**
 * E2E — Autenticação e redirecionamento por papel.
 *
 * Garante que o fluxo de login (via /dev/login, stand-in do Google OAuth)
 * leva cada papel ao dashboard correto e que rotas protegidas bloqueiam
 * quem não tem sessão.
 */
import { test, expect } from '@playwright/test'
import { loginAsTutor, loginAsAluno } from '../fixtures/auth'

test.describe('Autenticação', () => {
  test('tutor entra e cai em /professor/dashboard', async ({ page }) => {
    await loginAsTutor(page)
    // Título "Meus Módulos" é o sinal inequívoco do dashboard do tutor
    await expect(page.getByRole('heading', { name: 'Meus Módulos' })).toBeVisible()
    // O módulo seedado precisa estar listado
    await expect(page.getByText('III - Ataque e Defesa')).toBeVisible()
  })

  test('aluno entra e cai em /aluno/dashboard', async ({ page }) => {
    await loginAsAluno(page)
    // O dashboard do aluno exibe o nome do módulo quando há matrícula ativa
    await expect(page.getByText('III - Ataque e Defesa')).toBeVisible()
  })

  test('acesso sem sessão a /professor/dashboard redireciona para /login', async ({ page }) => {
    await page.context().clearCookies()
    await page.goto('/professor/dashboard')
    await expect(page).toHaveURL(/\/login/)
  })

  test('acesso sem sessão a /aluno/dashboard redireciona para /login', async ({ page }) => {
    await page.context().clearCookies()
    await page.goto('/aluno/dashboard')
    await expect(page).toHaveURL(/\/login/)
  })
})
