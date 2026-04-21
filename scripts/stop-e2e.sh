#!/bin/bash

# 停止 E2E 测试环境

echo "停止 E2E 测试环境..."

pkill -f "next dev" 2>/dev/null || true
pkill -f "node.*dist/index" 2>/dev/null || true

echo "E2E 测试环境已停止"
