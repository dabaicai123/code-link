'use client';

import { useState, useEffect } from 'react';
import { api, ApiError } from '@/lib/api';

interface PreviewFrameProps {
  projectId: number;
}

export function PreviewFrame({ projectId }: PreviewFrameProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startBuild = async () => {
    setLoading(true);
    setError(null);

    try {
      await api.post('/builds', { projectId });
      // 构建状态通过 WebSocket 更新
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : '构建失败';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const loadPreview = async () => {
    try {
      const response = await api.get<{ url: string }>(`/builds/preview/${projectId}`);
      setPreviewUrl(response.url);
    } catch {
      // 预览不存在时忽略错误
    }
  };

  useEffect(() => {
    loadPreview();
  }, [projectId]);

  return (
    <div className="preview-frame">
      <div className="preview-toolbar flex items-center gap-2 mb-4">
        <button
          onClick={startBuild}
          disabled={loading}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? '构建中...' : '构建预览'}
        </button>
        {previewUrl && (
          <button
            onClick={loadPreview}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
          >
            刷新预览
          </button>
        )}
      </div>

      {error && (
        <div className="preview-error p-4 bg-red-50 text-red-700 rounded-md mb-4">
          {error}
        </div>
      )}

      {previewUrl ? (
        <iframe
          src={previewUrl}
          className="preview-iframe rounded-md"
          style={{
            width: '100%',
            height: '500px',
            border: '1px solid #e5e7eb',
          }}
        />
      ) : (
        <div className="preview-placeholder flex items-center justify-center h-64 bg-gray-50 rounded-md text-gray-500">
          点击&quot;构建预览&quot;开始
        </div>
      )}
    </div>
  );
}
