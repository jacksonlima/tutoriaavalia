import { handlers } from '@/lib/auth'

// Força Node.js runtime — Prisma não funciona no Edge Runtime
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const { GET, POST } = handlers
