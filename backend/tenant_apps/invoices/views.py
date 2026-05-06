"""
Invoices and Claims views for ProjectMeats.

Provides REST API endpoints for invoice and claim management with strict multi-tenant isolation.
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from tenant_apps.invoices.models import Invoice, Claim, PaymentTransaction
from tenant_apps.invoices.serializers import InvoiceSerializer, ClaimSerializer, PaymentTransactionSerializer
from apps.core.viewsets_documents import OperationalDocumentActionsMixin


class InvoiceViewSet(OperationalDocumentActionsMixin, viewsets.ModelViewSet):
    """ViewSet for managing invoices with strict tenant isolation."""
    
    queryset = Invoice.objects.all()
    serializer_class = InvoiceSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Filter invoices by tenant.

        Soft deletes:
        - default: hide deleted
        - admin: allow include_deleted=1
        """
        if not hasattr(self.request, 'tenant') or not self.request.tenant:
            return Invoice.objects.none()

        include_deleted = str(self.request.query_params.get('include_deleted') or '').strip().lower() in {
            '1',
            'true',
            't',
            'yes',
            'y',
        }
        is_admin = bool(getattr(self.request.user, 'is_superuser', False) or getattr(self.request.user, 'is_staff', False))

        queryset = Invoice.all_objects.filter(tenant=self.request.tenant) if (include_deleted and is_admin) else Invoice.objects.filter(tenant=self.request.tenant)
        
        # Filter by status if provided
        status = self.request.query_params.get('status')
        if status:
            queryset = queryset.filter(status=status)

        # Filter by subscription invoices if provided
        is_subscription = self.request.query_params.get('is_subscription')
        if is_subscription is not None:
            raw = str(is_subscription).strip().lower()
            if raw in {'1', 'true', 't', 'yes', 'y'}:
                queryset = queryset.filter(is_subscription=True)
            elif raw in {'0', 'false', 'f', 'no', 'n'}:
                queryset = queryset.filter(is_subscription=False)
        
        return queryset.select_related('customer', 'sales_order', 'product')
    
    def perform_create(self, serializer):
        """Auto-assign tenant on invoice creation."""
        tenant = getattr(self.request, 'tenant', None)
        if not tenant:
            raise DRFValidationError('Tenant context is required to create an invoice.')

        serializer.save(tenant=tenant)

    def perform_destroy(self, instance):
        instance.soft_delete()

    @action(detail=True, methods=['post'], url_path='restore')
    def restore(self, request, pk=None):
        if not (getattr(request.user, 'is_superuser', False) or getattr(request.user, 'is_staff', False)):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

        tenant = getattr(request, 'tenant', None)
        if not tenant:
            return Response({'error': 'Tenant not found'}, status=status.HTTP_400_BAD_REQUEST)

        inv = Invoice.all_objects.filter(tenant=tenant, pk=pk).first()
        if not inv:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

        inv.restore()
        return Response(InvoiceSerializer(inv).data)


class ClaimViewSet(viewsets.ModelViewSet):
    """ViewSet for managing claims with strict tenant isolation."""
    
    queryset = Claim.objects.all()
    serializer_class = ClaimSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Filter claims by tenant and optional filters."""
        if not hasattr(self.request, 'tenant') or not self.request.tenant:
            return Claim.objects.none()
        
        queryset = Claim.objects.filter(tenant=self.request.tenant)
        
        # Filter by claim type (payable/receivable)
        claim_type = self.request.query_params.get('type')
        if claim_type:
            queryset = queryset.filter(claim_type=claim_type)
        
        # Filter by status
        status = self.request.query_params.get('status')
        if status:
            queryset = queryset.filter(status=status)
        
        return queryset.select_related('supplier', 'customer', 'purchase_order', 'sales_order', 'invoice')
    
    def perform_create(self, serializer):
        """Auto-assign tenant and created_by on claim creation."""
        tenant = getattr(self.request, 'tenant', None)
        if not tenant:
            raise DRFValidationError('Tenant context is required to create a claim.')

        serializer.save(
            tenant=tenant,
            created_by=self.request.user
        )



class PaymentTransactionViewSet(viewsets.ModelViewSet):
    """
    ViewSet for PaymentTransaction model.
    
    Handles creating payment transactions and automatically updating
    the related order/invoice payment status.
    """
    queryset = PaymentTransaction.objects.all()
    serializer_class = PaymentTransactionSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Filter payments by tenant."""
        tenant = getattr(self.request, 'tenant', None)
        if not tenant:
            return PaymentTransaction.objects.none()

        queryset = super().get_queryset().filter(tenant=tenant)
        for field_name in ('invoice', 'sales_order', 'purchase_order'):
            raw_value = self.request.query_params.get(field_name)
            if raw_value:
                queryset = queryset.filter(**{f'{field_name}_id': raw_value})
        return queryset.select_related('source_settlement_event')
    
    def perform_create(self, serializer):
        """Set tenant and created_by when creating payment."""
        tenant = getattr(self.request, 'tenant', None)
        if not tenant:
            raise DRFValidationError('Tenant context is required to create a payment transaction.')

        serializer.save(
            tenant=tenant,
            created_by=self.request.user
        )
