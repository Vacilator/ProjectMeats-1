import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { apiService, Supplier } from '../services/apiService';
import { logger } from '@/utils/logger';

const TestButton = styled.button`
  background-color: rgb(var(--color-primary));
  color: rgb(var(--color-text-inverse));
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  opacity: 1;
  transition: background-color 0.2s, opacity 0.2s;

  &:hover {
    background-color: rgb(var(--color-primary-hover));
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
`;

const ApiTestComponent: React.FC = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const testCreateSupplier = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const newSupplier = {
        name: `Test Supplier ${new Date().getTime()}`,
        contact_person: 'Test Person',
        email: 'test@example.com',
        phone: '555-0123',
        address: '123 Test St',
        city: 'Test City',
        state: 'TS',
        zip_code: '12345',
      };

      const result = await apiService.createSupplier(newSupplier);

      setSuccess(`✅ Successfully created supplier: ${result.name} (ID: ${result.id})`);
      fetchSuppliers(); // Refresh the list
    } catch (err) {
      logger.error('Error creating supplier:', err);
      setError(`❌ Error creating supplier: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const supplierData = await apiService.getSuppliers();
      setSuppliers(supplierData);
    } catch (err) {
      logger.error('Error fetching suppliers:', err);
      setError(`❌ Error fetching suppliers: ${err}`);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h2>🧪 API Test Component</h2>
      <div style={{ marginBottom: '20px' }}>
        <TestButton onClick={testCreateSupplier} disabled={loading}>
          {loading ? '⏳ Creating...' : '✨ Test Create Supplier'}
        </TestButton>
      </div>

      {error && (
        <div
          style={{
            backgroundColor: 'rgba(var(--color-error), 0.14)',
            color: 'rgb(var(--color-error))',
            padding: '10px',
            borderRadius: '4px',
            marginBottom: '10px',
          }}
        >
          {error}
        </div>
      )}

      {success && (
        <div
          style={{
            backgroundColor: 'rgba(var(--color-info), 0.12)',
            color: 'rgb(var(--color-success))',
            padding: '10px',
            borderRadius: '4px',
            marginBottom: '10px',
          }}
        >
          {success}
        </div>
      )}

      <h3>📋 Current Suppliers ({suppliers.length})</h3>
      <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
        {suppliers.map((supplier) => (
          <div
            key={supplier.id}
            style={{
              border: '1px solid rgb(var(--color-border))',
              padding: '10px',
              marginBottom: '5px',
              borderRadius: '4px',
              backgroundColor: 'rgb(var(--color-surface))',
            }}
          >
            <strong>
              #{supplier.id} - {supplier.name}
            </strong>
            <br />
            Contact: {supplier.contact_person}
            <br />
            Email: {supplier.email}
            <br />
            Phone: {supplier.phone}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ApiTestComponent;
