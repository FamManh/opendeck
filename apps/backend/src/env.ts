// Phải được import đầu tiên: decorator của gateway đọc process.env lúc nạp module, trước khi ConfigModule chạy.
try { process.loadEnvFile('.env') } catch { /* .env là tuỳ chọn khi biến môi trường đã có sẵn */ }
