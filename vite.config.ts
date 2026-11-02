/// <reference types="vitest" />
import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Configuración de desarrollo para reducir warnings
  server: {
    proxy: {
      '/api/dolarazo': {
        target: 'https://www.dolarazo.com.ar',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/dolarazo/, ''),
        secure: false,
      },
      '/api/balanz': {
        target: 'https://calculadora.balanz.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/balanz/, ''),
        secure: false,
        cookieDomainRewrite: { '*': '' },
        cookiePathRewrite: {
          '/calculadoraDeBonos': '/api/balanz/calculadoraDeBonos',
          '/': '/'
        },
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            const cookies = proxyRes.headers['set-cookie'];
            if (cookies) {
              proxyRes.headers['set-cookie'] = cookies.map(c => 
                c.replace(/;\s*Secure/gi, '')
                 .replace(/;\s*Domain=[^;]+/gi, '')
                 .replace(/;\s*SameSite=[^;]+/gi, '; SameSite=Lax')
              );
            }
          });
        }
      }
    },
    warmup: {
      // Pre-cargar estos módulos para evitar warnings de preload
      clientFiles: [
        './src/main.tsx',
        './src/App.tsx',
      ]
    }
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: './src/test/setup.ts',
    // Edge Function tests run under Deno (`deno test`), not Vitest.
    exclude: ['**/node_modules/**', '**/dist/**', 'supabase/functions/**'],
    // Placeholder values so modules that build the Supabase client load without a local .env.
    env: {
      VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'test-publishable-key',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData',
        'dist/',
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Configuración de módulos preload
    modulePreload: {
      polyfill: false, // Desactiva el polyfill de modulepreload
    },
    rollupOptions: {
      output: {
        // Only always-needed libraries get their own chunk. jspdf, html2canvas and recharts stay
        // out on purpose: forcing them here made Rollup hoist shared helpers into those chunks,
        // so every page downloaded them up front even without exporting or showing a chart.
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'query-vendor': ['@tanstack/react-query'],
          'supabase-vendor': ['@supabase/supabase-js'],
        },
      },
    },
    // Increase chunk size warning limit to 600kb
    chunkSizeWarningLimit: 600,
  },
})