#!/bin/bash
set -e

# 启动文件监听 agent (后续实现)
# node /agent/file-watcher.js &

# 启动 WebSocket client (后续实现)
# node /agent/ws-client.js &

# 保持容器运行
exec tail -f /dev/null