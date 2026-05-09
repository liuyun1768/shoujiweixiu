/** 宝塔 PM2：导入项目后改 cwd / 路径 */
module.exports = {
  apps: [
    {
      name: 'shoujiweixiu-api',
      cwd: __dirname + '/../backend',
      script: 'dist/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: { NODE_ENV: 'production' },
    },
  ],
}
