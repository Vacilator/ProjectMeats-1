/**
 * EntityFieldPicker Diagnostic Component
 * 
 * Debug version that logs every step of the field fetch process.
 * Use this to identify why "(0 fields)" appears.
 * 
 * Created: 2026-02-21
 */

import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useEntityList, useEntityFields } from '../../../services/schemaService';

const DiagnosticContainer = styled.div`
  padding: 20px;
  font-family: monospace;
  font-size: 12px;
  background: rgb(var(--color-background));
  border: 1px solid rgb(var(--color-border));
  border-radius: 8px;
  max-height: 600px;
  overflow-y: auto;
`;

const Section = styled.div`
  margin-bottom: 20px;
  padding: 12px;
  background: rgba(var(--color-primary), 0.05);
  border-left: 3px solid rgb(var(--color-primary));
`;

const Title = styled.h3`
  margin: 0 0 10px 0;
  color: rgb(var(--color-primary));
`;

const LogLine = styled.div<{ $type?: 'info' | 'success' | 'error' | 'warning' }>`
  padding: 4px 8px;
  margin: 2px 0;
  background: ${props => {
    switch (props.$type) {
      case 'success': return 'rgba(34, 197, 94, 0.1)';
      case 'error': return 'rgba(239, 68, 68, 0.1)';
      case 'warning': return 'rgba(234, 179, 8, 0.1)';
      default: return 'transparent';
    }
  }};
  color: ${props => {
    switch (props.$type) {
      case 'success': return 'rgb(34, 197, 94)';
      case 'error': return 'rgb(239, 68, 68)';
      case 'warning': return 'rgb(234, 179, 8)';
      default: return 'rgb(var(--color-text-secondary))';
    }
  }};
  border-radius: 4px;
`;

const Select = styled.select`
  width: 100%;
  padding: 8px;
  border: 1px solid rgb(var(--color-border));
  border-radius: 4px;
  margin: 10px 0;
`;

const Button = styled.button`
  padding: 8px 16px;
  background: rgb(var(--color-primary));
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  margin-right: 10px;

  &:hover {
    background: rgba(var(--color-primary), 0.8);
  }
`;

