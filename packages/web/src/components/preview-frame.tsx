'use client';

import { useState, useEffect, useCallback } from 'react';
import { useBuild } from '@/hooks/use-build';

interface PreviewFrameProps {
  projectId: number;
}

export function PreviewFrame({ projectId }: PreviewFrameProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const { loading, error, startBuild, getPreviewUrl, stopPreview } = useBuild(projectId);

  const handleStartBuild = async () => {
    await startBuild();
    // 构建完成后刷新预览
    const url = await getPreviewUrl();
    if (url) {
      setPreviewUrl(url);
    }
  };

  const loadPreview = useCallback(async () => {
    const url = await getPreviewUrl();
    if (url) {
      setPreviewUrl(url);
    }
  }, [getPreviewUrl]);

  const handleStopPreview = async () => {
    const success = await stopPreview();
    if (success) {
      setPreviewUrl(null);
    }
  };

  useEffect(() => {
    loadPreview();
  }, [projectId, loadPreview]);

  return (
    <div className="preview-frame">
      <div className="preview-toolbar flex items-center gap-2 mb-4">
        <button
          onClick={handleStartBuild}
          disabled={loading}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? '构建中...' : '构建预览'}
        </button>
        {previewUrl && (
          <>
            <button
              onClick={loadPreview}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
            >
              刷新预览
            </button>
            <button
              onClick={handleStopPreview}
              disabled={loading}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              停止预览
            </button>
          </>
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
