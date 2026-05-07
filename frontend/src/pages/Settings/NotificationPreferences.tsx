/**
 * NotificationPreferences Page Component
 * 
 * Full settings page for notification preferences with per-type configuration.
 * Integrates with the Wave 3 notification-preferences API endpoint.
 */
import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useNotifications, NotificationType } from '../../contexts/NotificationsContext';

// ============================================================================
// STYLED COMPONENTS
// ============================================================================

const Container = styled.div`
  max-width: 800px;
  margin: 0 auto;
  padding: 24px;
`;

const Header = styled.div`
  margin-bottom: 32px;
`;

const Title = styled.h1`
  font-size: 28px;
  font-weight: 600;
  color: rgb(var(--color-text-primary, 44 62 80));
  margin: 0 0 8px 0;
`;

const Subtitle = styled.p`
  font-size: 14px;
  color: rgb(var(--color-text-secondary, 127 140 141));
  margin: 0;
`;

const Section = styled.section`
  background: rgb(var(--color-surface, 255 255 255));
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  padding: 24px;
  margin-bottom: 24px;
`;

const SectionTitle = styled.h2`
  font-size: 18px;
  font-weight: 600;
  color: rgb(var(--color-text-primary, 44 62 80));
  margin: 0 0 16px 0;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const SectionDescription = styled.p`
  font-size: 13px;
  color: rgb(var(--color-text-secondary, 127 140 141));
  margin: 0 0 20px 0;
`;

const ToggleRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 0;
  border-bottom: 1px solid rgb(var(--color-border, 224 224 224));

  &:last-child {
    border-bottom: none;
  }
`;

const ToggleInfo = styled.div`
  flex: 1;
`;

const ToggleLabel = styled.label`
  display: block;
  font-size: 15px;
  font-weight: 500;
  color: rgb(var(--color-text-primary, 44 62 80));
  margin-bottom: 4px;
  cursor: pointer;
`;

const ToggleDescription = styled.span`
  font-size: 13px;
  color: rgb(var(--color-text-secondary, 127 140 141));
`;

const Toggle = styled.button<{ $active: boolean; $disabled?: boolean }>`
  width: 48px;
  height: 26px;
  border-radius: 13px;
  border: none;
  cursor: ${props => props.$disabled ? 'not-allowed' : 'pointer'};
  background: ${props => props.$active ? 'rgb(var(--color-success))' : 'rgb(var(--color-border, 224 224 224))'};
  position: relative;
  transition: background 0.2s ease;
  opacity: ${props => props.$disabled ? 0.5 : 1};
  flex-shrink: 0;
  margin-left: 16px;

  &::after {
    content: '';
    position: absolute;
    top: 3px;
    left: ${props => props.$active ? '25px' : '3px'};
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: white;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    transition: left 0.2s ease;
  }

  &:focus {
    outline: none;
    box-shadow: 0 0 0 3px rgba(var(--color-success), 0.3);
  }
`;

const NotificationTypeGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
  margin-top: 16px;
`;

const NotificationTypeCard = styled.div<{ $disabled?: boolean }>`
  padding: 16px;
  border: 1px solid rgb(var(--color-border, 224 224 224));
  border-radius: 8px;
  opacity: ${props => props.$disabled ? 0.5 : 1};
`;

const NotificationTypeHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
`;

const NotificationTypeIcon = styled.span`
  font-size: 20px;
`;

const NotificationTypeName = styled.span`
  font-size: 14px;
  font-weight: 500;
  color: rgb(var(--color-text-primary, 44 62 80));
`;

const DeliveryOptions = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
`;

const DeliveryBadge = styled.button<{ $active: boolean; $disabled?: boolean }>`
  padding: 4px 10px;
  font-size: 12px;
  border-radius: 4px;
  border: 1px solid ${props => props.$active ? 'rgb(var(--color-primary, 102 126 234))' : 'rgb(var(--color-border, 224 224 224))'};
  background: ${props => props.$active ? 'rgba(var(--color-primary), 0.1)' : 'transparent'};
  color: ${props => props.$active ? 'rgb(var(--color-primary, 102 126 234))' : 'rgb(var(--color-text-secondary, 127 140 141))'};
  cursor: ${props => props.$disabled ? 'not-allowed' : 'pointer'};
  transition: all 0.15s ease;

  &:hover:not(:disabled) {
    border-color: rgb(var(--color-primary, 102 126 234));
  }

  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px rgba(var(--color-primary), 0.3);
  }
`;

const QuietHoursSection = styled.div`
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid rgb(var(--color-border, 224 224 224));
`;

const TimeInputGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
`;

