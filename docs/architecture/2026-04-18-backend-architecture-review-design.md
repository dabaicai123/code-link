---
name: Backend Architecture Review
description: 后端模块架构审查报告，识别过度设计、过期设计、架构问题和性能瓶颈
type: project
---

# 后端架构审查设计文档

## 审查范围

- 核心业务模块：Auth、Organization、Project、Draft
- 数据层设计：Schema、Repositories
- 辅助功能模块：Build、AI、WebSocket、Terminal
- 基础设施模块：Docker、Git

## 审查重点

过度设计、过期设计、架构合理性、性能优化

---

## 一、核心业务模块

### 1. Auth 模块

**问题清单：**

| ID | 类型 | 问题 | 位置 | 优先级 |
|----|------|------|------|--------|
| A1 | 过度设计 | `createOrgMemberMiddleware`、`createProjectMemberMiddleware`、`createCanCreateOrgMiddleware` 三个中间件工厂函数每次请求新建 Repository 实例 | middleware/auth.ts:71-211 | 中 |
| A2 | 过度设计 | `ROLE_HIERARCHY` 定义在 auth.ts，但 Service 层也有权限检查逻辑，存在重复 | middleware/auth.ts:9-13 | 低 |
| A3 | 过期设计 | `projectRole` 扩展字段未使用，项目权限实际通过组织检查 | middleware/auth.ts:21-22 | 高 |
| A4 | 架构问题 | 权限检查逻辑分散在 Service 和 Middleware，缺乏统一权限服务 | 多处 | 中 |

**修改方案：**

1. **简化中间件设计**：Repository 使用单例模式，避免每次请求新建实例
2. **移除未使用的 `projectRole` 字段**
3. **创建 PermissionService** 统一权限检查逻辑，Service 和 Middleware 调用此服务

### 2. Organization 模块

**问题清单：**

| ID | 类型 | 问题 | 位置 | 优先级 |
|----|------|------|------|--------|
| O1 | 过度设计 | 每个方法重复 `isSuperAdmin` 检查，可抽取私有方法 | organization.service.ts:多处 | 中 |
| O2 | 架构问题 | `OrganizationDetail` 接口与 Repository 返回类型重叠 | organization.service.ts:29-35 | 低 |
| O3 | 性能问题 | `acceptInvitation` 多次数据库查询（查邀请、更新、添加成员、查组织、查成员） | organization.service.ts:344-376 | 高 |

**修改方案：**

1. 创建 `checkPermission(orgId, userId, minRole)` 私有方法
2. 合并 `acceptInvitation` 操作为单次事务

### 3. Project 模块

**问题清单：**

| ID | 类型 | 问题 | 位置 | 优先级 |
|----|------|------|------|--------|
| P1 | 过度设计 | `parseRepoUrl` 是纯工具函数，应放在 utils | project.service.ts:116-138 | 低 |
| P2 | 架构问题 | `isProjectMember` 方法重复权限检查逻辑 | project.service.ts:144-157 | 中 |
| P3 | 过度设计 | `getProjectForRepo` 与 `findById` 功能重叠 | project.service.ts:227-239 | 低 |

**修改方案：**

1. 将 `parseRepoUrl` 移到 `utils/git.ts`
2. 合并 `getProjectForRepo` 和 `findById`，通过参数控制

### 4. Draft 模块

**问题清单：**

| ID | 类型 | 问题 | 位置 | 优先级 |
|----|------|------|------|--------|
| D1 | 过度设计 | Draft 定义 6 种状态，可能不需要这么多 | draft.service.ts:89 | 中 |
| D2 | 过度设计 | `message_confirmations` 表设计复杂，使用场景有限 | schema.ts:145-153 | 高 |
| D3 | 性能问题 | `findMessages` 查询所有消息无分页优化 | draft.repository.ts:155-182 | 高 |
| D4 | 架构问题 | AI 响应逻辑在 Route 层，应在 Service 层 | routes/drafts.ts:111-145 | 高 |

**修改方案：**

1. 评估简化 Draft 状态为 3-4 种
2. 将 AI 响应逻辑移到 DraftService
3. 添加消息分页和索引优化

---

## 二、数据层设计

### Schema 设计

**问题清单：**

| ID | 类型 | 问题 | 位置 | 优先级 |
|----|------|------|------|--------|
| S1 | 过期设计 | `project_members` 表未使用 | db/schema/projects.ts:17-24 | 高 |
| S2 | 架构问题 | `projects.organizationId` 可为空，但业务逻辑假设必须属于组织 | db/schema/projects.ts:10 | 高 |
| S3 | 过度设计 | `draft_messages.message_type` 定义 8 种，部分未使用 | db/schema/drafts.ts:36-38 | 中 |
| S4 | 过度设计 | `message_confirmations` 表功能复杂 | db/schema/drafts.ts:44-52 | 高 |
| S5 | 性能问题 | `draft_messages` 缺少 `updated_at` 索引 | db/schema/drafts.ts | 中 |
| S6 | 架构问题 | Schema 存在 raw SQL (`schema.ts`) 和 Drizzle (`db/schema/*.ts`) 两套定义 | db/schema.ts | 高 |

