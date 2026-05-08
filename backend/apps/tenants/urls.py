from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .invitation_views import TenantInvitationViewSet, signup_with_invitation, validate_invitation
from .views import ActivityLogViewSet, TenantConfigurationViewSet, TenantUserViewSet, TenantViewSet

router = DefaultRouter()
router.register(r"tenants", TenantViewSet)
router.register(r"tenant-users", TenantUserViewSet)
router.register(r"invitations", TenantInvitationViewSet, basename="tenant-invitation")
router.register(r"activity-logs", ActivityLogViewSet, basename="activity-log")
router.register(r"configurations", TenantConfigurationViewSet, basename="tenant-configuration")

app_name = "tenants"

urlpatterns = [
    # NOTE: Place validate route BEFORE router URLs so it does not get captured by the
    # router's `invitations/<pk>/` detail route (where pk="validate" would 401).
    path("invitations/validate/", validate_invitation, name="validate-invitation"),
    path("auth/signup-with-invitation/", signup_with_invitation, name="signup-with-invitation"),
    path("", include(router.urls)),
]
