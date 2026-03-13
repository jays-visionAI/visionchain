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
      target: 'es2020',
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            // ── Vendor: always-needed, split by library ──────────────────
            if (id.includes('node_modules')) {
              if (id.includes('ethers')) return 'vendor-ethers';
              if (id.includes('firebase')) return 'vendor-firebase';
              if (id.includes('lucide')) return 'vendor-icons';
              if (id.includes('@google/generative-ai') || id.includes('@google/genai')) return 'vendor-gemini';
              if (id.includes('mermaid')) return 'vendor-mermaid'; // circular-dep-safe
              if (id.includes('marked') || id.includes('highlight')) return 'vendor-markdown';
              // Chart libs: split heavy charting into separate lazy chunks
              if (id.includes('klinecharts')) return 'vendor-kline';
              if (id.includes('lightweight-charts')) return 'vendor-lightweight';
              if (id.includes('apexcharts') || id.includes('solid-apexcharts')) return 'vendor-charts';
              if (id.includes('qrcode')) return 'vendor-qr';
              if (id.includes('motion') || id.includes('animate')) return 'vendor-motion';
              if (id.includes('axios')) return 'vendor-axios';
              // Heavy libs that are only used in specific views
              if (id.includes('quill')) return 'vendor-quill';
              if (id.includes('papaparse')) return 'vendor-csv';
              if (id.includes('bip39')) return 'vendor-bip39';
              if (id.includes('source-map')) return 'vendor-sourcemap';
              // Crypto primitives
              const match = id.match(/node_modules\/([^\/]+)/);
              if (match) {
                const pkg = match[1];
                if (['@noble', '@scure', 'bn.js', 'hash.js', 'elliptic', 'secp256k1'].some(p => pkg.includes(p)))
                  return 'vendor-crypto';
                if (['buffer', 'stream', 'util', 'events', 'process'].some(p => pkg.includes(p)))
                  return 'vendor-polyfill';
              }
              return 'vendor';
            }

            // ── Admin ─────────────────────────────────────────────────────
            if (id.includes('/components/admin/tabs/')) return 'admin-tabs';
            if (id.includes('/components/admin/dashboard/')) return 'admin-dashboard';
            if (id.includes('/components/admin/users/')) return 'admin-users';
            if (id.includes('/components/admin/')) {
              const m = id.match(/\/components\/admin\/Admin(\w+)\.tsx/);
              if (m) return `admin-${m[1].toLowerCase()}`;
              if (id.includes('adminRoleContext') || id.includes('AdminLayout')) return 'admin-core';
              return undefined;
            }

            // ── Wallet: split each view into its own lazy chunk ───────────
            // Core always-present wallet pieces
            if (id.includes('/components/wallet/WalletSidebar')) return 'wallet-core';
            if (id.includes('/components/wallet/WalletViewHeader')) return 'wallet-core';
            if (id.includes('/components/wallet/VisionLogo')) return 'wallet-core';
            if (id.includes('/components/wallet/VisionFullLogo')) return 'wallet-core';

            // Game files – separate from wallet-core (loaded only when Game Center is opened)
            if (id.includes('/components/wallet/VCNGameCenter')) return 'wallet-games';
            if (id.match(/\/components\/wallet\/\w+Game\.tsx/)) return 'wallet-games';
            if (id.includes('/components/wallet/GameDailyLeaderboard')) return 'wallet-games';
            if (id.includes('/services/game/')) return 'wallet-games';

            // Heavy views – each gets its own async chunk
            if (id.includes('/components/wallet/WalletDashboard')) return 'wallet-dashboard';
            if (id.includes('/components/wallet/WalletDisk')) return 'wallet-disk';
            if (id.includes('/components/wallet/WalletAssets')) return 'wallet-assets';
            if (id.includes('/components/wallet/WalletFlowModals')) return 'wallet-modals';
            if (id.includes('/components/wallet/WalletSend')) return 'wallet-send';
            if (id.includes('/components/wallet/WalletReceive')) return 'wallet-send';
            if (id.includes('/components/wallet/WalletMint')) return 'wallet-mint';
            if (id.includes('/components/wallet/WalletNodes')) return 'wallet-nodes';
            if (id.includes('/components/wallet/WalletContacts')) return 'wallet-contacts';
            if (id.includes('/components/wallet/WalletSettings')) return 'wallet-settings';
            if (id.includes('/components/wallet/WalletNotifications')) return 'wallet-notifications';
            if (id.includes('/components/wallet/WalletReferral')) return 'wallet-referral';
            if (id.includes('/components/wallet/WalletActivity')) return 'wallet-activity';
            if (id.includes('/components/wallet/WalletCampaign')) return 'wallet-campaign';
            if (id.includes('/components/wallet/VisionInsight')) return 'wallet-insight';
            if (id.includes('/components/wallet/VisionMarket')) return 'wallet-market';
            if (id.includes('/components/wallet/VisionChart')) return 'wallet-chart';
            if (id.includes('/components/wallet/WalletCexPortfolio')) return 'wallet-cex';
            if (id.includes('/components/wallet/AgentHosting')) return 'wallet-agent';
            if (id.includes('/components/wallet/')) return 'wallet-core';

            // Bridge & Staking (heavy, navigated-to only)
            if (id.includes('/components/Bridge')) return 'bridge';
            if (id.includes('/components/ValidatorStaking')) return 'staking';

            // Wallet.tsx entry – keep light
            if (id.includes('/components/Wallet.tsx') || id.includes('Wallet.tsx')) return 'wallet-main';

            // Chat
            if (id.includes('/components/chat/')) return 'chat';
          }
        }
      }
    }
  };
});
