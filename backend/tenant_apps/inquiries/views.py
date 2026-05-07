"""ViewSets for Inquiries app."""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError
from django.utils import timezone
from django.db.models import F, Count, Sum, Q, Avg
from django.db.models.functions import TruncWeek
from datetime import timedelta

from .models import (
    Inquiry,
    InquiryProduct,
    InquiryRouteDecisionChoices,
    InquiryTemplate,
    InquiryTemplateProduct,
)
from .serializers import (
    CreateSupplierPurchaseOrderDraftSerializer,
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
from tenant_apps.purchase_orders.serializers import PurchaseOrderSerializer
from .services import create_supplier_quote_purchase_order_draft
from .services.supplier_quote_po_draft import SupplierQuotePODraftError


class InquiryViewSet(viewsets.ModelViewSet):
    """ViewSet for Inquiry CRUD operations."""
    
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Filter by tenant and apply common list filters.

        The UI expects query params like:
        - search: free-text search
        - status: filter by Inquiry.status
        - entity_type: customer|supplier
        - customer / customer_id
        - supplier / supplier_id
        - ordering: inquiry_date|created_on (prefix with - for desc)
        """
        tenant = getattr(self.request, 'tenant', None)
        if not tenant:
            return Inquiry.objects.none()

        qs = (
            Inquiry.objects.filter(tenant=tenant)
            .select_related(
                'supplier',
                'customer',
                'contact',
                'source_call',
                'source_email',
                'requested_master_product',
                'supplier_purchase_order',
                'sales_order',
                'carrier_purchase_order',
                'created_by',
            )
            .prefetch_related('products')
        )

        params = getattr(self.request, 'query_params', {})

        status_value = params.get('status')
        if status_value:
            qs = qs.filter(status=status_value)

        entity_type = params.get('entity_type')
        if entity_type in ('customer', 'supplier'):
            qs = qs.filter(entity_type=entity_type)

        route_decision = params.get('route_decision')
        if route_decision in InquiryRouteDecisionChoices.values:
            qs = qs.filter(route_decision=route_decision)

        customer_id = params.get('customer') or params.get('customer_id')
        if customer_id:
            qs = qs.filter(customer_id=customer_id)

        supplier_id = params.get('supplier') or params.get('supplier_id')
        if supplier_id:
            qs = qs.filter(supplier_id=supplier_id)

        search = params.get('search')
        if search:
            qs = qs.filter(
                Q(inquiry_number__icontains=search)
                | Q(contact_name__icontains=search)
                | Q(customer__name__icontains=search)
                | Q(supplier__name__icontains=search)
            )

        ordering = params.get('ordering')
        allowed = {
            'inquiry_date',
            '-inquiry_date',
            'created_on',
            '-created_on',
        }
        if ordering in allowed:
            qs = qs.order_by(ordering)

        return qs
    
    def get_serializer_class(self):
        """Return appropriate serializer based on action."""
        if self.action == 'list':
            return InquiryListSerializer
        elif self.action == 'create':
            return InquiryCreateSerializer
        return InquiryDetailSerializer
    
    def perform_create(self, serializer):
        """Set tenant and created_by on create."""
        tenant = getattr(self.request, 'tenant', None)
        if not tenant:
            raise ValidationError({'error': 'Tenant context is required'})

        serializer.save(tenant=tenant, created_by=self.request.user)
    
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
            shipping_type=getattr(inquiry, 'shipping_type', None) or 'tenant',
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
        
        # Add call description to inquiry notes
        if call.description:
            data['notes'] = f"From call: {call.description}"
        
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

    @action(detail=True, methods=['post'], url_path='create-supplier-po-draft')
    def create_supplier_po_draft(self, request, pk=None):
        """Create or return the draft supplier PO for a qualifying normalized quote reply."""
        inquiry = self.get_object()
        serializer = CreateSupplierPurchaseOrderDraftSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            result = create_supplier_quote_purchase_order_draft(
                tenant=request.tenant,
                inquiry=inquiry,
                rfq_id=serializer.validated_data['rfq_id'],
            )
        except SupplierQuotePODraftError as exc:
            raise ValidationError({'rfq_id': str(exc)}) from exc

        response_status = status.HTTP_201_CREATED if result.created else status.HTTP_200_OK
        return Response(
            {
                'created': result.created,
                'purchase_order': PurchaseOrderSerializer(
                    result.purchase_order,
                    context={'request': request},
                ).data,
            },
            status=response_status,
        )

    @action(detail=True, methods=['post'], url_path='create-sales-order-draft')
    def create_sales_order_draft(self, request, pk=None):
        """Create or return the draft sales order for a FULFILL-routed inquiry.

        POST /api/v1/inquiries/{id}/create-sales-order-draft/
        """
        from tenant_apps.sales_orders.services.draft_sales_order import (
            create_draft_from_fulfill,
            DraftSalesOrderError,
        )
        from tenant_apps.sales_orders.serializers import SalesOrderSerializer as SOSerializer

        inquiry = self.get_object()

        try:
            result = create_draft_from_fulfill(
                tenant=request.tenant,
                inquiry=inquiry,
            )
        except DraftSalesOrderError as exc:
            raise ValidationError({'detail': str(exc)}) from exc

        response_status = status.HTTP_201_CREATED if result.created else status.HTTP_200_OK
        return Response(
            {
                'created': result.created,
                'source_type': result.source_type,
                'sales_order': SOSerializer(
                    result.sales_order,
                    context={'request': request},
                ).data,
            },
            status=response_status,
        )

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
            route_decision=inquiry.route_decision,
            supplier_id=new_entity_id if new_entity_id and inquiry.entity_type == 'supplier' else inquiry.supplier_id,
            customer_id=new_entity_id if new_entity_id and inquiry.entity_type == 'customer' else inquiry.customer_id,
            contact_id=new_contact_id or inquiry.contact_id,
            requested_master_product=inquiry.requested_master_product,
            requested_protein=inquiry.requested_protein,
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
    
    @action(detail=False, methods=['get'])
    def analytics(self, request):
        """
        Get win/loss analytics and inquiry statistics.
        
        Query params:
        - period: 'week', 'month', 'quarter', 'year' (default: 'month')
        - entity_type: 'supplier' or 'customer' (optional filter)
        """
        period = request.query_params.get('period', 'month')
        entity_type = request.query_params.get('entity_type')
        
        # Calculate date range based on period
        now = timezone.now()
        if period == 'week':
            start_date = now - timedelta(days=7)
        elif period == 'month':
            start_date = now - timedelta(days=30)
        elif period == 'quarter':
            start_date = now - timedelta(days=90)
        elif period == 'year':
            start_date = now - timedelta(days=365)
        else:
            start_date = now - timedelta(days=30)
        
        # Base queryset
        base_qs = Inquiry.objects.filter(
            tenant=request.tenant,
            inquiry_date__gte=start_date
        )
        
        if entity_type:
            base_qs = base_qs.filter(entity_type=entity_type)
        
        # Status distribution
        status_counts = base_qs.values('status').annotate(
            count=Count('id')
        ).order_by('status')
        
        # Win/Loss metrics
        total_closed = base_qs.filter(status__in=['accepted', 'rejected']).count()
        wins = base_qs.filter(status='accepted').count()
        losses = base_qs.filter(status='rejected').count()
        win_rate = (wins / total_closed * 100) if total_closed > 0 else 0
        
        # Value metrics
        value_metrics = base_qs.filter(status='accepted').aggregate(
            total_won_value=Sum('products__actual_total'),
            avg_deal_size=Avg('products__actual_total'),
        )
        
        lost_value = base_qs.filter(status='rejected').aggregate(
            total_lost_value=Sum('products__desired_total')
        )['total_lost_value'] or 0
        
        # Time to close (average days from creation to decision)
        closed_inquiries = base_qs.filter(
            status__in=['accepted', 'rejected'],
            decision_date__isnull=False
        )
        
        avg_days_to_close = None
        if closed_inquiries.exists():
            total_days = sum(
                (i.decision_date - i.inquiry_date).days
                for i in closed_inquiries
                if i.decision_date and i.inquiry_date
            )
            avg_days_to_close = total_days / closed_inquiries.count() if closed_inquiries.count() > 0 else None
        
        # Trend data (grouped by week)
        trend_data = base_qs.annotate(
            week=TruncWeek('inquiry_date')
        ).values('week').annotate(
            total=Count('id'),
            accepted=Count('id', filter=Q(status='accepted')),
            rejected=Count('id', filter=Q(status='rejected')),
        ).order_by('week')
        
        # Top win/loss reasons
        win_reasons = base_qs.filter(
            status='accepted',
            win_loss_reason__isnull=False
        ).exclude(win_loss_reason='').values_list('win_loss_reason', flat=True)[:10]
        
        loss_reasons = base_qs.filter(
            status='rejected',
            win_loss_reason__isnull=False
        ).exclude(win_loss_reason='').values_list('win_loss_reason', flat=True)[:10]
        
        # Competitor mentions
        competitor_data = base_qs.exclude(
            competitor_names=''
        ).values_list('competitor_names', flat=True)
        
        # Parse competitor names (simple split by comma/newline)
        competitor_counts = {}
        for comp_str in competitor_data:
            if comp_str:
                for comp in comp_str.replace('\n', ',').split(','):
                    comp = comp.strip()
                    if comp:
                        competitor_counts[comp] = competitor_counts.get(comp, 0) + 1
        
        # Sort by count and take top 10
        top_competitors = sorted(
            competitor_counts.items(),
            key=lambda x: x[1],
            reverse=True
        )[:10]
        
        # Source type breakdown
        source_breakdown = base_qs.values('source_type').annotate(
            count=Count('id'),
            won=Count('id', filter=Q(status='accepted')),
        ).order_by('-count')
        
        return Response({
            'period': period,
            'date_range': {
                'start': start_date.isoformat(),
                'end': now.isoformat(),
            },
            'summary': {
                'total_inquiries': base_qs.count(),
                'pending': base_qs.filter(status__in=['draft', 'pending', 'quoted']).count(),
                'won': wins,
                'lost': losses,
                'win_rate': round(win_rate, 1),
                'total_won_value': float(value_metrics['total_won_value'] or 0),
                'total_lost_value': float(lost_value),
                'avg_deal_size': float(value_metrics['avg_deal_size'] or 0),
                'avg_days_to_close': round(avg_days_to_close, 1) if avg_days_to_close else None,
            },
            'status_distribution': list(status_counts),
            'trend': list(trend_data),
            'source_breakdown': list(source_breakdown),
            'top_competitors': [
                {'name': name, 'count': count}
                for name, count in top_competitors
            ],
            'recent_win_reasons': list(win_reasons),
            'recent_loss_reasons': list(loss_reasons),
        })


    # ------------------------------------------------------------------
    # Orchestrator endpoints (CTE-04.5)
    # ------------------------------------------------------------------

    @action(detail=True, methods=['get'], url_path='orchestrator-state')
    def orchestrator_state(self, request, pk=None):
        """Get the current happy-path orchestrator state for this inquiry.

        GET /api/v1/inquiries/{id}/orchestrator-state/
        """
        from .services.happy_path_orchestrator import (
            get_lineage_chain,
            get_orchestrator_state,
        )

        inquiry = self.get_object()
        current_step = get_orchestrator_state(tenant=request.tenant, inquiry=inquiry)
        lineage = get_lineage_chain(tenant=request.tenant, inquiry=inquiry)

        return Response({
            'current_step': current_step.value,
            'lineage': lineage,
        })

    @action(detail=True, methods=['post'], url_path='orchestrator-advance')
    def orchestrator_advance(self, request, pk=None):
        """Advance the happy-path orchestrator for this inquiry.

        POST /api/v1/inquiries/{id}/orchestrator-advance/
        Body (optional): {"advance_through": "draft_sales_order"}
        """
        from .services.happy_path_orchestrator import (
            OrchestratorStep,
            advance_orchestrator,
        )

        inquiry = self.get_object()
        advance_through = request.data.get('advance_through')

        target_step = None
        if advance_through:
            try:
                target_step = OrchestratorStep(advance_through)
            except ValueError:
                raise ValidationError({
                    'advance_through': f"Invalid step: '{advance_through}'. "
                    f"Valid: {[s.value for s in OrchestratorStep]}"
                })

        result = advance_orchestrator(
            tenant=request.tenant,
            inquiry=inquiry,
            advance_through=target_step,
            user=request.user,
        )

        return Response({
            'inquiry_id': result.inquiry_id,
            'route': result.route,
            'current_step': result.current_step.value,
            'completed': result.completed,
            'blocked': result.blocked,
            'blocked_reason': result.blocked_reason,
            'steps_executed': [
                {
                    'step': s.step.value,
                    'success': s.success,
                    'message': s.message,
                    'entity_id': s.entity_id,
                    'entity_type': s.entity_type,
                }
                for s in result.steps_executed
            ],
        })

    @action(detail=True, methods=['get'], url_path='lineage')
    def lineage(self, request, pk=None):
        """Get the full lineage chain for this inquiry (for Process Cockpit React Flow).

        GET /api/v1/inquiries/{id}/lineage/
        """
        from .services.happy_path_orchestrator import get_lineage_chain

        inquiry = self.get_object()
        chain = get_lineage_chain(tenant=request.tenant, inquiry=inquiry)
        return Response(chain)


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
