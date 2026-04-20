import { describe, it, expect, beforeEach } from 'vitest';
import { useOrganizationStore } from '@/lib/stores/organization-store';
import type { Organization } from '@/types/organization';

describe('useOrganizationStore', () => {
  beforeEach(() => {
    useOrganizationStore.setState({
      organizations: [],
      currentOrganization: null,
    });
  });

  const mockOrg: Organization = {
    id: 1,
    name: 'Test Org',
    createdBy: 1,
    createdAt: '2026-04-20T00:00:00Z',
    role: 'owner',
  };

  it('initializes with empty organizations', () => {
    const state = useOrganizationStore.getState();
    expect(state.organizations).toEqual([]);
    expect(state.currentOrganization).toBeNull();
  });

  it('sets organizations correctly', () => {
    useOrganizationStore.getState().setOrganizations([mockOrg]);

    const state = useOrganizationStore.getState();
    expect(state.organizations).toHaveLength(1);
    expect(state.currentOrganization?.id).toBe(1);
  });

  it('sets current organization', () => {
    useOrganizationStore.getState().setCurrentOrganization(mockOrg);

    const state = useOrganizationStore.getState();
    expect(state.currentOrganization).toEqual(mockOrg);
  });

  it('adds organization', () => {
    useOrganizationStore.getState().addOrganization(mockOrg);

    const state = useOrganizationStore.getState();
    expect(state.organizations).toContainEqual(mockOrg);
  });

  it('updates organization', () => {
    useOrganizationStore.getState().setOrganizations([mockOrg]);
    useOrganizationStore.getState().updateOrganization(1, { name: 'Updated Org' });

    const state = useOrganizationStore.getState();
    expect(state.organizations[0].name).toBe('Updated Org');
  });

  it('removes organization', () => {
    useOrganizationStore.getState().setOrganizations([mockOrg]);
    useOrganizationStore.getState().removeOrganization(1);

    const state = useOrganizationStore.getState();
    expect(state.organizations).toHaveLength(0);
    expect(state.currentOrganization).toBeNull();
  });
});
