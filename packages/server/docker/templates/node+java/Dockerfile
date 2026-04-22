FROM node:22-slim

# 安装基础工具 + JDK 和 locale 支持
RUN apt-get update && apt-get install -y \
    git \
    curl \
    openjdk-17-jdk \
    locales \
    && rm -rf /var/lib/apt/lists/* \
    && sed -i '/en_US.UTF-8/s/^# //g' /etc/locale.gen \
    && sed -i '/zh_CN.UTF-8/s/^# //g' /etc/locale.gen \
    && locale-gen

ENV LANG=en_US.UTF-8
ENV LC_ALL=en_US.UTF-8

# 创建非 root 用户（UID 10000，避免与 node 用户冲突）
RUN useradd -m -u 10000 -s /bin/bash codelink

# 安装 Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code

# 预置 Claude Code 配置目录
RUN mkdir -p /home/codelink/.claude && \
    chown -R codelink:codelink /home/codelink/.claude

# 内置 settings.json（bypass 权限白名单 + 启用 superpowers 插件）
COPY claude-settings.json /home/codelink/.claude/settings.json
RUN chown codelink:codelink /home/codelink/.claude/settings.json

# 内置 ~/.claude.json（跳过 onboarding）
COPY claude.json /home/codelink/.claude.json
RUN chown codelink:codelink /home/codelink/.claude.json

# 构建时安装 superpowers 插件和 ui-ux-pro-max 技能
COPY setup-plugins.sh /tmp/setup-plugins.sh
RUN --mount=type=cache,target=/home/codelink/.claude/plugins/cache \
    bash /tmp/setup-plugins.sh && \
    rm /tmp/setup-plugins.sh

# 创建工作目录并授权
WORKDIR /workspace
RUN chown -R codelink:codelink /workspace

# 切换到非 root 用户
USER codelink

COPY node+java/entrypoint.sh /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]