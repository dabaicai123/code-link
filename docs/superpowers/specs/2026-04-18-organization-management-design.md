# 组织管理与项目权限设计文档

## 背景

当前系统存在项目层级，但缺少组织/团队层级的管理能力。用户需要：
- 在项目之上建立组织概念
- 组织管理员可以邀请系统内人员加入组织
- 组织成员自动继承组织下所有项目的访问权限
- 不同角色拥有不同的操作权限

## 目标

建立组织层级管理体系，实现：
1. 组织的创建与管理（邀请制）
2. 组织成员的角色管理（owner/developer/member）
3. 项目权限通过组织成员关系自动继承
4. 超级管理员机制用于初始化第一个组织

---

## 整体架构

```
用户
  └── 所属组织 (organization_members.role: owner/developer/member)
        └── 组织下的项目 (projects)
              └── 项目权限 (通过组织角色自动继承)
```

---

## 数据模型

### 新增表

#### organizations 表

```sql
CREATE TABLE organizations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

#### organization_members 表

```sql
CREATE TABLE organization_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'developer', 'member')),
  invited_by INTEGER NOT NULL REFERENCES users(id),
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(organization_id, user_id)
);

CREATE INDEX idx_org_members_org_id ON organization_members(organization_id);
CREATE INDEX idx_org_members_user_id ON organization_members(user_id);
```

#### organization_invitations 表

```sql
CREATE TABLE organization_invitations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'developer', 'member')),
  invited_by INTEGER NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(organization_id, email)
);

CREATE INDEX idx_org_invitations_email ON organization_invitations(email);
CREATE INDEX idx_org_invitations_status ON organization_invitations(status);
```

### 修改表

#### projects 表

```sql
-- 添加 organization_id 字段
ALTER TABLE projects ADD COLUMN organization_id INTEGER NOT NULL REFERENCES organizations(id);

-- 移除 created_by 字段（通过 organization_members 获取创建者信息）
-- SQLite 不支持 DROP COLUMN，需要在迁移时重建表
```

迁移后的 projects 表结构：
```sql
CREATE TABLE projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  template_type TEXT NOT NULL CHECK (template_type IN ('node', 'node+java', 'node+python')),
  organization_id INTEGER NOT NULL REFERENCES organizations(id),
  container_id TEXT,
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'running', 'stopped')),
  created_by INTEGER NOT NULL REFERENCES users(id),  -- 保留，记录具体创建者
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 删除表

- `project_members` 表（权限通过组织成员关系自动继承）

---

## 权限矩阵

### 组织层级权限

| 操作 | 超级管理员 | 组织 owner | 组织 developer | 组织 member |
|------|-----------|-----------|---------------|-------------|
| 创建组织 | ✓ | ✓ | ✗ | ✗ |
| 管理组织成员（邀请/移除/修改角色） | ✓ | ✓ | ✗ | ✗ |
| 删除组织 | ✓ | ✓ | ✗ | ✗ |
| 修改组织名称 | ✓ | ✓ | ✗ | ✗ |

### 项目层级权限

| 操作 | 超级管理员 | 组织 owner | 组织 developer | 组织 member |
|------|-----------|-----------|---------------|-------------|
| 创建项目 | ✓ | ✓ | ✓ | ✗ |
| 查看项目 | ✓ | ✓ | ✓ | ✓ |
| 删除项目 | ✓ | ✓ | ✗ | ✗ |
| 添加/管理仓库 | ✓ | ✓ | ✓ | ✗ |

### Draft 权限

| 操作 | 超级管理员 | 组织 owner | 组织 developer | 组织 member |
|------|-----------|-----------|---------------|-------------|
| 创建 Draft | ✓ | ✓ | ✓ | ✗ |
| 查看 Draft 内容 | ✓ | ✓ | ✓ | ✓ |
| 发送消息 | ✓ | ✓ | ✓ | ✗ |
| 确认消息（同意/反对/建议） | ✓ | ✓ | ✓ | ✗ |
| 修改 Draft 状态 | ✓ | ✓ | ✓ | ✗ |

### 操作权限

