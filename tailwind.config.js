/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // ── shadcn/ui — variáveis CSS obrigatórias ─────────────
        // Sem estas definições o globals.css quebra no build
        // (@apply border-border, bg-background, text-foreground)
        border:      'hsl(var(--border))',
        input:       'hsl(var(--input))',
        ring:        'hsl(var(--ring))',
        background:  'hsl(var(--background))',
        foreground:  'hsl(var(--foreground))',
        primary: {
          DEFAULT:    'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT:    'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT:    'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT:    'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT:    'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT:    'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT:    'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },

        // ── Paleta CESUPA ──────────────────────────────────────
        // Extraída do site www.cesupa.br — identidade visual oficial
        cesupa: {
          navy:         '#1B2280', // azul escuro — logo, rodapé, botão Sistema Online
          'navy-dark':  '#141967', // hover do navy
          blue:         '#3A50C8', // azul vivo — seções, cards, gradiente
          'blue-dark':  '#3046B8', // hover do blue
          'blue-mid':   '#4A6FD4', // azul médio — links, títulos de cards
          teal:         '#26C6DA', // ciano — sublinhados, destaques, ícones
          'light-bg':   '#F5F6FA', // cinza claro — background de página
          'light-blue': '#E8EAF6', // azul lavanda — banner, fundos suaves
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [],
}
