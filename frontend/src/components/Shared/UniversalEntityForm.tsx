import React, { useEffect, useMemo, useState } from 'react';
import { Spin, message } from 'antd';
import styled from 'styled-components';
import { businessApi } from '../../services/businessApi';
import DynamicFormEngine from '../../features/system/DynamicFormEngine';

interface UniversalEntityFormProps {
  entityType: string;
  entityId?: string;
  onSubmit?: (data: Record<string, unknown>) => Promise<void> | void;
  onCancel?: () => void;
}

type BackendField = {
  key: string;
  label?: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  help_text?: string;
  // Future: relationship metadata to enable SearchableSelect injection
  related_entity_type?: string;
};

type BackendSchema = {
  name?: string;
  description?: string;
  fields?: BackendField[];
};

const Container = styled.div`
  width: 100%;
`;

/**
 * UniversalEntityForm (Scaffold)
 *
 * Strategic direction: metadata-driven UI that renders create/edit forms from backend schema.
 *
 * Notes:
 * - The backend schema endpoint is still evolving; this component intentionally treats the
 *   schema call as a best-effort placeholder.
 * - FK interception (SearchableSelect) is implemented via schema mapping once the schema
 *   includes relationship metadata and DynamicFormEngine supports custom field renderers.
 */
export const UniversalEntityForm: React.FC<UniversalEntityFormProps> = ({
  entityType,
  entityId,
  onSubmit,
  onCancel,
}) => {
  const [loading, setLoading] = useState(false);
  const [schema, setSchema] = useState<BackendSchema | null>(null);
  const [initialValues, setInitialValues] = useState<Record<string, unknown> | undefined>(undefined);

  const schemaName = useMemo(() => `${entityType}${entityId ? `:${entityId}` : ''}`, [entityType, entityId]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      try {
        // Placeholder schema endpoint (expected to be replaced by a real contract).
        // Example future contract:
        //   GET /api/v1/system/forms/schema/?entity_type=purchase-orders
        const resp = await businessApi.get('/system/forms/schema/', {
          params: {
            entity_type: entityType,
            entity_id: entityId || undefined,
          },
        });

        if (!mounted) return;

        setSchema((resp.data ?? null) as BackendSchema | null);

        // Placeholder initial values: if edit mode, consumers should wire a detail endpoint
        // and pass those values; for now, leave empty.
        setInitialValues(undefined);
      } catch (err: any) {
        if (!mounted) return;
        setSchema(null);
        setInitialValues(undefined);
        message.warning('Universal form schema endpoint not available yet');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [entityType, entityId]);

  const dynamicSchema = useMemo(() => {
    // Map backend schema → DynamicFormEngine schema format.
    // TODO: Once backend provides strict field typing + FK metadata, this mapping should:
    // - Convert FK fields to a renderer that uses SearchableSelect.
    // - Convert array/list fields to multi-select renderers.
    const fields = (schema?.fields ?? []).map((f) => ({
      key: f.key,
      label: f.label || f.key,
      type: (f.type as any) || 'text',
      required: Boolean(f.required),
      placeholder: f.placeholder,
      help_text: f.help_text,
    }));

    return {
      step_index: 0,
      name: schema?.name || `Universal Form: ${schemaName}`,
      description: schema?.description,
      fields,
    } as any;
  }, [schema, schemaName]);

  if (loading) {
    return (
      <Container style={{ padding: 16 }}>
        <Spin />
      </Container>
    );
  }

  if (!schema) {
    return (
      <Container style={{ padding: 16, color: 'rgb(var(--color-text-secondary))', fontSize: 13 }}>
        UniversalEntityForm scaffold is ready, but the backend schema endpoint is not wired yet.
      </Container>
    );
  }

  return (
    <Container>
      <DynamicFormEngine
        schema={dynamicSchema}
        initialValues={initialValues as any}
        onSubmit={async (data: Record<string, any>) => {
          if (onSubmit) {
            await onSubmit(data);
          } else {
            // Default: no-op scaffold
            message.info('UniversalEntityForm submitted (scaffold)');
          }
        }}
        onCancel={onCancel}
      />
    </Container>
  );
};

export default UniversalEntityForm;
