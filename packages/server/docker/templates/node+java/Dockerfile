FROM node:20-slim

# 安装基础工具 + JDK
RUN apt-get update && apt-get install -y \
    git \
    curl \
    openjdk-17-jdk \
    && rm -rf /var/lib/apt/lists/*

# 创建非 root 用户
RUN useradd -m -u 1000 -s /bin/bash codelink

# 安装 Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code

# 预置 Claude Code 配置目录
RUN mkdir -p /home/codelink/.claude && \
    chown -R codelink:codelink /home/codelink/.claude

# 内置 settings.json（bypass 权限白名单）
COPY claude-settings.json /home/codelink/.claude/settings.json
RUN chown codelink:codelink /home/codelink/.claude/settings.json

# 内置 ~/.claude.json（跳过 onboarding）
COPY claude.json /home/codelink/.claude.json
RUN chown codelink:codelink /home/codelink/.claude.json

# 创建工作目录并授权
WORKDIR /workspace
RUN chown -R codelink:codelink /workspace

# 切换到非 root 用户
USER codelink

COPY node+java/entrypoint.sh /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]