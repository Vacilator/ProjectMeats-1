import { businessApi } from './businessApi';

export interface UserPreferencesResponse {
  onboarding_state?: unknown;
  theme?: string;
  sidebar_collapsed?: boolean;
  dashboard_layout?: Record<string, unknown>;
  quick_menu_items?: string[];
  widget_preferences?: Record<string, unknown>;
}

export interface UserPreferencesPatch {
  onboarding_state?: unknown;
  theme?: string;
  sidebar_collapsed?: boolean;
  dashboard_layout?: Record<string, unknown>;
  quick_menu_items?: string[];
  widget_preferences?: Record<string, unknown>;
}

export const userPreferencesService = {
  async getCurrent(): Promise<UserPreferencesResponse> {
    const response = await businessApi.get<UserPreferencesResponse>('/preferences/me/');
    return response.data;
  },

  async updateCurrent(
    patch: UserPreferencesPatch,
  ): Promise<UserPreferencesResponse> {
    const response = await businessApi.patch<UserPreferencesResponse>(
      '/preferences/me/',
      patch,
    );
    return response.data;
  },
};
