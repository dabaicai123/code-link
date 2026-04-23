#!/bin/bash

# E2E 测试环境启动脚本
# 同时启动前端和后端服务（后端使用内存数据库）
# 使用 dotenv-cli 从根 .env 注入环境变量，无内联密钥

set -e
cd "$(dirname "$0")/.."

SERVER_PORT=${SERVER_PORT:-4000}
WEB_PORT=${WEB_PORT:-3000}

echo "启动 E2E 测试环境..."

# 杀掉可能存在的旧进程
if [ -f /tmp/code-link-backend.pid ]; then
    kill "$(cat /tmp/code-link-backend.pid)" 2>/dev/null || true
    rm /tmp/code-link-backend.pid
fi
if [ -f /tmp/code-link-frontend.pid ]; then
    kill "$(cat /tmp/code-link-frontend.pid)" 2>/dev/null || true
    rm /tmp/code-link-frontend.pid
fi
sleep 2

# 构建后端
echo "构建后端..."
pnpm --filter @code-link/server build

# 启动后端 (使用内存数据库)
echo "启动后端服务 (内存数据库模式)..."
NODE_ENV=test DB_PATH=:memory: dotenv -- pnpm --filter @code-link/server start &
BACKEND_PID=$!

# 等待后端启动
sleep 3

# 检查后端是否启动成功
if ! curl -s http://localhost:${SERVER_PORT}/api/health > /dev/null 2>&1; then
    echo "后端服务启动失败"
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
fi
echo "后端服务已启动: http://localhost:${SERVER_PORT}"

# 启动前端
echo "启动前端服务..."
dotenv -- pnpm --filter @code-link/web dev &
FRONTEND_PID=$!

# 等待前端启动
sleep 5

# 检查前端是否启动成功
if ! curl -s http://localhost:${WEB_PORT} > /dev/null 2>&1; then
    echo "前端服务启动失败"
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    exit 1
fi
echo "前端服务已启动: http://localhost:${WEB_PORT}"

# 保存 PID 到文件
echo "$BACKEND_PID" > /tmp/code-link-backend.pid
echo "$FRONTEND_PID" > /tmp/code-link-frontend.pid

echo ""
echo "E2E 测试环境已就绪!"
echo "后端 PID: $BACKEND_PID (内存数据库)"
echo "前端 PID: $FRONTEND_PID"
echo ""
echo "运行测试: pnpm --filter @code-link/e2e test"
echo "停止服务: ./scripts/stop-e2e.sh 或 kill $BACKEND_PID $FRONTEND_PID"