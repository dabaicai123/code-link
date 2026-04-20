# 测试目录结构

## 目录分类

### Core 核心模块测试 (`core/`)
测试核心基础设施组件：
- `config.test.ts` - 配置管理
- `config-required.test.ts` - 必填配置验证
- `database.test.ts` - DatabaseConnection 和 BaseRepository
- `errors.test.ts` - 业务错误类和响应辅助函数
- `error-handler.test.ts` - Express 错误处理中间件
- `logger.test.ts` - LoggerService (Pino)

### Modules 业务模块测试 (`modules/`)
测试各业务模块的 Controller、Service、Repository：
- `auth/` - 认证模块
- `organization/` - 组织模块
- `project/` - 项目模块
- `draft/` - 草稿模块
- `build/` - 构建模块
- `gitprovider/` - Git 提供商集成
- `claude-config/` - Claude 配置模块

### Middleware 中间件测试 (`middleware/`)
测试 Express 中间件：
- `validation.test.ts` - 请求验证中间件
- `request-id.test.ts` - 请求 ID 生成

### Socket WebSocket 测试 (`socket/`)
测试 Socket.IO 相关功能：
- `middleware/auth.test.ts` - Socket 认证中间件

### Shared 共享服务测试 (`shared/`)
测试跨模块共享服务：
- `permission.service.test.ts` - 权限服务

### Database 数据库测试 (`db/`)
测试数据库初始化：
- `init-admin.test.ts` - 默认管理员初始化

### Helpers 测试辅助工具 (`helpers/`)
提供测试用的辅助函数和 mock：
- `test-db.ts` - 测试数据库操作 helper
- `test-db.test.ts` - helper 函数自身测试
- `shared-test-db.ts` - E2E 测试共享数据库

## 根目录测试文件

基础设施组件测试：
- `server.test.ts` - Express 服务器启动和路由
- `db.test.ts` - 数据库 Schema 和约束
- `tokens-schema.test.ts` - project_tokens/project_repos 表

安全相关测试：
- `auth-rate-limit.test.ts` - 认证接口限流
- `socket-rate-limit.test.ts` - Socket 连接限流
- `cors-config.test.ts` - CORS 配置
- `socket-error-sanitize.test.ts` - Socket 错误信息脱敏

Docker/容器测试：
- `volume-manager.test.ts` - Docker 卷管理
- `port-manager.test.ts` - 端口分配管理
- `templates.test.ts` - 容器模板

AI 功能测试：
- `ai-commands.test.ts` - AI 命令处理

其他：
- `crypto.test.ts` - AES 加密
- `ws-types.test.ts` - WebSocket 类型定义
- `repository-pagination.test.ts` - Repository 分页功能

## 已删除的冗余测试

以下测试文件已被删除，因为对应的功能已迁移到新模块架构：

| 原文件 | 替代测试 |
|--------|----------|
| `github-client.test.ts` | `modules/gitprovider/service.test.ts` |
| `gitlab-client.test.ts` | `modules/gitprovider/service.test.ts` |
| `oauth.test.ts` | `modules/gitprovider/service.test.ts` |
| `logger.test.ts` | `core/logger.test.ts` |
| `logger-middleware.test.ts` | `middleware/request-id.test.ts` |
| `errors.test.ts` | `core/errors.test.ts` |
| `docker-client.test.ts` - 仅测试单例模式，价值低 | 已移除 |