const TimeInput = styled.input`
  padding: 8px 12px;
  border: 1px solid rgb(var(--color-border, 224 224 224));
  border-radius: 6px;
  font-size: 14px;
  width: 120px;

  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary, 102 126 234));
  }

  &:disabled {
    background: rgb(var(--color-background, 248 249 250));
    cursor: not-allowed;
  }
`;

const TimeLabel = styled.span`
  font-size: 13px;
  color: rgb(var(--color-text-secondary, 127 140 141));
`;

const SaveButton = styled.button`
  padding: 12px 24px;
  background: rgb(var(--color-primary, 102 126 234));
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.15s ease;

  &:hover {
    opacity: 0.9;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const ButtonRow = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
`;

const SuccessMessage = styled.div`
  padding: 12px 16px;
  background: rgba(var(--color-success), 0.1);
  border: 1px solid rgba(var(--color-success), 0.3);
  border-radius: 8px;
  color: rgb(var(--color-success));
  font-size: 14px;
  margin-bottom: 24px;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const ErrorMessage = styled.div`
  padding: 12px 16px;
  background: rgba(var(--color-error), 0.1);
  border: 1px solid rgba(var(--color-error), 0.3);
  border-radius: 8px;
  color: rgb(var(--color-error));
  font-size: 14px;
  margin-bottom: 24px;
