import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';

import {
  getAvailableForms,
  getAvailableWorkForms,
  type AvailableWorkForm,
  type TenantForm,
} from '@/services/workformsApi';

export type WorkFormOrFormSelection =
  | { kind: 'form'; id: string }
  | { kind: 'workform'; id: string };

interface WorkFormOrFormSelectorProps {
  value?: WorkFormOrFormSelection;
  onChange: (value: WorkFormOrFormSelection | undefined) => void;
  disabled?: boolean;
  allowWorkForms?: boolean;
}

const Tabs = styled.div`
  display: inline-flex;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  overflow: hidden;
`;

const Tab = styled.button<{ $active?: boolean }>`
  padding: 8px 12px;
  border: none;
  cursor: pointer;
  font-size: 12px;
  font-weight: 800;
  background: ${(p) => (p.$active ? 'rgba(var(--color-primary), 0.12)' : 'rgb(var(--color-surface))')};
  color: ${(p) => (p.$active ? 'rgb(var(--color-primary))' : 'rgb(var(--color-text-primary))')};

  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  &:not(:last-child) {
    border-right: 1px solid rgb(var(--color-border));
  }
`;

const Select = styled.select`
  width: 100%;
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  border: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));
  font-size: 13px;
`;

const Helper = styled.div`
  margin-top: 6px;
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
`;

export const WorkFormOrFormSelector: React.FC<WorkFormOrFormSelectorProps> = ({
  value,
  onChange,
  disabled = false,
  allowWorkForms = true,
}) => {
  const [tab, setTab] = useState<'forms' | 'workforms'>(value?.kind === 'workform' ? 'workforms' : 'forms');
  const [forms, setForms] = useState<TenantForm[]>([]);
  const [workforms, setWorkforms] = useState<AvailableWorkForm[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const [f, wf] = await Promise.all([
          getAvailableForms(),
          allowWorkForms ? getAvailableWorkForms() : Promise.resolve([]),
        ]);
        if (!mounted) return;
        setForms(f);
        setWorkforms(wf);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [allowWorkForms]);

  useEffect(() => {
    if (value?.kind === 'workform') setTab('workforms');
    if (value?.kind === 'form') setTab('forms');
  }, [value?.kind]);

  const selectedId = value?.id ?? '';

  const options = useMemo(() => {
    if (tab === 'workforms') {
      return workforms.map((wf) => ({
        id: wf.id,
        label: `• [WorkForm] ${wf.name}`,
      }));
    }

    return forms.map((f) => ({
      id: f.id,
      label: `• [Form] ${f.name}`,
    }));
  }, [forms, tab, workforms]);

  return (
    <div>
      <Tabs>
        <Tab
          type="button"
          $active={tab === 'forms'}
          onClick={() => {
            setTab('forms');
            if (value?.kind === 'workform') onChange(undefined);
          }}
          disabled={disabled}
        >
          Forms (steps only)
        </Tab>
        <Tab
          type="button"
          $active={tab === 'workforms'}
          onClick={() => {
            setTab('workforms');
            if (value?.kind === 'form') onChange(undefined);
          }}
          disabled={disabled || !allowWorkForms}
          title={!allowWorkForms ? 'WorkForms selection disabled here' : undefined}
        >
          WorkForms (automation)
        </Tab>
      </Tabs>

      <Select
        value={selectedId}
        onChange={(e) => {
          const id = e.target.value;
          if (!id) {
            onChange(undefined);
            return;
          }
          onChange(tab === 'workforms' ? { kind: 'workform', id } : { kind: 'form', id });
        }}
        disabled={disabled || loading}
      >
        <option value="">{loading ? 'Loading…' : 'Select…'}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </Select>

      <Helper>
        {tab === 'forms'
          ? 'Select a step-only form (no automation nodes).'
          : 'Select a full WorkForm (includes automation and actions).'}
      </Helper>
    </div>
  );
};