| 操作 | 超级管理员 | 组织 owner | 组织 developer | 组织 member |
|------|-----------|-----------|---------------|-------------|
| 终端命令执行 | ✓ | ✓ | ✓ | ✗ |
| 触发构建/部署 | ✓ | ✓ | ✓ | ✗ |
| 查看聊天记录 | ✓ | ✓ | ✓ | ✓ |

---

## API 设计

### 组织管理 API

#### 创建组织
```
POST /api/organizations
Body: { name: string }
Response: { organization }
权限: 超级管理员 或 现有组织的 owner
```

#### 获取用户所属组织
```
GET /api/organizations
Response: [organization]
权限: 登录用户
```

#### 获取组织详情
```
GET /api/organizations/:id
Response: { organization, members: [{ id, name, email, avatar, role, joined_at }] }
权限: 组织成员
```

#### 修改组织名称
```
PUT /api/organizations/:id
Body: { name: string }
Response: { organization }
权限: 组织 owner
```

#### 删除组织
```
DELETE /api/organizations/:id
Response: 204
权限: 组织 owner
```

### 组织成员管理 API

#### 邀请成员
```
POST /api/organizations/:id/invitations
Body: { email: string, role: 'owner' | 'developer' | 'member' }
Response: { invitation }
权限: 组织 owner
```

#### 获取待处理邀请列表
```
GET /api/organizations/:id/invitations
Response: [invitation]
权限: 组织 owner
```

#### 取消邀请
```
DELETE /api/organizations/:id/invitations/:invId
Response: 204
权限: 组织 owner
```

#### 获取用户收到的邀请
```
GET /api/invitations
Response: [invitation]
权限: 登录用户
```

#### 接受邀请
```
POST /api/invitations/:invId
Response: { organization, member }
权限: 被邀请用户（邮箱匹配）
```

#### 拒绝邀请
```
DELETE /api/invitations/:invId
Response: 204
权限: 被邀请用户（邮箱匹配）
```

#### 修改成员角色
```
PUT /api/organizations/:id/members/:userId
Body: { role: 'owner' | 'developer' | 'member' }
Response: { member }
权限: 组织 owner
```

#### 移除成员
```
DELETE /api/organizations/:id/members/:userId
Response: 204
权限: 组织 owner
```

### 项目 API 变化

#### 创建项目
```
POST /api/projects
Body: { name: string, template_type: string, organization_id: number }
Response: { project }
权限: 组织 developer 或 owner
```

#### 获取项目列表
```
GET /api/projects
Response: [project]
权限: 登录用户（返回所属组织下的所有项目）
```

#### 获取项目详情
```
GET /api/projects/:id
Response: { project, members, repos }
权限检查: 通过 organization_members 表验证
```

#### 删除项目
```
DELETE /api/projects/:id
Response: 204
权限: 组织 owner
```

---

## 超级管理员机制

### 配置方式

通过环境变量配置超级管理员邮箱列表：

```bash
SUPER_ADMIN_EMAILS=admin@example.com,admin2@example.com
```

### 权限检查逻辑

```typescript
function isSuperAdmin(userEmail: string): boolean {
  const superAdminEmails = process.env.SUPER_ADMIN_EMAILS?.split(',') || [];
  return superAdminEmails.includes(userEmail);
}
```

超级管理员拥有所有组织的最高权限，并且可以创建新组织。

---

## 权限检查中间件

### 组织权限中间件

```typescript
function orgMemberMiddleware(minRole: 'member' | 'developer' | 'owner'): Middleware {
  return (req, res, next) => {
    const userId = req.userId;
    const orgId = parseInt(req.params.orgId || req.body.organization_id);

    // 超级管理员直接通过
    const user = db.prepare('SELECT email FROM users WHERE id = ?').get(userId);
    if (isSuperAdmin(user.email)) {
      req.orgRole = 'owner';
      return next();
    }

    // 检查组织成员角色
    const membership = db.prepare(
      'SELECT role FROM organization_members WHERE organization_id = ? AND user_id = ?'
    ).get(orgId, userId);

    if (!membership) {
      return res.status(403).json({ error: '您不是该组织的成员' });
    }

    const roleHierarchy = { owner: 3, developer: 2, member: 1 };
    if (roleHierarchy[membership.role] < roleHierarchy[minRole]) {
      return res.status(403).json({ error: '权限不足' });
    }

    req.orgRole = membership.role;
    next();
  };
}
```

