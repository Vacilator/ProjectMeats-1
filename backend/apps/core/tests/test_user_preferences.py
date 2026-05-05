"""
Tests for UserPreferences model and API.
"""
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APITestCase
from rest_framework import status
from apps.core.models import UserPreferences
from apps.core.serializers import UserPreferencesSerializer


class UserPreferencesModelTest(TestCase):
    """Tests for UserPreferences model."""
    
    def setUp(self):
        """Set up test user."""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
    
    def test_create_user_preferences(self):
        """Test creating user preferences."""
        preferences = UserPreferences.objects.create(
            user=self.user,
            theme='dark',
            sidebar_collapsed=True
        )
        self.assertEqual(preferences.user, self.user)
        self.assertEqual(preferences.theme, 'dark')
        self.assertTrue(preferences.sidebar_collapsed)
    
    def test_default_values(self):
        """Test default values for user preferences."""
        preferences = UserPreferences.objects.create(user=self.user)
        self.assertEqual(preferences.theme, 'light')
        self.assertFalse(preferences.sidebar_collapsed)
        self.assertEqual(preferences.dashboard_layout, {})
        self.assertEqual(preferences.quick_menu_items, [])
        self.assertEqual(preferences.widget_preferences, {})
    
    def test_json_field_storage(self):
        """Test JSON field storage."""
        preferences = UserPreferences.objects.create(
            user=self.user,
            dashboard_layout={'widgets': ['sales', 'inventory']},
            quick_menu_items=['/suppliers', '/customers'],
            widget_preferences={'sales': {'collapsed': False}}
        )
        self.assertEqual(len(preferences.dashboard_layout['widgets']), 2)
        self.assertEqual(len(preferences.quick_menu_items), 2)
        self.assertIn('sales', preferences.widget_preferences)
    
    def test_str_representation(self):
        """Test string representation."""
        preferences = UserPreferences.objects.create(user=self.user)
        self.assertEqual(str(preferences), f"Preferences for {self.user.username}")


