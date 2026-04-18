# 后端 API 统一响应格式设计

## 概述

后端所有 API 接口统一使用 `{ code, data/error }` 格式响应，便于前端统一处理。

## 响应格式

### 成功响应

```json
{
  "code": 0,
  "data": <T>
}
```

- `code`: 数字，0 表示成功
- `data`: 任意类型，可以是对象、数组或 null

### 失败响应

```json
{
  "code": 40001,
  "error": "错误描述信息"
}
```

- `code`: 数字，非 0 表示失败
- `error`: 字符串，用户可读的错误信息

## 错误码定义

### 错误码范围

| 范围 | 类型 | 示例 |
|------|------|------|
| 0 | 成功 | - |
| 10000-19999 | 系统错误 | 服务器异常、数据库错误 |
| 20000-29999 | 参数错误 | 缺少参数、格式错误 |
| 30000-39999 | 认证/授权错误 | 未登录、权限不足 |
| 40000-49999 | 业务错误 | 资源不存在、操作冲突 |

### 常用错误码

| 错误码 | 名称 | 说明 |
|--------|------|------|
| 10001 | INTERNAL_ERROR | 服务器内部错误 |
| 20001 | PARAM_MISSING | 缺少必填参数 |
| 20002 | PARAM_INVALID | 参数格式错误 |
| 30001 | UNAUTHORIZED | 未登录或 Token 无效 |
| 30002 | FORBIDDEN | 权限不足 |
| 40001 | NOT_FOUND | 资源不存在 |
| 40002 | CLAUDE_CONFIG_MISSING | Claude Code 配置缺失 |
| 40003 | CONFLICT | 操作冲突（如最后一个 owner 不能删除） |
| 40004 | ALREADY_EXISTS | 资源已存在 |

## 实现方案

### 后端工具函数

```typescript
// packages/server/src/utils/response.ts

export interface ApiResponse<T> {
  code: 0;
  data: T;
}

export interface ApiErrorResponse {
  code: number;
  error: string;
}

export function success<T>(data: T): ApiResponse<T> {
  return { code: 0, data };
}

export function fail(code: number, error: string): ApiErrorResponse {
  return { code, error };
}

// 预定义错误工厂函数
export const Errors = {
  // 系统错误
  internal: (msg?: string) => fail(10001, msg || '服务器内部错误'),
  
  // 参数错误
  paramMissing: (field: string) => fail(20001, `缺少参数: ${field}`),
  paramInvalid: (field: string, reason?: string) => fail(20002, reason || `参数格式错误: ${field}`),
  
  // 认证/授权错误
  unauthorized: () => fail(30001, '请先登录'),
  forbidden: () => fail(30002, '权限不足'),
  
  // 业务错误
  notFound: (resource: string) => fail(40001, `${resource}不存在`),
  claudeConfigMissing: () => fail(40002, '请先在「设置 → Claude Code 配置」中完成配置'),
  conflict: (msg: string) => fail(40003, msg),
  alreadyExists: (resource: string) => fail(40004, `${resource}已存在`),
};
```

### 路由使用示例

```typescript
// 成功响应
router.get('/:id', async (req, res) => {
  const project = await projectService.findById(id);
  res.json(success(project));
});

// 错误响应
router.post('/:id/container/start', async (req, res) => {
  if (!config) {
    return res.status(400).json(Errors.claudeConfigMissing());
  }
  // ...
  res.json(success({ containerId, status }));
});
```

### 前端适配

修改 `ApiError` 类：

```typescript
// packages/web/src/lib/api.ts

export class ApiError extends Error {
  status: number;  // HTTP 状态码
  code: number;    // 业务错误码

  constructor(status: number, code: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

// 解析响应
if (!response.ok) {
  const errorData = await response.json();
  throw new ApiError(
    response.status,
    errorData.code || 10001,
    errorData.error || '请求失败'
  );
}

// 成功响应
const result = await response.json();
return result.data;  // 直接返回 data 部分
```

## 改造范围

需要修改的文件：

**后端：**
- 新建 `packages/server/src/utils/response.ts`
- 修改所有 routes 文件使用统一响应格式

**前端：**
- 修改 `packages/web/src/lib/api.ts` 适配新格式

## 兼容性

此次改造会破坏现有 API 契约，前后端需要同步发布。
