"""
Debug helper for permissions issues.
Temporary file to diagnose superuser permissions.
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated


class DebugPermissionsView(APIView):
    """
    Debug endpoint to check user authentication state.
    GET /api/v1/workflows/debug-permissions/
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        user = request.user
        tenant = getattr(request, 'tenant', None)
        
        return Response({
            'user_id': user.id if user else None,
            'username': user.username if user else None,
            'email': user.email if user and hasattr(user, 'email') else None,
            'is_authenticated': user.is_authenticated if user else False,
            'is_superuser': user.is_superuser if user else False,
            'is_staff': user.is_staff if user and hasattr(user, 'is_staff') else False,
            'tenant_id': tenant.id if tenant else None,
            'tenant_name': tenant.name if tenant else None,
            'tenant_slug': tenant.slug if tenant else None,
            'has_tenant': tenant is not None,
            'request_user_type': type(user).__name__,
        })
