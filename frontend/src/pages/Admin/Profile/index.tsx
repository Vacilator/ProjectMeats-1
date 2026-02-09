import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useToast } from '@/hooks/useToast';
import { LoadingSkeleton } from '@/components/Admin/LoadingSkeleton';
import styles from './Profile.module.css';

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

export const Profile: React.FC = () => {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const { data: tenant, isLoading } = useQuery<Tenant>({
    queryKey: ['tenant'],
    queryFn: async () => {
      const response = await axios.get('/api/tenants/current/');
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
    primary_color_light: '#667eea',
    primary_color_dark: '#764ba2',
  });

  React.useEffect(() => {
    if (tenant) {
      setFormData({
        name: tenant.name || '',
        description: tenant.description || '',
        contact_email: tenant.contact_email || '',
        contact_phone: tenant.contact_phone || '',
        address: tenant.address || '',
        website: tenant.website || '',
        primary_color_light: tenant.branding?.primary_color_light || '#667eea',
        primary_color_dark: tenant.branding?.primary_color_dark || '#764ba2',
      });
      
      if (tenant.branding?.logo_url) {
        setLogoPreview(tenant.branding.logo_url);
      }
    }
  }, [tenant]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await axios.patch(`/api/tenants/${tenant?.id}/`, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant'] });
      showToast('Profile updated successfully', 'success');
      setLogoFile(null);
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Failed to update profile';
      showToast(message, 'error');
    },
  });

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleColorChange = (field: 'primary_color_light' | 'primary_color_dark', value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        showToast('Please select an image file', 'error');
        return;
      }

      if (file.size > 2 * 1024 * 1024) {
        showToast('Image size must be less than 2MB', 'error');
        return;
      }

      setLogoFile(file);

      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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

  if (isLoading) {
    return <LoadingSkeleton type="card" count={1} />;
  }

  if (!tenant) {
    return (
      <div className={styles.error}>
        <p>Unable to load tenant information</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Organization Profile</h1>
        <p>Manage your organization's information and branding</p>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        <section className={styles.section}>
          <h2>Basic Information</h2>
          
          <div className={styles.formGroup}>
            <label htmlFor="name">
              Organization Name <span className={styles.required}>*</span>
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              required
              placeholder="Enter organization name"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={4}
              placeholder="Tell us about your organization"
            />
          </div>
        </section>

        <section className={styles.section}>
          <h2>Contact Information</h2>
          
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="contact_email">
                Email <span className={styles.required}>*</span>
              </label>
              <input
                type="email"
                id="contact_email"
                name="contact_email"
                value={formData.contact_email}
                onChange={handleInputChange}
                required
                placeholder="contact@example.com"
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="contact_phone">Phone</label>
              <input
                type="tel"
                id="contact_phone"
                name="contact_phone"
                value={formData.contact_phone}
                onChange={handleInputChange}
                placeholder="+1 (555) 123-4567"
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="website">Website</label>
            <input
              type="url"
              id="website"
              name="website"
              value={formData.website}
              onChange={handleInputChange}
              placeholder="https://example.com"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="address">Address</label>
            <textarea
              id="address"
              name="address"
              value={formData.address}
              onChange={handleInputChange}
              rows={3}
              placeholder="Enter physical address"
            />
          </div>
        </section>

        <section className={styles.section}>
          <h2>Branding</h2>
          
          <div className={styles.formGroup}>
            <label>Organization Logo</label>
            <div className={styles.logoUpload}>
              {logoPreview ? (
                <div className={styles.logoPreview}>
                  <img src={logoPreview} alt="Logo preview" />
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className={styles.removeButton}
                    aria-label="Remove logo"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className={styles.logoPlaceholder}>
                  <svg
                    width="48"
                    height="48"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <p>No logo uploaded</p>
                </div>
              )}
              <input
                type="file"
                id="logo"
                accept="image/*"
                onChange={handleLogoChange}
                className={styles.fileInput}
              />
              <label htmlFor="logo" className={styles.uploadButton}>
                Choose Logo
              </label>
              <p className={styles.hint}>PNG, JPG or SVG (max 2MB)</p>
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="primary_color_light">Primary Color (Light Mode)</label>
              <div className={styles.colorPicker}>
                <input
                  type="color"
                  id="primary_color_light"
                  value={formData.primary_color_light}
                  onChange={(e) => handleColorChange('primary_color_light', e.target.value)}
                />
                <input
                  type="text"
                  value={formData.primary_color_light}
                  onChange={(e) => handleColorChange('primary_color_light', e.target.value)}
                  placeholder="#667eea"
                  pattern="^#[0-9A-Fa-f]{6}$"
                />
              </div>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="primary_color_dark">Primary Color (Dark Mode)</label>
              <div className={styles.colorPicker}>
                <input
                  type="color"
                  id="primary_color_dark"
                  value={formData.primary_color_dark}
                  onChange={(e) => handleColorChange('primary_color_dark', e.target.value)}
                />
                <input
                  type="text"
                  value={formData.primary_color_dark}
                  onChange={(e) => handleColorChange('primary_color_dark', e.target.value)}
                  placeholder="#764ba2"
                  pattern="^#[0-9A-Fa-f]{6}$"
                />
              </div>
            </div>
          </div>

          <div className={styles.preview}>
            <h3>Preview</h3>
            <div className={styles.previewContent}>
              <div
                className={styles.previewButton}
                style={{
                  background: `linear-gradient(135deg, ${formData.primary_color_light} 0%, ${formData.primary_color_dark} 100%)`,
                }}
              >
                {logoPreview && (
                  <img src={logoPreview} alt="Logo" className={styles.previewLogo} />
                )}
                <span>{formData.name || 'Organization Name'}</span>
              </div>
            </div>
          </div>
        </section>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancelButton}
            onClick={() => {
              if (tenant) {
                setFormData({
                  name: tenant.name || '',
                  description: tenant.description || '',
                  contact_email: tenant.contact_email || '',
                  contact_phone: tenant.contact_phone || '',
                  address: tenant.address || '',
                  website: tenant.website || '',
                  primary_color_light: tenant.branding?.primary_color_light || '#667eea',
                  primary_color_dark: tenant.branding?.primary_color_dark || '#764ba2',
                });
                setLogoFile(null);
                setLogoPreview(tenant.branding?.logo_url || null);
              }
            }}
          >
            Reset
          </button>
          <button
            type="submit"
            className={styles.saveButton}
            disabled={updateProfileMutation.isPending}
          >
            {updateProfileMutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default Profile;
