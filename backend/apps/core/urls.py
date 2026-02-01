from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

# Create a router for ViewSets
router = DefaultRouter()
router.register(r'preferences', views.UserPreferencesViewSet, basename='user-preferences')

urlpatterns = [
    path("auth/login/", views.login, name="login"),
    path("auth/guest-login/", views.guest_login, name="guest-login"),
    path("auth/signup/", views.signup, name="signup"),
    path("auth/logout/", views.logout, name="logout"),
    # Choices endpoint for static dropdowns
    path("choices/", views.ChoicesAPIView.as_view(), name="choices"),
    # Universal Search API (Wave 2: Cockpit Command Center)
    path("search/universal/", views.UniversalSearchView.as_view(), name="universal-search"),
    path("search/recent/", views.RecentItemsView.as_view(), name="recent-items"),
    path("search/operators/", views.SearchOperatorsView.as_view(), name="search-operators"),
    # Include router URLs
    path("", include(router.urls)),
]
