# 测试目录结构

## 目录分类

### Core 核心模块测试 (`core/`)
测试核心基础设施组件：
- `config.test.ts` - 配置管理（含必填配置验证）
- `crypto.test.ts` - AES-256-GCM 加密
- `database.test.ts` - DatabaseConnection 和 BaseRepository
- `pagination.test.ts` - Repository 分页限制
- `errors.test.ts` - 业务错误类和响应辅助函数
- `error-handler.test.ts` - Express 错误处理中间件
- `server.test.ts` - Express 服务器启动和路由

### Modules 业务模块测试 (`modules/`)
测试各业务模块的 Service、Repository 及 lib：
- `auth/` - 认证模块
  - `service.test.ts` - 认证业务逻辑
  - `repository.test.ts` - 认证数据层
  - `rate-limit.test.ts` - 认证接口限流
- `organization/` - 组织模块
  - `service.test.ts` - 组织业务逻辑
  - `repository.test.ts` - 组织数据层
- `project/` - 项目模块
  - `service.test.ts` - 项目业务逻辑
  - `repository.test.ts` - 项目数据层
- `draft/` - 草稿模块
  - `service.test.ts` - 草稿业务逻辑
  - `repository.test.ts` - 草稿数据层
  - `commands.test.ts` - AI 命令解析
- `build/` - 构建模块
  - `service.test.ts` - 构建业务逻辑
  - `repository.test.ts` - 构建数据层
  - `port-manager.test.ts` - 端口分配管理
- `container/` - 容器模块
  - `templates.test.ts` - 容器模板配置
- `claude-config/` - Claude 配置模块
  - `service.test.ts` - 配置业务逻辑
  - `repository.test.ts` - 配置数据层
- `gitprovider/` - Git 提供商集成
  - `service.test.ts` - OAuth 流程业务逻辑
  - `repository.test.ts` - Token 数据层

### Middleware 中间件测试 (`middleware/`)
测试 Express 中间件：
- `validation.test.ts` - 请求验证中间件
- `request-id.test.ts` - 请求 ID 生成
- `cors-config.test.ts` - CORS 配置

### Socket WebSocket 测试 (`socket/`)
测试 Socket.IO 相关功能：
- `ws-types.test.ts` - WebSocket 事件类型定义
- `room-manager.test.ts` - 房间用户追踪和清理
- `rate-limit.test.ts` - Socket 连接限流
- `middleware/auth.test.ts` - Socket 认证中间件

### Shared 共享服务测试 (`shared/`)
测试跨模块共享服务：
- `permission.service.test.ts` - 权限服务

### Database 数据库测试 (`db/`)
测试数据库 schema 和初始化：
- `schema.test.ts` - 数据库表、约束、级联删除
- `init-admin.test.ts` - 默认管理员初始化

### Helpers 测试辅助工具 (`helpers/`)
提供测试用的辅助函数：
- `test-db.ts` - 测试数据库操作 helper
- `shared-test-db.ts` - E2E 测试共享数据库

## 已删除的冗余测试

| 原文件 | 原因 |
|--------|------|
| 所有 7 个 `controller.test.ts` | 仅测 mock delegation，无业务价值 |
| `helpers/test-db.test.ts` | meta-testing，真正测试失败会自然暴露 helper bug |
| `db-indexes.test.ts` | 测试实现细节而非功能需求 |
| `core/logger.test.ts` | 测试第三方库接口，非业务逻辑 |
| `core/config-required.test.ts` | 已合并入 `core/config.test.ts` |
| `tokens-schema.test.ts` | 已合并入 `db/schema.test.ts` |

## 已移动的测试文件

| 原路径 | 新路径 |
|--------|--------|
| `crypto.test.ts` | `core/crypto.test.ts` |
| `ai-commands.test.ts` | `modules/draft/commands.test.ts` |
| `ws-types.test.ts` | `socket/ws-types.test.ts` |
| `port-manager.test.ts` | `modules/build/port-manager.test.ts` |
| `templates.test.ts` | `modules/container/templates.test.ts` |
| `auth-rate-limit.test.ts` | `modules/auth/rate-limit.test.ts` |
| `cors-config.test.ts` | `middleware/cors-config.test.ts` |
| `socket-rate-limit.test.ts` | `socket/rate-limit.test.ts` |
| `socket-room-cleanup.test.ts` | `socket/room-manager.test.ts` |
| `repository-pagination.test.ts` | `core/pagination.test.ts` |
| `server.test.ts` | `core/server.test.ts` |
| `db.test.ts` | `db/schema.test.ts` |