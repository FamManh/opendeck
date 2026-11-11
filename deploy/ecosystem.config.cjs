// pm2 config. Chạy từ thư mục gốc repo: pm2 startOrReload deploy/ecosystem.config.cjs
const path = require('node:path')

module.exports = {
  apps: [
    {
      name: 'opendeck-api',
      cwd: path.join(__dirname, '../apps/backend'), // env.ts đọc .env từ cwd
      script: 'dist/main.js',
      instances: 1, // Socket.IO giữ state phòng trong process -> không chạy cluster
      exec_mode: 'fork',
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 4445, // ghi đè PORT trong .env (loadEnvFile không đè biến đã có)
      },
    },
    {
      name: 'opendeck-web',
      cwd: path.join(__dirname, '../apps/frontend'),
      // serve dist/ ở chế độ SPA (-s: route lạ trả index.html)
      script: 'node_modules/serve/build/main.js',
      args: '-s dist -l tcp://127.0.0.1:4444 --no-clipboard',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '256M',
    },
  ],
}