class UserPreferencesSerializerTest(TestCase):
    """Tests for the canonical onboarding preferences contract."""

    def setUp(self):
        self.user = User.objects.create_user(
            username='serializer-user',
            email='serializer@example.com',
            password='testpass123'
        )

    def test_serializer_exposes_default_onboarding_state(self):
        preferences = UserPreferences.objects.create(user=self.user)

        serializer = UserPreferencesSerializer(preferences)

        self.assertEqual(
            serializer.data['onboarding_state'],
            {'completed_tours': [], 'tour_statuses': {}}
        )

    def test_serializer_merges_onboarding_state_without_clobbering_widget_preferences(self):
        preferences = UserPreferences.objects.create(
            user=self.user,
            widget_preferences={'sales': {'collapsed': False}}
        )

        serializer = UserPreferencesSerializer(
            preferences,
            data={
                'onboarding_state': {
                    'completed_tours': [' cockpit ', 'workflow-editor', 'cockpit'],
                    'tour_statuses': {
                        'cockpit': {
                            'status': 'completed',
                            'last_event': 'completed',
                            'last_event_at': '2026-05-04T12:00:00Z',
                            'completed_at': '2026-05-04T12:00:00Z',
                            'start_count': 1,
                            'complete_count': 1,
                            'skip_count': 0,
                            'resume_count': 0,
                        }
                    },
                }
            },
            partial=True
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        updated_preferences = serializer.save()

        self.assertEqual(updated_preferences.widget_preferences['sales'], {'collapsed': False})
        self.assertEqual(
            updated_preferences.widget_preferences['onboarding'],
            {
                'completed_tours': ['cockpit', 'workflow-editor'],
                'tour_statuses': {
                    'cockpit': {
                        'status': 'completed',
                        'last_event': 'completed',
                        'last_event_at': '2026-05-04T12:00:00Z',
                        'started_at': None,
                        'completed_at': '2026-05-04T12:00:00Z',
                        'skipped_at': None,
                        'start_count': 1,
                        'complete_count': 1,
                        'skip_count': 0,
                        'resume_count': 0,
                    }
                },
            }
        )

    def test_serializer_rejects_invalid_onboarding_state(self):
        preferences = UserPreferences.objects.create(user=self.user)

        serializer = UserPreferencesSerializer(
            preferences,
            data={'onboarding_state': {'completed_tours': 'cockpit'}},
            partial=True
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn('onboarding_state', serializer.errors)

    def test_serializer_rejects_invalid_tour_status_payload(self):
        preferences = UserPreferences.objects.create(user=self.user)

        serializer = UserPreferencesSerializer(
            preferences,
            data={
                'onboarding_state': {
                    'completed_tours': [],
                    'tour_statuses': {
                        'cockpit': {
                            'status': 'invalid',
                        }
                    },
                }
            },
            partial=True
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn('onboarding_state', serializer.errors)

class UserPreferencesAPITest(APITestCase):
    """Tests for UserPreferences API endpoints."""
    
    def setUp(self):
        """Set up test users and authentication."""
        self.user1 = User.objects.create_user(
            username='user1',
            email='user1@example.com',
            password='testpass123'
        )
        self.user2 = User.objects.create_user(
            username='user2',
            email='user2@example.com',
            password='testpass123'
        )
    
    def _make_request(self, method, url, user=None, data=None):
        """Helper to make requests with optional authentication."""
        self.client.force_authenticate(user=user)
        if method == 'GET':
            return self.client.get(url)
        if method == 'PATCH':
            return self.client.patch(url, data, format='json')
        if method == 'PUT':
            return self.client.put(url, data, format='json')
        raise AssertionError(f'Unsupported method: {method}')
    
    def test_get_or_create_preferences(self):
        """Test GET /api/v1/preferences/me/ creates preferences if not exists."""
        response = self._make_request('GET', '/api/v1/preferences/me/', self.user1)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['user'], self.user1.id)
        self.assertEqual(response.data['theme'], 'light')
        self.assertEqual(response.data['onboarding_state'], {'completed_tours': [], 'tour_statuses': {}})
        
        # Verify it was created in database
        self.assertTrue(
            UserPreferences.objects.filter(user=self.user1).exists()
        )
    
    def test_update_preferences_partial(self):
        """Test PATCH /api/v1/preferences/me/ updates preferences."""
        # First create preferences
        self._make_request('GET', '/api/v1/preferences/me/', self.user1)
        
        # Update onboarding state only
        response = self._make_request(
            'PATCH',
            '/api/v1/preferences/me/',
            self.user1,
            {
                'onboarding_state': {
                    'completed_tours': ['workflow-editor'],
                    'tour_statuses': {
                        'workflow-editor': {
                            'status': 'completed',
                            'last_event': 'completed',
                            'last_event_at': '2026-05-05T18:00:00Z',
                            'started_at': '2026-05-05T17:59:00Z',
                            'completed_at': '2026-05-05T18:00:00Z',
                            'skipped_at': None,
                            'start_count': 1,
                            'complete_count': 1,
                            'skip_count': 0,
                            'resume_count': 0,
                        },
                    },
                },
            }
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data['onboarding_state']['completed_tours'],
            ['workflow-editor'],
        )
        
        # Verify in database
        preferences = UserPreferences.objects.get(user=self.user1)
        self.assertEqual(
            preferences.widget_preferences['onboarding']['completed_tours'],
            ['workflow-editor'],
        )
    
    def test_update_preferences_full(self):
        """Test PUT /api/v1/preferences/me/ updates all preferences."""
        data = {
            'theme': 'dark',
            'sidebar_collapsed': True,
            'dashboard_layout': {'widgets': ['sales']},
            'quick_menu_items': ['/suppliers'],
            'widget_preferences': {'sales': {'period': 'month'}},
            'onboarding_state': {
                'completed_tours': ['cockpit'],
                'tour_statuses': {
                    'cockpit': {
                        'status': 'completed',
                        'last_event': 'completed',
                        'last_event_at': '2026-05-05T18:30:00Z',
                        'started_at': '2026-05-05T18:29:00Z',
                        'completed_at': '2026-05-05T18:30:00Z',
                        'skipped_at': None,
                        'start_count': 1,
                        'complete_count': 1,
                        'skip_count': 0,
                        'resume_count': 0,
                    },
                },
            },
        }
        
        response = self._make_request('PUT', '/api/v1/preferences/me/', self.user1, data)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['theme'], 'dark')
        self.assertTrue(response.data['sidebar_collapsed'])
        self.assertEqual(response.data['dashboard_layout'], {'widgets': ['sales']})
        self.assertEqual(response.data['onboarding_state']['completed_tours'], ['cockpit'])
    
    def test_user_isolation(self):
        """Test users can only access their own preferences."""
        # User1 creates preferences
        response1 = self._make_request(
            'PATCH',
            '/api/v1/preferences/me/',
            self.user1,
            {'theme': 'dark'}
        )
        self.assertEqual(response1.status_code, status.HTTP_200_OK)
        self.assertEqual(response1.data['theme'], 'dark')
        
        # User2 creates preferences
        response2 = self._make_request(
            'PATCH',
            '/api/v1/preferences/me/',
            self.user2,
            {
                'onboarding_state': {
                    'completed_tours': ['cockpit'],
                    'tour_statuses': {
                        'cockpit': {
                            'status': 'completed',
                            'last_event': 'completed',
                            'last_event_at': '2026-05-05T19:00:00Z',
                            'started_at': None,
                            'completed_at': '2026-05-05T19:00:00Z',
                            'skipped_at': None,
                            'start_count': 0,
                            'complete_count': 1,
                            'skip_count': 0,
                            'resume_count': 0,
                        },
                    },
                },
            }
        )
        self.assertEqual(response2.status_code, status.HTTP_200_OK)
        self.assertEqual(response2.data['onboarding_state']['completed_tours'], ['cockpit'])
        
        # Verify users have different preferences
        pref1 = UserPreferences.objects.get(user=self.user1)
        pref2 = UserPreferences.objects.get(user=self.user2)
        self.assertEqual(pref1.theme, 'dark')
        self.assertEqual(pref2.widget_preferences['onboarding']['completed_tours'], ['cockpit'])
    
    def test_unauthenticated_access_denied(self):
        """Test unauthenticated users cannot access preferences."""
        response = self.client.get('/api/v1/preferences/me/')
        # DRF may return 401 or 403 depending on authentication configuration
        self.assertIn(response.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])
