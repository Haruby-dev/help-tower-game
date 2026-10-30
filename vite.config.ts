import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/help-tower-game/',
  build: {
    // Phaser ไฟล์ใหญ่อยู่แล้ว
    chunkSizeWarningLimit: 2000,
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
  },
});
