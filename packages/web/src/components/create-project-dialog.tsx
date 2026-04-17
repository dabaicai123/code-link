'use client';

import { useState } from 'react';
import { api, ApiError } from '@/lib/api';

/**
 * 模板类型
 */
type TemplateType = 'node' | 'node+java' | 'node+python';

/**
 * 模板选项
 */
const TEMPLATE_OPTIONS: { value: TemplateType; label: string; description: string }[] = [
  {
    value: 'node',
    label: 'Node.js',
    description: '纯 Node.js 运行环境',
  },
  {
    value: 'node+java',
    label: 'Node.js + Java',
    description: 'Node.js 与 Java 混合环境',
  },
  {
    value: 'node+python',
    label: 'Node.js + Python',
    description: 'Node.js 与 Python 混合环境',
  },
];

/**
 * 项目信息
 */
interface Project {
  id: number;
  name: string;
  template_type: TemplateType;
  container_id: string | null;
  status: 'created' | 'running' | 'stopped';
  github_repo: string | null;
  created_by: number;
  created_at: string;
}

interface CreateProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (project: Project) => void;
}

interface FormErrors {
  name?: string;
  template_type?: string;
  github_repo?: string;
  general?: string;
}

export function CreateProjectDialog({
  isOpen,
  onClose,
  onSuccess,
}: CreateProjectDialogProps) {
  const [name, setName] = useState('');
  const [templateType, setTemplateType] = useState<TemplateType>('node');
  const [githubRepo, setGithubRepo] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!name.trim()) {
      newErrors.name = '请输入项目名称';
    } else if (name.length > 100) {
      newErrors.name = '项目名称不能超过 100 个字符';
    }

    if (!templateType) {
      newErrors.template_type = '请选择模板类型';
    }

    if (githubRepo && !/^https?:\/\/github\.com\/[\w-]+\/[\w.-]+$/.test(githubRepo)) {
      newErrors.github_repo = '请输入有效的 GitHub 仓库地址';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const project = await api.post<Project>('/projects', {
        name: name.trim(),
        template_type: templateType,
        ...(githubRepo && { github_repo: githubRepo.trim() }),
      });
      onSuccess(project);
      handleClose();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : '创建项目失败，请稍后重试';
      setErrors({ general: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setName('');
    setTemplateType('node');
    setGithubRepo('');
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
            <h2 className="text-xl font-semibold text-gray-900">创建新项目</h2>
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

            {/* 项目名称 */}
            <div>
              <label
                htmlFor="project-name"
                className="block text-sm font-medium text-gray-700"
              >
                项目名称 <span className="text-red-500">*</span>
              </label>
              <input
                id="project-name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors.name) {
                    setErrors((prev) => ({ ...prev, name: undefined }));
                  }
                }}
                className={`mt-1 block w-full px-3 py-2 border ${
                  errors.name ? 'border-red-300' : 'border-gray-300'
                } rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}
                placeholder="输入项目名称"
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name}</p>
              )}
            </div>

            {/* 模板类型 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                模板类型 <span className="text-red-500">*</span>
              </label>
              <div className="space-y-2">
                {TEMPLATE_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className={`flex items-center p-3 border rounded-md cursor-pointer transition-colors ${
                      templateType === option.value
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="template-type"
                      value={option.value}
                      checked={templateType === option.value}
                      onChange={() => setTemplateType(option.value)}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="ml-3">
                      <span className="block text-sm font-medium text-gray-900">
                        {option.label}
                      </span>
                      <span className="block text-xs text-gray-500">
                        {option.description}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
              {errors.template_type && (
                <p className="mt-1 text-sm text-red-600">{errors.template_type}</p>
              )}
            </div>

            {/* GitHub 仓库 */}
            <div>
              <label
                htmlFor="github-repo"
                className="block text-sm font-medium text-gray-700"
              >
                GitHub 仓库 <span className="text-gray-400">(可选)</span>
              </label>
              <input
                id="github-repo"
                type="url"
                value={githubRepo}
                onChange={(e) => {
                  setGithubRepo(e.target.value);
                  if (errors.github_repo) {
                    setErrors((prev) => ({ ...prev, github_repo: undefined }));
                  }
                }}
                className={`mt-1 block w-full px-3 py-2 border ${
                  errors.github_repo ? 'border-red-300' : 'border-gray-300'
                } rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}
                placeholder="https://github.com/owner/repo"
              />
              {errors.github_repo && (
                <p className="mt-1 text-sm text-red-600">{errors.github_repo}</p>
              )}
            </div>

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
                disabled={isSubmitting}
                className={`px-4 py-2 text-sm font-medium text-white rounded-md ${
                  isSubmitting
                    ? 'bg-indigo-400 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
                }`}
              >
                {isSubmitting ? '创建中...' : '创建项目'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}