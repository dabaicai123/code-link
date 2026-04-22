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

# 停止后端和前端进程
pkill -f "next dev" 2>/dev/null || true
pkill -f "node.*dist/index" 2>/dev/null || true

echo "E2E 测试环境已停止"