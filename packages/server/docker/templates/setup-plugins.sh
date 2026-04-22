#!/bin/bash
set -e

# Claude Code 插件和技能安装脚本
# 构建镜像时由 root 用户执行

CLINK_HOME="/home/codelink"

echo "=== Installing superpowers plugin (global) ==="
claude plugin install superpowers@claude-plugins-official --scope user || echo "⚠️ superpowers plugin install failed, skipping"

echo "=== Installing ui-ux-pro-max skills (global) ==="
# ui-ux-pro-max 通过 skills-lock.json 安装，需要先创建工作目录的 .claude 目录
mkdir -p /workspace/.claude
cat > /workspace/.claude/skills-lock.json << 'SKILLSLOCK'
{
  "version": 1,
  "skills": {
    "ui-ux-pro-max": {
      "source": "nextlevelbuilder/ui-ux-pro-max-skill",
      "sourceType": "github"
    },
    "ckm:banner-design": {
      "source": "nextlevelbuilder/ui-ux-pro-max-skill",
      "sourceType": "github"
    },
    "ckm:brand": {
      "source": "nextlevelbuilder/ui-ux-pro-max-skill",
      "sourceType": "github"
    },
    "ckm:design": {
      "source": "nextlevelbuilder/ui-ux-pro-max-skill",
      "sourceType": "github"
    },
    "ckm:design-system": {
      "source": "nextlevelbuilder/ui-ux-pro-max-skill",
      "sourceType": "github"
    },
    "ckm:slides": {
      "source": "nextlevelbuilder/ui-ux-pro-max-skill",
      "sourceType": "github"
    },
    "ckm:ui-styling": {
      "source": "nextlevelbuilder/ui-ux-pro-max-skill",
      "sourceType": "github"
    }
  }
}
SKILLSLOCK

# 确保 codelink 用户拥有所有文件权限
chown -R codelink:codelink "$CLINK_HOME/.claude"
chown -R codelink:codelink /workspace/.claude

echo "=== Setup complete ==="