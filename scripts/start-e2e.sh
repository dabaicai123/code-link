#!/bin/bash

# E2E 测试环境启动脚本
# 同时启动前端和后端服务（后端使用内存数据库）

set -e

echo "启动 E2E 测试环境..."

# 杀掉可能存在的旧进程
pkill -f "next dev" 2>/dev/null || true
pkill -f "node.*dist/index" 2>/dev/null || true
sleep 2

# 构建后端
echo "构建后端..."
pnpm --filter @code-link/server build

# 启动后端 (端口 4000，使用内存数据库)
echo "启动后端服务 (内存数据库模式)..."
cd packages/server
NODE_ENV=test DB_PATH=:memory: JWT_SECRET=e2e-test-secret-key-minimum-32-chars-long CLAUDE_CONFIG_ENCRYPTION_KEY=e2e-test-encryption-key-minimum-32-chars pnpm start &
BACKEND_PID=$!
cd ../..

# 等待后端启动
sleep 3

# 检查后端是否启动成功
if ! curl -s http://localhost:4000/api/health > /dev/null 2>&1; then
    echo "后端服务启动失败"
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
fi
echo "后端服务已启动: http://localhost:4000"

# 启动前端 (端口 3000)
echo "启动前端服务..."
cd packages/web
pnpm dev &
FRONTEND_PID=$!
cd ../..

# 等待前端启动
sleep 5

# 检查前端是否启动成功
if ! curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "前端服务启动失败"
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    exit 1
fi
echo "前端服务已启动: http://localhost:3000"

echo ""
echo "E2E 测试环境已就绪!"
echo "后端 PID: $BACKEND_PID (内存数据库)"
echo "前端 PID: $FRONTEND_PID"
echo ""
echo "运行测试: pnpm --filter @code-link/e2e test"
echo "停止服务: ./scripts/stop-e2e.sh 或 kill $BACKEND_PID $FRONTEND_PID"
