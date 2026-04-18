---
name: collaborative-coding-platform
description: AI-assisted collaborative coding platform — Docker-isolated project workspaces with real-time sync and Claude Code CLI
created: 2026-04-17
status: approved
---

# AI辅助协作编码平台 设计文档

## 一句话

创建项目 = 启动Docker容器，编码在容器内（AI+人），看效果 = Docker构建+iframe预览，沟通 = 实时聊天+状态同步。

## 核心流程

```
创建项目(选模板) → 启动容器 → 编码(Claude Code CLI + 人工) → 构建预览(iframe) → 部署上线 → 推送GitHub
```

角色分工：
- **产品**: Web界面查看交互原型，提出反馈
- **开发**: Web终端连接容器内CLI编码，Claude Code辅助生成代码，人工审核确认
- **部署**: 触发构建，推送上线

## 系统组件

| 组件 | 技术 | 职责 |
|------|------|------|
| Web前端 | Next.js | 项目管理、Web终端(xterm.js)、文件树查看、聊天、iframe预览 |
| 核心服务 | Node.js | 项目CRUD、容器生命周期(Docker API)、WebSocket、GitHub集成、构建调度 |
| 实时同步 | WebSocket | 容器内文件变更广播到同项目所有在线用户 |
| 聊天/通知 | WebSocket | 项目内聊天、AI操作通知、构建状态推送 |
| 主存储 | SQLite | 用户、项目元数据、任务、聊天记录 |
| 容器编排 | Docker API | 创建/销毁/构建/预览容器管理 |

## Docker模板

创建项目时选择模板类型，以此启动隔离容器。每种模板包含完整开发环境 + Claude Code CLI + 预置Dockerfile。

### 模板列表

- **node** — Node.js + npm/pnpm，适合前端项目
- **node+java** — Node.js + JDK + Maven/Gradle，适合前后端分离全栈项目
- **node+python** — Node.js + Python + pip，适合AI/数据+前端项目

### 模板内容

每个模板镜像包含：
- 基础开发环境（对应语言的runtime + 工具链）
- Claude Code CLI（预装配置）
- Git
- 预置Dockerfile（用于构建部署产物）
- 文件监听agent（轻量进程，上报文件变更）
- WebSocket client（连接核心服务，上报事件）

### 容器生命周期

1. **创建**: 核心服务调用Docker API，从模板镜像启动容器，挂载持久化卷
2. **运行**: 用户通过Web终端连接容器shell，使用Claude Code编码
3. **构建预览**: 核心服务从项目容器持久化卷读取Dockerfile，构建新镜像，启动预览容器映射到随机端口，前端iframe展示
4. **部署上线**: 构建产物推送到部署目标（外部服务器/云）
5. **销毁**: 项目关闭时停止并移除容器，保留持久化卷可选

## 实时同步机制

### 文件同步

- 容器内文件监听agent检测变更
- 变更事件通过容器内WebSocket client上报核心服务
- 核心服务广播到同项目所有在线用户的Web前端
- 前端实时更新文件树和代码内容

### 聊天/沟通

- 项目级聊天频道（WebSocket）
- AI操作自动通知（Claude Code开始/完成编码任务时）
- 构建状态推送（构建开始/成功/失败）

## AI交互

- 用户通过Web终端（xterm.js）直连容器内shell
- 在容器内直接使用Claude Code CLI
- AI生成的代码通过文件同步机制自然传播给同项目其他用户
- 协作在审核和沟通层面，不需要实时协作编辑同一文件

## GitHub集成

- **导入项目**: 创建项目时可选"从GitHub导入" → git clone到容器内
- **推送代码**: 编码完成后触发"推送到GitHub" → 容器内git push回仓库
- **多仓库**: 一个项目可关联多个GitHub repo，容器内可同时拉取操作

## 预览部署

### iframe内嵌预览

- 构建完成后，核心服务启动预览容器
- 预览容器映射随机端口（如3001）
- 前端iframe指向 `http://host:port`
- 同项目所有用户都能在Web界面内直接看到效果

### 部署上线

- 预览确认后，触发部署流程
- 构建产物推送到外部部署目标
- 代码推送到GitHub仓库
- 部署不在项目容器内完成（外部独立环境）

## 数据模型

### SQLite表结构

- **users** — id, name, email, avatar, created_at
- **projects** — id, name, template_type(node/node+java/node+python), container_id, status, github_repos, created_by, created_at
- **project_members** — id, project_id, user_id, role(owner/developer/product)
- **tasks** — id, project_id, title, description, assigned_to, status(todo/in_progress/done), created_at
- **messages** — id, project_id, user_id, content, type(chat/notification), created_at
- **builds** — id, project_id, status(pending/running/success/failed), preview_port, created_at


## 技术栈总览

| 层 | 技术 |
|----|------|
| 前端 | Next.js + xterm.js + WebSocket client |
| 核心服务 | Node.js + Express/Fastify + Docker API + SQLite |
| 容器模板 | Docker (node / node+java / node+python) |
| AI | Claude Code CLI（容器内） |
| 存储 | SQLite |
| 版本管理 | Git + GitHub API |

## MVP范围

快速验证，第一版只做核心闭环：

1. 用户登录 + 项目创建（选模板）
2. Docker容器启动 + Web终端连接
3. 文件树查看 + 实时同步
4. 项目内聊天
5. 构建预览（iframe）
6. GitHub导入/推送

暂不含：
- 权限管理（初期所有人都是owner）
- 部署到外部服务器（MVP只做本地预览）
- 任务系统（后期加）
- 多仓库支持（MVP只支持单仓库）
