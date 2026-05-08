/**
 * Notification Utility
 *
 * Centralized notification system using Ant Design's message component.
 * Provides consistent styling and behavior across the application.
 */
import { message } from 'antd';

// Configure message defaults
message.config({
  top: 60, // Below header
  duration: 3, // 3 seconds
  maxCount: 3, // Max notifications at once
});

export interface NotificationOptions {
  duration?: number;
  key?: string;
}

/**
 * Show a success notification
 */
export const showSuccess = (content: string, options?: NotificationOptions) => {
  message.success({
    content,
    duration: options?.duration ?? 3,
    key: options?.key,
  });
};

/**
 * Show an error notification
 */
export const showError = (content: string, options?: NotificationOptions) => {
  message.error({
    content,
    duration: options?.duration ?? 5, // Errors show longer
    key: options?.key,
  });
};

/**
 * Show a warning notification
 */
export const showWarning = (content: string, options?: NotificationOptions) => {
  message.warning({
    content,
    duration: options?.duration ?? 4,
    key: options?.key,
  });
};

/**
 * Show an info notification
 */
export const showInfo = (content: string, options?: NotificationOptions) => {
  message.info({
    content,
    duration: options?.duration ?? 3,
    key: options?.key,
  });
};

/**
 * Show a loading notification (must be dismissed manually or with key)
 */
export const showLoading = (content: string, key: string) => {
  message.loading({
    content,
    duration: 0, // Don't auto-dismiss
    key,
  });
};

/**
 * Dismiss a notification by key
 */
export const dismissNotification = (key: string) => {
  message.destroy(key);
};

/**
 * Helper to handle API errors consistently
 */
export const handleApiError = (error: unknown, fallbackMessage = 'An error occurred') => {
  let errorMessage = fallbackMessage;

  if (error && typeof error === 'object') {
    const err = error as { response?: { data?: { error?: string; detail?: string; message?: string } }; message?: string };
    errorMessage = err.response?.data?.error
      || err.response?.data?.detail
      || err.response?.data?.message
      || err.message
      || fallbackMessage;
  }

  showError(errorMessage);
  return errorMessage;
};

/**
 * Notification utility object for convenient imports
 */
export const notify = {
  success: showSuccess,
  error: showError,
  warning: showWarning,
  info: showInfo,
  loading: showLoading,
  dismiss: dismissNotification,
  handleApiError,
};

export default notify;