export const EntityFieldPickerDiagnostic: React.FC = () => {
  const [selectedEntity, setSelectedEntity] = useState<string>('');
  const [diagnosticLogs, setDiagnosticLogs] = useState<Array<{ type: string; message: string; timestamp: number }>>([]);

  const addLog = (type: 'info' | 'success' | 'error' | 'warning', message: string) => {
    setDiagnosticLogs(prev => [...prev, { type, message, timestamp: Date.now() }]);
    console.log(`[EntityFieldPicker Diagnostic] [${type.toUpperCase()}]`, message);
  };

  // Entity list hook
  const { 
    data: entities = [], 
    isLoading: entitiesLoading, 
    error: entitiesError,
    isSuccess: entitiesSuccess,
    isFetched: entitiesFetched
  } = useEntityList();

  // Entity fields hook (only enabled when entity selected)
  const { 
    data: fieldsData,
    isLoading: fieldsLoading,
    error: fieldsError,
    isSuccess: fieldsSuccess,
    isFetched: fieldsFetched,
    isFetching: fieldsFetching
  } = useEntityFields(selectedEntity, { enabled: !!selectedEntity });

  // Log entity list results
  useEffect(() => {
    if (entitiesLoading) {
      addLog('info', 'Loading entities list...');
    }
    if (entitiesSuccess) {
      addLog('success', `Entities loaded: ${entities.length} entities available`);
      entities.forEach(entity => {
        addLog('info', `  - ${entity.id} (${entity.label})`);
      });
    }
    if (entitiesError) {
      addLog('error', `Entities error: ${entitiesError}`);
    }
  }, [entitiesLoading, entitiesSuccess, entitiesError, entities]);

  // Log entity fields results
  useEffect(() => {
    if (!selectedEntity) return;

    addLog('info', `Entity selected: ${selectedEntity}`);

    if (fieldsLoading || fieldsFetching) {
      addLog('info', 'Loading fields...');
    }
    if (fieldsSuccess && fieldsFetched) {
      const fieldCount = fieldsData?.fields?.length || 0;
      if (fieldCount > 0) {
        addLog('success', `Fields loaded: ${fieldCount} fields`);
        fieldsData?.fields?.forEach(field => {
          addLog('info', `  - ${field.name} (${field.type}, required: ${field.required})`);
        });
      } else {
        addLog('warning', 'No fields returned (empty array)');
      }
    }
    if (fieldsError) {
      addLog('error', `Fields error: ${JSON.stringify(fieldsError)}`);
    }
  }, [selectedEntity, fieldsLoading, fieldsSuccess, fieldsError, fieldsData, fieldsFetched, fieldsFetching]);

  const handleEntityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const entityId = e.target.value;
    setSelectedEntity(entityId);
    setDiagnosticLogs(prev => [...prev, { type: 'info', message: `\n=== Entity Changed to: ${entityId} ===\n`, timestamp: Date.now() }]);
  };

  const clearLogs = () => {
    setDiagnosticLogs([]);
  };

  const testDirectFetch = async () => {
    if (!selectedEntity) {
      addLog('warning', 'No entity selected');
      return;
    }

    addLog('info', `\n=== Testing Direct API Fetch ===`);
    addLog('info', `Entity ID: ${selectedEntity}`);

    const encodedEntity = encodeURIComponent(selectedEntity);
    const url = `/api/v1/system/entities/${encodedEntity}/fields/`;
    addLog('info', `Encoded URL: ${url}`);

    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
      });

      addLog('info', `Response status: ${response.status} ${response.statusText}`);

      if (response.ok) {
        const data = await response.json();
        addLog('success', `Response received: ${JSON.stringify(data, null, 2)}`);
        addLog('info', `Field count: ${data.fields?.length || 0}`);
      } else {
        const errorText = await response.text();
        addLog('error', `Error response: ${errorText}`);
      }
    } catch (error) {
      addLog('error', `Fetch failed: ${error}`);
    }
  };

  return (
    <DiagnosticContainer>
      <Section>
        <Title>Entity Field Picker Diagnostic Tool</Title>
        <p>This tool helps debug why "(0 fields)" appears in the form configuration.</p>
      </Section>

      <Section>
        <Title>Step 1: Select Entity</Title>
        <Select value={selectedEntity} onChange={handleEntityChange}>
          <option value="">-- Select Entity --</option>
          {entities.map(entity => (
            <option key={entity.id} value={entity.id}>
              {entity.label} ({entity.id})
            </option>
          ))}
        </Select>

        <div>
          <Button onClick={clearLogs}>Clear Logs</Button>
          <Button onClick={testDirectFetch} disabled={!selectedEntity}>
            Test Direct API Fetch
          </Button>
        </div>
      </Section>

      <Section>
        <Title>Diagnostic Logs ({diagnosticLogs.length})</Title>
        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
          {diagnosticLogs.length === 0 ? (
            <LogLine $type="info">No logs yet. Select an entity to begin.</LogLine>
          ) : (
            diagnosticLogs.map((log, index) => (
              <LogLine key={index} $type={log.type as any}>
                {new Date(log.timestamp).toLocaleTimeString()}: {log.message}
              </LogLine>
            ))
          )}
        </div>
      </Section>

      <Section>
        <Title>Current State</Title>
        <LogLine>Entities Loaded: {entitiesFetched ? 'Yes' : 'No'} ({entities.length} total)</LogLine>
        <LogLine>Selected Entity: {selectedEntity || 'None'}</LogLine>
        <LogLine>Fields Loading: {fieldsLoading ? 'Yes' : 'No'}</LogLine>
        <LogLine>Fields Fetched: {fieldsFetched ? 'Yes' : 'No'}</LogLine>
        <LogLine>Fields Count: {fieldsData?.fields?.length || 0}</LogLine>
        <LogLine>Error: {fieldsError ? String(fieldsError) : 'None'}</LogLine>
      </Section>

      <Section>
        <Title>How to Use</Title>
        <ol style={{ margin: 0, paddingLeft: '20px' }}>
          <li>Select an entity from the dropdown above</li>
          <li>Watch the logs populate automatically</li>
          <li>Click "Test Direct API Fetch" to bypass React Query</li>
          <li>Compare both results to identify the issue</li>
          <li>Check browser Network tab for actual HTTP requests</li>
        </ol>
      </Section>
    </DiagnosticContainer>
  );
};
