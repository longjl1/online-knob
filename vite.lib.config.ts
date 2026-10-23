import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'

const source = (path: string) => fileURLToPath(new URL(path, import.meta.url))
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': source('./src') } },
  build: {
    outDir: 'dist-lib',
    lib: {
      entry: {
        index: source('./src/index.ts'),
        'mechanical-bar': source('./src/components/mechanical-bar/index.ts'),
        'gear-wheel': source('./src/components/gear-wheel/index.ts'),
        'mechanical-flip': source('./src/components/mechanical-flip/index.ts'),
        'spring-pull': source('./src/components/spring-pull/index.ts'),
      },
      formats: ['es'],
      fileName: (_format, entry) => `${entry}.js`,
      cssFileName: 'mechanical-ui',
    },
    rolldownOptions: { external: ['react', 'react-dom', 'react/jsx-runtime', '@radix-ui/react-slot', 'class-variance-authority', 'clsx', 'tailwind-merge'] },
  },
})
