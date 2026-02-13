import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      '192.168.1.101',
      '192.168.1.101.nip.io',
      '.nip.io'  // Allow all nip.io subdomains
    ]
  },
  build: {
    target: 'esnext'
  }
});
