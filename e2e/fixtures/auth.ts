/**
 * Helpers de autenticação para os specs E2E.
 *
 * Usam a página /dev/login (só existe em NODE_ENV=development) para
 * estabelecer sessão sem depender de Google OAuth. A página renderiza
 * um botão <form action="/api/dev/login" method="POST"> por usuário;
 * nós filtramos pelo email e submetemos.
 */
import { Page, expect } from '@playwright/test'

async function loginAs(page: Page, email: string) {
  await page.goto('/dev/login')
  // Cada usuário é um <form> com um <input hidden name="email"> seguido de botão
  const form = page.locator(`form:has(input[name="email"][value="${email}"])`)
  await expect(form, `form de login para ${email} não encontrado`).toHaveCount(1)
  await form.locator('button[type="submit"]').click()
  await page.waitForURL(/\/(professor|aluno)\/dashboard/, { timeout: 15_000 })
}

export async function loginAsTutor(page: Page) {
  await loginAs(page, 'tutor.e2e@prof.cesupa.br')
  await expect(page).toHaveURL(/\/professor\/dashboard/)
}

export async function loginAsAluno(page: Page) {
  await loginAs(page, 'aluno1.e2e@aluno.cesupa.br')
  await expect(page).toHaveURL(/\/aluno\/dashboard/)
}
