'use client';

interface AccountProfileProps {
  user: { id: number; name: string; email: string };
}

export function AccountProfile({ user }: AccountProfileProps) {
  return (
    <div>
      <h1 className="text-xl font-bold text-text-primary">个人资料</h1>
      <p className="text-sm text-text-muted mb-6">查看和管理您的账户信息</p>

      <div className="bg-bg-card border border-border-default rounded-[var(--corner-lg)] p-6">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 rounded-full bg-accent-light flex items-center justify-center text-accent-primary text-2xl font-bold">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="text-lg font-semibold text-text-primary">{user.name}</div>
            <div className="text-[13px] text-text-muted">{user.email}</div>
          </div>
        </div>

        <div className="border-t border-border-light">
          <div className="flex justify-between py-3 border-b border-border-light">
            <span className="text-[13px] text-text-muted font-medium">用户名</span>
            <span className="text-[13px] font-medium text-text-primary">{user.name}</span>
          </div>
          <div className="flex justify-between py-3 border-b border-border-light">
            <span className="text-[13px] text-text-muted font-medium">邮箱</span>
            <span className="text-[13px] font-medium text-text-primary">{user.email}</span>
          </div>
          <div className="flex justify-between py-3 border-b border-border-light">
            <span className="text-[13px] text-text-muted font-medium">注册日期</span>
            <span className="text-[13px] font-medium text-text-primary">—</span>
          </div>
          <div className="flex justify-between py-3">
            <span className="text-[13px] text-text-muted font-medium">所属组织</span>
            <span className="text-[13px] font-medium text-text-primary">—</span>
          </div>
        </div>
      </div>

      <button
        className="w-full h-[var(--size-control-md)] bg-accent-primary text-white rounded-[var(--corner-md)] text-[13px] font-medium cursor-pointer shadow-[var(--elev-warm-sm)]"
      >
        退出登录
      </button>
    </div>
  );
}