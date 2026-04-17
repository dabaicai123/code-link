# Claude Code 项目配置

## Git 命令偏好

使用 `git -C <path>` 代替 `cd && git` 复合命令，避免触发"裸仓库攻击"的安全提示。

**示例：**
```bash
# 推荐
git -C /root/my/code-link add packages/server/src/file.ts && git -C /root/my/code-link commit -m "fix: something"

# 不推荐（会触发安全提示）
cd /root/my/code-link && git add packages/server/src/file.ts && git commit -m "fix: something"
```

## 权限配置

项目权限配置在 `.claude/settings.local.json`，包含常用命令的白名单。
