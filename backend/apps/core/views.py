from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from rest_framework.serializers import ValidationError
from apps.tenants.models import Tenant, TenantUser


@api_view(["POST"])
@permission_classes([AllowAny])
def login(request):
    """
    Login endpoint for token-based authentication.
    """
    username = request.data.get("username")
    password = request.data.get("password")

    if not username or not password:
        return Response(
            {"error": "Username and password are required"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = authenticate(username=username, password=password)

    if user:
        token, created = Token.objects.get_or_create(user=user)
        
        # Get user's tenants
        user_tenants = TenantUser.objects.filter(
            user=user,
            is_active=True
        ).select_related('tenant').values(
            'tenant__id',
            'tenant__name',
            'tenant__slug',
            'role'
        )
        
        return Response(
            {
                "token": token.key,
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "is_staff": user.is_staff,
                    "is_superuser": user.is_superuser,
                    "is_active": user.is_active,
                },
                "tenants": list(user_tenants),
            }
        )

    return Response(
        {"error": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED
    )


@api_view(["POST"])
@permission_classes([AllowAny])
def guest_login(request):
    """
    Guest login endpoint - automatically logs in as the guest user.
    
    This allows users to try ProjectMeats without creating an account.
    The guest user has admin-level permissions within the guest tenant,
    but is NOT a superuser.
    """
    try:
        # Get guest user (default username: 'guest')
        guest_username = 'guest'
        guest_user = User.objects.get(username=guest_username)
        
        if not guest_user.is_active:
            return Response(
                {"error": "Guest account is currently disabled"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
        
        # Get or create token for guest user
        token, created = Token.objects.get_or_create(user=guest_user)
        
        # Get guest tenant info
        guest_tenant_user = TenantUser.objects.filter(
            user=guest_user,
            is_active=True
        ).select_related('tenant').first()
        
        if not guest_tenant_user:
            return Response(
                {"error": "Guest tenant not configured. Please run: python manage.py create_guest_tenant"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        return Response(
            {
                "token": token.key,
                "user": {
                    "id": guest_user.id,
                    "username": guest_user.username,
                    "email": guest_user.email,
                    "first_name": guest_user.first_name,
                    "last_name": guest_user.last_name,
                    "is_staff": guest_user.is_staff,
                    "is_superuser": guest_user.is_superuser,
                    "is_active": guest_user.is_active,
                },
                "tenant": {
                    "id": str(guest_tenant_user.tenant.id),
                    "name": guest_tenant_user.tenant.name,
                    "slug": guest_tenant_user.tenant.slug,
                    "role": guest_tenant_user.role,
                    "is_guest": True,
                },
                "message": "Welcome to ProjectMeats! You are logged in as a guest user."
            }
        )
        
    except User.DoesNotExist:
        return Response(
            {
                "error": "Guest account not found. Please run: python manage.py create_guest_tenant",
                "setup_command": "python manage.py create_guest_tenant"
            },
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(["POST"])
@permission_classes([AllowAny])
def signup(request):
    """
    DEPRECATED: Open signup is disabled. Use invitation-based signup.
    
    Registration is now invite-only to ensure all users are properly associated
    with a tenant. Users must sign up using an invitation link.
    """
    return Response(
        {
            "error": "Open registration is disabled.",
            "message": "Registration is invite-only. Please contact your tenant administrator for an invitation link.",
            "endpoint": "Use /api/tenants/api/auth/signup-with-invitation/ instead"
        },
        status=status.HTTP_403_FORBIDDEN,
    )


@api_view(["POST"])
def logout(request):
    """
    Logout endpoint that deletes the user's token.
    """
    try:
        token = Token.objects.get(user=request.user)
        token.delete()
        return Response({"message": "Successfully logged out"})
    except Token.DoesNotExist:
        return Response({"message": "Already logged out"})


from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from apps.core.models import (
    UserPreferences,
    EdibleInedibleChoices,
    AccountingPaymentTermsChoices,
    CreditLimitChoices,
    AccountLineOfCreditChoices,
    ProteinTypeChoices,
    FreshOrFrozenChoices,
    PackageTypeChoices,
    NetOrCatchChoices,
    PlantTypeChoices,
    CertificateTypeChoices,
    OriginChoices,
    CountryOriginChoices,
    ShippingOfferedChoices,
    IndustryChoices,
    WeightUnitChoices,
    AppointmentMethodChoices,
    ContactTypeChoices,
    DepartmentChoicesSupplier,
    CarrierDepartmentChoices,
    CartonTypeChoices,
)
from apps.core.serializers import UserPreferencesSerializer


class ChoicesAPIView(APIView):
    """
    API endpoint for getting all static choices (Django TextChoices).
    
    Returns all choice options defined in core.models for use in
    form dropdowns. These are static options that don't require
    database lookups.
    
    GET /api/v1/choices/
    GET /api/v1/choices/?choice_type=protein_type
    """
    permission_classes = [IsAuthenticated]
    
    # Map choice type names to choice classes
    CHOICE_CLASSES = {
        'edible_inedible': EdibleInedibleChoices,
        'accounting_payment_terms': AccountingPaymentTermsChoices,
        'credit_limit': CreditLimitChoices,
        'account_line_of_credit': AccountLineOfCreditChoices,
        'protein_type': ProteinTypeChoices,
        'fresh_or_frozen': FreshOrFrozenChoices,
        'package_type': PackageTypeChoices,
        'net_or_catch': NetOrCatchChoices,
        'plant_type': PlantTypeChoices,
        'certificate_type': CertificateTypeChoices,
        'origin': OriginChoices,
        'country_origin': CountryOriginChoices,
        'shipping_offered': ShippingOfferedChoices,
        'industry': IndustryChoices,
        'weight_unit': WeightUnitChoices,
        'appointment_method': AppointmentMethodChoices,
        'contact_type': ContactTypeChoices,
        'department_supplier': DepartmentChoicesSupplier,
        'carrier_department': CarrierDepartmentChoices,
        'carton_type': CartonTypeChoices,
    }
    
    def get(self, request):
        """Get all choices or a specific choice type."""
        choice_type = request.query_params.get('choice_type')
        
        if choice_type:
            # Return a specific choice type
            if choice_type not in self.CHOICE_CLASSES:
                return Response(
                    {'error': f'Unknown choice type: {choice_type}'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            choice_class = self.CHOICE_CLASSES[choice_type]
            options = [
                {'value': c.value, 'label': c.label}
                for c in choice_class
            ]
            
            return Response({
                'choice_type': choice_type,
                'options': options,
                'count': len(options),
            })
        
        # Return all choices
        all_choices = {}
        for choice_name, choice_class in self.CHOICE_CLASSES.items():
            all_choices[choice_name] = [
                {'value': c.value, 'label': c.label}
                for c in choice_class
            ]
        
        return Response({
            'choices': all_choices,
            'choice_types': list(self.CHOICE_CLASSES.keys()),
        })


class UserPreferencesViewSet(viewsets.ModelViewSet):
    """
    ViewSet for UserPreferences.
    
    Provides CRUD operations for user preferences.
    Users can only access/modify their own preferences.
    """
    
    serializer_class = UserPreferencesSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Return preferences for the current user only."""
        return UserPreferences.objects.filter(user=self.request.user)
    
    def perform_create(self, serializer):
        """Create preferences for the current user."""
        serializer.save(user=self.request.user)
    
    @action(detail=False, methods=['get', 'put', 'patch'])
    def me(self, request):
        """
        Get or update preferences for the current user.
        
        GET: Returns current user's preferences (creates if not exists)
        PUT/PATCH: Updates current user's preferences
        """
        # Get or create preferences for current user
        preferences, created = UserPreferences.objects.get_or_create(
            user=request.user
        )
        
        if request.method in ['PUT', 'PATCH']:
            serializer = self.get_serializer(
                preferences,
                data=request.data,
                partial=(request.method == 'PATCH')
            )
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)
        
        # GET request
        serializer = self.get_serializer(preferences)
        return Response(serializer.data)
