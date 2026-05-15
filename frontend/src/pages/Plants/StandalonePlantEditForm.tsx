import React from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Switch,
  Typography,
  message,
} from 'antd';

import type { Plant } from '@/services/apiService';
import { businessApi } from '@/services/businessApi';
import { withTenantQueryKey } from '@/utils/queryKeys';

const { Paragraph, Title } = Typography;

type PlantStatusValue = 'active' | 'inactive';

type StandalonePlantEditFormProps = {
  plantId: string;
  onCancel: () => void;
  onSaved?: (plant: Plant) => void;
};

type StandalonePlantEditFormValues = {
  name: string;
  plant_est_num: string;
  status: PlantStatusValue;
  plant_type?: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  booking_contact_email: string;
  booking_contact_phone: string;
  booking_contact_phone_type: 'mobile' | 'office';
  capacity?: number | null;
  export_approved: boolean;
  fcfs: boolean;
};

const plantTypeOptions = [
  { label: 'Vertical (Kill to Fabrication)', value: 'vertical' },
  { label: 'Processing Plant', value: 'processing' },
  { label: 'Distribution Center', value: 'distribution' },
  { label: 'Warehouse', value: 'warehouse' },
  { label: 'Retail Location', value: 'retail' },
  { label: 'Other', value: 'other' },
];

const phoneTypeOptions = [
  { label: 'Office', value: 'office' },
  { label: 'Mobile', value: 'mobile' },
];

const statusOptions = [
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
];

const normalizeInitialValues = (plant: Plant): StandalonePlantEditFormValues => ({
  name: String(plant.name || ''),
  plant_est_num: String(plant.plant_est_num || ''),
  status: plant.is_active === false ? 'inactive' : 'active',
  plant_type: String(plant.plant_type || 'processing'),
  address: String(plant.address || ''),
  city: String(plant.city || ''),
  state: String(plant.state || ''),
  zip_code: String(plant.zip_code || ''),
  country: String(plant.country || 'USA'),
  booking_contact_email: String(plant.booking_contact_email || ''),
  booking_contact_phone: String(plant.booking_contact_phone || ''),
  booking_contact_phone_type:
    plant.booking_contact_phone_type === 'mobile' ? 'mobile' : 'office',
  capacity: typeof plant.capacity === 'number' && Number.isFinite(plant.capacity) ? plant.capacity : null,
  export_approved: Boolean(plant.export_approved),
  fcfs: Boolean(plant.fcfs),
});

const getErrorMessage = (error: unknown, fallback: string): string => {
  return error instanceof Error && error.message ? error.message : fallback;
};

