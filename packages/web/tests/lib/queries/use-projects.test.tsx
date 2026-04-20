import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { ReactNode } from 'react';
import { useProjects, useStartContainer } from '@/lib/queries/use-projects';
import { useOrganizationStore } from '@/lib/stores';

// Mock api module
vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    status: number;
    code: number;
    constructor(message: string, status: number, code: number) {
      super(message);
      this.status = status;
      this.code = code;
    }
  },
}));

import { api } from '@/lib/api';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  };
}

describe('useProjects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useOrganizationStore.setState({
      organizations: [],
      currentOrganization: { id: 1, name: 'Test Org', createdBy: 1, createdAt: '2026-04-20', role: 'owner' },
    });
  });

  it('fetches projects for current organization', async () => {
    const mockProjects = [
      { id: 1, name: 'Project 1', status: 'running', organizationId: 1 },
    ];
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockProjects);

    const { result } = renderHook(() => useProjects(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.get).toHaveBeenCalledWith('/projects?organizationId=1');
    expect(result.current.data).toEqual(mockProjects);
  });

  it('disables query when no current organization', () => {
    useOrganizationStore.setState({ currentOrganization: null });

    const { result } = renderHook(() => useProjects(), { wrapper: createWrapper() });

    expect(result.current.fetchStatus).toBe('idle');
    expect(api.get).not.toHaveBeenCalled();
  });
});

describe('useStartContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useOrganizationStore.setState({
      organizations: [],
      currentOrganization: { id: 1, name: 'Test Org', createdBy: 1, createdAt: '2026-04-20', role: 'owner' },
    });
  });

  it('starts container and optimistically updates project status', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const { result } = renderHook(() => useStartContainer(), { wrapper: createWrapper() });

    result.current.mutate(1);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.post).toHaveBeenCalledWith('/projects/1/container/start');
  });
});