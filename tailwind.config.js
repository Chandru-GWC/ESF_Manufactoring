/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          purple: "var(--accent-primary)",
          blue: "var(--brand-blue)",
          orange: "var(--brand-orange)",
          navy: "var(--brand-navy)",
          white: "var(--brand-white)",
          bg: "var(--bg-app)",
          'blue-soft': "var(--blue-soft)",
          'purple-soft': "var(--accent-subtle)",
          'peach-soft': "var(--peach-soft)",
          sky: "var(--sky)",
          cyan: "var(--cyan)",
          primary: "var(--accent-primary)",
          hover: "var(--accent-hover)",
          subtle: "var(--accent-subtle)",
        },
        canvas: {
          app: "var(--bg-app)",
          surface: "var(--bg-surface)",
          subtle: "var(--bg-subtle)",
          muted: "var(--bg-muted)",
        },
        sidebar: {
          bg: "var(--sidebar-bg)",
          surface: "var(--sidebar-surface)",
          border: "var(--sidebar-border)",
          text: "var(--sidebar-text)",
          muted: "var(--sidebar-text-muted)",
          active: "var(--sidebar-active)",
        },
        ink: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)",
          disabled: "var(--text-disabled)",
        },
        line: {
          subtle: "var(--border-subtle)",
          default: "var(--border-default)",
          strong: "var(--border-strong)",
        },
        severity: {
          critical: {
            text: "var(--severity-critical-text)",
            bg: "var(--severity-critical-bg)",
            border: "var(--severity-critical-border)",
            dot: "var(--severity-critical-dot)",
          },
          high: {
            text: "var(--severity-high-text)",
            bg: "var(--severity-high-bg)",
            border: "var(--severity-high-border)",
            dot: "var(--severity-high-dot)",
          },
          warning: {
            text: "var(--severity-warning-text)",
            bg: "var(--severity-warning-bg)",
            border: "var(--severity-warning-border)",
            dot: "var(--severity-warning-dot)",
          },
          success: {
            text: "var(--severity-success-text)",
            bg: "var(--severity-success-bg)",
            border: "var(--severity-success-border)",
            dot: "var(--severity-success-dot)",
          },
          info: {
            text: "var(--severity-info-text)",
            bg: "var(--severity-info-bg)",
            border: "var(--severity-info-border)",
            dot: "var(--severity-info-dot)",
          },
        },
      },
      fontFamily: {
        sans: ['Manrope', 'Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'IBM Plex Mono', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        'sm-subtle': '0 1px 2px 0 rgba(15, 23, 42, 0.04)',
        'elevated': '0 4px 12px -2px rgba(15, 23, 42, 0.06), 0 2px 6px -1px rgba(15, 23, 42, 0.03)',
        'modal': '0 20px 25px -5px rgba(15, 23, 42, 0.16), 0 8px 10px -6px rgba(15, 23, 42, 0.10)',
      },
    },
  },
  plugins: [
    require('daisyui'),
  ],
  daisyui: {
    themes: [
      {
        light: {
          "primary": "#1D4ED8",
          "secondary": "#2563EB",
          "accent": "#EA580C",
          "neutral": "#111827",
          "base-100": "#FFFFFF",
          "base-200": "#F7F8FA",
          "base-300": "#E2E8F0",
          "info": "#2563EB",
          "success": "#16A34A",
          "warning": "#EA580C",
          "error": "#DC2626",
        },
      },
    ],
    darkTheme: "light",
  },
};
