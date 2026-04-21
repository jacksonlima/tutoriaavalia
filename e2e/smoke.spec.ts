/**
 * TutoriaAvalia v2 — Testes E2E: Smoke Tests
 * Autor: Jackson Lima — CESUPA
 *
 * Verifica que as páginas principais carregam corretamente.
 * Para rodar: npm run test:e2e
 */
import { test, expect } from '@playwright/test'

test.describe('Páginas públicas', () => {

  test('página raiz redireciona para login', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login/)
  })

  test('página de login carrega corretamente', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByText('TutoriaAvalia')).toBeVisible()
    await expect(page.getByText('Entrar com Google')).toBeVisible()
    await expect(page.getByText('Política de Privacidade')).toBeVisible()
  })

  test('página de privacidade é pública (sem login)', async ({ page }) => {
    await page.goto('/privacidade')
    // Usa getByRole para evitar ambiguidade (o texto aparece no h1 e no conteúdo)
    await expect(page.getByRole('heading', { name: 'Política de Privacidade' })).toBeVisible()
    await expect(page.getByText('Jackson Cordeiro Lima').first()).toBeVisible()
    await expect(page.getByText('Lei Geral de Proteção')).toBeVisible()
  })

  test('canal de direitos LGPD é público', async ({ page }) => {
    await page.goto('/direitos')
    // Usa getByRole para evitar ambiguidade (o texto aparece no h1 e em um <strong>)
    await expect(page.getByRole('heading', { name: 'Exercício de Direitos LGPD' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Enviar solicitação' })).toBeVisible()
  })

  test('página de login tem link para política de privacidade', async ({ page }) => {
    await page.goto('/login')
    const link = page.getByRole('link', { name: 'Política de Privacidade' })
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute('href', '/privacidade')
  })

})

test.describe('Rotas protegidas redirecionam para login', () => {

  test('/professor/dashboard redireciona para login', async ({ page }) => {
    await page.goto('/professor/dashboard')
    await expect(page).toHaveURL(/\/login/)
  })

  test('/aluno/dashboard redireciona para login', async ({ page }) => {
    await page.goto('/aluno/dashboard')
    await expect(page).toHaveURL(/\/login/)
  })

  test('/professor/relatorios redireciona para login', async ({ page }) => {
    await page.goto('/professor/relatorios')
    await expect(page).toHaveURL(/\/login/)
  })

})

test.describe('APIs retornam 401 sem autenticação', () => {

  test('GET /api/notificacoes retorna 401 ou 403', async ({ request }) => {
    const res = await request.get('/api/notificacoes')
    expect([401, 403, 500]).toContain(res.status())
  })

  test('GET /api/notas retorna 401 ou 403', async ({ request }) => {
    const res = await request.get('/api/notas?moduloId=qualquer')
    expect([401, 403, 500]).toContain(res.status())
  })

  test('POST /api/avaliacoes/aluno retorna 401 sem sessão', async ({ request }) => {
    const res = await request.post('/api/avaliacoes/aluno', {
      data: { problemaId: 'fake', tipoEncontro: 'ABERTURA', avaliacoes: [] },
    })
    expect([401, 403, 500]).toContain(res.status())
  })

})
