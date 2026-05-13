import React, { useMemo, useState } from 'react';
import { Button, Card, Col, Form, Input, InputNumber, Row, Select, Space, Switch, Typography, message } from 'antd';

import type { Plant } from '@/services/apiService';
import { businessApi } from '@/services/businessApi';

const { Paragraph, Title } = Typography;

type HardcodedPlantSeed = Partial<Plant> & {
  export_approved?: boolean;
};

type HardcodedPlantFormProps = {
  plantId: string;
  initialValues: HardcodedPlantSeed | null;
  onCancel: () => void;
  onSaved?: (plant: Plant) => void;
};

type HardcodedPlantFormValues = {
  name: string;
  plant_est_num?: string;
  plant_type?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
  booking_contact_email?: string;
  booking_contact_phone?: string;
  booking_contact_phone_type?: 'mobile' | 'office';
  capacity?: number | null;
  export_approved?: boolean;
  is_active?: boolean;
  fcfs?: boolean;
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

const normalizeInitialValues = (plant: HardcodedPlantSeed | null): HardcodedPlantFormValues => ({
  name: String(plant?.name || ''),
  plant_est_num: String(plant?.plant_est_num || ''),
  plant_type: String(plant?.plant_type || 'processing'),
  address: String(plant?.address || ''),
  city: String(plant?.city || ''),
  state: String(plant?.state || ''),
  zip_code: String(plant?.zip_code || ''),
  country: String(plant?.country || 'USA'),
  booking_contact_email: String(plant?.booking_contact_email || ''),
  booking_contact_phone: String(plant?.booking_contact_phone || ''),
  booking_contact_phone_type:
    plant?.booking_contact_phone_type === 'mobile' ? 'mobile' : 'office',
  capacity:
    typeof plant?.capacity === 'number' && Number.isFinite(plant.capacity) ? plant.capacity : null,
  export_approved: Boolean(plant?.export_approved),
  is_active: plant?.is_active ?? true,
  fcfs: Boolean(plant?.fcfs),
});

export const HardcodedPlantForm: React.FC<HardcodedPlantFormProps> = ({
  plantId,
  initialValues,
  onCancel,
  onSaved,
}) => {
  const [form] = Form.useForm<HardcodedPlantFormValues>();
  const [saving, setSaving] = useState(false);
  const normalizedInitialValues = useMemo(
    () => normalizeInitialValues(initialValues),
    [initialValues],
  );

  const handleSubmit = async (values: HardcodedPlantFormValues) => {
    if (!plantId) {
      message.error('Plant ID is missing.');
      return;
    }

    const numericPlantId = Number(plantId);
    if (!Number.isFinite(numericPlantId)) {
      message.error('Plant ID is invalid.');
      return;
    }

    setSaving(true);
    try {
      const payload: HardcodedPlantSeed = {
        ...values,
        capacity: values.capacity ?? undefined,
      };
      const resp = await businessApi.patch(`plants/${numericPlantId}/`, payload);
      const updated = resp.data as Plant;
      message.success('Plant updated.');
      onSaved?.(updated);
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : 'Unable to save the plant right now.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: 16 }}>
      <Card
        style={{
          borderRadius: 16,
          border: '1px solid rgb(var(--color-border, 224 224 224))',
          background: 'rgb(var(--color-surface, 255 255 255))',
        }}
      >
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <div>
            <Button onClick={onCancel}>Back to Details</Button>
          </div>

          <div>
            <Title level={3} style={{ marginBottom: 8 }}>
              Edit Plant
            </Title>
            <Paragraph type="secondary" style={{ marginBottom: 0 }}>
              Static business-continuity form. This bypasses the dynamic schema engine for plant edits.
            </Paragraph>
          </div>

          <Form<HardcodedPlantFormValues>
            form={form}
            layout="vertical"
            initialValues={normalizedInitialValues}
            onFinish={handleSubmit}
            key={`${plantId}-${initialValues?.updated_at || 'initial'}`}
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
                <Form.Item label="Plant EST #" name="plant_est_num">
                  <Input placeholder="Optional establishment number" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item label="Plant Type" name="plant_type">
                  <Select options={plantTypeOptions} />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="Capacity" name="capacity">
                  <InputNumber min={0} style={{ width: '100%' }} placeholder="Optional capacity" />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item label="Address" name="address">
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
              <Col xs={24} md={8}>
                <Form.Item label="Export Approved" name="export_approved" valuePropName="checked">
                  <Switch />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item label="Active" name="is_active" valuePropName="checked">
                  <Switch />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item label="FCFS" name="fcfs" valuePropName="checked">
                  <Switch />
                </Form.Item>
              </Col>
            </Row>

            <Space size={12}>
              <Button onClick={onCancel} disabled={saving}>
                Cancel
              </Button>
              <Button type="primary" htmlType="submit" loading={saving}>
                Save Plant
              </Button>
            </Space>
          </Form>
        </Space>
      </Card>
    </div>
  );
};

export default HardcodedPlantForm;
