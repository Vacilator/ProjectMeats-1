"""
Entity Graph ViewSet
Provides unified API for entity relationships across all business models.

This ViewSet enables the Cockpit SmartSearch to dynamically discover and navigate
entity relationships without hardcoded URL logic.

Created: 2026-03-03 - Cockpit Integration Task 1
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied
from django.apps import apps
from django.core.exceptions import ObjectDoesNotExist

from django.conf import settings


class EntityViewSet(viewsets.ViewSet):
    """Unified entity relationship API for the Cockpit.

    Endpoints:
    - GET /api/v1/system/entities/{type}/{id}/relationships/ - Get related entities
    - GET /api/v1/system/entities/{type}/{id}/ - Get single entity details (record profile payload)
    - PATCH /api/v1/system/entities/{type}/{id}/ - Update a single field (inline editing)
    """

    permission_classes = [IsAuthenticated]

    # Map entity types to (app_label, model_name)
    MODEL_MAP = {
        'customer': ('customers', 'Customer'),
        'supplier': ('suppliers', 'Supplier'),
        # Products are system-wide (tenantless) after the Phase 3 deduplication.
        'product': ('system', 'Product'),
        'contact': ('contacts', 'Contact'),
        'purchase_order': ('purchase_orders', 'PurchaseOrder'),
        'sales_order': ('sales_orders', 'SalesOrder'),
        'invoice': ('invoices', 'Invoice'),
        # Additional Cockpit-searchable entities
        'inquiry': ('inquiries', 'Inquiry'),
        'claim': ('invoices', 'Claim'),
        'call': ('cockpit', 'ScheduledCall'),
        'tenant_user': ('tenants', 'TenantUser'),
    }
    
    @action(detail=True, methods=['get'], url_path='relationships')
    def relationships(self, request, type=None, pk=None):
        """
        Get all related entities for a given entity.
        
        Query params:
        - relationship_types: Comma-separated list (e.g., "customers,purchase_orders")
        
        Returns:
        {
          "entity": { "id": 123, "type": "customer", "name": "Acme Corp" },
          "relationships": {
            "purchase_orders": [
              { "id": 456, "type": "purchase_order", "title": "PO-001", "metadata": {...} }
            ],
            "sales_orders": [...],
            "contacts": [...]
          },
          "counts": {
            "purchase_orders": 15,
            "sales_orders": 8,
            "contacts": 3
          }
        }
        """
        tenant = request.tenant
        
        if type not in self.MODEL_MAP:
            return Response(
                {"error": f"Unknown entity type: {type}"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        app_label, model_name = self.MODEL_MAP[type]
        
        try:
            Model = apps.get_model(app_label, model_name)
        except LookupError:
            return Response(
                {"error": f"Model not found: {app_label}.{model_name}"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Get the entity
        try:
            if hasattr(Model, 'tenant'):
                entity = Model.objects.filter(tenant=tenant).get(pk=pk)
            else:
                # Products are shared across tenants
                entity = Model.objects.get(pk=pk)
        except ObjectDoesNotExist:
            return Response(
                {"error": f"{model_name} not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Get relationship types to load
        requested_types = request.query_params.get('relationship_types', '').split(',')
        if not requested_types or requested_types == ['']:
            # Default: Load all common relationships
            requested_types = self._get_default_relationships(type)
        
        # Build relationships
        relationships = {}
        counts = {}
        
        for rel_type in requested_types:
            rel_data = self._get_relationship_data(entity, type, rel_type, tenant)
            if rel_data is None:
                relationships[rel_type] = []
                counts[rel_type] = 0
                continue

            relationships[rel_type] = rel_data.get('items', [])
            counts[rel_type] = rel_data.get('count', 0)
        
        return Response({
            "entity": self._serialize_entity(entity, type),
            "relationships": relationships,
            "counts": counts
        })
    
    def retrieve(self, request, pk=None, type=None):
        """Get single entity details for record-centric Cockpit UI."""
        try:
            entity, entity_type, Model = self._get_entity_or_404(request, type=type, pk=pk)
        except ValueError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except LookupError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_404_NOT_FOUND)
        except ObjectDoesNotExist:
            return Response({'error': 'Entity not found'}, status=status.HTTP_404_NOT_FOUND)

        can_edit = bool(getattr(request.user, 'is_staff', False) or getattr(request.user, 'is_superuser', False))
        return Response(self._serialize_entity_detail(entity, entity_type, can_edit=can_edit))

    @action(detail=True, methods=['get'], url_path='summary')
    def summary(self, request, type=None, pk=None):
        """AI-generated summary of the entity status + next steps."""
        tenant = getattr(request, 'tenant', None)
        if not tenant:
            return Response({'error': 'Tenant not found'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            entity, entity_type, Model = self._get_entity_or_404(request, type=type, pk=pk)
        except ValueError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except LookupError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_404_NOT_FOUND)
        except ObjectDoesNotExist:
            return Response({'error': 'Entity not found'}, status=status.HTTP_404_NOT_FOUND)

        recent_activities = []
        try:
            # Cockpit ActivityLog is the universal tenant-aware notes feed.
            from tenant_apps.cockpit.models import ActivityLog as CockpitActivityLog

            entity_id_int = int(pk)
            qs = (
                CockpitActivityLog.objects.filter(
                    tenant=tenant,
                    entity_type=entity_type,
                    entity_id=entity_id_int,
                )
                .select_related('created_by')
                .order_by('-created_on')
            )
            for row in qs[:5]:
                recent_activities.append(
                    {
                        'created_on': getattr(row, 'created_on', None),
                        'title': row.title,
                        'content': row.content,
                        'created_by': getattr(getattr(row, 'created_by', None), 'username', None),
                    }
                )
        except Exception:
            # Best-effort: summary should still work without activity logs.
            recent_activities = []

        entity_payload = self._serialize_entity_detail(entity, entity_type, can_edit=False)

        openai_api_key = getattr(settings, 'OPENAI_API_KEY', None)
        if not openai_api_key:
            return Response(
                {
                    'summary': (
                        f"Summary unavailable (OpenAI not configured). "
                        f"Entity: {entity_payload.get('title') or entity_payload.get('name') or entity_type}"
                    )
                },
                status=status.HTTP_200_OK,
            )

        try:
            from openai import OpenAI

            client = OpenAI(api_key=openai_api_key)
            prompt_data = {
                'entity': entity_payload,
                'recent_activities': recent_activities,
            }
            completion = client.chat.completions.create(
                model='gpt-4o-mini',
                messages=[
                    {
                        'role': 'user',
                        'content': (
                            'Summarize the current status and next steps for this entity based on this data: '
                            f'{prompt_data}.\n\nReturn exactly 3 sentences.'
                        ),
                    }
                ],
            )
            result_text = ((completion.choices[0].message.content or '') if completion.choices else '').strip()
        except Exception as e:
            return Response({'error': f'Failed to generate summary: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({'summary': result_text}, status=status.HTTP_200_OK)

    def partial_update(self, request, pk=None, type=None):
        """Inline editing endpoint used by Cockpit EntityProfileHeader.

        Payload (minimal): {"field": "name", "value": "Acme"}
        """
        if not (getattr(request.user, 'is_staff', False) or getattr(request.user, 'is_superuser', False)):
            raise PermissionDenied('You do not have permission to edit records')

        try:
            entity, entity_type, Model = self._get_entity_or_404(request, type=type, pk=pk)
        except ValueError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except LookupError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_404_NOT_FOUND)
        except ObjectDoesNotExist:
            return Response({'error': 'Entity not found'}, status=status.HTTP_404_NOT_FOUND)

        field_name = str(request.data.get('field') or '').strip()
        if not field_name:
            return Response({'error': 'Missing field'}, status=status.HTTP_400_BAD_REQUEST)

        # Block known-dangerous or non-editable fields
        blocked = {
            'id', 'pk', 'tenant', 'tenant_id', 'custom_data',
            'created_at', 'updated_at', 'created_on', 'updated_on',
        }
        if field_name in blocked:
            return Response({'error': f'Field not editable: {field_name}'}, status=status.HTTP_400_BAD_REQUEST)

        raw_value = request.data.get('value', None)

        # Special-case: product association lists (not direct model fields)
        if field_name in {'preferred_products', 'active_products'}:
            tenant = getattr(request, 'tenant', None)

            if entity_type == 'customer' and hasattr(entity, 'products') and field_name in {'preferred_products', 'active_products'}:
                if not isinstance(raw_value, list):
                    return Response({'error': 'Value must be a list of product IDs'}, status=status.HTTP_400_BAD_REQUEST)

                Product = apps.get_model('system', 'Product')
                products = Product.objects.filter(id__in=raw_value)
                entity.products.set(products)
                return Response(self._serialize_entity_detail(entity, entity_type, can_edit=True))

            if entity_type == 'supplier':
                if not isinstance(raw_value, list):
                    return Response({'error': 'Value must be a list of product IDs'}, status=status.HTTP_400_BAD_REQUEST)

                Product = apps.get_model('system', 'Product')
                valid_ids = set(Product.objects.filter(id__in=raw_value).values_list('id', flat=True))

                if field_name == 'active_products':
                    from tenant_apps.suppliers.models import SupplierAvailableItem

                    existing = SupplierAvailableItem.objects.filter(tenant=tenant, supplier=entity)
                    existing.exclude(product_id__in=valid_ids).update(is_active=False)
                    existing.filter(product_id__in=valid_ids).update(is_active=True)

                    existing_ids = set(existing.values_list('product_id', flat=True))
                    to_create = valid_ids - existing_ids
                    SupplierAvailableItem.objects.bulk_create(
                        [
                            SupplierAvailableItem(tenant=tenant, supplier=entity, product_id=pid, is_active=True)
                            for pid in to_create
                        ],
                        ignore_conflicts=True,
                    )

                    return Response(self._serialize_entity_detail(entity, entity_type, can_edit=True))

                if field_name == 'preferred_products':
                    from apps.system.models.tenant_product_preference import TenantProductPreference

                    # Clear existing preferred mappings for this supplier
                    TenantProductPreference.objects.filter(
                        tenant=tenant,
                        preferred_supplier=entity,
                    ).update(preferred_supplier=None)

                    # Set preferred supplier for selected products
                    TenantProductPreference.objects.filter(
                        tenant=tenant,
                        product_id__in=valid_ids,
                    ).update(preferred_supplier=entity)

                    return Response(self._serialize_entity_detail(entity, entity_type, can_edit=True))

            return Response({'error': f'Field not editable for {entity_type}: {field_name}'}, status=status.HTTP_400_BAD_REQUEST)

        # Only allow direct model fields (no reverse relations / m2m)
        model_fields = {f.name: f for f in Model._meta.get_fields() if getattr(f, 'concrete', False) and not getattr(f, 'many_to_many', False)}
        if field_name not in model_fields:
            return Response({'error': f'Unknown field: {field_name}'}, status=status.HTTP_400_BAD_REQUEST)

        field = model_fields[field_name]

        try:
            if getattr(field, 'is_relation', False) and getattr(field, 'many_to_one', False):
                # FK: accept id or null
                if raw_value in ('', None):
                    setattr(entity, field.attname, None)
                else:
                    setattr(entity, field.attname, field.target_field.to_python(raw_value))
            else:
                setattr(entity, field.name, field.to_python(raw_value))

            entity.save(update_fields=[field_name])
        except Exception as exc:
            return Response({'error': f'Failed to update {field_name}: {exc}'}, status=status.HTTP_400_BAD_REQUEST)

        return Response(self._serialize_entity_detail(entity, entity_type, can_edit=True))

    def _get_entity_or_404(self, request, *, type, pk):
        tenant = request.tenant

        raw_type = str(type or '').strip()
        if not raw_type:
            raise ValueError('Unknown entity type:')

        # Allow case-insensitive and short-name inputs (e.g., "Inquiry" instead of "inquiry").
        candidate = raw_type.replace('-', '_').strip()
        candidate_lc = candidate.lower()

        resolved_type = None
        if candidate_lc in self.MODEL_MAP:
            resolved_type = candidate_lc
        else:
            from apps.core.utils.naming import to_snake_case

            # CamelCase/PascalCase -> snake_case
            snake = to_snake_case(candidate)
            if snake in self.MODEL_MAP:
                resolved_type = snake
            elif snake.endswith('s') and snake[:-1] in self.MODEL_MAP:
                resolved_type = snake[:-1]
            else:
                # Map model/app short names (e.g., Inquiry, inquiries) to canonical keys.
                for key, (app_label, model_name) in self.MODEL_MAP.items():
                    if candidate_lc == model_name.lower() or candidate_lc == app_label.lower():
                        resolved_type = key
                        break

        if not resolved_type:
            raise ValueError(f'Unknown entity type: {raw_type}')

        app_label, model_name = self.MODEL_MAP[resolved_type]
        try:
            Model = apps.get_model(app_label, model_name)
        except LookupError as exc:
            raise LookupError(f'Model not found: {app_label}.{model_name}') from exc

        if hasattr(Model, 'tenant'):
            entity = Model.objects.filter(tenant=tenant).get(pk=pk)
        else:
            entity = Model.objects.get(pk=pk)

        return entity, resolved_type, Model

    def _entity_type_for_model(self, model):
        """Best-effort mapping from Django model to Cockpit entity type string."""
        if not model:
            return None
        for entity_type, (app_label, model_name) in self.MODEL_MAP.items():
            if model._meta.app_label == app_label and model.__name__ == model_name:
                return entity_type
        return None

    def _serialize_entity_detail(self, entity, entity_type, *, can_edit=False):
        """Serialize an entity for record profile display.

        Returns base identity + a safe 'fields' dict with scalar values and FK references.
        """
        base = self._serialize_entity(entity, entity_type)
        Model = entity.__class__

        blocked = {
            'tenant', 'custom_data',
        }
        fields_payload = {}
        for field in Model._meta.get_fields():
            # Only include forward concrete fields
            if not getattr(field, 'concrete', False) or getattr(field, 'many_to_many', False):
                continue
            if field.name in blocked:
                continue

            if getattr(field, 'is_relation', False) and getattr(field, 'many_to_one', False):
                fk_id = getattr(entity, field.attname, None)
                if fk_id is None:
                    fields_payload[field.name] = None
                    continue

                rel_obj = getattr(entity, field.name, None)
                rel_type = self._entity_type_for_model(getattr(rel_obj, '__class__', None))
                rel_title = None
                if rel_obj is not None:
                    # Reuse minimal serializer to produce a stable title
                    rel_title = self._serialize_entity(rel_obj, rel_type or field.related_model.__name__.lower()).get('title')

                fields_payload[field.name] = {
                    'id': fk_id,
                    'type': rel_type,
                    'title': rel_title,
                }
            else:
                fields_payload[field.name] = getattr(entity, field.name, None)

        base['fields'] = fields_payload
        base['can_edit'] = bool(can_edit)
        return base
    
    def _get_default_relationships(self, entity_type):
        """Return default relationship types for each entity."""
        defaults = {
            # Cockpit UX defaults (continuous browsing): emphasize the primary panels.
            'customer': ['contacts', 'recent_orders', 'invoices', 'inquiries', 'related_products'],
            'supplier': ['contacts', 'recent_orders', 'inquiries', 'related_products'],
            'product': ['purchase_orders', 'sales_orders'],
            # Keep lightweight, reliable relationships for order-like entities.
            'purchase_order': ['supplier', 'product', 'sales_order'],
            'sales_order': ['customer', 'supplier', 'product', 'contact'],
            'contact': ['customer', 'supplier'],
        }
        return defaults.get(entity_type, [])
    
    def _get_relationship_data(self, entity, entity_type, rel_type, tenant):
        """
        Get related entities of a specific type.
        Returns: {"items": [...], "count": N} or None if relationship doesn't exist.
        """
        # Customer relationships
        if entity_type == 'customer':
            if rel_type == 'contacts':
                return self._get_contacts_for_customer(entity, tenant)
            if rel_type in ('sales_orders', 'recent_orders'):
                return self._get_sales_orders_for_customer(entity, tenant)
            if rel_type == 'invoices':
                return self._get_invoices_for_customer(entity, tenant)
            if rel_type in ('related_products', 'products'):
                return self._get_related_products_for_customer(entity, tenant)
            if rel_type == 'inquiries':
                return self._get_inquiries_for_customer(entity, tenant)
            # Legacy key (PurchaseOrder has no customer FK in current schema)
            if rel_type == 'purchase_orders':
                return {"count": 0, "items": []}

        # Supplier relationships
        if entity_type == 'supplier':
            if rel_type == 'contacts':
                return self._get_contacts_for_supplier(entity, tenant)
            if rel_type == 'purchase_orders':
                return self._get_purchase_orders_for_supplier(entity, tenant)
            if rel_type == 'sales_orders':
                return self._get_sales_orders_for_supplier(entity, tenant)
            if rel_type == 'recent_orders':
                return self._get_recent_orders_for_supplier(entity, tenant)
            if rel_type == 'inquiries':
                return self._get_inquiries_for_supplier(entity, tenant)
            if rel_type in ('related_products', 'products'):
                return self._get_related_products_for_supplier(entity, tenant)

        # Product relationships
        if entity_type == 'product':
            if rel_type == 'purchase_orders':
                return self._get_purchase_orders_for_product(entity, tenant)
            if rel_type == 'sales_orders':
                return self._get_sales_orders_for_product(entity, tenant)

        # Purchase Order relationships
        if entity_type == 'purchase_order':
            if rel_type == 'supplier':
                return self._get_supplier_for_po(entity, tenant)
            if rel_type == 'product':
                return self._get_product_for_po(entity)
            if rel_type == 'sales_order':
                return self._get_sales_order_for_po(entity, tenant)

        # Sales Order relationships
        if entity_type == 'sales_order':
            if rel_type == 'customer':
                return self._get_customer_for_so(entity, tenant)
            if rel_type == 'supplier':
                return self._get_supplier_for_so(entity, tenant)
            if rel_type == 'product':
                return self._get_product_for_so(entity)
            if rel_type == 'contact':
                return self._get_contact_for_so(entity, tenant)
            if rel_type == 'invoice':
                return self._get_invoice_for_so(entity, tenant)

        # Contact relationships
        if entity_type == 'contact':
            if rel_type == 'customer':
                return self._get_customer_for_contact(entity, tenant)
            if rel_type == 'supplier':
                return self._get_supplier_for_contact(entity, tenant)

        return None
    
    def _order_queryset_recent_first(self, qs):
        """Order a queryset by the most reliable "recent" timestamp available."""
        model = getattr(qs, 'model', None)
        if not model:
            return qs

        candidates = [
            # Tenant-app models typically use created_on/modified_on
            'modified_on',
            'created_on',
            # Inquiries use inquiry_date as their primary business timestamp
            'inquiry_date',
            # System models typically use created_at/updated_at
            'updated_at',
            'created_at',
            # Legacy timestamp field names
            'date_time_stamp',
            'date_time_stamp_created',
        ]
        field_names = {f.name for f in model._meta.get_fields() if hasattr(f, 'name')}
        for name in candidates:
            if name in field_names:
                return qs.order_by(f'-{name}')
        return qs

    def _get_purchase_orders_for_customer(self, customer, tenant):
        """Legacy relationship (no longer modeled): PurchaseOrder has no customer FK."""
        return {"count": 0, "items": []}

    def _get_sales_orders_for_customer(self, customer, tenant):
        """Get sales orders for a customer."""
        try:
            SalesOrder = apps.get_model('sales_orders', 'SalesOrder')
            qs = SalesOrder.objects.filter(tenant=tenant, customer=customer)
            qs = self._order_queryset_recent_first(qs)
            return {
                "count": qs.count(),
                "items": [self._serialize_entity(so, 'sales_order') for so in qs[:10]],
            }
        except LookupError:
            return None

    def _get_invoices_for_customer(self, customer, tenant):
        """Get invoices for a customer."""
        try:
            Invoice = apps.get_model('invoices', 'Invoice')
            qs = Invoice.objects.filter(tenant=tenant, customer=customer)
            qs = self._order_queryset_recent_first(qs)
            return {
                "count": qs.count(),
                "items": [self._serialize_entity(inv, 'invoice') for inv in qs[:10]],
            }
        except LookupError:
            return None

    def _get_inquiries_for_customer(self, customer, tenant):
        """Get inquiries for a customer."""
        try:
            Inquiry = apps.get_model('inquiries', 'Inquiry')
            qs = Inquiry.objects.filter(tenant=tenant, customer=customer)
            qs = self._order_queryset_recent_first(qs).prefetch_related('products__product')
            return {
                "count": qs.count(),
                "items": [self._serialize_inquiry_relationship_item(inq) for inq in qs[:10]],
            }
        except LookupError:
            return None

    def _get_sales_orders_for_supplier(self, supplier, tenant):
        """Get sales orders for a supplier."""
        try:
            SalesOrder = apps.get_model('sales_orders', 'SalesOrder')
            qs = SalesOrder.objects.filter(tenant=tenant, supplier=supplier)
            qs = self._order_queryset_recent_first(qs)
            return {
                "count": qs.count(),
                "items": [self._serialize_entity(so, 'sales_order') for so in qs[:10]],
            }
        except LookupError:
            return None

    def _get_contacts_for_customer(self, customer, tenant):
        """Get contacts for a customer.

        Contacts may be linked either via:
        - Modern M2M: Customer.contacts
        - Legacy FK: Contact.customer
        """
        try:
            Contact = apps.get_model('contacts', 'Contact')

            legacy_ids = set(
                Contact.objects.filter(tenant=tenant, customer=customer).values_list('id', flat=True)
            )

            m2m_ids: set[int] = set()
            try:
                rel = getattr(customer, 'contacts', None)
                if rel is not None:
                    m2m_ids = set(rel.filter(tenant=tenant).values_list('id', flat=True))
            except Exception:
                m2m_ids = set()

            contact_ids = legacy_ids | m2m_ids
            if not contact_ids:
                return {"count": 0, "items": []}

            qs = Contact.objects.filter(tenant=tenant, id__in=list(contact_ids)).order_by('last_name', 'first_name')
            return {
                "count": qs.count(),
                "items": [self._serialize_entity(contact, 'contact') for contact in qs[:10]],
            }
        except LookupError:
            return None

    def _get_purchase_orders_for_supplier(self, supplier, tenant):
        """Get purchase orders for a supplier."""
        try:
            PurchaseOrder = apps.get_model('purchase_orders', 'PurchaseOrder')
            qs = PurchaseOrder.objects.filter(tenant=tenant, supplier=supplier)
            qs = self._order_queryset_recent_first(qs)
            return {
                "count": qs.count(),
                "items": [self._serialize_entity(po, 'purchase_order') for po in qs[:10]],
            }
        except LookupError:
            return None

    def _get_inquiries_for_supplier(self, supplier, tenant):
        """Get inquiries for a supplier."""
        try:
            Inquiry = apps.get_model('inquiries', 'Inquiry')
            qs = Inquiry.objects.filter(tenant=tenant, supplier=supplier)
            qs = self._order_queryset_recent_first(qs).prefetch_related('products__product')
            return {
                "count": qs.count(),
                "items": [self._serialize_inquiry_relationship_item(inq) for inq in qs[:10]],
            }
        except LookupError:
            return None

    def _get_recent_orders_for_supplier(self, supplier, tenant):
        """Get recent orders for a supplier (purchase orders + sales orders)."""
        purchase = self._get_purchase_orders_for_supplier(supplier, tenant) or {"count": 0, "items": []}
        sales = self._get_sales_orders_for_supplier(supplier, tenant) or {"count": 0, "items": []}

        def to_epoch(value):
            if not value:
                return 0.0
            try:
                return float(value.timestamp())
            except Exception:
                return 0.0

        combined = list(purchase.get('items', [])) + list(sales.get('items', []))
        combined.sort(
            key=lambda item: to_epoch(item.get('updated_at') or item.get('created_at')),
            reverse=True,
        )

        return {
            "count": int(purchase.get('count', 0)) + int(sales.get('count', 0)),
            "items": combined[:10],
        }

    def _get_contacts_for_supplier(self, supplier, tenant):
        """Get contacts for a supplier.

        Contacts may be linked either via:
        - Modern M2M: Supplier.contacts
        - Legacy FK: Contact.supplier
        """
        try:
            Contact = apps.get_model('contacts', 'Contact')

            legacy_ids = set(
                Contact.objects.filter(tenant=tenant, supplier=supplier).values_list('id', flat=True)
            )

            m2m_ids: set[int] = set()
            try:
                rel = getattr(supplier, 'contacts', None)
                if rel is not None:
                    m2m_ids = set(rel.filter(tenant=tenant).values_list('id', flat=True))
            except Exception:
                m2m_ids = set()

            contact_ids = legacy_ids | m2m_ids
            if not contact_ids:
                return {"count": 0, "items": []}

            qs = Contact.objects.filter(tenant=tenant, id__in=list(contact_ids)).order_by('last_name', 'first_name')
            return {
                "count": qs.count(),
                "items": [self._serialize_entity(contact, 'contact') for contact in qs[:10]],
            }
        except LookupError:
            return None

    def _get_purchase_orders_for_product(self, product, tenant):
        """Get purchase orders for a given system Product."""
        try:
            PurchaseOrder = apps.get_model('purchase_orders', 'PurchaseOrder')
            qs = PurchaseOrder.objects.filter(tenant=tenant, product=product)
            qs = self._order_queryset_recent_first(qs)
            return {
                "count": qs.count(),
                "items": [self._serialize_entity(po, 'purchase_order') for po in qs[:10]],
            }
        except LookupError:
            return None

    def _get_sales_orders_for_product(self, product, tenant):
        """Get sales orders for a given system Product."""
        try:
            SalesOrder = apps.get_model('sales_orders', 'SalesOrder')
            qs = SalesOrder.objects.filter(tenant=tenant, product=product)
            qs = self._order_queryset_recent_first(qs)
            return {
                "count": qs.count(),
                "items": [self._serialize_entity(so, 'sales_order') for so in qs[:10]],
            }
        except LookupError:
            return None

    def _get_related_products_for_customer(self, customer, tenant):
        """Get products commonly associated with a customer via recent SalesOrders."""
        try:
            SalesOrder = apps.get_model('sales_orders', 'SalesOrder')
            Product = apps.get_model('system', 'Product')

            product_ids = (
                SalesOrder.objects.filter(tenant=tenant, customer=customer)
                .exclude(product_id__isnull=True)
                .values_list('product_id', flat=True)
                .distinct()
            )
            qs = Product.objects.filter(id__in=list(product_ids))
            return {
                "count": qs.count(),
                "items": [self._serialize_entity(p, 'product') for p in qs[:25]],
            }
        except LookupError:
            return None

    def _get_related_products_for_supplier(self, supplier, tenant):
        """Get products commonly associated with a supplier via PurchaseOrders and SalesOrders."""
        try:
            PurchaseOrder = apps.get_model('purchase_orders', 'PurchaseOrder')
            SalesOrder = apps.get_model('sales_orders', 'SalesOrder')
            Product = apps.get_model('system', 'Product')

            po_product_ids = (
                PurchaseOrder.objects.filter(tenant=tenant, supplier=supplier)
                .exclude(product_id__isnull=True)
                .values_list('product_id', flat=True)
                .distinct()
            )
            so_product_ids = (
                SalesOrder.objects.filter(tenant=tenant, supplier=supplier)
                .exclude(product_id__isnull=True)
                .values_list('product_id', flat=True)
                .distinct()
            )
            product_ids = set(list(po_product_ids) + list(so_product_ids))
            qs = Product.objects.filter(id__in=list(product_ids))
            return {
                "count": qs.count(),
                "items": [self._serialize_entity(p, 'product') for p in qs[:25]],
            }
        except LookupError:
            return None
    
    def _get_supplier_for_po(self, purchase_order, tenant):
        """Get supplier for a purchase order."""
        if hasattr(purchase_order, 'supplier') and purchase_order.supplier:
            return {
                "count": 1,
                "items": [self._serialize_entity(purchase_order.supplier, 'supplier')]
            }
        return None
    
    def _get_customer_for_so(self, sales_order, tenant):
        """Get customer for a sales order."""
        if hasattr(sales_order, 'customer') and sales_order.customer:
            return {
                "count": 1,
                "items": [self._serialize_entity(sales_order.customer, 'customer')],
            }
        return None

    def _get_supplier_for_so(self, sales_order, tenant):
        """Get supplier for a sales order."""
        if hasattr(sales_order, 'supplier') and sales_order.supplier:
            return {
                "count": 1,
                "items": [self._serialize_entity(sales_order.supplier, 'supplier')],
            }
        return None

    def _get_product_for_so(self, sales_order):
        """Get product for a sales order (system Product)."""
        if hasattr(sales_order, 'product') and sales_order.product:
            return {
                "count": 1,
                "items": [self._serialize_entity(sales_order.product, 'product')],
            }
        return None

    def _get_contact_for_so(self, sales_order, tenant):
        """Get primary contact for a sales order."""
        if hasattr(sales_order, 'contact') and sales_order.contact:
            return {
                "count": 1,
                "items": [self._serialize_entity(sales_order.contact, 'contact')],
            }
        return None

    def _get_invoice_for_so(self, sales_order, tenant):
        """Get invoice for a sales order (if any)."""
        try:
            Invoice = apps.get_model('invoices', 'Invoice')
            qs = Invoice.objects.filter(tenant=tenant, sales_order=sales_order)
            qs = self._order_queryset_recent_first(qs)
            return {
                "count": qs.count(),
                "items": [self._serialize_entity(inv, 'invoice') for inv in qs[:10]],
            }
        except LookupError:
            return None

    def _get_product_for_po(self, purchase_order):
        """Get product for a purchase order (system Product)."""
        if hasattr(purchase_order, 'product') and purchase_order.product:
            return {
                "count": 1,
                "items": [self._serialize_entity(purchase_order.product, 'product')],
            }
        return None

    def _get_sales_order_for_po(self, purchase_order, tenant):
        """Get linked sales order for a purchase order if present."""
        if hasattr(purchase_order, 'sales_order') and purchase_order.sales_order:
            return {
                "count": 1,
                "items": [self._serialize_entity(purchase_order.sales_order, 'sales_order')],
            }
        return None

    def _get_customer_for_contact(self, contact, tenant):
        """Get customer associated to a contact (if any)."""
        if hasattr(contact, 'customer') and contact.customer:
            return {
                "count": 1,
                "items": [self._serialize_entity(contact.customer, 'customer')],
            }
        return None

    def _get_supplier_for_contact(self, contact, tenant):
        """Get supplier associated to a contact (if any)."""
        if hasattr(contact, 'supplier') and contact.supplier:
            return {
                "count": 1,
                "items": [self._serialize_entity(contact.supplier, 'supplier')],
            }
        return None
    
    def _serialize_inquiry_relationship_item(self, inquiry):
        """Serialize Inquiry items for Cockpit relationship panels.

        The Cockpit Customer → Inquiries panel needs:
        - inquiry number
        - created/modified timestamps
        - a small product summary list (up to 4)
        """
        base = self._serialize_entity(inquiry, 'inquiry')

        # Preserve the existing metadata shape but add inquiry-specific fields.
        meta = dict(base.get('metadata') or {})
        meta['inquiry_number'] = getattr(inquiry, 'inquiry_number', None)
        meta['created_on'] = getattr(inquiry, 'created_on', None)
        meta['modified_on'] = getattr(inquiry, 'modified_on', None)

        # Product summary (up to 4 items)
        preview_limit = 4
        product_summary = []
        more_count = 0
        try:
            rel = getattr(inquiry, 'products', None)
            if rel is not None:
                qs = rel.select_related('product').order_by('created_on')
                total = qs.count()
                for row in qs[:preview_limit]:
                    product = getattr(row, 'product', None)
                    label = (
                        getattr(product, 'product_code', None)
                        or getattr(product, 'name', None)
                        or getattr(product, 'description', None)
                    )
                    if label:
                        product_summary.append(str(label))
                more_count = max(0, total - preview_limit)
        except Exception:
            product_summary = []
            more_count = 0

        meta['product_summary'] = product_summary
        meta['product_more_count'] = more_count
        base['metadata'] = meta

        # Convenience timestamps at the top-level too.
        if meta.get('modified_on') is not None:
            base['updated_at'] = meta.get('modified_on')

        return base

    def _serialize_entity(self, entity, entity_type):
        """Minimal serialization for entity references."""
        base = {
            "id": entity.pk,
            "type": entity_type,
        }
        
        # Add type-specific fields
        if entity_type == 'contact':
            first = getattr(entity, 'first_name', '') or ''
            last = getattr(entity, 'last_name', '') or ''
            full_name = (f"{first} {last}").strip()
            base['title'] = full_name or getattr(entity, 'email', None) or f"Contact {entity.pk}"
        elif entity_type == 'purchase_order':
            base['title'] = (
                getattr(entity, 'order_number', None)
                or getattr(entity, 'our_purchase_order_num', None)
                or f"Purchase Order {entity.pk}"
            )
        elif entity_type == 'sales_order':
            base['title'] = (
                getattr(entity, 'our_sales_order_num', None)
                or getattr(entity, 'delivery_po_num', None)
                or f"Sales Order {entity.pk}"
            )
        elif entity_type == 'invoice':
            base['title'] = (
                getattr(entity, 'invoice_number', None)
                or f"Invoice {entity.pk}"
            )
        elif entity_type == 'inquiry':
            base['title'] = (
                getattr(entity, 'inquiry_number', None)
                or f"Inquiry {entity.pk}"
            )
        elif entity_type == 'product':
            base['title'] = (
                getattr(entity, 'name', None)
                or getattr(entity, 'product_code', None)
                or f"Product {entity.pk}"
            )
        elif hasattr(entity, 'name'):
            base['title'] = entity.name
        elif hasattr(entity, 'title'):
            base['title'] = entity.title
        elif hasattr(entity, 'number'):
            base['title'] = entity.number
        else:
            base['title'] = f"{entity_type.title()} {entity.pk}"
        
        # Add metadata (last activity, labels, etc.)
        base['metadata'] = self._get_entity_metadata(entity, entity_type)
        
        # Add common fields
        if hasattr(entity, 'created_on'):
            base['created_at'] = entity.created_on
        elif hasattr(entity, 'created_at'):
            base['created_at'] = entity.created_at
        
        return base
    
    def _serialize_line_item(self, line_item, item_type):
        """Serialize line item with product details."""
        base = {
            "id": line_item.pk,
            "type": item_type,
        }
        
        # Add product name
        if hasattr(line_item, 'product') and line_item.product:
            base['title'] = line_item.product.name
            base['product_id'] = line_item.product.pk
        else:
            base['title'] = f"Line Item {line_item.pk}"
        
        # Add quantity and pricing
        if hasattr(line_item, 'quantity'):
            base['quantity'] = line_item.quantity
        if hasattr(line_item, 'unit_price'):
            base['unit_price'] = float(line_item.unit_price)
        if hasattr(line_item, 'total_price'):
            base['total_price'] = float(line_item.total_price)
        
        return base
    
    def _get_entity_metadata(self, entity, entity_type):
        """Get contextual metadata for an entity."""
        try:
            from apps.system.services.ranking_service import EntityLabels
            
            metadata = {
                "labels": EntityLabels.get_labels(entity, entity_type),
            }

            # Product associations for Cockpit EntityProfileHeader
            # Keep payload intentionally small (names/codes only) to avoid heavy M2M serialization.
            if entity_type == 'customer' and hasattr(entity, 'products'):
                try:
                    preferred = list(
                        entity.products.filter(is_active=True)
                        .order_by('product_code')
                        .values('id', 'product_code', 'name')[:50]
                    )
                    metadata['preferred_products'] = preferred
                    # Customers don't currently have a separate active-products model; treat as same for now.
                    metadata['active_products'] = preferred
                except Exception:
                    metadata['preferred_products'] = []
                    metadata['active_products'] = []

            if entity_type == 'supplier':
                # Preferred products: products where this supplier is marked preferred in tenant product preferences
                try:
                    from apps.system.models.tenant_product_preference import TenantProductPreference

                    preferred = list(
                        TenantProductPreference.objects.filter(
                            tenant=getattr(entity, 'tenant', None),
                            preferred_supplier=entity,
                            is_active=True,
                        )
                        .select_related('product')
                        .order_by('product__product_code')
                        .values('product__id', 'product__product_code', 'product__name')[:50]
                    )
                    metadata['preferred_products'] = [
                        {'id': row['product__id'], 'product_code': row['product__product_code'], 'name': row['product__name']}
                        for row in preferred
                    ]
                except Exception:
                    metadata['preferred_products'] = []

                # Active products: supplier-level availability table
                try:
                    from tenant_apps.suppliers.models import SupplierAvailableItem

                    active = list(
                        SupplierAvailableItem.objects.filter(
                            tenant=getattr(entity, 'tenant', None),
                            supplier=entity,
                            is_active=True,
                        )
                        .select_related('product')
                        .order_by('product__product_code')
                        .values('product__id', 'product__product_code', 'product__name')[:50]
                    )
                    metadata['active_products'] = [
                        {'id': row['product__id'], 'product_code': row['product__product_code'], 'name': row['product__name']}
                        for row in active
                    ]
                except Exception:
                    metadata['active_products'] = []
            
            # Add last activity timestamp
            if hasattr(entity, 'modified_on'):
                metadata['last_activity'] = entity.modified_on
            elif hasattr(entity, 'updated_at'):
                metadata['last_activity'] = entity.updated_at
            
            return metadata
        except Exception as e:
            # Graceful fallback if labeling fails
            return {"labels": []}
    
    @action(detail=True, methods=['get'], url_path='fuzzy-related')
    def fuzzy_related(self, request, type=None, pk=None):
        """
        Discover related entities using fuzzy matching (email domain, tax ID, name).
        
        This endpoint finds relationships even when foreign keys are NULL by matching:
        - Email domains (@company.com)
        - Tax IDs / Business numbers
        - Company names / Short names
        - SKUs / Reference numbers
        
        Example: GET /api/v1/system/entities/customer/123/fuzzy-related/
        
        Query params:
        - max_results: Maximum fuzzy matches to return (default: 50)
        
        Returns:
        {
          "entity": { "id": 123, "type": "customer", "name": "Acme Corp" },
          "fuzzy_matches": [
            {
              "id": "456",
              "type": "order",
              "name": "Order #1234",
              "subtitle": "Email: john@acme.com",
              "metadata": {
                "match_type": "email_domain",
                "domain": "acme.com"
              },
              "relevance_score": 0.9
            },
            ...
          ],
          "total": 15
        }
        """
        from apps.system.services import RelationshipDiscoveryService
        
        tenant = request.tenant
        
        if type not in self.MODEL_MAP:
            return Response(
                {"error": f"Unknown entity type: {type}"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get max results from query params
        max_results = int(request.query_params.get('max_results', 50))
        
        # Initialize fuzzy discovery service
        discovery_service = RelationshipDiscoveryService(tenant)
        
        try:
            # Discover fuzzy relationships
            fuzzy_matches = discovery_service.discover_related_entities(
                entity_type=type,
                entity_id=pk,
                max_results=max_results
            )
            
            # Get source entity for response
            app_label, model_name = self.MODEL_MAP[type]
            Model = apps.get_model(app_label, model_name)
            
            if hasattr(Model, 'tenant'):
                entity = Model.objects.filter(tenant=tenant).get(pk=pk)
            else:
                entity = Model.objects.get(pk=pk)
            
            return Response({
                "entity": self._serialize_entity(entity, type),
                "fuzzy_matches": fuzzy_matches,
                "total": len(fuzzy_matches)
            })
            
        except ObjectDoesNotExist:
            return Response(
                {"error": f"Entity not found: {type} #{pk}"},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            # Graceful error handling - return empty results
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f'Fuzzy discovery failed for {type} #{pk}: {str(e)}', exc_info=True)
            
            return Response({
                "entity": {"id": pk, "type": type},
                "fuzzy_matches": [],
                "total": 0,
                "error": "Fuzzy discovery temporarily unavailable"
            })
