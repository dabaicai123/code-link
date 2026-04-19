import { create } from 'zustand';
import { Organization } from '@/lib/api';
import { storage } from '@/lib/storage';

interface OrganizationState {
  organizations: Organization[];
  currentOrganization: Organization | null;
  setOrganizations: (orgs: Organization[]) => void;
  setCurrentOrganization: (org: Organization | null) => void;
  addOrganization: (org: Organization) => void;
  updateOrganization: (id: number, data: Partial<Organization>) => void;
  removeOrganization: (id: number) => void;
  clear: () => void;
}

export const useOrganizationStore = create<OrganizationState>()((set, get) => ({
  organizations: [],
  currentOrganization: null,

  setOrganizations: (orgs) => {
    set({ organizations: orgs });

    // If no current organization, select the first one or restore from storage
    const current = get().currentOrganization;
    if (!current && orgs.length > 0) {
      const storedOrgId = storage.getOrgId();
      const storedOrg = storedOrgId ? orgs.find((o) => o.id === storedOrgId) : null;
      const orgToSelect = storedOrg || orgs[0];
      set({ currentOrganization: orgToSelect });
      storage.setOrgId(orgToSelect.id);
    }
  },

  setCurrentOrganization: (org) => {
    set({ currentOrganization: org });
    if (org) {
      storage.setOrgId(org.id);
    } else {
      storage.removeOrgId();
    }
  },

  addOrganization: (org) =>
    set((state) => {
      const newOrgs = [...state.organizations, org];
      // If this is the first org, auto-select it
      if (!state.currentOrganization) {
        storage.setOrgId(org.id);
        return {
          organizations: newOrgs,
          currentOrganization: org,
        };
      }
      return { organizations: newOrgs };
    }),

  updateOrganization: (id, data) =>
    set((state) => ({
      organizations: state.organizations.map((org) =>
        org.id === id ? { ...org, ...data } : org
      ),
      currentOrganization:
        state.currentOrganization?.id === id
          ? { ...state.currentOrganization, ...data }
          : state.currentOrganization,
    })),

  removeOrganization: (id) =>
    set((state) => {
      const newOrgs = state.organizations.filter((org) => org.id !== id);
      const newCurrent =
        state.currentOrganization?.id === id
          ? newOrgs[0] || null
          : state.currentOrganization;

      // Update storage if current org changed
      if (state.currentOrganization?.id === id) {
        if (newCurrent) {
          storage.setOrgId(newCurrent.id);
        } else {
          storage.removeOrgId();
        }
      }

      return {
        organizations: newOrgs,
        currentOrganization: newCurrent,
      };
    }),

  clear: () => {
    storage.removeOrgId();
    set({
      organizations: [],
      currentOrganization: null,
    });
  },
}));
