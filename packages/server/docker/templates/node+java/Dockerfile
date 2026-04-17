# docker/templates/node+java/Dockerfile
FROM node:20-slim

# 安装 JDK 21
RUN apt-get update && apt-get install -y \
    openjdk-21-jdk \
    maven \
    gradle \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 设置 JAVA_HOME
ENV JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64

# 安装 Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code

WORKDIR /workspace

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh && mkdir -p /agent

ENTRYPOINT ["/entrypoint.sh"]