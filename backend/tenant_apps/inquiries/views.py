"""ViewSets for Inquiries app."""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.db.models import F

from .models import Inquiry, InquiryProduct, InquiryTemplate, InquiryTemplateProduct
from .serializers import (
    InquiryListSerializer,
    InquiryDetailSerializer,
    InquiryCreateSerializer,
    InquiryProductSerializer,
    AddProductsSerializer,
    InquiryTemplateListSerializer,
    InquiryTemplateDetailSerializer,
    InquiryTemplateCreateSerializer,
    CloneInquirySerializer,
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
    
    @action(detail=True, methods=['post'])
    def clone(self, request, pk=None):
        """Clone an existing inquiry, optionally with products and pricing."""
        inquiry = self.get_object()
        serializer = CloneInquirySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        include_products = serializer.validated_data.get('include_products', True)
        include_pricing = serializer.validated_data.get('include_pricing', False)
        new_entity_id = serializer.validated_data.get('new_entity_id')
        new_contact_id = serializer.validated_data.get('new_contact_id')
        
        # Clone inquiry (without products first)
        new_inquiry = Inquiry.objects.create(
            tenant=inquiry.tenant,
            status='draft',
            source_type=inquiry.source_type,
            entity_type=inquiry.entity_type,
            supplier_id=new_entity_id if new_entity_id and inquiry.entity_type == 'supplier' else inquiry.supplier_id,
            customer_id=new_entity_id if new_entity_id and inquiry.entity_type == 'customer' else inquiry.customer_id,
            contact_id=new_contact_id or inquiry.contact_id,
            contact_name=inquiry.contact_name,
            contact_email=inquiry.contact_email,
            contact_phone=inquiry.contact_phone,
            contact_company=inquiry.contact_company,
            contact_position=inquiry.contact_position,
            notes=f"Cloned from {inquiry.inquiry_number}\n{inquiry.notes}",
            created_by=request.user
        )
        
        # Clone products if requested
        if include_products:
            for ip in inquiry.products.all():
                product_data = {
                    'inquiry': new_inquiry,
                    'product': ip.product,
                    'quantity': ip.quantity,
                    'desired_uom': ip.desired_uom,
                    'desired_uom_value': ip.desired_uom_value,
                    'notes': ip.notes,
                }
                
                # Include pricing if requested
                if include_pricing:
                    product_data.update({
                        'desired_total': ip.desired_total,
                        'desired_price_per_unit': ip.desired_price_per_unit,
                    })
                
                InquiryProduct.objects.create(**product_data)
        
        return Response(
            InquiryDetailSerializer(new_inquiry).data,
            status=status.HTTP_201_CREATED
        )
    
    @action(detail=True, methods=['get'], url_path='download-quote')
    def download_quote(self, request, pk=None):
        """Generate and download a PDF quote for the inquiry."""
        from django.http import HttpResponse
        from .services.pdf_generator import InquiryPDFGenerator
        
        inquiry = self.get_object()
        
        # Generate PDF
        generator = InquiryPDFGenerator(inquiry)
        pdf_buffer = generator.generate()
        
        # Create response
        response = HttpResponse(
            pdf_buffer.read(),
            content_type='application/pdf'
        )
        response['Content-Disposition'] = f'attachment; filename="{generator.get_filename()}"'
        
        return response
    
    @action(detail=False, methods=['post'], url_path='from-template/(?P<template_id>[^/.]+)')
    def from_template(self, request, template_id=None):
        """Create a new inquiry from a template."""
        try:
            template = InquiryTemplate.objects.get(
                id=template_id,
                tenant=request.tenant,
                is_active=True
            )
        except InquiryTemplate.DoesNotExist:
            return Response(
                {'error': 'Template not found or inactive'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Get entity and contact from request
        entity_id = request.data.get('entity_id')
        contact_id = request.data.get('contact_id')
        
        # Build inquiry data
        inquiry_data = {
            'tenant': request.tenant,
            'status': 'draft',
            'entity_type': template.entity_type,
            'notes': template.default_notes,
            'created_by': request.user,
        }
        
        # Set valid_until from template
        if template.default_valid_days:
            inquiry_data['valid_until'] = (
                timezone.now().date() + timezone.timedelta(days=template.default_valid_days)
            )
        
        # Set entity based on type
        if template.entity_type == 'supplier' and entity_id:
            inquiry_data['supplier_id'] = entity_id
        elif template.entity_type == 'customer' and entity_id:
            inquiry_data['customer_id'] = entity_id
        
        if contact_id:
            inquiry_data['contact_id'] = contact_id
        
        # Create inquiry
        inquiry = Inquiry.objects.create(**inquiry_data)
        
        # Create products from template
        for tp in template.products.all():
            InquiryProduct.objects.create(
                inquiry=inquiry,
                product=tp.product,
                quantity=tp.default_quantity,
                desired_uom=tp.default_uom,
                desired_price_per_unit=tp.default_price_per_unit,
                notes=tp.notes
            )
        
        # Increment template use count
        InquiryTemplate.objects.filter(id=template_id).update(
            use_count=F('use_count') + 1
        )
        
        return Response(
            InquiryDetailSerializer(inquiry).data,
            status=status.HTTP_201_CREATED
        )


class InquiryProductViewSet(viewsets.ModelViewSet):
    """ViewSet for InquiryProduct CRUD operations."""
    
    permission_classes = [IsAuthenticated]
    serializer_class = InquiryProductSerializer
    
    def get_queryset(self):
        """Filter by tenant via inquiry."""
        return InquiryProduct.objects.filter(
            inquiry__tenant=self.request.tenant
        ).select_related('product', 'inquiry')


class InquiryTemplateViewSet(viewsets.ModelViewSet):
    """ViewSet for InquiryTemplate CRUD operations."""
    
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Filter by tenant."""
        queryset = InquiryTemplate.objects.filter(
            tenant=self.request.tenant
        ).prefetch_related('products')
        
        # Filter by entity_type if provided
        entity_type = self.request.query_params.get('entity_type')
        if entity_type:
            queryset = queryset.filter(entity_type=entity_type)
        
        # Filter by is_active if provided
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')
        
        return queryset
    
    def get_serializer_class(self):
        """Return appropriate serializer based on action."""
        if self.action == 'list':
            return InquiryTemplateListSerializer
        elif self.action in ('create', 'update', 'partial_update'):
            return InquiryTemplateCreateSerializer
        return InquiryTemplateDetailSerializer
    
    def perform_create(self, serializer):
        """Set tenant and created_by on create."""
        serializer.save(
            tenant=self.request.tenant,
            created_by=self.request.user
        )
    
    @action(detail=True, methods=['post'])
    def add_products(self, request, pk=None):
        """Add products to an existing template."""
        template = self.get_object()
        products_data = request.data.get('products', [])
        
        created_products = []
        for product_data in products_data:
            product = InquiryTemplateProduct.objects.create(
                template=template,
                product_id=product_data.get('product'),
                default_quantity=product_data.get('default_quantity', 0),
                default_uom=product_data.get('default_uom', 'LBS'),
                default_price_per_unit=product_data.get('default_price_per_unit'),
                notes=product_data.get('notes', ''),
                sort_order=product_data.get('sort_order', 0)
            )
            created_products.append(product)
        
        return Response(
            InquiryTemplateDetailSerializer(template).data,
            status=status.HTTP_201_CREATED
        )
