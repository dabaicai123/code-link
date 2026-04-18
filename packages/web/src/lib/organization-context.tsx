'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { api, ApiError, Organization } from './api';

const CURRENT_ORG_KEY = 'currentOrganizationId';

interface OrganizationContextType {
  organizations: Organization[];
  currentOrganization: Organization | null;
  loading: boolean;
  setCurrentOrganization: (org: Organization | null) => void;
  refreshOrganizations: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrganization, setCurrentOrganizationState] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshOrganizations = useCallback(async () => {
    try {
      const orgs = await api.getOrganizations();
      setOrganizations(orgs);

      const storedOrgId = localStorage.getItem(CURRENT_ORG_KEY);
      if (storedOrgId) {
        const orgId = parseInt(storedOrgId, 10);
        const storedOrg = orgs.find(o => o.id === orgId);
        if (storedOrg) {
          setCurrentOrganizationState(storedOrg);
        } else if (orgs.length > 0) {
          setCurrentOrganizationState(orgs[0]);
          localStorage.setItem(CURRENT_ORG_KEY, String(orgs[0].id));
        }
      } else if (orgs.length > 0) {
        setCurrentOrganizationState(orgs[0]);
        localStorage.setItem(CURRENT_ORG_KEY, String(orgs[0].id));
      }
    } catch (err) {
      console.error('Failed to fetch organizations:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshOrganizations();
  }, [refreshOrganizations]);

  const setCurrentOrganization = useCallback((org: Organization | null) => {
    setCurrentOrganizationState(org);
    if (org) {
      localStorage.setItem(CURRENT_ORG_KEY, String(org.id));
    } else {
      localStorage.removeItem(CURRENT_ORG_KEY);
    }
  }, []);

  return (
    <OrganizationContext.Provider
      value={{
        organizations,
        currentOrganization,
        loading,
        setCurrentOrganization,
        refreshOrganizations,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization(): OrganizationContextType {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
}