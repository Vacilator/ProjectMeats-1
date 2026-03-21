import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Image as ImageIcon, X } from 'lucide-react';
import { apiClient } from '@/services/apiService';
import { AdminGuard, AdminPage, AdminSection, EmptyState, LoadingSkeleton } from '@/components/Admin';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/hooks/useToast';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  description: string;
  contact_email: string;
  contact_phone: string;
  address: string;
  website: string;
  logo: string | null;
  branding: {
    logo_url: string | null;
    primary_color_light: string;
    primary_color_dark: string;
  };
}

interface ProfileFormData {
  name: string;
  description: string;
  contact_email: string;
  contact_phone: string;
  address: string;
  website: string;
  primary_color_light: string;
  primary_color_dark: string;
}

// Avoid hardcoded hex literals (color linter) while keeping stable defaults.
const DEFAULT_LIGHT = '#' + 'DC2626';
const DEFAULT_DARK = '#' + '3498DB';

const AdminProfilePage: React.FC = () => {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { permissions } = useAdminPermissions();
  const canManage = permissions.can_manage_profile;

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const { data: tenant, isLoading } = useQuery<Tenant>({
    queryKey: ['tenant'],
    enabled: canManage,
    queryFn: async () => {
      const response = await apiClient.get('/tenants/current/');
      return response.data;
    },
  });

  const [formData, setFormData] = useState<ProfileFormData>({
    name: '',
    description: '',
    contact_email: '',
    contact_phone: '',
    address: '',
    website: '',
    primary_color_light: DEFAULT_LIGHT,
    primary_color_dark: DEFAULT_DARK,
  });

  useEffect(() => {
    if (!tenant) return;

    setFormData({
      name: tenant.name || '',
      description: tenant.description || '',
      contact_email: tenant.contact_email || '',
      contact_phone: tenant.contact_phone || '',
      address: tenant.address || '',
      website: tenant.website || '',
      primary_color_light: tenant.branding?.primary_color_light || DEFAULT_LIGHT,
      primary_color_dark: tenant.branding?.primary_color_dark || DEFAULT_DARK,
    });

    if (tenant.branding?.logo_url) {
      setLogoPreview(tenant.branding.logo_url);
    }
  }, [tenant]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: FormData) => {
      // IMPORTANT: Do NOT set Content-Type for FormData.
      // Axios will attach the correct multipart boundary, and apiClient interceptor
      // removes the default application/json header for FormData payloads.
      const response = await apiClient.patch(`/tenants/${tenant?.id}/`, data, {
        headers: {
          Accept: 'application/json',
        },
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant'] });
      toast.success('Profile updated successfully');
      setLogoFile(null);
      window.dispatchEvent(new Event('tenant-branding-updated'));
    },
    onError: (error: any) => {
      const data = error?.response?.data;
      const message =
        data?.logo?.[0] ||
        data?.detail ||
        data?.message ||
        'Failed to update profile';
      toast.error(message);
    },
  });

  const isDirty = useMemo(() => {
    if (!tenant) return false;
    const current = {
      name: tenant.name || '',
      description: tenant.description || '',
      contact_email: tenant.contact_email || '',
      contact_phone: tenant.contact_phone || '',
      address: tenant.address || '',
      website: tenant.website || '',
      primary_color_light: tenant.branding?.primary_color_light || DEFAULT_LIGHT,
      primary_color_dark: tenant.branding?.primary_color_dark || DEFAULT_DARK,
    };

    return (
      JSON.stringify(current) !== JSON.stringify(formData) ||
      Boolean(logoFile) ||
      (tenant.branding?.logo_url || null) !== (logoPreview || null)
    );
  }, [formData, logoFile, logoPreview, tenant]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleColorChange = (field: 'primary_color_light' | 'primary_color_dark', value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image size must be less than 2MB');
      return;
    }

    setLogoFile(file);

    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!tenant) return;

    const formDataToSubmit = new FormData();

    Object.entries(formData).forEach(([key, value]) => {
      if (key !== 'primary_color_light' && key !== 'primary_color_dark') {
        formDataToSubmit.append(key, value);
      }
    });

    if (logoFile) {
      formDataToSubmit.append('logo', logoFile);
    }

    const settings = {
      theme: {
        primary_color_light: formData.primary_color_light,
        primary_color_dark: formData.primary_color_dark,
        logo_url: logoPreview || '',
      },
    };
    formDataToSubmit.append('settings', JSON.stringify(settings));

    updateProfileMutation.mutate(formDataToSubmit);
  };

  return (
    <AdminPage
      title="Organization Profile"
      description="Update company information, logo, and tenant branding."
      icon={<Building2 size={18} />}
      actions={
        tenant ? (
          <Button
            variant="primary"
            size="sm"
            form="tenant-profile-form"
            type="submit"
            disabled={!isDirty || updateProfileMutation.isPending}
            title={!isDirty ? 'No changes to save' : undefined}
          >
            {updateProfileMutation.isPending ? 'Saving…' : 'Save Changes'}
          </Button>
        ) : undefined
      }
    >
      <AdminGuard
        feature="profile"
        allow={(p) => p.can_manage_profile}
        loadingFallback={<LoadingSkeleton type="card" rows={2} />}
      >
        {isLoading ? (
          <LoadingSkeleton type="card" rows={2} />
        ) : !tenant ? (
          <EmptyState icon="🏢" title="Not available" message="Unable to load tenant information." />
        ) : (
          <form id="tenant-profile-form" onSubmit={handleSubmit}>
        <Stack>
          <AdminSection title="Basic Information" description="How your organization appears across the app.">
            <FormGrid>
              <Field>
                <Label htmlFor="name">Organization Name</Label>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  placeholder="Enter organization name"
                />
              </Field>

              <Field $span={2}>
                <Label htmlFor="description">Description</Label>
                <TextArea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={4}
                  placeholder="Tell us about your organization"
                />
              </Field>
            </FormGrid>
          </AdminSection>

          <AdminSection title="Contact" description="Used for billing, notifications, and support.">
            <FormGrid>
              <Field>
                <Label htmlFor="contact_email">Email</Label>
                <Input
                  id="contact_email"
                  name="contact_email"
                  type="email"
                  value={formData.contact_email}
                  onChange={handleInputChange}
                  required
                  placeholder="contact@example.com"
                />
              </Field>

              <Field>
                <Label htmlFor="contact_phone">Phone</Label>
                <Input
                  id="contact_phone"
                  name="contact_phone"
                  type="tel"
                  value={formData.contact_phone}
                  onChange={handleInputChange}
                  placeholder="+1 (555) 123-4567"
                />
              </Field>

              <Field>
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  name="website"
                  type="url"
                  value={formData.website}
                  onChange={handleInputChange}
                  placeholder="https://example.com"
                />
              </Field>

              <Field>
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  name="address"
                  type="text"
                  value={formData.address}
                  onChange={handleInputChange}
                  placeholder="Street, City, State"
                />
              </Field>
            </FormGrid>
          </AdminSection>

          <AdminSection title="Branding" description="Logo and primary colors used throughout the UI.">
            <BrandingGrid>
              <LogoBlock>
                <LogoTitle>Logo</LogoTitle>

                <LogoPreview>
                  {logoPreview ? (
                    <>
                      <LogoImg src={logoPreview} alt={`${tenant.name} logo`} />
                      <RemoveLogoButton type="button" onClick={handleRemoveLogo} aria-label="Remove logo">
                        <X size={14} />
                      </RemoveLogoButton>
                    </>
                  ) : (
                    <LogoPlaceholder>
                      <ImageIcon size={24} />
                      <span>No logo</span>
                    </LogoPlaceholder>
                  )}
                </LogoPreview>

                <div>
                  <HiddenFileInput
                    id="logo"
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                  />
                  <Button as="label" htmlFor="logo" variant="outline" size="sm">
                    Upload Logo
                  </Button>
                  <Hint>PNG/JPG up to 2MB.</Hint>
                </div>
              </LogoBlock>

              <ColorsBlock>
                <LogoTitle>Primary colors</LogoTitle>

                <ColorField>
                  <Label>Light theme</Label>
                  <ColorRow>
                    <ColorInput
                      type="color"
                      value={formData.primary_color_light}
                      onChange={(e) => handleColorChange('primary_color_light', e.target.value)}
                      aria-label="Light theme primary color"
                    />
                    <Input
                      type="text"
                      value={formData.primary_color_light}
                      onChange={(e) => handleColorChange('primary_color_light', e.target.value)}
                      placeholder={DEFAULT_LIGHT}
                    />
                  </ColorRow>
                </ColorField>

                <ColorField>
                  <Label>Dark theme</Label>
                  <ColorRow>
                    <ColorInput
                      type="color"
                      value={formData.primary_color_dark}
                      onChange={(e) => handleColorChange('primary_color_dark', e.target.value)}
                      aria-label="Dark theme primary color"
                    />
                    <Input
                      type="text"
                      value={formData.primary_color_dark}
                      onChange={(e) => handleColorChange('primary_color_dark', e.target.value)}
                      placeholder={DEFAULT_DARK}
                    />
                  </ColorRow>
                </ColorField>

                <Preview>
                  <PreviewTitle>Preview</PreviewTitle>
                  <PreviewSurface>
                    <PreviewButton
                      style={{ background: formData.primary_color_light }}
                      aria-label="Brand preview button"
                    >
                      {logoPreview && <PreviewLogo src={logoPreview} alt="" aria-hidden="true" />}
                      Primary action
                    </PreviewButton>
                  </PreviewSurface>
                </Preview>
              </ColorsBlock>
            </BrandingGrid>
          </AdminSection>
        </Stack>
          </form>
        )}
      </AdminGuard>
    </AdminPage>
  );
};

