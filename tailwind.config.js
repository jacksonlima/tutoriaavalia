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
        // ── Paleta CESUPA ──────────────────────────────────────
        // Extraída do site www.cesupa.br — identidade visual oficial
        cesupa: {
          navy:       '#1B2280', // azul escuro — logo, rodapé, botão Sistema Online
          'navy-dark':'#141967', // hover do navy
          blue:       '#3A50C8', // azul vivo — seções, cards, gradiente
          'blue-dark':'#3046B8', // hover do blue
          'blue-mid': '#4A6FD4', // azul médio — links, títulos de cards
          teal:       '#26C6DA', // ciano — sublinhados, destaques, ícones
          'light-bg': '#F5F6FA', // cinza claro — background de página
          'light-blue':'#E8EAF6', // azul lavanda — banner, fundos suaves
        },
      },
    },
  },
  plugins: [],
}
