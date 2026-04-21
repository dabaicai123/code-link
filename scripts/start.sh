#!/bin/bash

# 启动 code-link 开发环境
# 同时启动前端和后端服务，后端使用 SQLite 文件数据库

set -e

echo "启动 code-link 开发环境..."

# 杀掉可能存在的旧进程
echo "清理旧进程..."
for pidfile in /tmp/code-link-backend.pid /tmp/code-link-frontend.pid; do
  if [ -f "$pidfile" ]; then
    kill $(cat "$pidfile") 2>/dev/null || true
  fi
done
# killall 按进程名杀，WSL2 下 lsof/fuser 可能无法获取 PID
killall node 2>/dev/null || true
sleep 1

# 构建后端
echo "构建后端..."
pnpm --filter @code-link/server build

# 启动后端 (端口 4000)
echo "启动后端服务..."
cd packages/server
pnpm start &
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
echo "后端服务已就绪: http://localhost:4000"

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
echo "前端服务已就绪: http://localhost:3000"

echo ""
echo "code-link 开发环境已就绪!"
echo "后端 PID: $BACKEND_PID (SQLite: ./packages/server/data/code-link.db)"
echo "前端 PID: $FRONTEND_PID"
echo ""
echo "访问: http://localhost:3000"
echo "停止服务: ./scripts/stop.sh 或 kill $BACKEND_PID $FRONTEND_PID"

# 保存 PID 到文件，方便 stop.sh 使用
echo "$BACKEND_PID" > /tmp/code-link-backend.pid
echo "$FRONTEND_PID" > /tmp/code-link-frontend.pid