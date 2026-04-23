#!/bin/bash

# 停止 E2E 测试环境

echo "停止 E2E 测试环境..."

# 清理 test_ 开头的 Docker 容器和卷
echo "清理测试容器..."
docker ps -a --filter "name=test_" --format "{{.ID}}" | while read cid; do
  docker stop "$cid" 2>/dev/null || true
  docker rm -f "$cid" 2>/dev/null || true
done

# 清理 test_ 开头的 Docker 卷
docker volume ls --filter "name=test_" --format "{{.Name}}" | while read vname; do
  docker volume rm "$vname" 2>/dev/null || true
done

echo "测试容器已清理"

# 通过 PID 文件停止后端和前端进程
if [ -f /tmp/code-link-backend.pid ]; then
    kill "$(cat /tmp/code-link-backend.pid)" 2>/dev/null || true
    rm /tmp/code-link-backend.pid
fi

if [ -f /tmp/code-link-frontend.pid ]; then
    kill "$(cat /tmp/code-link-frontend.pid)" 2>/dev/null || true
    rm /tmp/code-link-frontend.pid
fi

echo "E2E 测试环境已停止"