export const StandalonePlantEditForm: React.FC<StandalonePlantEditFormProps> = ({
  plantId,
  onCancel,
  onSaved,
}) => {
  const numericPlantId = Number(plantId);
  const isValidPlantId = Number.isFinite(numericPlantId);

  const plantQuery = useQuery({
    queryKey: withTenantQueryKey('plant-standalone-edit', plantId),
    queryFn: async () => {
      if (!isValidPlantId) {
        throw new Error('Plant ID is invalid.');
      }

      const resp = await businessApi.get(`plants/${numericPlantId}/`);
      return resp.data as Plant;
    },
    enabled: Boolean(plantId),
    retry: false,
  });

  const updatePlantMutation = useMutation({
    mutationFn: async (values: StandalonePlantEditFormValues) => {
      if (!isValidPlantId) {
        throw new Error('Plant ID is invalid.');
      }

      const resp = await businessApi.patch(`plants/${numericPlantId}/`, {
        name: values.name,
        plant_est_num: values.plant_est_num || undefined,
        plant_type: values.plant_type || undefined,
        address: values.address || undefined,
        city: values.city || undefined,
        state: values.state || undefined,
        zip_code: values.zip_code || undefined,
        country: values.country || undefined,
        booking_contact_email: values.booking_contact_email || undefined,
        booking_contact_phone: values.booking_contact_phone || undefined,
        booking_contact_phone_type: values.booking_contact_phone_type,
        capacity: values.capacity ?? undefined,
        export_approved: values.export_approved,
        is_active: values.status === 'active',
        fcfs: values.fcfs,
      });
      return resp.data as Plant;
    },
    onSuccess: (updatedPlant) => {
      message.success('Plant updated.');
      onSaved?.(updatedPlant);
    },
    onError: (error) => {
      message.error(getErrorMessage(error, 'Unable to save the plant right now.'));
    },
  });

  if (!plantId || !isValidPlantId) {
    return (
      <div style={{ padding: 16 }}>
        <Alert type="error" showIcon message="Plant ID is invalid." />
      </div>
    );
  }

  if (plantQuery.isLoading) {
    return (
      <div style={{ padding: 16 }}>
        <Card>
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <div>
              <Button onClick={onCancel}>Back to Details</Button>
            </div>
            <Paragraph style={{ marginBottom: 0 }}>Loading plant details…</Paragraph>
          </Space>
        </Card>
      </div>
    );
  }

  if (plantQuery.isError || !plantQuery.data) {
    return (
      <div style={{ padding: 16 }}>
        <Alert
          type="error"
          showIcon
          message={getErrorMessage(plantQuery.error, 'Failed to load plant details.')}
        />
      </div>
    );
  }

  const initialValues = normalizeInitialValues(plantQuery.data);

  return (
    <div style={{ padding: 16 }}>
      <Card
        style={{
          borderRadius: 16,
          border: '1px solid rgb(var(--color-border))',
          background: 'rgb(var(--color-surface))',
        }}
      >
        <Space orientation="vertical" size={16} style={{ width: '100%' }}>
          <div>
            <Button onClick={onCancel}>Back to Details</Button>
          </div>

          <div>
            <Title level={3} style={{ marginBottom: 8 }}>
              Edit Plant
            </Title>
            <Paragraph type="secondary" style={{ marginBottom: 0 }}>
              Standalone plant editor. This bypasses the universal form engine for plant edits.
            </Paragraph>
          </div>

          <Form<StandalonePlantEditFormValues>
            layout="vertical"
            initialValues={initialValues}
            key={`${plantId}-${plantQuery.data.updated_at}`}
            onFinish={async (values) => {
              await updatePlantMutation.mutateAsync(values);
            }}
          >
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item
                  label="Plant Name"
                  name="name"
                  rules={[{ required: true, message: 'Plant name is required.' }]}
                >
                  <Input placeholder="Enter plant name" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="Plant Number" name="plant_est_num">
                  <Input placeholder="Optional establishment number" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col xs={24} md={8}>
                <Form.Item label="Status" name="status">
                  <Select options={statusOptions} />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item label="Plant Type" name="plant_type">
                  <Select options={plantTypeOptions} />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item label="Capacity" name="capacity">
                  <InputNumber min={0} style={{ width: '100%' }} placeholder="Optional capacity" />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item label="Location" name="address">
              <Input.TextArea rows={3} placeholder="Street address" />
            </Form.Item>

            <Row gutter={16}>
              <Col xs={24} md={8}>
                <Form.Item label="City" name="city">
                  <Input />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item label="State" name="state">
                  <Input />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item label="ZIP Code" name="zip_code">
                  <Input />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item label="Country" name="country">
                  <Input />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="Booking Contact Email" name="booking_contact_email">
                  <Input type="email" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item label="Booking Contact Phone" name="booking_contact_phone">
                  <Input />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="Phone Type" name="booking_contact_phone_type">
                  <Select options={phoneTypeOptions} />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item label="Export Approved" name="export_approved" valuePropName="checked">
                  <Switch />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="FCFS" name="fcfs" valuePropName="checked">
                  <Switch />
                </Form.Item>
              </Col>
            </Row>

            <Space size={12}>
              <Button onClick={onCancel} disabled={updatePlantMutation.isPending}>
                Cancel
              </Button>
              <Button type="primary" htmlType="submit" loading={updatePlantMutation.isPending}>
                Save Plant
              </Button>
            </Space>
          </Form>
        </Space>
      </Card>
    </div>
  );
};

export default StandalonePlantEditForm;
