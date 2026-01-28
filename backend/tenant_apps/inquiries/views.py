"""ViewSets for Inquiries app."""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone

from .models import Inquiry, InquiryProduct
from .serializers import (
    InquiryListSerializer,
    InquiryDetailSerializer,
    InquiryCreateSerializer,
    InquiryProductSerializer,
    AddProductsSerializer,
)


class InquiryViewSet(viewsets.ModelViewSet):
    """ViewSet for Inquiry CRUD operations."""
    
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Filter by tenant."""
        return Inquiry.objects.filter(
            tenant=self.request.tenant
        ).select_related(
            'supplier', 'customer', 'contact', 'source_call', 'created_by'
        ).prefetch_related('products')
    
    def get_serializer_class(self):
        """Return appropriate serializer based on action."""
        if self.action == 'list':
            return InquiryListSerializer
        elif self.action == 'create':
            return InquiryCreateSerializer
        return InquiryDetailSerializer
    
    def perform_create(self, serializer):
        """Set tenant and created_by on create."""
        serializer.save(
            tenant=self.request.tenant,
            created_by=self.request.user
        )
    
    @action(detail=True, methods=['post'])
    def add_products(self, request, pk=None):
        """Add products to an existing inquiry."""
        inquiry = self.get_object()
        serializer = AddProductsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        created_products = []
        for product_data in serializer.validated_data['products']:
            product = InquiryProduct.objects.create(
                inquiry=inquiry,
                **product_data
            )
            created_products.append(product)
        
        return Response(
            InquiryProductSerializer(created_products, many=True).data,
            status=status.HTTP_201_CREATED
        )
    
    @action(detail=True, methods=['post'])
    def create_fulfillment(self, request, pk=None):
        """Create a fulfillment from this inquiry."""
        from tenant_apps.fulfillments.models import Fulfillment, FulfillmentProduct
        from tenant_apps.fulfillments.serializers import FulfillmentDetailSerializer
        
        inquiry = self.get_object()
        
        # Get optional data from request
        supplier_id = request.data.get('supplier')
        carrier_id = request.data.get('carrier')
        product_quantities = request.data.get('products', [])
        
        # Create fulfillment
        fulfillment = Fulfillment.objects.create(
            tenant=inquiry.tenant,
            inquiry=inquiry,
            supplier_id=supplier_id,
            customer=inquiry.customer,
            created_by=request.user
        )
        
        if carrier_id:
            fulfillment.carrier_id = carrier_id
            fulfillment.save()
        
        # Create fulfillment products
        if product_quantities:
            # Use provided quantities
            for pq in product_quantities:
                FulfillmentProduct.objects.create(
                    fulfillment=fulfillment,
                    inquiry_product_id=pq['inquiry_product_id'],
                    quantity_fulfilled=pq.get('quantity_fulfilled', 0),
                    unit_price=pq.get('unit_price')
                )
        else:
            # Default: include all inquiry products with full quantities
            for ip in inquiry.products.all():
                FulfillmentProduct.objects.create(
                    fulfillment=fulfillment,
                    inquiry_product=ip,
                    quantity_fulfilled=ip.quantity,
                    unit_price=ip.actual_price_per_unit
                )
        
        return Response(
            FulfillmentDetailSerializer(fulfillment).data,
            status=status.HTTP_201_CREATED
        )
    
    @action(detail=False, methods=['get'], url_path='from-call/(?P<call_id>[^/.]+)')
    def from_call(self, request, call_id=None):
        """Pre-populate inquiry data from a scheduled call."""
        from tenant_apps.cockpit.models import ScheduledCall
        
        try:
            call = ScheduledCall.objects.get(
                id=call_id,
                tenant=request.tenant
            )
        except ScheduledCall.DoesNotExist:
            return Response(
                {'error': 'Call not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Build pre-populated data from call
        data = {
            'source_type': 'scheduled_call',
            'source_call': str(call.id),
            'entity_type': call.entity_type,
        }
        
        # Set entity based on type
        if call.entity_type == 'supplier' and call.entity_id:
            data['supplier'] = call.entity_id
            from tenant_apps.suppliers.models import Supplier
            try:
                supplier = Supplier.objects.get(id=call.entity_id, tenant=request.tenant)
                data['contact_company'] = supplier.name
                data['contact_name'] = supplier.contact_person or ''
                data['contact_email'] = supplier.email or ''
                data['contact_phone'] = supplier.phone or ''
            except Supplier.DoesNotExist:
                pass
        elif call.entity_type == 'customer' and call.entity_id:
            data['customer'] = call.entity_id
            from tenant_apps.customers.models import Customer
            try:
                customer = Customer.objects.get(id=call.entity_id, tenant=request.tenant)
                data['contact_company'] = customer.name
                data['contact_name'] = customer.contact_person or ''
                data['contact_email'] = customer.email or ''
                data['contact_phone'] = customer.phone or ''
            except Customer.DoesNotExist:
                pass
        
        # Add call notes to inquiry notes
        if call.notes:
            data['notes'] = f"From call: {call.notes}"
        
        return Response(data)
    
    @action(detail=True, methods=['post'])
    def update_status(self, request, pk=None):
        """Update inquiry status with timestamp tracking."""
        inquiry = self.get_object()
        new_status = request.data.get('status')
        
        if not new_status:
            return Response(
                {'error': 'status is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        now = timezone.now()
        inquiry.status = new_status
        
        # Update related timestamps
        if new_status == 'quoted':
            inquiry.quoted_date = now
        elif new_status in ('accepted', 'rejected'):
            inquiry.decision_date = now
            if new_status == 'rejected':
                inquiry.win_loss_reason = request.data.get('reason', '')
        
        inquiry.save()
        
        return Response(InquiryDetailSerializer(inquiry).data)


class InquiryProductViewSet(viewsets.ModelViewSet):
    """ViewSet for InquiryProduct CRUD operations."""
    
    permission_classes = [IsAuthenticated]
    serializer_class = InquiryProductSerializer
    
    def get_queryset(self):
        """Filter by tenant via inquiry."""
        return InquiryProduct.objects.filter(
            inquiry__tenant=self.request.tenant
        ).select_related('product', 'inquiry')
