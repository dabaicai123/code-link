'use client';

import { useState, useEffect } from 'react';
import { api, ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/stores/auth-store';

/**
 * 仓库提供商
 */
type Provider = 'github' | 'gitlab';

/**
 * 仓库信息
 */
interface Repo {
  id: number | string;
  name: string;
  full_name: string;
  url: string;
  default_branch: string;
  private: boolean;
}

/**
 * 分支信息
 */
interface Branch {
  name: string;
}

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  default_branch: string;
  private: boolean;
}

interface GitLabProject {
  id: number;
  name: string;
  path_with_namespace: string;
  web_url: string;
  default_ref: string;
  private: boolean;
}

interface RepoImportDialogProps {
  isOpen: boolean;
  projectId: number;
  containerId: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface FormErrors {
  repo?: string;
  branch?: string;
  general?: string;
}

/**
 * 仓库导入对话框
 */
export function RepoImportDialog({
  isOpen,
  projectId,
  containerId,
  onClose,
  onSuccess,
}: RepoImportDialogProps) {
  const user = useAuthStore((s) => s.user);
  const [provider, setProvider] = useState<Provider>('github');
  const [repos, setRepos] = useState<Repo[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<Repo | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const [isLoadingRepos, setIsLoadingRepos] = useState<boolean>(false);
  const [isLoadingBranches, setIsLoadingBranches] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errors, setErrors] = useState<FormErrors>({});

  // 检查授权状态
  useEffect(() => {
    if (isOpen && user) {
      checkAuthorization();
    }
  }, [isOpen, user, provider]);

  // 加载仓库列表
  useEffect(() => {
    if (isAuthorized && provider && user) {
      loadRepos();
    }
  }, [isAuthorized, provider, user]);

  // 加载分支列表
  useEffect(() => {
    if (selectedRepo && user) {
      loadBranches();
    }
  }, [selectedRepo]);

  const checkAuthorization = async () => {
    try {
      const response = await api.get<{ authorized: boolean }>(
        `/${provider}/status?userId=${user!.id}`
      );
      setIsAuthorized(response.authorized);
    } catch {
      setIsAuthorized(false);
    }
  };

  const loadRepos = async () => {
    setIsLoadingRepos(true);
    setRepos([]);
    setSelectedRepo(null);
    setBranches([]);
    setSelectedBranch('');
    try {
      const endpoint = provider === 'github' ? '/github/repos' : '/gitlab/projects';
      const data = await api.get<unknown>(`${endpoint}?userId=${user!.id}`);

      // 转换数据格式
      const formattedRepos: Repo[] = (data as (GitHubRepo | GitLabProject)[]).map((repo) => ({
        id: repo.id,
        name: repo.name,
        full_name: 'full_name' in repo ? repo.full_name : repo.path_with_namespace,
        url: 'html_url' in repo ? repo.html_url : repo.web_url,
        default_branch: 'default_branch' in repo ? repo.default_branch : repo.default_ref || 'main',
        private: repo.private,
      }));

      setRepos(formattedRepos);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : '获取仓库列表失败';
      setErrors({ general: message });
    } finally {
      setIsLoadingRepos(false);
    }
  };

  const loadBranches = async () => {
    setIsLoadingBranches(true);
    setBranches([]);
    try {
      if (provider === 'github') {
        // GitHub 仓库
        const [owner, repoName] = selectedRepo!.full_name.split('/');
        const data = await api.get<Branch[]>(
          `/github/repos/${owner}/${repoName}/branches?userId=${user!.id}`
        );
        setBranches(data);
      } else {
        // GitLab 项目
        const data = await api.get<Branch[]>(
          `/gitlab/projects/${selectedRepo!.id}/branches?userId=${user!.id}`
        );
        setBranches(data);
      }

      // 设置默认分支
      if (selectedRepo!.default_branch) {
        setSelectedBranch(selectedRepo!.default_branch);
      }
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : '获取分支列表失败';
      setErrors({ general: message });
    } finally {
      setIsLoadingBranches(false);
    }
  };

  const handleAuthorize = async () => {
    try {
      const response = await api.get<{ url: string }>(`/${provider}/oauth`);
      // 重定向到 OAuth 页面
      window.location.href = response.url;
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : '获取授权链接失败';
      setErrors({ general: message });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: FormErrors = {};

    if (!selectedRepo) {
      newErrors.repo = '请选择仓库';
    }

    if (!selectedBranch) {
      newErrors.branch = '请选择分支';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      await api.post(`/repos/${projectId}/import`, {
        repoUrl: selectedRepo!.url,
        branch: selectedBranch,
        containerId,
      });
      onSuccess();
      handleClose();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : '导入仓库失败';
      setErrors({ general: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setProvider('github');
    setRepos([]);
    setBranches([]);
    setSelectedRepo(null);
    setSelectedBranch('');
    setIsAuthorized(false);
    setErrors({});
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* 背景遮罩 */}
        <div
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={handleClose}
        />

        {/* 对话框 */}
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6 z-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">导入仓库</h2>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-500 transition-colors"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {errors.general && (
              <div className="rounded-md bg-red-50 p-3">
                <p className="text-sm text-red-800">{errors.general}</p>
              </div>
            )}

            {/* 提供商选择 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                选择平台
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setProvider('github')}
                  className={`flex items-center px-4 py-2 rounded-md border ${
                    provider === 'github'
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                    <path
                      fillRule="evenodd"
                      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                      clipRule="evenodd"
                    />
                  </svg>
                  GitHub
                </button>
                <button
                  type="button"
                  onClick={() => setProvider('gitlab')}
                  className={`flex items-center px-4 py-2 rounded-md border ${
                    provider === 'gitlab'
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l2.61-8.03a.84.84 0 0 1 .75-.58h5.77l2.61-8.03a.84.84 0 0 1 .75-.58h5.77a.84.84 0 0 1 .75.58l2.61 8.03a.84.84 0 0 1-.3.94zM12 19.54l6.91-5.27-2.61-8.03H8.7L6.09 14.27z" />
                  </svg>
                  GitLab
                </button>
              </div>
            </div>

            {/* 授权状态 */}
            {!isAuthorized ? (
              <div className="rounded-md bg-gray-50 p-4 text-center">
                <p className="text-sm text-gray-600 mb-3">
                  您尚未授权 {provider === 'github' ? 'GitHub' : 'GitLab'}
                </p>
                <button
                  type="button"
                  onClick={handleAuthorize}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
                >
                  授权 {provider === 'github' ? 'GitHub' : 'GitLab'}
                </button>
              </div>
            ) : (
              <>
                {/* 仓库选择 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    选择仓库
                  </label>
                  {isLoadingRepos ? (
                    <div className="flex items-center justify-center py-3">
                      <svg
                        className="animate-spin h-5 w-5 text-indigo-600"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                    </div>
                  ) : repos.length === 0 ? (
                    <p className="text-sm text-gray-500 py-2">暂无可用仓库</p>
                  ) : (
                    <select
                      value={selectedRepo?.id || ''}
                      onChange={(e) => {
                        const repo = repos.find((r) => String(r.id) === e.target.value);
                        setSelectedRepo(repo || null);
                        setSelectedBranch('');
                        if (errors.repo) {
                          setErrors((prev) => ({ ...prev, repo: undefined }));
                        }
                      }}
                      className={`block w-full px-3 py-2 border ${
                        errors.repo ? 'border-red-300' : 'border-gray-300'
                      } rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}
                    >
                      <option value="">请选择仓库</option>
                      {repos.map((repo) => (
                        <option key={repo.id} value={repo.id}>
                          {repo.full_name} {repo.private ? '(私有)' : ''}
                        </option>
                      ))}
                    </select>
                  )}
                  {errors.repo && (
                    <p className="mt-1 text-sm text-red-600">{errors.repo}</p>
                  )}
                </div>

                {/* 分支选择 */}
                {selectedRepo && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      选择分支
                    </label>
                    {isLoadingBranches ? (
                      <div className="flex items-center justify-center py-3">
                        <svg
                          className="animate-spin h-5 w-5 text-indigo-600"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                      </div>
                    ) : (
                      <select
                        value={selectedBranch}
                        onChange={(e) => {
                          setSelectedBranch(e.target.value);
                          if (errors.branch) {
                            setErrors((prev) => ({ ...prev, branch: undefined }));
                          }
                        }}
                        className={`block w-full px-3 py-2 border ${
                          errors.branch ? 'border-red-300' : 'border-gray-300'
                        } rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}
                      >
                        <option value="">请选择分支</option>
                        {branches.map((branch) => (
                          <option key={branch.name} value={branch.name}>
                            {branch.name}
                          </option>
                        ))}
                      </select>
                    )}
                    {errors.branch && (
                      <p className="mt-1 text-sm text-red-600">{errors.branch}</p>
                    )}
                  </div>
                )}

                {/* 按钮 */}
                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !selectedRepo || !selectedBranch}
                    className={`px-4 py-2 text-sm font-medium text-white rounded-md ${
                      isSubmitting || !selectedRepo || !selectedBranch
                        ? 'bg-indigo-400 cursor-not-allowed'
                        : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
                    }`}
                  >
                    {isSubmitting ? '导入中...' : '导入仓库'}
                  </button>
                </div>
              </>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}