import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import solid from 'vite-plugin-solid';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: '/',
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [solid()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    build: {
      chunkSizeWarningLimit: 400,
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            // Vendor chunks - split large npm dependencies
            if (id.includes('node_modules')) {
              if (id.includes('ethers')) return 'vendor-ethers';
              if (id.includes('firebase')) return 'vendor-firebase';
              if (id.includes('solid')) return 'vendor-solid';
              if (id.includes('lucide')) return 'vendor-icons';
              if (id.includes('@google/generative-ai') || id.includes('@google/genai')) return 'vendor-gemini';
              if (id.includes('axios')) return 'vendor-axios';
              // Mermaid must be its own async chunk -- it has circular deps that crash if bundled into vendor
              if (id.includes('mermaid')) return 'vendor-mermaid';
              if (id.includes('marked') || id.includes('highlight')) return 'vendor-markdown';
              if (id.includes('apexcharts') || id.includes('chart')) return 'vendor-charts';
              if (id.includes('qrcode')) return 'vendor-qr';
              if (id.includes('motion') || id.includes('animate')) return 'vendor-motion';
              // Split remaining vendor by first-level package name
              const match = id.match(/node_modules\/([^\/]+)/);
              if (match) {
                const pkg = match[1];
                if (['@noble', '@scure', 'bn.js', 'hash.js', 'elliptic', 'secp256k1'].some(p => pkg.includes(p))) {
                  return 'vendor-crypto';
                }
                if (['buffer', 'stream', 'util', 'events', 'process'].some(p => pkg.includes(p))) {
                  return 'vendor-polyfill';
                }
              }
              return 'vendor';
            }

            // Admin tabs - lazy loaded, separate chunk
            if (id.includes('/components/admin/tabs/')) {
              return 'admin-tabs';
            }

            // Admin dashboard sub-components
            if (id.includes('/components/admin/dashboard/')) {
              return 'admin-dashboard';
            }

            // Admin users sub-components
            if (id.includes('/components/admin/users/')) {
              return 'admin-users';
            }

            // Admin page components - split per page for better lazy loading
            if (id.includes('/components/admin/')) {
              // Extract Admin* component name for individual chunks
              const match = id.match(/\/components\/admin\/Admin(\w+)\.tsx/);
              if (match) {
                return `admin-${match[1].toLowerCase()}`;
              }
              // Shared admin code (layout, context) - only specific shared files
              if (id.includes('adminRoleContext') || id.includes('AdminLayout')) {
                return 'admin-core';
              }
              // Let lazy-loaded sub-components (ActivateContract, ManagePartners, 
              // UploadCSV, Announcement, PaymasterAdmin, etc.) get their own 
              // auto-generated chunks via Rollup's default code splitting
              return undefined;
            }

            // Wallet components - separate chunk
            if (id.includes('/components/wallet/')) {
              return 'wallet';
            }

            // Main Wallet.tsx - separate chunk
            if (id.includes('Wallet.tsx')) {
              return 'wallet-main';
            }

            // Chat components
            if (id.includes('/components/chat/')) {
              return 'chat';
            }

            // All services bundled together to avoid circular deps
            if (id.includes('/services/')) {
              return 'services';
            }
          }
        }
      }
    }
  };
});
