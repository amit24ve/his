import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  server: {
    port: 8900,
    host: '0.0.0.0',

    // Your domain
    allowedHosts: [
      'cubehis.avopay.pro',
      'localhost',
      '127.0.0.1'
    ],

    fs: {
      allow: [
        path.resolve(__dirname, '.'),
        path.resolve(__dirname, '..')
      ],
      strict: true
    },

    warmup: {
      clientFiles: [
        './src/main.jsx',
        './src/App.jsx',
        './src/components/LoginForm.jsx',
        './src/index.css',
      ],
    },
  },

  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react-router-dom',
      'react-toastify',
      'axios',
      'framer-motion',
    ],
    esbuildOptions: {
      target: 'esnext',
    },
  },

  plugins: [
    react(),
    {
      name: 'spa-fallback',
      configureServer(server) {
        return () => {
          server.middlewares.use((req, res, next) => {
            if (
              req.url.startsWith('/leads/') &&
              req.url.indexOf('.') === -1
            ) {
              req.url = '/index.html';
            }
            next();
          });
        };
      }
    }
  ],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },

  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 700,

    rollupOptions: {
      output: {
        manualChunks: {
          vendor: [
            'react',
            'react-dom',
            'react-router-dom'
          ],
        },
      },
    },
  },

  // Better for production domain deployment
  base: '/'
})