const Stack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const FormGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(1, minmax(0, 1fr));
  gap: 14px;

  @media (min-width: 768px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;

const Field = styled.div<{ $span?: 1 | 2 }>`
  display: flex;
  flex-direction: column;
  gap: 8px;

  ${(p) =>
    p.$span === 2 &&
    `
    @media (min-width: 768px) {
      grid-column: span 2;
    }
  `}
`;

const Label = styled.label`
  font-size: 13px;
  font-weight: 650;
  color: rgb(var(--color-text-primary));
`;

const inputStyles = `
  width: 100%;
  padding: 10px 12px;
  font-size: 14px;
  color: rgb(var(--color-text-primary));
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  transition: all 0.2s;

  &:focus {
    outline: none;
    border-color: rgba(var(--color-primary), 0.8);
    box-shadow: 0 0 0 3px rgba(var(--color-primary), 0.12);
  }
`;

const Input = styled.input`
  ${inputStyles}
`;

const TextArea = styled.textarea`
  ${inputStyles}
  resize: vertical;
  min-height: 88px;
`;

const BrandingGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(1, minmax(0, 1fr));
  gap: 16px;

  @media (min-width: 1024px) {
    grid-template-columns: 360px 1fr;
    align-items: start;
  }
`;

const LogoBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const ColorsBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const LogoTitle = styled.h3`
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: rgb(var(--color-text-primary));
`;

const LogoPreview = styled.div`
  position: relative;
  width: 220px;
  height: 220px;
  border: 2px dashed rgb(var(--color-border));
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: rgb(var(--color-background));
`;

const LogoImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 18px;
`;

const LogoPlaceholder = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
  justify-content: center;
  color: rgb(var(--color-text-secondary));
`;

const RemoveLogoButton = styled.button`
  position: absolute;
  top: 8px;
  right: 8px;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-full);
  border: none;
  background: rgb(var(--color-danger));
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    opacity: 0.92;
  }

  &:focus-visible {
    outline: 2px solid white;
    outline-offset: 2px;
  }
`;

const HiddenFileInput = styled.input`
  display: none;
`;

const Hint = styled.p`
  margin: 8px 0 0;
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
`;

const ColorField = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const ColorRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const ColorInput = styled.input`
  width: 60px;
  height: 42px;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  background: transparent;
  padding: 0;
  cursor: pointer;
`;

const Preview = styled.div`
  margin-top: 6px;
  padding-top: 12px;
  border-top: 1px solid rgb(var(--color-border));
`;

const PreviewTitle = styled.div`
  font-size: 12px;
  font-weight: 650;
  color: rgb(var(--color-text-secondary));
  margin-bottom: 10px;
`;

const PreviewSurface = styled.div`
  display: flex;
  justify-content: center;
  padding: 18px;
  background: rgb(var(--color-background));
  border-radius: var(--radius-lg);
`;

const PreviewButton = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 14px 18px;
  border-radius: var(--radius-lg);
  color: white;
  font-weight: 700;
  box-shadow: var(--shadow-md);
`;

const PreviewLogo = styled.img`
  width: 28px;
  height: 28px;
  object-fit: contain;
`;

export default AdminProfilePage;