**修改方案：**

1. **删除 `project_members` 表及相关代码**
2. **将 `projects.organizationId` 改为 NOT NULL**
3. **删除 raw SQL 的 `schema.ts`，只使用 Drizzle Schema**
4. **简化 `message_type` 和评估删除 `message_confirmations`**

### Repositories 设计

**问题清单：**

| ID | 类型 | 问题 | 位置 | 优先级 |
|----|------|------|------|--------|
| R1 | 架构问题 | Repository 方法每次调用获取 `getDb()`，可使用实例级 db | repositories/*.ts | 低 |
| R2 | 架构问题 | `DraftRepository.upsertConfirmation` 混用 raw SQL 和 Drizzle | draft.repository.ts:184-203 | 中 |

**修改方案：**

1. Repository 构造时获取 db 实例
2. 统一使用 Drizzle ORM，删除 raw SQL

---

## 三、辅助功能模块

### AI 模块

**问题清单：**

| ID | 类型 | 问题 | 位置 | 优先级 |
|----|------|------|------|--------|
| AI1 | 过度设计 | 定义 7 种命令类型，实际可能只用几种 | ai/commands.ts:8-15 | 中 |
| AI2 | 过期设计 | `getSupportedCommands` 方法未调用 | ai/commands.ts:148-157 | 低 |

**修改方案：**

1. 评估简化命令类型
2. 删除未使用方法

### WebSocket 模块

**问题清单：**

| ID | 类型 | 问题 | 位置 | 优先级 |
|----|------|------|------|--------|
| WS1 | 架构问题 | ChannelManager 同时管理 Project 和 Draft 频道，职责混杂 | websocket/channels.ts | 中 |
| WS2 | 过期设计 | `messages` 表未实现 chat 消息存储功能 | db/schema.ts:66-73 | 高 |

**修改方案：**

1. 拆分为 `ProjectChannelManager` 和 `DraftChannelManager`
2. 删除 `messages` 表或实现存储功能

### Build 模块

**问题清单：**

| ID | 类型 | 问题 | 位置 | 优先级 |
|----|------|------|------|--------|
| B1 | 架构问题 | BuildManager 使用全局单例，应统一单例模式 | build/build-manager.ts:104-111 | 低 |

### Terminal 模块

**无明显问题**，设计合理。

---

## 四、基础设施模块

### Docker 模块

**问题清单：**

| ID | 类型 | 问题 | 位置 | 优先级 |
|----|------|------|------|--------|
| DCK1 | 架构问题 | templates.ts 使用 process.cwd()，部署时可能出错 | docker/templates.ts:16-28 | 中 |

**修改方案：**

使用配置或环境变量指定模板目录路径

### Git 模块

**问题清单：**

| ID | 类型 | 问题 | 位置 | 优先级 |
|----|------|------|------|--------|
| G1 | 过度设计 | TokenManager 只是 Repository 包装，可删除 | git/token-manager.ts | 低 |

**修改方案：**

删除 TokenManager，直接使用 TokenRepository

---

## 五、汇总优先级排序

### 高优先级（应立即修复）

| 问题 | 影响 |
|------|------|
| A3: 移除未使用的 projectRole | 清理过期代码 |
| O3: acceptInvitation 性能优化 | 减少数据库查询 |
| D4: AI 响应逻辑位置错误 | 架构分层问题 |
| S1: 删除 project_members 表 | 清理未使用代码 |
| S2: organizationId 改为 NOT NULL | 数据完整性 |
| S4: 评估 message_confirmations | 过度设计清理 |
| S6: 删除 raw SQL Schema | 统一数据层设计 |
| WS2: messages 表处理 | 过期代码清理 |

### 中优先级（下阶段修复）

| 问题 | 影响 |
|------|------|
| A1/A4: 权限检查重构 | 架构优化 |
| D1/D3: Draft 状态和分页 | 性能和设计简化 |
| S3/S5: message_type 简化和索引 | 性能优化 |
| AI1: 命令类型简化 | 过度设计清理 |
| WS1: ChannelManager 拆分 | 职责分离 |
| DCK1: 模板路径配置 | 部署问题 |

### 低优先级（可延后）

| 问题 | 影响 |
|------|------|
| O2/P1/P3/A2/R1/G1/AI2/B1 | 代码风格和细节优化 |

---

## 六、设计自检

- [x] 无 TBD 或 TODO
- [x] 无内部矛盾
- [x] 范围明确，聚焦单一审查任务
- [x] 需求明确，可直接实施

---

## 七、下一步

请审核此设计文档，确认后我将使用 writing-plans skill 创建实施计划。