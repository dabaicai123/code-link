'use client';

import { createContext, useContext, ReactNode } from 'react';
import { useOrganizations } from '@/lib/queries';
import { useOrganizationStore } from './stores/organization-store';
import { Organization } from './api';

interface OrganizationContextType {
  organizations: Organization[];
  currentOrganization: Organization | null;
  loading: boolean;
  setCurrentOrganization: (org: Organization | null) => void;
  refreshOrganizations: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { organizations, currentOrganization, setCurrentOrganization } = useOrganizationStore();
  const { refetch, isLoading } = useOrganizations();

  const refreshOrganizations = async () => {
    await refetch();
  };

  return (
    <OrganizationContext.Provider
      value={{
        organizations,
        currentOrganization,
        loading: isLoading,
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