### 项目权限中间件

```typescript
function projectMemberMiddleware(minRole: 'member' | 'developer' | 'owner'): Middleware {
  return (req, res, next) => {
    const userId = req.userId;
    const projectId = parseInt(req.params.id);

    // 超级管理员直接通过
    const user = db.prepare('SELECT email FROM users WHERE id = ?').get(userId);
    if (isSuperAdmin(user.email)) {
      req.projectRole = 'owner';
      return next();
    }

    // 获取项目所属组织
    const project = db.prepare('SELECT organization_id FROM projects WHERE id = ?').get(projectId);
    if (!project) {
      return res.status(404).json({ error: '项目不存在' });
    }

    // 检查组织成员角色
    const membership = db.prepare(
      'SELECT role FROM organization_members WHERE organization_id = ? AND user_id = ?'
    ).get(project.organization_id, userId);

    if (!membership) {
      return res.status(403).json({ error: '您不是该项目的成员' });
    }

    // 映射组织角色到项目权限等级
    const roleHierarchy = { owner: 3, developer: 2, member: 1 };
    if (roleHierarchy[membership.role] < roleHierarchy[minRole]) {
      return res.status(403).json({ error: '权限不足' });
    }

    req.projectRole = membership.role;
    next();
  };
}
```

---

## 数据迁移计划

### 迁移步骤

1. 创建新表（organizations, organization_members, organization_invitations）
2. 为超级管理员创建第一个组织
3. 将现有项目迁移到第一个组织（设置 organization_id）
4. 将现有 project_members 转换为 organization_members
   - role='owner' → 组织 owner
   - role='developer' → 组织 developer
   - role='product' → 组织 member
5. 删除 project_members 表

### 迁移脚本示例

```typescript
function migrateToOrganizations(db: Database, superAdminEmail: string) {
  // 创建第一个组织
  const superAdmin = db.prepare('SELECT id FROM users WHERE email = ?').get(superAdminEmail);
  const orgResult = db.prepare(
    'INSERT INTO organizations (name, created_by) VALUES (?, ?)'
  ).run('Default Organization', superAdmin.id);
  const orgId = orgResult.lastInsertRowid;

  // 添加超级管理员为组织 owner
  db.prepare(
    'INSERT INTO organization_members (organization_id, user_id, role, invited_by) VALUES (?, ?, ?, ?)'
  ).run(orgId, superAdmin.id, 'owner', superAdmin.id);

  // 迁移项目
  db.prepare('UPDATE projects SET organization_id = ?').run(orgId);

  // 迁移项目成员到组织成员
  const projectMembers = db.prepare('SELECT * FROM project_members').all();
  const orgMembers = new Map(); // 避免重复

  for (const pm of projectMembers) {
    if (!orgMembers.has(pm.user_id)) {
      const role = pm.role === 'product' ? 'member' : pm.role;
      db.prepare(
        'INSERT INTO organization_members (organization_id, user_id, role, invited_by) VALUES (?, ?, ?, ?)'
      ).run(orgId, pm.user_id, role, superAdmin.id);
      orgMembers.set(pm.user_id, role);
    }
  }
}
```

---

## 前端变更

### 新增页面/组件

1. **组织列表页面** `/organizations` — 显示用户所属的组织
2. **组织详情页面** `/organizations/:id` — 组织信息、成员列表、邀请管理
3. **邀请处理页面** `/invitations` — 显示待处理的邀请，接受/拒绝操作
4. **组织成员管理组件** — 成员列表、邀请表单、角色修改

### 修改组件

1. **项目创建对话框** — 添加组织选择（如果用户属于多个组织）
2. **侧边栏** — 添加组织导航入口
3. **权限检查逻辑** — 根据 orgRole/projectRole 显示/隐藏操作按钮

---

## 测试要点

### 单元测试

- 组织 CRUD 操作
- 成员邀请/接受/拒绝流程
- 权限中间件（各种角色组合）
- 超级管理员权限

### 集成测试

- 创建项目 → 自动关联组织
- 组织成员访问项目权限
- Draft 权限继承
- 终端/构建权限控制

### 边界情况

- 用户不属于任何组织时的行为
- 组织被删除后项目的处理
- 成员被移除后 Draft 的处理
- 多个组织 owner 之间的操作