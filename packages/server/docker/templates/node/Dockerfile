# docker/templates/node/Dockerfile
FROM node:20-slim

# 安装基础工具
RUN apt-get update && apt-get install -y \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 安装 Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code

# 创建工作目录
WORKDIR /workspace

# 复制启动脚本并创建 agent 目录
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh && mkdir -p /agent

ENTRYPOINT ["/entrypoint.sh"]