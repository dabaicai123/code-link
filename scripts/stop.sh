#!/bin/bash

# 停止 code-link 开发环境

echo "停止 code-link 开发环境..."

# 从 PID 文件读取并杀进程
if [ -f /tmp/code-link-backend.pid ]; then
    kill "$(cat /tmp/code-link-backend.pid)" 2>/dev/null || true
    rm /tmp/code-link-backend.pid
fi

if [ -f /tmp/code-link-frontend.pid ]; then
    kill "$(cat /tmp/code-link-frontend.pid)" 2>/dev/null || true
    rm /tmp/code-link-frontend.pid
fi

# 兜底：杀掉可能残留的进程
pkill -f "next dev" 2>/dev/null || true
pkill -f "node.*dist/index" 2>/dev/null || true

echo "code-link 开发环境已停止"