`;

const LoadingSpinner = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 60px;
  
  &::after {
    content: '';
    width: 40px;
    height: 40px;
    border: 3px solid rgb(var(--color-border, 224 224 224));
    border-top-color: rgb(var(--color-primary, 102 126 234));
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

// ============================================================================
// NOTIFICATION TYPE CONFIG
// ============================================================================

interface NotificationTypeConfig {
  type: NotificationType;
  label: string;
  description: string;
  icon: string;
}

const NOTIFICATION_TYPES: NotificationTypeConfig[] = [
  { type: 'task_assigned', label: 'Task Assigned', description: 'When a task is assigned to you', icon: '📋' },
  { type: 'task_due_soon', label: 'Task Due Soon', description: 'Reminders for upcoming deadlines', icon: '⏰' },
  { type: 'task_overdue', label: 'Task Overdue', description: 'When a task is past its due date', icon: '🔴' },
  { type: 'task_completed', label: 'Task Completed', description: 'When a task you assigned is done', icon: '✅' },
  { type: 'form_submitted', label: 'Form Submitted', description: 'When a form is submitted for review', icon: '📝' },
  { type: 'form_approved', label: 'Form Approved', description: 'When your submission is approved', icon: '👍' },
  { type: 'form_rejected', label: 'Form Rejected', description: 'When your submission is rejected', icon: '👎' },
  { type: 'mention', label: 'Mentions', description: 'When someone mentions you', icon: '@' },
  { type: 'comment', label: 'Comments', description: 'New comments on items you follow', icon: '💬' },
  { type: 'status_change', label: 'Status Changes', description: 'Updates on item status', icon: '🔄' },
  { type: 'workflow_trigger', label: 'Workflow Triggers', description: 'Automated workflow events', icon: '⚡' },
  { type: 'system', label: 'System', description: 'Important system announcements', icon: '🔔' },
];

const DELIVERY_METHODS = ['in_app', 'email', 'push'] as const;
type DeliveryMethod = typeof DELIVERY_METHODS[number];

const DELIVERY_LABELS: Record<DeliveryMethod, string> = {
  in_app: 'In-App',
  email: 'Email',
  push: 'Push',
};

// ============================================================================
// COMPONENT
// ============================================================================

export const NotificationPreferences: React.FC = () => {
  const { preferences, updatePreferences, loading: contextLoading, error: contextError } = useNotifications();
  
  // Local state for form
  const [localPrefs, setLocalPrefs] = useState({
    notifications_enabled: true,
    email_enabled: true,
    sms_enabled: false,
    push_enabled: true,
    type_preferences: {} as Record<NotificationType, DeliveryMethod[]>,
    quiet_hours_enabled: false,
    quiet_hours_start: '22:00',
    quiet_hours_end: '08:00',
    daily_digest_enabled: false,
    weekly_digest_enabled: false,
  });
  
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Sync local state with context preferences
  useEffect(() => {
    if (preferences) {
      setLocalPrefs({
        notifications_enabled: preferences.notifications_enabled,
        email_enabled: preferences.email_enabled,
        sms_enabled: preferences.sms_enabled,
        push_enabled: preferences.push_enabled,
        type_preferences: preferences.type_preferences || {},
        quiet_hours_enabled: preferences.quiet_hours_enabled,
        quiet_hours_start: preferences.quiet_hours_start || '22:00',
        quiet_hours_end: preferences.quiet_hours_end || '08:00',
        daily_digest_enabled: preferences.daily_digest_enabled,
        weekly_digest_enabled: preferences.weekly_digest_enabled,
      });
    }
  }, [preferences]);

  // Get delivery methods for a notification type
  const getTypeDeliveryMethods = (type: NotificationType): DeliveryMethod[] => {
    return localPrefs.type_preferences[type] || ['in_app'];
  };

  // Toggle a delivery method for a notification type
  const toggleTypeDelivery = (type: NotificationType, method: DeliveryMethod) => {
    const current = getTypeDeliveryMethods(type);
    const updated = current.includes(method)
      ? current.filter(m => m !== method)
      : [...current, method];
    
    // Ensure at least in_app is always enabled
    if (updated.length === 0) {
      updated.push('in_app');
    }
    
    setLocalPrefs(prev => ({
      ...prev,
      type_preferences: {
        ...prev.type_preferences,
        [type]: updated,
      },
    }));
  };

  // Handle save
  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    setSaveError(null);
    
    try {
      await updatePreferences(localPrefs);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError('Failed to save preferences. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (contextLoading && !preferences) {
    return (
      <Container>
        <Header>
          <Title>Notification Preferences</Title>
        </Header>
        <LoadingSpinner />
      </Container>
    );
  }

  return (
    <Container>
      <Header>
        <Title>Notification Preferences</Title>
        <Subtitle>Manage how and when you receive notifications</Subtitle>
      </Header>

      {saveSuccess && (
        <SuccessMessage>
          ✅ Preferences saved successfully!
        </SuccessMessage>
      )}

      {(saveError || contextError) && (
        <ErrorMessage>{saveError || contextError}</ErrorMessage>
      )}

      {/* Master Toggle */}
      <Section>
        <SectionTitle>🔔 General</SectionTitle>
        <SectionDescription>
          Control your overall notification settings
        </SectionDescription>

        <ToggleRow>
          <ToggleInfo>
            <ToggleLabel htmlFor="notifications-enabled">Enable Notifications</ToggleLabel>
            <ToggleDescription>Receive notifications from the system</ToggleDescription>
          </ToggleInfo>
          <Toggle
            id="notifications-enabled"
            $active={localPrefs.notifications_enabled}
            onClick={() => setLocalPrefs(p => ({ ...p, notifications_enabled: !p.notifications_enabled }))}
            aria-pressed={localPrefs.notifications_enabled}
          />
        </ToggleRow>

        <ToggleRow>
          <ToggleInfo>
            <ToggleLabel htmlFor="email-enabled">Email Notifications</ToggleLabel>
            <ToggleDescription>Receive notifications via email</ToggleDescription>
          </ToggleInfo>
          <Toggle
            id="email-enabled"
            $active={localPrefs.email_enabled}
            $disabled={!localPrefs.notifications_enabled}
            onClick={() => localPrefs.notifications_enabled && setLocalPrefs(p => ({ ...p, email_enabled: !p.email_enabled }))}
            aria-pressed={localPrefs.email_enabled}
          />
        </ToggleRow>

        <ToggleRow>
          <ToggleInfo>
            <ToggleLabel htmlFor="push-enabled">Push Notifications</ToggleLabel>
            <ToggleDescription>Receive browser push notifications</ToggleDescription>
          </ToggleInfo>
          <Toggle
            id="push-enabled"
            $active={localPrefs.push_enabled}
            $disabled={!localPrefs.notifications_enabled}
            onClick={() => localPrefs.notifications_enabled && setLocalPrefs(p => ({ ...p, push_enabled: !p.push_enabled }))}
            aria-pressed={localPrefs.push_enabled}
          />
        </ToggleRow>
      </Section>

      {/* Notification Types */}
      <Section>
        <SectionTitle>📋 Notification Types</SectionTitle>
        <SectionDescription>
          Choose how you want to be notified for each type of event
        </SectionDescription>

        <NotificationTypeGrid>
          {NOTIFICATION_TYPES.map((config) => (
            <NotificationTypeCard key={config.type} $disabled={!localPrefs.notifications_enabled}>
              <NotificationTypeHeader>
                <NotificationTypeIcon>{config.icon}</NotificationTypeIcon>
                <NotificationTypeName>{config.label}</NotificationTypeName>
              </NotificationTypeHeader>
              <DeliveryOptions>
                {DELIVERY_METHODS.map((method) => {
                  // Check if delivery method is enabled globally
                  const isMethodEnabled = method === 'in_app' || 
                    (method === 'email' && localPrefs.email_enabled) ||
                    (method === 'push' && localPrefs.push_enabled);
                  
                  return (
                    <DeliveryBadge
                      key={method}
                      $active={getTypeDeliveryMethods(config.type).includes(method)}
                      $disabled={!localPrefs.notifications_enabled || !isMethodEnabled}
                      onClick={() => localPrefs.notifications_enabled && isMethodEnabled && toggleTypeDelivery(config.type, method)}
                      title={config.description}
                    >
                      {DELIVERY_LABELS[method]}
                    </DeliveryBadge>
                  );
                })}
              </DeliveryOptions>
            </NotificationTypeCard>
          ))}
        </NotificationTypeGrid>
      </Section>

      {/* Quiet Hours */}
      <Section>
        <SectionTitle>🌙 Quiet Hours</SectionTitle>
        <SectionDescription>
          Pause notifications during specific hours (email and push only)
        </SectionDescription>

        <ToggleRow>
          <ToggleInfo>
            <ToggleLabel htmlFor="quiet-hours">Enable Quiet Hours</ToggleLabel>
            <ToggleDescription>Don't send notifications during specified hours</ToggleDescription>
          </ToggleInfo>
          <Toggle
            id="quiet-hours"
            $active={localPrefs.quiet_hours_enabled}
            $disabled={!localPrefs.notifications_enabled}
            onClick={() => localPrefs.notifications_enabled && setLocalPrefs(p => ({ ...p, quiet_hours_enabled: !p.quiet_hours_enabled }))}
            aria-pressed={localPrefs.quiet_hours_enabled}
          />
        </ToggleRow>

        {localPrefs.quiet_hours_enabled && (
          <QuietHoursSection>
            <TimeInputGroup>
              <TimeLabel>From:</TimeLabel>
              <TimeInput
                type="time"
                value={localPrefs.quiet_hours_start}
                onChange={(e) => setLocalPrefs(p => ({ ...p, quiet_hours_start: e.target.value }))}
                disabled={!localPrefs.notifications_enabled}
              />
              <TimeLabel>To:</TimeLabel>
              <TimeInput
                type="time"
                value={localPrefs.quiet_hours_end}
                onChange={(e) => setLocalPrefs(p => ({ ...p, quiet_hours_end: e.target.value }))}
                disabled={!localPrefs.notifications_enabled}
              />
            </TimeInputGroup>
          </QuietHoursSection>
        )}
      </Section>

      {/* Digest Settings */}
      <Section>
        <SectionTitle>📬 Digest Settings</SectionTitle>
        <SectionDescription>
          Receive a summary of notifications instead of individual emails
        </SectionDescription>

        <ToggleRow>
          <ToggleInfo>
            <ToggleLabel htmlFor="daily-digest">Daily Digest</ToggleLabel>
            <ToggleDescription>Receive a daily summary of your notifications</ToggleDescription>
          </ToggleInfo>
          <Toggle
            id="daily-digest"
            $active={localPrefs.daily_digest_enabled}
            $disabled={!localPrefs.notifications_enabled || !localPrefs.email_enabled}
            onClick={() => localPrefs.notifications_enabled && localPrefs.email_enabled && setLocalPrefs(p => ({ ...p, daily_digest_enabled: !p.daily_digest_enabled }))}
            aria-pressed={localPrefs.daily_digest_enabled}
          />
        </ToggleRow>

        <ToggleRow>
          <ToggleInfo>
            <ToggleLabel htmlFor="weekly-digest">Weekly Digest</ToggleLabel>
            <ToggleDescription>Receive a weekly summary of your notifications</ToggleDescription>
          </ToggleInfo>
          <Toggle
            id="weekly-digest"
            $active={localPrefs.weekly_digest_enabled}
            $disabled={!localPrefs.notifications_enabled || !localPrefs.email_enabled}
            onClick={() => localPrefs.notifications_enabled && localPrefs.email_enabled && setLocalPrefs(p => ({ ...p, weekly_digest_enabled: !p.weekly_digest_enabled }))}
            aria-pressed={localPrefs.weekly_digest_enabled}
          />
        </ToggleRow>
      </Section>

      <ButtonRow>
        <SaveButton onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Preferences'}
        </SaveButton>
      </ButtonRow>
    </Container>
  );
};

export default NotificationPreferences;
