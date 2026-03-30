/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // Enable class-based dark mode
  theme: {
    extend: {
      colors: {
        // Dark Mode (Neon Midnight Theme) - Default
        background: '#0B1120',
        panel: '#121A2C',
        text: {
          primary: '#E0E0FF',
          muted: '#94A3C0',
        },
        accent: {
          cyan: '#00D4FF',
          pink: '#FF2A6D',
        },
        status: {
          success: '#39FFA0',
          warning: '#FFB800',
        },
        // Light Mode Theme (matching the provided image)
        light: {
          background: '#F3F4F6',      // Light gray background
          panel: '#FFFFFF',            // White cards/panels
          sidebar: '#E5E7EB',          // Slightly darker gray for sidebar
          text: {
            primary: '#111827',        // Dark text
            secondary: '#374151',      // Medium dark text
            muted: '#6B7280',          // Gray text
          },
          border: '#E5E7EB',           // Light border
          card: {
            blue: '#DBEAFE',           // Light blue card background
            yellow: '#FEF3C7',         // Light yellow card background
            purple: '#E9D5FF',         // Light purple card background
            pink: '#FCE7F3',           // Light pink card background
            green: '#D1FAE5',          // Light green card background
          },
          accent: {
            cyan: '#06B6D4',           // Slightly darker cyan for better contrast
            pink: '#EC4899',           // Adjusted pink
          }
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
