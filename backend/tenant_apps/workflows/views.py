"""
API ViewSets for Tenant Workflows.

Bundle Two: System → Tenant Workflows & New Data Entities
Provides REST API endpoints for Forms, Workflows, and Lists.
"""

import logging
from datetime import timedelta

from django.contrib.auth.models import User
from django.db import IntegrityError, transaction
from django.db.models import Count, Exists, F, Max, OuterRef, Prefetch, Q
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from drf_spectacular.utils import OpenApiTypes, extend_schema

logger = logging.getLogger(__name__)

from apps.tenants.models import Tenant, TenantUser

from .models import (
    FormStatus,
    FormStatusHistory,
    FormStepSubmission,
    FormSubmission,
    FormSubmissionStatus,
    StepAssignment,
    StepSubmissionStatus,
    TenantForm,
    TenantFormEntity,
    TenantFormField,
    TenantFormRule,
    TenantList,
    TenantWorkflow,
    TenantWorkflowAction,
    TenantWorkflowCondition,
    UserNotification,
    UserNotificationPreferences,
    WorkflowExecutionLog,
    WorkflowStatus,
)
from .permissions import (
    CanEditWorkForm,
    CanPublishWorkForm,
    IsTenantAdminOrOwnerOrReadOnly,
    WorkFormPermissionHelper,
)
from .serializers import (
    EntityOptionsResponseSerializer,
    QuickCreateCreateResponseSerializer,
    QuickCreateFieldsResponseSerializer,
    SmartFieldMatchRequestSerializer,
    SmartFieldMatchResponseSerializer,
    TenantFormCreateSerializer,
    TenantFormEntitySerializer,
    TenantFormFieldSerializer,
    TenantFormRuleSerializer,
    TenantFormSerializer,
    TenantListSerializer,
    TenantWorkflowActionSerializer,
    TenantWorkflowConditionSerializer,
    TenantWorkflowCreateSerializer,
    TenantWorkflowSerializer,
    WorkflowExecutionLogSerializer,
)
from .services import FieldRegistry, get_available_entities, get_entity_fields
from .services.entity_persistence import persist_form_submission
from .services.form_process_persistence import FormProcessPersistenceService

# =============================================================================
# ADMIN FORM BUILDER API VIEWS
# =============================================================================


def _get_request_tenant(request):
    """Return resolved tenant, supporting both middleware and DRF-auth flows.

    In normal requests, TenantAware authentication sets request.tenant and asserts
    RLS session vars. For tests (force_authenticate) and edge cases, we also support
    late resolution from the X-Tenant-ID header with membership validation.
    """

    django_request = getattr(request, '_request', None)
    tenant = getattr(request, 'tenant', None) or getattr(django_request, 'tenant', None)
    if tenant:
        return tenant

    tenant_id = None
    if hasattr(request, 'headers'):
        tenant_id = request.headers.get('X-Tenant-ID')
    if not tenant_id and django_request is not None and hasattr(django_request, 'headers'):
        tenant_id = django_request.headers.get('X-Tenant-ID')

    user = getattr(request, 'user', None) or getattr(django_request, 'user', None)
    if not tenant_id or not user or not getattr(user, 'is_authenticated', False):
        return None

    try:
        tenant = Tenant.objects.get(id=tenant_id, is_active=True)
    except (Tenant.DoesNotExist, ValueError):
        return None

    is_global_admin = user.groups.filter(name='Global System Admins').exists()
    if not (user.is_superuser or is_global_admin):
        if not TenantUser.objects.filter(user=user, tenant=tenant, is_active=True).exists():
            return None

    # Cache for later uses during this request lifecycle.
    try:
        setattr(request, 'tenant', tenant)
    except Exception:
        pass
    try:
        if django_request is not None:
            setattr(django_request, 'tenant', tenant)
    except Exception:
        pass

    return tenant


def _require_tenant(request):
    tenant = _get_request_tenant(request)
    if not tenant:
        return None, Response(
            {'error': 'Tenant context is required (X-Tenant-ID header).'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    return tenant, None


class EntityFieldsAPIView(APIView):
    """
    API endpoint for getting available fields for an entity type.
    Used by the form builder admin interface.
    """

    permission_classes = [IsAdminUser]

    def get(self, request, entity_type):
        """Get all available fields for an entity type."""
        fields = get_entity_fields(entity_type)
        if not fields:
            return Response({"error": f"Unknown entity type: {entity_type}"}, status=status.HTTP_404_NOT_FOUND)
        return Response(
            {
                "entity_type": entity_type,
                "fields": fields,
                "count": len(fields),
            }
        )


class AvailableEntitiesAPIView(APIView):
    """
    API endpoint for getting available entity types.
    Used by the form builder admin interface.
    """

    permission_classes = [IsAdminUser]

    def get(self, request):
        """Get all available entity types."""
        entities = get_available_entities()
        return Response(
            {
                "entities": entities,
                "count": len(entities),
            }
        )


class FormStepFieldsAPIView(APIView):
    """
    API endpoint for managing fields in a form step (TenantFormEntity).
    Used by the form builder admin interface.
    """

    permission_classes = [IsAdminUser]

    def get(self, request, step_id):
        """Get selected and available fields for a form step."""
        tenant, error = _require_tenant(request)
        if error:
            return error

        try:
            step = TenantFormEntity.objects.select_related("form").get(pk=step_id, tenant=tenant)
        except TenantFormEntity.DoesNotExist:
            return Response({"error": "Form step not found"}, status=status.HTTP_404_NOT_FOUND)

        # Get available fields for this entity type
        available_fields = get_entity_fields(step.entity_type)

        # Get currently selected fields
        selected = step.fields.all().order_by("order")
        selected_keys = {f.field_key for f in selected}

        selected_fields = []
        for field in selected:
            # Find matching field metadata
            field_meta = next((f for f in available_fields if f["key"] == field.field_key), None)
            # Use stored field_type if available, fall back to metadata
            field_type = (
                field.field_type
                if field.field_type and field.field_type != "text"
                else (field_meta["type"] if field_meta else "text")
            )
            if field_type == "text" and field_meta and field_meta.get("type"):
                field_type = field_meta["type"]

            selected_fields.append(
                {
                    "id": str(field.id),
                    "key": field.field_key,
                    "label": field.custom_label or (field_meta["label"] if field_meta else field.field_key),
                    "type": field_type,
                    "required": field.is_required,
                    "visible": field.is_visible,
                    "order": field.order,
                    "help_text": field.custom_help_text,
                    # Phase 3: Include auto-populate indicator
                    "hasAutoPopulate": bool(field.auto_populate_source_step and field.auto_populate_source_field),
                    "autoPopulateSource": (
                        f"{field.auto_populate_source_step.step_name or field.auto_populate_source_step.entity_type}.{field.auto_populate_source_field}"
                        if field.auto_populate_source_step
                        else None
                    ),
                }
            )

        # Mark which available fields are already selected
        for field in available_fields:
            field["selected"] = field["key"] in selected_keys

        return Response(
            {
                "step_id": str(step_id),
                "step_name": step.step_name or step.entity_type.replace("_", " ").title(),
                "entity_type": step.entity_type,
                "selected_fields": selected_fields,
                "available_fields": available_fields,
            }
        )

    def post(self, request, step_id):
        """Save field selection for a form step."""
        tenant, error = _require_tenant(request)
        if error:
            return error

        try:
            step = TenantFormEntity.objects.get(pk=step_id, tenant=tenant)
        except TenantFormEntity.DoesNotExist:
            return Response({"error": "Form step not found"}, status=status.HTTP_404_NOT_FOUND)

        fields_data = request.data.get("fields", [])

        with transaction.atomic():
            # Delete existing fields
            step.fields.all().delete()

            # Create new fields in order
            for order, field_data in enumerate(fields_data):
                TenantFormField.objects.create(
                    form_entity=step,
                    field_key=field_data["key"],
                    field_type=field_data.get("type", "text"),  # Store the field type
                    is_visible=field_data.get("visible", True),
                    is_required=field_data.get("required", False),
                    order=order,
                    custom_label=field_data.get("custom_label", ""),
                    custom_help_text=field_data.get("help_text", ""),
                )

        return Response(
            {
                "status": "success",
                "message": f"Saved {len(fields_data)} fields",
                "step_id": str(step_id),
            }
        )


class FormStepReorderAPIView(APIView):
    """
    API endpoint for reordering form steps.
    Used by the form builder admin interface for drag-drop.
    """

    permission_classes = [IsAdminUser]

    def post(self, request, form_id):
        """Reorder steps in a form."""
        tenant, error = _require_tenant(request)
        if error:
            return error

        try:
            form = TenantForm.objects.get(pk=form_id, tenant=tenant)
        except TenantForm.DoesNotExist:
            return Response({"error": "Form not found"}, status=status.HTTP_404_NOT_FOUND)

        step_order = request.data.get("step_order", [])

        with transaction.atomic():
            for order, step_id in enumerate(step_order):
                TenantFormEntity.objects.filter(id=step_id, form=form).update(order=order)

        return Response(
            {
                "status": "success",
                "message": f"Reordered {len(step_order)} steps",
            }
        )


class FormStepsAPIView(APIView):
    """
    API endpoint for managing form steps (create/delete).
    Used by the form builder admin interface.
    """

    permission_classes = [IsAdminUser]

    def get(self, request, form_id):
        """Get all steps for a form."""
        tenant, error = _require_tenant(request)
        if error:
            return error

        try:
            form = TenantForm.objects.get(pk=form_id, tenant=tenant)
        except TenantForm.DoesNotExist:
            return Response({"error": "Form not found"}, status=status.HTTP_404_NOT_FOUND)

        steps = form.entities.all().order_by("order")
        steps_data = [
            {
                "id": str(step.id),
                "entity_type": step.entity_type,
                "step_name": step.step_name or "",
                "order": step.order,
                "field_count": step.fields.count(),
            }
            for step in steps
        ]

        return Response(
            {"form_id": str(form_id), "form_name": form.name, "steps": steps_data, "count": len(steps_data)}
        )

    def post(self, request, form_id):
        """Create a new step for a form."""
        tenant, error = _require_tenant(request)
        if error:
            return error

        try:
            form = TenantForm.objects.get(pk=form_id, tenant=tenant)
        except TenantForm.DoesNotExist:
            return Response({"error": "Form not found"}, status=status.HTTP_404_NOT_FOUND)

        entity_type = request.data.get("entity_type")
        step_name = request.data.get("step_name", "")

        if not entity_type:
            return Response({"error": "entity_type is required"}, status=status.HTTP_400_BAD_REQUEST)

        # Get the next order number
        max_order = form.entities.aggregate(Max("order"))["order__max"]
        next_order = 0 if max_order is None else max_order + 1

        # Create the step
        step = TenantFormEntity.objects.create(
            form=form, entity_type=entity_type, step_name=step_name, order=next_order
        )

        return Response(
            {
                "status": "success",
                "message": "Step created",
                "step": {
                    "id": str(step.id),
                    "entity_type": step.entity_type,
                    "step_name": step.step_name or "",
                    "order": step.order,
                    "field_count": 0,
                },
            },
            status=status.HTTP_201_CREATED,
        )


class FormStepDetailAPIView(APIView):
    """
    API endpoint for managing individual form steps (get/update/delete).
    """

    permission_classes = [IsAdminUser]

    def get(self, request, step_id):
        """Get a single step."""
        tenant, error = _require_tenant(request)
        if error:
            return error

        try:
            step = TenantFormEntity.objects.get(pk=step_id, tenant=tenant)
        except TenantFormEntity.DoesNotExist:
            return Response({"error": "Step not found"}, status=status.HTTP_404_NOT_FOUND)

        return Response(
            {
                "id": str(step.id),
                "form_id": str(step.form_id),
                "entity_type": step.entity_type,
                "step_name": step.step_name or "",
                "order": step.order,
                "field_count": step.fields.count(),
            }
        )

    def put(self, request, step_id):
        """Update a step."""
        tenant, error = _require_tenant(request)
        if error:
            return error

        try:
            step = TenantFormEntity.objects.get(pk=step_id, tenant=tenant)
        except TenantFormEntity.DoesNotExist:
            return Response({"error": "Step not found"}, status=status.HTTP_404_NOT_FOUND)

        # Update allowed fields
        if "entity_type" in request.data:
            step.entity_type = request.data["entity_type"]
        if "step_name" in request.data:
            step.step_name = request.data["step_name"]
        if "order" in request.data:
            step.order = request.data["order"]

        step.save()

        return Response(
            {
                "status": "success",
                "message": "Step updated",
                "step": {
                    "id": str(step.id),
                    "entity_type": step.entity_type,
                    "step_name": step.step_name or "",
                    "order": step.order,
                },
            }
        )

    def delete(self, request, step_id):
        """Delete a step."""
        tenant, error = _require_tenant(request)
        if error:
            return error

        try:
            step = TenantFormEntity.objects.get(pk=step_id, tenant=tenant)
        except TenantFormEntity.DoesNotExist:
            return Response({"error": "Step not found"}, status=status.HTTP_404_NOT_FOUND)

        step.delete()

        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(tags=["Workflows", "Admin"])
class SmartFieldMatchAPIView(APIView):
    """
    API endpoint for smart field matching suggestions.
    Used by the auto-populate configuration in form builder.
    """

    permission_classes = [IsAdminUser]

    @extend_schema(
        request=SmartFieldMatchRequestSerializer,
        responses={200: SmartFieldMatchResponseSerializer},
    )
    def post(self, request):
        """
        Find matching fields for auto-population.

        Request body:
        {
            "source_field": {"key": "email", "type": "email"},
            "target_entity_type": "contact"
        }
        """
        source_field = request.data.get("source_field")
        target_entity_type = request.data.get("target_entity_type")

        if not source_field or not target_entity_type:
            return Response(
                {"error": "source_field and target_entity_type are required"}, status=status.HTTP_400_BAD_REQUEST
            )

        matches = FieldRegistry.find_matching_fields(source_field, target_entity_type)

        return Response(
            {
                "source_field": source_field,
                "target_entity_type": target_entity_type,
                "matches": matches,
            }
        )


class FieldConfigAPIView(APIView):
    """
    API endpoint for configuring individual field settings.
    Used by the field configuration modal in form builder.
    """

    permission_classes = [IsAdminUser]

    def get(self, request, field_id):
        """Get field configuration including auto-populate settings."""
        tenant, error = _require_tenant(request)
        if error:
            return error

        try:
            field = TenantFormField.objects.select_related(
                "form_entity", "form_entity__form", "auto_populate_source_step"
            ).get(pk=field_id, tenant=tenant)
        except TenantFormField.DoesNotExist:
            return Response({"error": "Field not found"}, status=status.HTTP_404_NOT_FOUND)

        # Get available source steps (all steps before this field's step)
        current_step = field.form_entity
        form = current_step.form
        available_source_steps = []

        for step in form.entities.filter(order__lt=current_step.order).order_by("order"):
            step_fields = get_entity_fields(step.entity_type)
            available_source_steps.append(
                {
                    "id": str(step.id),
                    "name": step.step_name or step.entity_type.replace("_", " ").title(),
                    "entity_type": step.entity_type,
                    "order": step.order,
                    "fields": step_fields,
                }
            )

        # Get smart match suggestions if there are source steps
        suggestions = []
        if available_source_steps:
            # Get this field's metadata
            field_meta = next(
                (f for f in get_entity_fields(current_step.entity_type) if f["key"] == field.field_key),
                {"key": field.field_key, "type": "text"},
            )

            # Find matches in all prior steps
            for source_step in available_source_steps:
                matches = FieldRegistry.find_matching_fields(field_meta, source_step["entity_type"])
                for match in matches[:3]:  # Top 3 matches per step
                    suggestions.append(
                        {
                            "source_step_id": source_step["id"],
                            "source_step_name": source_step["name"],
                            "source_field_key": match["field"]["key"],
                            "source_field_label": match["field"]["label"],
                            "score": match["score"],
                            "reasons": match["reasons"],
                        }
                    )

            # Sort by score descending
            suggestions.sort(key=lambda x: x["score"], reverse=True)

        return Response(
            {
                "field_id": str(field_id),
                "field_key": field.field_key,
                "custom_label": field.custom_label,
                "custom_help_text": field.custom_help_text,
                "is_required": field.is_required,
                "is_visible": field.is_visible,
                "default_value": field.default_value,
                "auto_populate": {
                    "source_step": str(field.auto_populate_source_step.id) if field.auto_populate_source_step else None,
                    "source_step_name": (
                        (field.auto_populate_source_step.step_name or field.auto_populate_source_step.entity_type)
                        if field.auto_populate_source_step
                        else None
                    ),
                    "source_field": field.auto_populate_source_field,
                    "mode": field.auto_populate_mode,
                },
                "available_source_steps": available_source_steps,
                "suggestions": suggestions[:5],  # Top 5 suggestions overall
            }
        )

    def post(self, request, field_id):
        """Update field configuration including auto-populate settings."""
        tenant, error = _require_tenant(request)
        if error:
            return error

        try:
            field = TenantFormField.objects.get(pk=field_id, tenant=tenant)
        except TenantFormField.DoesNotExist:
            return Response({"error": "Field not found"}, status=status.HTTP_404_NOT_FOUND)

        # Update basic settings
        if "custom_label" in request.data:
            field.custom_label = request.data["custom_label"]
        if "custom_help_text" in request.data:
            field.custom_help_text = request.data["custom_help_text"]
        if "is_required" in request.data:
            field.is_required = request.data["is_required"]
        if "is_visible" in request.data:
            field.is_visible = request.data["is_visible"]
        if "default_value" in request.data:
            field.default_value = request.data["default_value"]

        # Update auto-populate settings
        auto_populate = request.data.get("auto_populate", {})
        if auto_populate:
            source_step_id = auto_populate.get("source_step")
            if source_step_id:
                try:
                    source_step = TenantFormEntity.objects.get(pk=source_step_id, tenant=tenant)
                    field.auto_populate_source_step = source_step
                except TenantFormEntity.DoesNotExist:
                    pass
            else:
                field.auto_populate_source_step = None

            field.auto_populate_source_field = auto_populate.get("source_field", "")
            field.auto_populate_mode = auto_populate.get("mode", "")

        field.save()

        return Response(
            {
                "status": "success",
                "message": "Field configuration saved",
                "field_id": str(field_id),
            }
        )

    # Allow PUT as an alias for POST (RESTful convention)
    def put(self, request, field_id):
        return self.post(request, field_id)


class FormMappingsAPIView(APIView):
    """
    API endpoint for managing field mappings in a form.
    Used by the Field Mappings section in the form builder admin interface.
    """

    permission_classes = [IsAdminUser]

    def get(self, request, form_id):
        """Get all field mappings for a form."""
        from .services import FieldMappingService

        tenant, error = _require_tenant(request)
        if error:
            return error

        try:
            form = TenantForm.objects.prefetch_related("entities").get(pk=form_id, tenant=tenant)
        except TenantForm.DoesNotExist:
            return Response({"error": "Form not found"}, status=status.HTTP_404_NOT_FOUND)

        mappings = FieldMappingService.get_current_mappings(form)

        # Get step info for context
        steps_data = []
        for step in form.entities.all().order_by("order"):
            steps_data.append(
                {
                    "id": str(step.id),
                    "name": step.step_name or step.entity_type.replace("_", " ").title(),
                    "entity_type": step.entity_type,
                    "order": step.order,
                }
            )

        return Response(
            {
                "form_id": str(form_id),
                "form_name": form.name,
                "steps": steps_data,
                "mappings": mappings,
                "count": len(mappings),
            }
        )


class FormAutoMapAPIView(APIView):
    """
    API endpoint for computing and applying auto-mappings.
    Uses fuzzy matching to suggest field mappings between steps.
    """

    permission_classes = [IsAdminUser]

    def get(self, request, form_id):
        """Compute auto-mapping suggestions without applying them."""
        from .services import FieldMappingService

        tenant, error = _require_tenant(request)
        if error:
            return error

        try:
            form = TenantForm.objects.prefetch_related("entities").get(pk=form_id, tenant=tenant)
        except TenantForm.DoesNotExist:
            return Response({"error": "Form not found"}, status=status.HTTP_404_NOT_FOUND)

        min_score = float(request.query_params.get("min_score", 50.0))
        suggestions = FieldMappingService.compute_auto_mappings(form, min_score)

        return Response({"form_id": str(form_id), "suggestions": suggestions, "count": len(suggestions)})

    def post(self, request, form_id):
        """Apply auto-mappings (either suggested or provided)."""
        from .services import FieldMappingService

        tenant, error = _require_tenant(request)
        if error:
            return error

        try:
            form = TenantForm.objects.prefetch_related("entities").get(pk=form_id, tenant=tenant)
        except TenantForm.DoesNotExist:
            return Response({"error": "Form not found"}, status=status.HTTP_404_NOT_FOUND)

        # If mappings are provided, use those; otherwise compute them
        mappings = request.data.get("mappings")
        if not mappings:
            min_score = float(request.data.get("min_score", 50.0))
            mappings = FieldMappingService.compute_auto_mappings(form, min_score)

        result = FieldMappingService.apply_auto_mappings(form, mappings)

        return Response(
            {
                "status": "success",
                "applied": result["applied"],
                "errors": result["errors"],
                "message": f"Applied {result['applied']} field mappings",
            }
        )


class FieldMappingAPIView(APIView):
    """
    API endpoint for managing a single field's mapping.
    """

    permission_classes = [IsAdminUser]

    def put(self, request, field_id):
        """Update a field's mapping."""
        from .services import FieldMappingService

        tenant, error = _require_tenant(request)
        if error:
            return error

        try:
            field = TenantFormField.objects.get(pk=field_id, tenant=tenant)
        except TenantFormField.DoesNotExist:
            return Response({"error": "Field not found"}, status=status.HTTP_404_NOT_FOUND)

        source_step_id = request.data.get("source_step_id")
        source_field_key = request.data.get("source_field_key")
        mode = request.data.get("mode", "copy")

        if source_step_id and source_field_key:
            success = FieldMappingService.apply_mapping(field, source_step_id, source_field_key, mode)
            if success:
                return Response({"status": "success", "message": "Mapping applied"})
            else:
                return Response({"error": "Failed to apply mapping"}, status=status.HTTP_400_BAD_REQUEST)
        else:
            return Response(
                {"error": "source_step_id and source_field_key are required"}, status=status.HTTP_400_BAD_REQUEST
            )

    def delete(self, request, field_id):
        """Remove a field's mapping."""
        from .services import FieldMappingService

        tenant, error = _require_tenant(request)
        if error:
            return error

        try:
            field = TenantFormField.objects.get(pk=field_id, tenant=tenant)
        except TenantFormField.DoesNotExist:
            return Response({"error": "Field not found"}, status=status.HTTP_404_NOT_FOUND)

        FieldMappingService.remove_mapping(field)

        return Response({"status": "success", "message": "Mapping removed"})


class FormRulesAPIView(APIView):
    """
    API endpoint for managing form conditional rules.
    Used by the rule builder in the form builder admin interface.
    """

    permission_classes = [IsAdminUser]

    def get(self, request, form_id):
        """Get all rules for a form with step/field context."""
        tenant, error = _require_tenant(request)
        if error:
            return error

        try:
            form = TenantForm.objects.prefetch_related("entities", "rules").get(pk=form_id, tenant=tenant)
        except TenantForm.DoesNotExist:
            return Response({"error": "Form not found"}, status=status.HTTP_404_NOT_FOUND)

        # Get all steps with their fields for condition/action selection
        steps_data = []
        for step in form.entities.all().order_by("order"):
            fields = get_entity_fields(step.entity_type)
            steps_data.append(
                {
                    "id": str(step.id),
                    "name": step.step_name or step.entity_type.replace("_", " ").title(),
                    "entity_type": step.entity_type,
                    "order": step.order,
                    "fields": fields,
                }
            )

        # Get existing rules
        rules_data = []
        for rule in form.rules.all().order_by("order"):
            rules_data.append(
                {
                    "id": str(rule.id),
                    "name": rule.name,
                    "is_active": rule.is_active,
                    "order": rule.order,
                    "conditions": rule.conditions,
                    "condition_logic": rule.condition_logic,
                    "actions": rule.actions,
                }
            )

        return Response(
            {
                "form_id": str(form_id),
                "form_name": form.name,
                "steps": steps_data,
                "rules": rules_data,
            }
        )

    def post(self, request, form_id):
        """Create a new rule for a form."""
        tenant, error = _require_tenant(request)
        if error:
            return error

        try:
            form = TenantForm.objects.get(pk=form_id, tenant=tenant)
        except TenantForm.DoesNotExist:
            return Response({"error": "Form not found"}, status=status.HTTP_404_NOT_FOUND)

        # Get next order (handle None when no rules exist, but 0 is valid)
        max_order = form.rules.aggregate(max_order=Max("order"))["max_order"]
        next_order = 0 if max_order is None else max_order + 1

        rule = TenantFormRule.objects.create(
            form=form,
            name=request.data.get("name", ""),
            is_active=request.data.get("is_active", True),
            order=next_order,
            conditions=request.data.get("conditions", []),
            condition_logic=request.data.get("condition_logic", "and"),
            actions=request.data.get("actions", []),
        )

        return Response(
            {
                "status": "success",
                "message": "Rule created",
                "rule_id": str(rule.id),
                "order": rule.order,
            },
            status=status.HTTP_201_CREATED,
        )


class FormRuleDetailAPIView(APIView):
    """
    API endpoint for managing individual form rules.
    """

    permission_classes = [IsAdminUser]

    def get(self, request, rule_id):
        """Get a single rule."""
        tenant, error = _require_tenant(request)
        if error:
            return error

        try:
            rule = TenantFormRule.objects.select_related("form").get(pk=rule_id, tenant=tenant)
        except TenantFormRule.DoesNotExist:
            return Response({"error": "Rule not found"}, status=status.HTTP_404_NOT_FOUND)

        return Response(
            {
                "id": str(rule.id),
                "form_id": str(rule.form.id),
                "name": rule.name,
                "is_active": rule.is_active,
                "order": rule.order,
                "conditions": rule.conditions,
                "condition_logic": rule.condition_logic,
                "actions": rule.actions,
            }
        )

    def put(self, request, rule_id):
        """Update a rule."""
        tenant, error = _require_tenant(request)
        if error:
            return error

        try:
            rule = TenantFormRule.objects.get(pk=rule_id, tenant=tenant)
        except TenantFormRule.DoesNotExist:
            return Response({"error": "Rule not found"}, status=status.HTTP_404_NOT_FOUND)

        if "name" in request.data:
            rule.name = request.data["name"]
        if "is_active" in request.data:
            rule.is_active = request.data["is_active"]
        if "conditions" in request.data:
            rule.conditions = request.data["conditions"]
        if "condition_logic" in request.data:
            rule.condition_logic = request.data["condition_logic"]
        if "actions" in request.data:
            rule.actions = request.data["actions"]

        rule.save()

        return Response(
            {
                "status": "success",
                "message": "Rule updated",
                "rule_id": str(rule_id),
            }
        )

    def delete(self, request, rule_id):
        """Delete a rule."""
        tenant, error = _require_tenant(request)
        if error:
            return error

        try:
            rule = TenantFormRule.objects.get(pk=rule_id, tenant=tenant)
        except TenantFormRule.DoesNotExist:
            return Response({"error": "Rule not found"}, status=status.HTTP_404_NOT_FOUND)

        rule.delete()

        return Response(
            {
                "status": "success",
                "message": "Rule deleted",
            }
        )


class TenantFilteredModelViewSet(viewsets.ModelViewSet):
    """Base ViewSet that filters by tenant.

    Note: With PostgreSQL RLS enabled, many tenant-scoped tables rely on the
    `app.current_tenant` session var. Middleware normally sets it, but we also
    set it here (best-effort) to avoid 500s during serializer validation or
    read paths when the session var isn't present.
    """

    permission_classes = [IsAuthenticated]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        tenant = getattr(request, "tenant", None)
        if tenant:
            self._ensure_rls_session_vars(str(tenant.id))

    def get_queryset(self):
        """Filter queryset by current tenant."""
        qs = super().get_queryset()
        if hasattr(self.request, "tenant") and self.request.tenant:
            return qs.filter(tenant=self.request.tenant)
        return qs.none()

    def _ensure_rls_session_vars(self, tenant_id: str) -> None:
        """Best-effort: (re)set Postgres session vars used by RLS.

        TenantMiddleware normally sets these, but on write paths we re-assert
        them to avoid "new row violates row-level security policy" 500s if the
        middleware couldn't set them earlier.
        """

        from apps.tenants.rls import set_current_tenant

        result = set_current_tenant(tenant_id)
        if not result.ok:
            logger.warning(
                "RLS: failed to set session vars for tenant=%s: %s",
                tenant_id,
                result.error,
            )

    def perform_create(self, serializer):
        """Set tenant and created_by on create.

        Important: tenant context is mandatory for all tenant-scoped models.
        Without this, the DB unique constraints / RLS can surface as 500s.
        """
        tenant = getattr(self.request, "tenant", None)
        if not tenant:
            raise ValidationError({"tenant": "Tenant context is required (X-Tenant-ID header)."})

        self._ensure_rls_session_vars(str(tenant.id))

        save_kwargs = {"tenant": tenant}

        if hasattr(serializer.Meta.model, "created_by") and getattr(self.request, "user", None):
            save_kwargs["created_by"] = self.request.user

        serializer.save(**save_kwargs)

    def perform_update(self, serializer):
        tenant = getattr(self.request, "tenant", None)
        if tenant:
            self._ensure_rls_session_vars(str(tenant.id))
        serializer.save()

    def perform_destroy(self, instance):
        tenant = getattr(self.request, "tenant", None)
        if tenant:
            self._ensure_rls_session_vars(str(tenant.id))
        instance.delete()


# =============================================================================
# TENANT LIST VIEWS
# =============================================================================


class TenantListViewSet(TenantFilteredModelViewSet):
    """API endpoint for Tenant Lists.

    Tenant-specific option lists for dropdown/multi-select fields.
    """

    queryset = TenantList.objects.all()
    serializer_class = TenantListSerializer
    permission_classes = [IsTenantAdminOrOwnerOrReadOnly]

    def perform_create(self, serializer):
        """Ensure tenant + created_by are always set on create.

        This prevents NOT NULL/unique/RLS failures surfacing as 500s.
        """
        tenant = getattr(self.request, 'tenant', None)
        if not tenant:
            raise ValidationError({"tenant": "Tenant context is required (X-Tenant-ID header)."})

        self._ensure_rls_session_vars(str(tenant.id))

        user = getattr(self.request, 'user', None)
        if user and getattr(user, 'is_authenticated', False):
            serializer.save(tenant=tenant, created_by=user)
        else:
            serializer.save(tenant=tenant)

    def create(self, request, *args, **kwargs):
        """Create list with a friendly error instead of 500 on IntegrityError."""

        tenant = getattr(request, 'tenant', None)
        if tenant:
            # Assert RLS vars before DRF validation/save (defense-in-depth).
            self._ensure_rls_session_vars(str(tenant.id))

        try:
            return super().create(request, *args, **kwargs)
        except IntegrityError:
            return Response(
                {"error": "A custom list with this name already exists for this tenant."},
                status=status.HTTP_409_CONFLICT,
            )

    def get_queryset(self):
        qs = super().get_queryset()

        # Filter by active status
        if self.request.query_params.get("active_only"):
            qs = qs.filter(is_active=True)

        return qs.order_by("name")

    @action(detail=False, methods=["get"])
    def search(self, request):
        """Search lists by name."""
        query = request.query_params.get("q", "")
        qs = self.get_queryset().filter(name__icontains=query)[:20]
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)


# =============================================================================
# TENANT FORM VIEWS
# =============================================================================


class TenantFormViewSet(TenantFilteredModelViewSet):
    """
    API endpoint for Tenant Forms.

    NOTE (Phase 7): Creation via POST /api/v1/workflows/forms/ is deprecated.
    WorkForms persistence is now handled via /api/v1/tenant-workforms/.

    Custom forms that tenants can create for entity record creation/editing.

    Phase 4.2: Uses role-based permissions:
    - owner/admin: Full access
    - manager: Can edit own forms only
    - user/readonly: Read-only access
    """

    queryset = TenantForm.objects.all()

    def get_permissions(self):
        """
        Dynamically set permissions based on action.
        """
        if self.action in ["create"]:
            permission_classes = [IsAuthenticated, CanEditWorkForm]
        elif self.action in ["update", "partial_update", "destroy"]:
            permission_classes = [IsAuthenticated, CanEditWorkForm]
        elif self.action in ["activate", "deactivate", "set_default"]:
            permission_classes = [IsAuthenticated, CanPublishWorkForm]
        else:
            # list, retrieve, preview - any authenticated user
            permission_classes = [IsAuthenticated]

        return [permission() for permission in permission_classes]

    def get_serializer_class(self):
        if self.action == "create":
            return TenantFormCreateSerializer
        return TenantFormSerializer

    def create(self, request, *args, **kwargs):
        """Deprecated endpoint.

        Legacy frontend code attempted to persist WorkForms (workflow graphs) by POSTing
        to `/api/v1/workflows/forms/`. WorkForms are saved via `/api/v1/tenant-workforms/`.

        We return 410 to make the failure mode explicit and stable.
        """
        return Response(
            {
                "error": "deprecated_endpoint",
                "detail": "POST /api/v1/workflows/forms/ is deprecated. Save WorkForms via /api/v1/tenant-workforms/ instead.",
                "recommended": {
                    "method": "PUT",
                    "path": "/api/v1/tenant-workforms/{id}/",
                    "field": "workflow_definition",
                },
            },
            status=status.HTTP_410_GONE,
        )

    def get_queryset(self):
        qs = super().get_queryset()

        # Prefetch related data for efficiency
        qs = qs.prefetch_related(
            Prefetch("entities", queryset=TenantFormEntity.objects.order_by("order")),
            Prefetch("rules", queryset=TenantFormRule.objects.order_by("order")),
        ).annotate(_entity_count=Count("entities"))

        # Filter by status
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)

        # Filter by entity type (for finding forms that include a specific entity)
        entity_type = self.request.query_params.get("entity_type")
        if entity_type:
            qs = qs.filter(entities__entity_type=entity_type).distinct()

        # Filter for default forms only
        if self.request.query_params.get("default_only"):
            qs = qs.filter(is_default=True)

        return qs.order_by("-is_default", "name")

    @action(detail=True, methods=["post"])
    def activate(self, request, pk=None):
        """Activate a form."""
        form = self.get_object()
        form.status = FormStatus.ACTIVE
        form.is_quick_action_enabled = True
        form.save(update_fields=["status", "is_quick_action_enabled", "updated_at"])
        return Response({"status": "activated"})

    @action(detail=True, methods=["post"])
    def deactivate(self, request, pk=None):
        """Deactivate a form."""
        form = self.get_object()
        form.status = FormStatus.INACTIVE
        form.save(update_fields=["status", "updated_at"])
        return Response({"status": "deactivated"})

    @action(detail=True, methods=["post"])
    def set_default(self, request, pk=None):
        """Set a form as the default for its entity type."""
        form = self.get_object()

        # Only single-entity forms can be default
        if form.entities.count() != 1:
            return Response(
                {"error": "Only single-entity forms can be set as default"}, status=status.HTTP_400_BAD_REQUEST
            )

        entity_type = form.entities.first().entity_type

        # Clear other defaults for this entity type
        TenantForm.objects.filter(tenant=request.tenant, is_default=True, entities__entity_type=entity_type).update(
            is_default=False
        )

        form.is_default = True
        form.save(update_fields=["is_default", "updated_at"])

        return Response({"status": "set_as_default", "entity_type": entity_type})

    @action(detail=True, methods=["get"])
    def preview(self, request, pk=None):
        """Get form structure for preview/rendering."""
        form = self.get_object()

        # Build form structure with ordered entities and fields
        entities_data = []
        for entity in form.entities.order_by("order"):
            fields_data = []
            for field in entity.fields.filter(is_visible=True).order_by("order"):
                fields_data.append(
                    {
                        "key": field.field_key,
                        "label": field.custom_label,
                        "help_text": field.custom_help_text,
                        "required": field.is_required,
                        "default_value": field.default_value,
                    }
                )

            entities_data.append(
                {
                    "entity_type": entity.entity_type,
                    "step_name": entity.step_name or entity.entity_type.title(),
                    "fields": fields_data,
                }
            )

        # Get active rules
        rules_data = []
        for rule in form.rules.filter(is_active=True).order_by("order"):
            rules_data.append(
                {
                    "name": rule.name,
                    "conditions": rule.conditions,
                    "condition_logic": rule.condition_logic,
                    "actions": rule.actions,
                }
            )

        return Response(
            {
                "id": form.id,
                "name": form.name,
                "description": form.description,
                "is_multi_step": len(entities_data) > 1,
                "entities": entities_data,
                "rules": rules_data,
            }
        )

    def perform_create(self, serializer):
        """
        Override create to sync FormProcessGroup nodes if flow_data is provided.
        
        Agent B: FormProcessGroup Persistence
        """
        form = serializer.save(tenant=self.request.tenant, created_by=self.request.user)
        
        # Check if flow_data contains FormProcessGroup nodes
        flow_data = form.flow_data
        if flow_data and flow_data.get('nodes'):
            try:
                service = FormProcessPersistenceService(
                    tenant=self.request.tenant,
                    user=self.request.user
                )
                result = service.sync_from_workflow(flow_data)
                
                if not result['success']:
                    logger.warning(f"FormProcessGroup sync had errors: {result['errors']}")
            except Exception as e:
                logger.error(f"Failed to sync FormProcessGroup nodes: {e}", exc_info=True)
    
    def perform_update(self, serializer):
        """
        Override update to sync FormProcessGroup nodes if flow_data is provided.
        
        Agent B: FormProcessGroup Persistence
        """
        form = serializer.save()
        
        # Check if flow_data contains FormProcessGroup nodes
        flow_data = form.flow_data
        if flow_data and flow_data.get('nodes'):
            try:
                service = FormProcessPersistenceService(
                    tenant=self.request.tenant,
                    user=self.request.user
                )
                result = service.sync_from_workflow(flow_data)
                
                if not result['success']:
                    logger.warning(f"FormProcessGroup sync had errors: {result['errors']}")
            except Exception as e:
                logger.error(f"Failed to sync FormProcessGroup nodes: {e}", exc_info=True)
    
    @action(detail=True, methods=['post'], url_path='enable-versioning')
    def enable_versioning(self, request, pk=None):
        """
        Enable version control for a form (Phase 2.4).
        
        Creates initial version snapshot.
        
        POST /api/v1/forms/{form_id}/enable-versioning/
        
        Returns:
            200: {"version_number": 1, "message": "Versioning enabled"}
            400: {"error": "Versioning already enabled"}
        """
        from tenant_apps.workflows.services.versioning import FormVersionService
        
        form = self.get_object()
        
        try:
            version = FormVersionService.enable_versioning(form, user=request.user)
            return Response({
                'version_number': version.version_number,
                'message': 'Versioning enabled successfully'
            }, status=status.HTTP_200_OK)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'], url_path='create-version')
    def create_version(self, request, pk=None):
        """
        Create a new version snapshot (Phase 2.4).
        
        POST /api/v1/forms/{form_id}/create-version/
        Body: {"change_summary": "Added email notification field"}
        
        Returns:
            200: {"version_number": 2, "message": "Version created"}
            400: {"error": "Versioning not enabled"}
        """
        from tenant_apps.workflows.services.versioning import FormVersionService
        
        form = self.get_object()
        change_summary = request.data.get('change_summary', '')
        
        try:
            version = FormVersionService.create_version(
                form=form,
                change_summary=change_summary,
                user=request.user
            )
            return Response({
                'version_number': version.version_number,
                'message': 'Version created successfully'
            }, status=status.HTTP_200_OK)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'], url_path='rollback')
    def rollback(self, request, pk=None):
        """
        Rollback form to a previous version (Phase 2.4).
        
        POST /api/v1/forms/{form_id}/rollback/
        Body: {"version_number": 3}
        
        Returns:
            200: {"version_number": 5, "message": "Rolled back to version 3"}
            400: {"error": "Version not found"}
        """
        from tenant_apps.workflows.services.versioning import FormVersionService
        
        form = self.get_object()
        version_number = request.data.get('version_number')
        
        if not version_number:
            return Response(
                {'error': 'version_number is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            new_version = FormVersionService.rollback_to_version(
                form=form,
                version_number=int(version_number),
                user=request.user
            )
            return Response({
                'version_number': new_version.version_number,
                'message': f'Rolled back to version {version_number}'
            }, status=status.HTTP_200_OK)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['get'], url_path='version-history')
    def version_history(self, request, pk=None):
        """
        Get version history for a form (Phase 2.4).
        
        GET /api/v1/forms/{form_id}/version-history/
        
        Returns:
            200: [{"version_number": 3, "change_summary": "...", ...}, ...]
        """
        from tenant_apps.workflows.services.versioning import FormVersionService
        
        form = self.get_object()
        history = FormVersionService.get_version_history(form)
        
        return Response(history, status=status.HTTP_200_OK)
    
    @action(detail=True, methods=['get'], url_path='compare-versions')
    def compare_versions(self, request, pk=None):
        """
        Compare two versions (Phase 2.4).
        
        GET /api/v1/forms/{form_id}/compare-versions/?version_a=1&version_b=3
        
        Returns:
            200: {"name": {"old": "...", "new": "..."}, ...}
            400: {"error": "Missing parameters"}
        """
        from tenant_apps.workflows.services.versioning import FormVersionService
        
        form = self.get_object()
        version_a = request.query_params.get('version_a')
        version_b = request.query_params.get('version_b')
        
        if not version_a or not version_b:
            return Response(
                {'error': 'version_a and version_b are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            diff = FormVersionService.compare_versions(
                form=form,
                version_a=int(version_a),
                version_b=int(version_b)
            )
            return Response(diff, status=status.HTTP_200_OK)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class TenantFormEntityViewSet(viewsets.ModelViewSet):
    """
    API endpoint for Form Entities (steps in multi-step forms).
    """

    queryset = TenantFormEntity.objects.all()
    serializer_class = TenantFormEntitySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        tenant = _get_request_tenant(self.request)
        if not tenant:
            return qs.none()

        qs = qs.filter(form__tenant=tenant)

        # Filter by form
        form_id = self.request.query_params.get("form")
        if form_id:
            qs = qs.filter(form_id=form_id)

        return qs.prefetch_related(Prefetch("fields", queryset=TenantFormField.objects.order_by("order"))).order_by(
            "order"
        )

    def create(self, request, *args, **kwargs):
        tenant, error = _require_tenant(request)
        if error:
            return error
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        tenant = _get_request_tenant(self.request)
        if not tenant:
            raise ValidationError({'tenant': 'Tenant context is required (X-Tenant-ID header).'})

        form = serializer.validated_data.get('form')
        if form is not None and getattr(form, 'tenant_id', None) != tenant.id:
            raise ValidationError({'form': 'Form must belong to the current tenant.'})

        serializer.save(tenant=tenant)

    @action(detail=True, methods=["post"])
    def reorder_fields(self, request, pk=None):
        """Reorder fields within an entity."""
        entity = self.get_object()
        field_order = request.data.get("field_order", [])  # List of field IDs in order

        for index, field_id in enumerate(field_order):
            TenantFormField.objects.filter(id=field_id, form_entity=entity).update(order=index)

        return Response({"status": "reordered"})


class TenantFormFieldViewSet(viewsets.ModelViewSet):
    """
    API endpoint for Form Fields.
    """

    queryset = TenantFormField.objects.all()
    serializer_class = TenantFormFieldSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        tenant = _get_request_tenant(self.request)
        if not tenant:
            return qs.none()

        qs = qs.filter(form_entity__form__tenant=tenant)

        # Filter by entity
        entity_id = self.request.query_params.get("entity")
        if entity_id:
            qs = qs.filter(form_entity_id=entity_id)

        return qs.order_by("order")

    def create(self, request, *args, **kwargs):
        tenant, error = _require_tenant(request)
        if error:
            return error
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        tenant = _get_request_tenant(self.request)
        if not tenant:
            raise ValidationError({'tenant': 'Tenant context is required (X-Tenant-ID header).'})

        entity = serializer.validated_data.get('form_entity')
        form = getattr(entity, 'form', None) if entity is not None else None
        if form is not None and getattr(form, 'tenant_id', None) != tenant.id:
            raise ValidationError({'form_entity': 'Form entity must belong to the current tenant.'})

        serializer.save(tenant=tenant)

    @action(detail=True, methods=['get'], url_path='cascade-options')
    def cascade_options(self, request, pk=None):
        """
        Get cascaded options for a field based on parent field value.
        
        Phase 2.3: Entity Cascading
        
        Query Parameters:
            parent_value: Value selected in parent field
            
        Example:
            GET /api/v1/form-fields/{field_id}/cascade-options/?parent_value=Beef
            
        Returns:
            200: [{"value": "...", "label": "..."}, ...]
            400: {"error": "Missing parent_value parameter"}
            404: {"error": "Field not found or cascading not enabled"}
        """
        from tenant_apps.workflows.services.cascading import CascadingFieldService

        tenant = _get_request_tenant(request)
        if not tenant:
            return Response(
                {"error": "Tenant context is required (X-Tenant-ID header)"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        field = self.get_object()
        parent_value = request.query_params.get('parent_value')
        
        if not parent_value:
            return Response(
                {"error": "Missing required parameter: parent_value"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not field.cascade_enabled:
            return Response(
                {"error": f"Field {field.field_key} does not have cascading enabled"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        try:
            options = CascadingFieldService.get_cascaded_options(
                field=field,
                parent_value=parent_value,
                tenant_id=str(tenant.id)
            )
            return Response(options, status=status.HTTP_200_OK)
        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class TenantFormRuleViewSet(viewsets.ModelViewSet):
    """
    API endpoint for Form Rules (conditional logic).
    """

    queryset = TenantFormRule.objects.all()
    serializer_class = TenantFormRuleSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        tenant = _get_request_tenant(self.request)
        if not tenant:
            return qs.none()

        qs = qs.filter(form__tenant=tenant)

        # Filter by form
        form_id = self.request.query_params.get("form")
        if form_id:
            qs = qs.filter(form_id=form_id)

        return qs.order_by("order")

    def create(self, request, *args, **kwargs):
        tenant, error = _require_tenant(request)
        if error:
            return error
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        tenant = _get_request_tenant(self.request)
        if not tenant:
            raise ValidationError({'tenant': 'Tenant context is required (X-Tenant-ID header).'})

        form = serializer.validated_data.get('form')
        if form is not None and getattr(form, 'tenant_id', None) != tenant.id:
            raise ValidationError({'form': 'Form must belong to the current tenant.'})

        serializer.save(tenant=tenant)


# =============================================================================
# TENANT WORKFLOW VIEWS
# =============================================================================


class TenantWorkflowViewSet(TenantFilteredModelViewSet):
    """API endpoint for Tenant Workflows.

    Automation rules with triggers and actions.
    """

    queryset = TenantWorkflow.objects.all()
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == "create":
            return TenantWorkflowCreateSerializer
        return TenantWorkflowSerializer

    def get_queryset(self):
        qs = super().get_queryset()

        # Prefetch related data
        qs = qs.prefetch_related(
            Prefetch("conditions", queryset=TenantWorkflowCondition.objects.order_by("order")),
            Prefetch("actions", queryset=TenantWorkflowAction.objects.order_by("order")),
        )

        # Filter by status
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)

        # Filter by trigger type
        trigger_type = self.request.query_params.get("trigger_type")
        if trigger_type:
            qs = qs.filter(trigger_type=trigger_type)

        # Filter by entity type
        entity_type = self.request.query_params.get("entity_type")
        if entity_type:
            qs = qs.filter(entity_type=entity_type)

        return qs.order_by("name")

    @action(detail=True, methods=["post"])
    def activate(self, request, pk=None):
        """Activate a workflow."""
        workflow = self.get_object()
        workflow.status = WorkflowStatus.ACTIVE
        workflow.save(update_fields=["status", "updated_at"])
        return Response({"status": "activated"})

    @action(detail=True, methods=["post"])
    def pause(self, request, pk=None):
        """Pause a workflow."""
        workflow = self.get_object()
        workflow.status = WorkflowStatus.PAUSED
        workflow.save(update_fields=["status", "updated_at"])
        return Response({"status": "paused"})

    @action(detail=True, methods=["post"])
    def deactivate(self, request, pk=None):
        """Deactivate a workflow."""
        workflow = self.get_object()
        workflow.status = WorkflowStatus.INACTIVE
        workflow.save(update_fields=["status", "updated_at"])
        return Response({"status": "deactivated"})

    @action(detail=True, methods=["post"])
    def run(self, request, pk=None):
        """Manually run a workflow."""
        workflow = self.get_object()

        if workflow.status != WorkflowStatus.ACTIVE:
            return Response({"error": "Workflow must be active to run"}, status=status.HTTP_400_BAD_REQUEST)

        # Create execution log
        log = WorkflowExecutionLog.objects.create(
            workflow=workflow,
            trigger_type="manual",
            trigger_data={"triggered_by": request.user.id},
            triggered_by=request.user,
            status="started",
        )

        # Note: Full workflow execution engine integration planned for Wave 4 (Admin Studio)
        # Currently logs execution and updates stats
        log.status = "success"
        log.completed_at = timezone.now()
        log.save()

        # Update workflow stats
        workflow.run_count += 1
        workflow.last_run_at = timezone.now()
        workflow.save(update_fields=["run_count", "last_run_at"])

        return Response({"status": "executed", "execution_id": str(log.id)})

    @action(detail=True, methods=["get"])
    def logs(self, request, pk=None):
        """Get execution logs for a workflow."""
        workflow = self.get_object()
        logs = WorkflowExecutionLog.objects.filter(workflow=workflow).order_by("-started_at")[:50]
        serializer = WorkflowExecutionLogSerializer(logs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def active_for_entity(self, request):
        """
        Get active workflows that should be triggered for a specific entity event.

        Query params:
        - entity_type: The type of entity (e.g., 'customer', 'supplier')
        - trigger: The trigger type (e.g., 'record_created', 'record_updated')
        """
        entity_type = request.query_params.get("entity_type")
        trigger = request.query_params.get("trigger")

        if not entity_type or not trigger:
            return Response({"error": "entity_type and trigger are required"}, status=status.HTTP_400_BAD_REQUEST)

        workflows = self.get_queryset().filter(
            status=WorkflowStatus.ACTIVE, entity_type=entity_type, trigger_type=trigger
        )

        serializer = self.get_serializer(workflows, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["get"])
    def analytics(self, request, pk=None):
        """
        Get comprehensive analytics for a workflow.
        
        Query params:
        - timeframe: '7d', '30d', '90d' (default: 30d)
        - start_date: ISO 8601 datetime
        - end_date: ISO 8601 datetime
        """
        from datetime import timedelta
        from django.db.models import Avg, Count, Q
        from django.db.models.functions import TruncDate, TruncHour
        from django.utils import timezone
        
        workflow = self.get_object()
        
        # Parse date range
        timeframe = request.query_params.get('timeframe', '30d')
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        
        if start_date and end_date:
            from dateutil import parser
            start = parser.isoparse(start_date)
            end = parser.isoparse(end_date)
        else:
            days_map = {'7d': 7, '30d': 30, '90d': 90}
            days = days_map.get(timeframe, 30)
            end = timezone.now()
            start = end - timedelta(days=days)
        
        # Base queryset
        logs = WorkflowExecutionLog.objects.filter(
            workflow=workflow,
            started_at__gte=start,
            started_at__lte=end
        )
        
        # Aggregate metrics
        total_executions = logs.count()
        successful = logs.filter(status='success').count()
        failed = logs.filter(status='failed').count()
        avg_duration = logs.filter(
            completed_at__isnull=False
        ).aggregate(
            avg_duration=Avg(
                (F('completed_at') - F('started_at'))
            )
        )['avg_duration']
        
        # Convert avg_duration to seconds
        avg_duration_seconds = 0
        if avg_duration:
            avg_duration_seconds = avg_duration.total_seconds()
        
        # Success rate
        success_rate = (successful / total_executions * 100) if total_executions > 0 else 0
        
        # Executions by day
        executions_by_day = logs.annotate(
            date=TruncDate('started_at')
        ).values('date').annotate(
            count=Count('id'),
            successful=Count('id', filter=Q(status='success')),
            failed=Count('id', filter=Q(status='failed'))
        ).order_by('date')
        
        # Executions by hour
        executions_by_hour = logs.annotate(
            hour=TruncHour('started_at')
        ).values('hour').annotate(
            count=Count('id')
        ).order_by('hour')[:24]
        
        # Action performance (mock data for now - would need action-level tracking)
        action_performance = []
        for action in workflow.actions.all()[:10]:
            action_performance.append({
                'action_type': action.action_type,
                'count': total_executions,  # Would track per-action
                'avg_duration': avg_duration_seconds / workflow.actions.count() if workflow.actions.exists() else 0,
                'success_rate': success_rate
            })
        
        # Error breakdown
        error_breakdown = logs.filter(
            status='failed'
        ).values('error_message').annotate(
            count=Count('id')
        ).order_by('-count')[:5]
        
        total_errors = sum(e['count'] for e in error_breakdown)
        for error in error_breakdown:
            error['error_type'] = error.pop('error_message') or 'Unknown Error'
            error['percentage'] = (error['count'] / total_errors * 100) if total_errors > 0 else 0
        
        return Response({
            'total_executions': total_executions,
            'successful_executions': successful,
            'failed_executions': failed,
            'avg_duration_seconds': avg_duration_seconds,
            'success_rate': success_rate,
            'executions_by_day': list(executions_by_day),
            'executions_by_hour': [
                {'hour': h['hour'].hour, 'count': h['count']}
                for h in executions_by_hour
            ],
            'action_performance': action_performance,
            'error_breakdown': list(error_breakdown)
        })
    
    @action(detail=True, methods=["post"])
    def export_template(self, request, pk=None):
        """
        Export workflow as a reusable template.
        
        Returns JSON template that can be imported by other tenants.
        """
        
        workflow = self.get_object()
        
        # Build template structure
        template = {
            'name': workflow.name,
            'description': workflow.description,
            'trigger_type': workflow.trigger_type,
            'entity_type': workflow.entity_type,
            'nodes': [],
            'edges': [],
            'variables': workflow.variables or {},
            'metadata': {
                'exported_at': timezone.now().isoformat(),
                'version': '1.0',
                'author': request.user.email if request.user else 'system'
            }
        }
        
        # Add conditions
        for condition in workflow.conditions.all():
            template['nodes'].append({
                'id': f'condition-{condition.id}',
                'type': 'condition',
                'data': {
                    'field': condition.field,
                    'operator': condition.operator,
                    'value': condition.value,
                    'logic': condition.logic
                }
            })
        
        # Add actions
        for action in workflow.actions.all():
            template['nodes'].append({
                'id': f'action-{action.id}',
                'type': action.action_type,
                'data': {
                    'config': action.config,
                    'order': action.order
                }
            })
        
        return Response(template)
    
    @action(detail=False, methods=["post"])
    def import_template(self, request):
        """
        Import a workflow from a template.
        
        Expected JSON body:
        {
            "template": {...},  # Template from export_template
            "name": "My Workflow",  # Optional override
            "activate": false  # Whether to activate immediately
        }
        """
        
        template = request.data.get('template')
        name_override = request.data.get('name')
        activate = request.data.get('activate', False)
        
        if not template:
            return Response(
                {'error': 'Template is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create workflow
        workflow_data = {
            'name': name_override or template.get('name', 'Imported Workflow'),
            'description': template.get('description', ''),
            'trigger_type': template.get('trigger_type'),
            'entity_type': template.get('entity_type'),
            'variables': template.get('variables', {}),
            'status': WorkflowStatus.ACTIVE if activate else WorkflowStatus.DRAFT,
            'tenant': request.tenant
        }
        
        with transaction.atomic():
            workflow = TenantWorkflow.objects.create(**workflow_data)
            
            # Import nodes
            node_mapping = {}  # Map template IDs to new IDs
            
            for node in template.get('nodes', []):
                node_type = node.get('type')
                node_data = node.get('data', {})
                
                if node_type == 'condition':
                    condition = TenantWorkflowCondition.objects.create(
                        workflow=workflow,
                        field=node_data.get('field'),
                        operator=node_data.get('operator'),
                        value=node_data.get('value'),
                        logic=node_data.get('logic', 'AND')
                    )
                    node_mapping[node['id']] = f'condition-{condition.id}'
                    
                elif node_type in ['email', 'webhook', 'update_record', 'create_record']:
                    action = TenantWorkflowAction.objects.create(
                        workflow=workflow,
                        action_type=node_type,
                        config=node_data.get('config', {}),
                        order=node_data.get('order', 0)
                    )
                    node_mapping[node['id']] = f'action-{action.id}'
        
        serializer = self.get_serializer(workflow)
        return Response({
            'workflow': serializer.data,
            'node_mapping': node_mapping,
            'message': 'Workflow imported successfully'
        }, status=status.HTTP_201_CREATED)


class TenantWorkflowConditionViewSet(viewsets.ModelViewSet):
    """
    API endpoint for Workflow Conditions.
    """

    queryset = TenantWorkflowCondition.objects.all()
    serializer_class = TenantWorkflowConditionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        tenant = _get_request_tenant(self.request)
        if not tenant:
            return qs.none()

        qs = qs.filter(workflow__tenant=tenant)

        workflow_id = self.request.query_params.get("workflow")
        if workflow_id:
            qs = qs.filter(workflow_id=workflow_id)

        return qs.order_by("order")

    def create(self, request, *args, **kwargs):
        tenant, error = _require_tenant(request)
        if error:
            return error
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        tenant = _get_request_tenant(self.request)
        if not tenant:
            raise ValidationError({'tenant': 'Tenant context is required (X-Tenant-ID header).'})

        workflow = serializer.validated_data.get('workflow')
        if workflow is not None and getattr(workflow, 'tenant_id', None) != tenant.id:
            raise ValidationError({'workflow': 'Workflow must belong to the current tenant.'})

        serializer.save(tenant=tenant)


class TenantWorkflowActionViewSet(viewsets.ModelViewSet):
    """
    API endpoint for Workflow Actions.
    """

    queryset = TenantWorkflowAction.objects.all()
    serializer_class = TenantWorkflowActionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        tenant = _get_request_tenant(self.request)
        if not tenant:
            return qs.none()

        qs = qs.filter(workflow__tenant=tenant)

        workflow_id = self.request.query_params.get("workflow")
        if workflow_id:
            qs = qs.filter(workflow_id=workflow_id)

        return qs.order_by("order")

    def create(self, request, *args, **kwargs):
        tenant, error = _require_tenant(request)
        if error:
            return error
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        tenant = _get_request_tenant(self.request)
        if not tenant:
            raise ValidationError({'tenant': 'Tenant context is required (X-Tenant-ID header).'})

        workflow = serializer.validated_data.get('workflow')
        if workflow is not None and getattr(workflow, 'tenant_id', None) != tenant.id:
            raise ValidationError({'workflow': 'Workflow must belong to the current tenant.'})

        serializer.save(tenant=tenant)


class WorkflowExecutionLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint for viewing Workflow Execution Logs.

    Read-only - logs are created by the workflow engine.
    """

    queryset = WorkflowExecutionLog.objects.all()
    serializer_class = WorkflowExecutionLogSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        tenant = getattr(self.request, "tenant", None)
        if not tenant:
            return qs.none()

        qs = qs.filter(workflow__tenant=tenant)

        # Filter by workflow
        workflow_id = self.request.query_params.get("workflow")
        if workflow_id:
            qs = qs.filter(workflow_id=workflow_id)

        # Filter by status
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)

        return qs.select_related("workflow", "triggered_by").order_by("-started_at")


# =============================================================================
# FORM SUBMISSION API VIEWS
# =============================================================================

from .serializers import (
    AvailableFormSerializer,
    AvailableQuickActionTargetSerializer,
    FormSubmissionAutoSaveSerializer,
    FormSubmissionCreateSerializer,
    FormSubmissionDetailSerializer,
    FormSubmissionListSerializer,
    QuickActionsGetResponseSerializer,
    QuickActionsPutResponseSerializer,
    QuickActionsSerializer,
    TenantWorkFormExecutionSerializer,
)


class TenantWorkFormExecutionViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only list of TenantWorkForm executions.

    Backing model: tenant_apps.workflows.models.TenantWorkFormExecution
    WorkForm definitions live in apps.system.models.TenantWorkForm.
    """

    permission_classes = [IsAuthenticated]
    serializer_class = TenantWorkFormExecutionSerializer

    def get_queryset(self):
        from .models import TenantWorkFormExecution

        tenant = getattr(self.request, 'tenant', None)
        if not tenant:
            return TenantWorkFormExecution.objects.none()

        qs = TenantWorkFormExecution.objects.select_related('workform', 'started_by', 'tenant').filter(tenant=tenant)

        workform_id = (self.request.query_params.get('workform') or '').strip()
        if workform_id:
            qs = qs.filter(workform_id=workform_id)

        started_by = (self.request.query_params.get('started_by') or '').strip()
        if started_by:
            # Prevent user-id enumeration: allow started_by=me for all users; allow arbitrary IDs only for tenant admins.
            if started_by == 'me':
                qs = qs.filter(started_by=self.request.user)
            else:
                from apps.tenants.models import TenantUser

                is_tenant_admin = TenantUser.objects.filter(
                    tenant=tenant,
                    user=self.request.user,
                    is_active=True,
                    role__in=['owner', 'admin'],
                ).exists()
                if not is_tenant_admin:
                    return TenantWorkFormExecution.objects.none()

                qs = qs.filter(started_by_id=started_by)

        entity_type = (self.request.query_params.get('entity_type') or '').strip()
        if entity_type:
            qs = qs.filter(initial_data__entity_type=entity_type)

        entity_id = (self.request.query_params.get('entity_id') or '').strip()
        if entity_id:
            # initial_data is a JSONField; entity_id may be persisted as either a JSON string
            # ("1") or a JSON number (1) depending on the caller payload.
            entity_id_str = str(entity_id)
            entity_id_filter = Q(initial_data__entity_id=entity_id_str)
            try:
                entity_id_filter |= Q(initial_data__entity_id=int(entity_id_str))
            except (TypeError, ValueError):
                pass
            qs = qs.filter(entity_id_filter)

        status_param = self.request.query_params.get('status')
        if status_param:
            statuses = [s.strip() for s in status_param.split(',') if s.strip()]
            if statuses:
                qs = qs.filter(status__in=statuses)

        search = (self.request.query_params.get('search') or '').strip()
        if search:
            qs = qs.filter(workform__name__icontains=search)

        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')

        sd = parse_date(start_date) if start_date else None
        ed = parse_date(end_date) if end_date else None
        if sd:
            qs = qs.filter(created_on__date__gte=sd)
        if ed:
            qs = qs.filter(created_on__date__lte=ed)

        return qs.order_by('-created_on')


class FormSubmissionViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing form submissions.

    Endpoints:
    - GET /form-submissions/ - List user's submissions
    - POST /form-submissions/ - Create new submission
    - GET /form-submissions/{id}/ - Get submission details
    - PATCH /form-submissions/{id}/ - Update submission
    - DELETE /form-submissions/{id}/ - Cancel/delete submission
    - POST /form-submissions/{id}/auto-save/ - Auto-save field value
    - POST /form-submissions/{id}/complete-step/ - Mark step as complete
    - POST /form-submissions/{id}/submit/ - Final submission
    """

    permission_classes = [IsAuthenticated]

    def list(self, request, *args, **kwargs):
        """
        List submissions with bulletproof error handling.
        Returns empty list on any errors to prevent 500 responses.
        """
        try:
            return super().list(request, *args, **kwargs)
        except Exception as e:
            # Catch any serialization or database errors
            logger.error(f'[FormSubmission] Failed to list submissions: {str(e)}', exc_info=True)
            
            # Send to Sentry if configured
            try:
                import sentry_sdk
                sentry_sdk.capture_exception(e)
            except ImportError:
                pass  # Sentry not configured
            
            # Return empty list to prevent 500 error
            return Response({
                "count": 0,
                "next": None,
                "previous": None,
                "results": []
            }, status=status.HTTP_200_OK)

    def get_serializer_class(self):
        if self.action == "list":
            return FormSubmissionListSerializer
        elif self.action == "create":
            return FormSubmissionCreateSerializer
        return FormSubmissionDetailSerializer

    def create(self, request, *args, **kwargs):
        """
        Override create to return full submission details.
        Uses CreateSerializer for input validation, DetailSerializer for response.
        """
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()

        # Refresh with prefetched relations for detail response
        instance = (
            FormSubmission.objects.select_related("form", "created_by", "current_step")
            .prefetch_related("step_submissions__step", "step_submissions__completed_by")
            .get(pk=instance.pk)
        )

        # Return full details
        detail_serializer = FormSubmissionDetailSerializer(instance, context=self.get_serializer_context())
        headers = self.get_success_headers(detail_serializer.data)
        return Response(detail_serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def get_queryset(self):
        """
        Get submissions with bulletproof error handling.
        Returns empty queryset on any database/RLS errors to prevent 500 responses.
        """
        try:
            tenant = getattr(self.request, 'tenant', None)
            if not tenant:
                return FormSubmission.objects.none()

            qs = FormSubmission.objects.filter(tenant=tenant)

            # ------------------------------------------------------------------
            # Visibility / assignment filtering
            # ------------------------------------------------------------------
            assigned_to = (self.request.query_params.get("assigned_to") or '').strip()

            # Tenant role (used for admin checks + role-based assignments)
            try:
                from apps.tenants.models import TenantUser

                tenant_user = TenantUser.objects.filter(tenant=tenant, user=self.request.user, is_active=True).first()
                tenant_role = tenant_user.role if tenant_user else None
            except Exception:
                tenant_role = None

            # Preserve legacy behavior: staff users (admin UI) can see tenant submissions without requiring TenantUser.
            is_tenant_admin = bool(
                self.request.user.is_superuser
                or self.request.user.is_staff
                or tenant_role in ['owner', 'admin']
            )

            # Determine whether a submission is assigned to the current user.
            # Back-compat: legacy submissions may have current_step=NULL; in that case, treat assignments as
            # "assigned anywhere in the form" (this matches existing tests + production behavior).
            assigned_to_me_q = Q(form__step_assignments__assignment_type='user', form__step_assignments__assigned_user=self.request.user)
            if tenant_role:
                assigned_to_me_q |= Q(
                    form__step_assignments__assignment_type__in=['role', 'team'],
                    form__step_assignments__assigned_role=tenant_role,
                )
            assigned_to_me_q |= Q(form__step_assignments__assignment_type='pool')

            if assigned_to:
                # Security: allow assigned_to=me for everyone; allow arbitrary IDs only for tenant admins.
                if assigned_to == 'me':
                    qs = qs.filter(assigned_to_me_q).distinct()
                else:
                    if not is_tenant_admin:
                        qs = qs.none()
                    else:
                        try:
                            target_user_id = int(assigned_to)
                        except (TypeError, ValueError):
                            qs = qs.none()
                        else:
                            qs = qs.filter(form__step_assignments__assignment_type='user', form__step_assignments__assigned_user_id=target_user_id).distinct()
            else:
                # Default visibility: non-admin users should see what they started + what is assigned to them.
                if not is_tenant_admin:
                    qs = qs.filter(Q(created_by=self.request.user) | assigned_to_me_q).distinct()

            # Filter by status (support comma-separated list)
            status_filter = self.request.query_params.get("status")
            if status_filter:
                statuses = [s.strip() for s in str(status_filter).split(',') if s.strip()]
                if statuses:
                    qs = qs.filter(status__in=statuses)

            # Filter by form
            form_id = self.request.query_params.get("form")
            if form_id:
                qs = qs.filter(form_id=form_id)

            return qs.select_related("form", "created_by", "current_step").prefetch_related(
                "step_submissions__step", "step_submissions__completed_by"
            )

        except Exception as e:
            # Catch any database errors (RLS failures, missing tables, connection issues)
            logger.error(f'[FormSubmission] Failed to fetch queryset: {str(e)}', exc_info=True)

            # Send to Sentry if configured
            try:
                import sentry_sdk
                sentry_sdk.capture_exception(e)
            except ImportError:
                pass  # Sentry not configured

            # Return empty queryset to prevent 500 error
            return FormSubmission.objects.none()

    @action(detail=False, methods=["get"], url_path="process-monitor")
    def process_monitor(self, request):
        """Process monitoring list view for Cockpit.

        Returns submission rows enriched with current-step assignee + SLA + elapsed time.

        Query params:
        - assigned_to=me (supported; reuses get_queryset filtering)
        - status, form (supported; reuses get_queryset filtering)
        """
        tenant = getattr(request, "tenant", None)
        if not tenant:
            # No tenant context -> return empty 200 instead of triggering RLS/DB errors.
            return Response({"count": 0, "results": []})

        try:
            qs = self.get_queryset().order_by("-updated_at")

            page = self.paginate_queryset(qs)
            submissions = page if page is not None else qs

            # Collect keys for batch StepAssignment lookup
            form_ids = {s.form_id for s in submissions}
            step_ids = {s.current_step_id for s in submissions if s.current_step_id}

            assignments_by_key = {}
            if form_ids and step_ids:
                assignments = (
                    StepAssignment.objects.filter(tenant=tenant, form_id__in=form_ids, step_id__in=step_ids)
                    .select_related("assigned_user", "step", "form")
                    .order_by("id")
                )

                for a in assignments:
                    key = (a.form_id, a.step_id)
                    current = assignments_by_key.get(key)

                    # Prefer a concrete user assignment over role/team.
                    if not current or (not current.get("assigned_user_id") and a.assigned_user_id):
                        assignments_by_key[key] = {
                            "assignment_type": a.assignment_type,
                            "assigned_user_id": a.assigned_user_id,
                            "assigned_user_name": (
                                a.assigned_user.get_full_name() or a.assigned_user.username
                                if a.assigned_user
                                else None
                            ),
                            "assigned_role": a.assigned_role,
                            "due_days": a.due_days,
                        }

            now = timezone.now()
            results = []

            for s in submissions:
                step_sub = None
                if s.current_step_id:
                    # step_submissions are prefetched; match in memory.
                    for ss in getattr(s, "step_submissions", []).all():
                        if ss.step_id == s.current_step_id:
                            step_sub = ss
                            break

                assignment = None
                if s.current_step_id:
                    assignment = assignments_by_key.get((s.form_id, s.current_step_id))

                last_activity_at = step_sub.updated_at if step_sub else s.updated_at
                time_in_step_seconds = None
                if last_activity_at:
                    time_in_step_seconds = int((now - last_activity_at).total_seconds())

                due_at = None
                is_overdue = False
                due_days = assignment.get("due_days") if assignment else None
                if due_days is not None and last_activity_at:
                    due_at_dt = last_activity_at + timedelta(days=due_days)
                    due_at = due_at_dt.isoformat()
                    is_overdue = now > due_at_dt

                assigned_to_display = None
                if assignment:
                    if assignment.get("assigned_user_name"):
                        assigned_to_display = assignment["assigned_user_name"]
                    elif assignment.get("assigned_role"):
                        assigned_to_display = assignment["assigned_role"]

                results.append(
                    {
                        "id": str(s.id),
                        "form_id": str(s.form_id),
                        "form_name": getattr(s.form, "name", None),
                        "status": s.status,
                        "created_by": s.created_by_id,
                        "created_by_name": (
                            s.created_by.get_full_name() or s.created_by.username
                            if s.created_by
                            else None
                        ),
                        "created_at": s.created_at.isoformat() if s.created_at else None,
                        "updated_at": s.updated_at.isoformat() if s.updated_at else None,
                        "current_step_id": str(s.current_step_id) if s.current_step_id else None,
                        "current_step_name": (
                            s.current_step.step_name if s.current_step else None
                        ),
                        "current_step_order": (s.current_step.order if s.current_step else None),
                        "current_step_entity_type": (s.current_step.entity_type if s.current_step else None),
                        "current_step_status": (step_sub.status if step_sub else None),
                        "current_step_updated_at": (last_activity_at.isoformat() if last_activity_at else None),
                        "assigned_to": assignment,
                        "assigned_to_display": assigned_to_display,
                        "due_days": due_days,
                        "due_at": due_at,
                        "is_overdue": is_overdue,
                        "time_in_current_step_seconds": time_in_step_seconds,
                    }
                )

            if page is not None:
                return self.get_paginated_response(results)
            return Response({"count": len(results), "results": results})

        except Exception:
            logger.error('[process_monitor] Failed to build results', exc_info=True)
            return Response({"count": 0, "results": []})

    @action(detail=True, methods=["post"])
    def auto_save(self, request, pk=None):
        """Auto-save a single field value."""
        submission = self.get_object()

        # Explicit tenant check for security
        request_tenant = getattr(request, "tenant", None)
        if not request_tenant or submission.tenant_id != request_tenant.id:
            return Response({"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN)

        # Check submission is editable
        if submission.status in [FormSubmissionStatus.COMPLETED, FormSubmissionStatus.CANCELLED]:
            return Response(
                {"error": "Cannot modify a completed or cancelled submission"}, status=status.HTTP_400_BAD_REQUEST
            )

        serializer = FormSubmissionAutoSaveSerializer(
            data=request.data, context={"request": request, "submission": submission}
        )
        serializer.is_valid(raise_exception=True)

        step_id = str(serializer.validated_data["step_id"])
        field_key = serializer.validated_data["field_key"]
        value = serializer.validated_data["value"]

        # Use transaction for atomicity
        with transaction.atomic():
            # Update data structure
            if step_id not in submission.data:
                submission.data[step_id] = {}

            submission.data[step_id][field_key] = value
            submission.data[step_id]["_meta"] = {
                "last_updated": timezone.now().isoformat(),
                "updated_by": str(request.user.id),
            }

            # Update status to in_progress if draft
            if submission.status == FormSubmissionStatus.DRAFT:
                submission.status = FormSubmissionStatus.IN_PROGRESS

            submission.save(update_fields=["data", "status", "updated_at"])

            # Update step submission status
            step_submission = submission.step_submissions.filter(step_id=step_id).first()
            if step_submission and step_submission.status == StepSubmissionStatus.NOT_STARTED:
                step_submission.status = StepSubmissionStatus.IN_PROGRESS
                step_submission.save(update_fields=["status", "updated_at"])

        return Response(
            {"success": True, "step_id": step_id, "field_key": field_key, "saved_at": timezone.now().isoformat()}
        )

    @action(detail=True, methods=["post"])
    def complete_step(self, request, pk=None):
        """Mark a step as complete."""
        submission = self.get_object()

        # Explicit tenant check for security
        request_tenant = getattr(request, "tenant", None)
        if not request_tenant or submission.tenant_id != request_tenant.id:
            return Response({"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN)

        step_id = request.data.get("step_id")

        if not step_id:
            return Response({"error": "step_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        step_submission = submission.step_submissions.filter(step_id=step_id).first()
        if not step_submission:
            return Response({"error": "Step not found in this submission"}, status=status.HTTP_404_NOT_FOUND)

        # Use transaction for atomicity
        with transaction.atomic():
            # Mark complete
            step_submission.mark_completed(user=request.user)

            # Move to next step if available
            current_order = step_submission.step.order
            next_step = submission.form.entities.filter(order__gt=current_order).order_by("order").first()

            if next_step:
                submission.current_step = next_step
                # Mark next step as in_progress
                next_step_submission = submission.step_submissions.filter(step=next_step).first()
                if next_step_submission:
                    next_step_submission.status = StepSubmissionStatus.IN_PROGRESS
                    next_step_submission.save(update_fields=["status", "updated_at"])

            submission.save(update_fields=["current_step", "updated_at"])

        return Response(
            {
                "success": True,
                "step_id": step_id,
                "step_status": step_submission.status,
                "next_step_id": str(next_step.id) if next_step else None,
            }
        )

    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        """
        Final submission of the form.

        This action:
        1. Validates all required steps are complete
        2. Creates entity records from form data
        3. Marks submission as completed (only if entities created successfully)

        Returns created entity IDs for each step.
        """
        submission = self.get_object()

        # Explicit tenant check for security
        request_tenant = getattr(request, "tenant", None)
        if not request_tenant or submission.tenant_id != request_tenant.id:
            return Response({"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN)

        if submission.status == FormSubmissionStatus.COMPLETED:
            return Response({"error": "Submission already completed"}, status=status.HTTP_400_BAD_REQUEST)

        # Check all required steps are complete (optional - can be configured)
        incomplete_steps = submission.step_submissions.exclude(
            status__in=[StepSubmissionStatus.COMPLETED, StepSubmissionStatus.SKIPPED]
        )

        if incomplete_steps.exists() and not request.data.get("force", False):
            return Response(
                {
                    "error": "Some steps are not complete",
                    "incomplete_steps": [
                        {"id": str(s.step_id), "name": s.step.step_name, "status": s.status} for s in incomplete_steps
                    ],
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Persist form data to entity records
        persistence_result = persist_form_submission(submission, user=request.user)

        # Only mark as completed if persistence was successful
        if persistence_result.get("success", False):
            submission.status = FormSubmissionStatus.COMPLETED
            submission.completed_at = timezone.now()
            submission.save(update_fields=["status", "completed_at", "updated_at"])

            return Response(
                {
                    "success": True,
                    "status": submission.status,
                    "completed_at": submission.completed_at.isoformat(),
                    "entities_created": persistence_result.get("created_entities", {}),
                }
            )
        else:
            # Persistence failed - keep submission in progress, return errors
            return Response(
                {
                    "success": False,
                    "status": submission.status,
                    "message": "Failed to create entity records",
                    "entities_created": persistence_result.get("created_entities", {}),
                    "errors": persistence_result.get("errors", []),
                },
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        """Cancel a submission."""
        submission = self.get_object()

        # Explicit tenant check for security
        request_tenant = getattr(request, "tenant", None)
        if not request_tenant or submission.tenant_id != request_tenant.id:
            return Response({"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN)

        if submission.status == FormSubmissionStatus.COMPLETED:
            return Response({"error": "Cannot cancel a completed submission"}, status=status.HTTP_400_BAD_REQUEST)

        submission.status = FormSubmissionStatus.CANCELLED
        submission.save(update_fields=["status", "updated_at"])

        return Response({"success": True, "status": submission.status})

    @action(detail=True, methods=["post"], url_path="upload")
    def upload_file(self, request, pk=None):
        """
        Upload a file for a submission field.

        POST /form-submissions/{id}/upload/
        Body (multipart/form-data):
          - field_key: string
          - file: File
        """
        from .models import FormSubmissionFile

        submission = self.get_object()

        # Tenant security check
        request_tenant = getattr(request, "tenant", None)
        if not request_tenant or submission.tenant_id != request_tenant.id:
            return Response({"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN)

        # Validate request
        field_key = request.data.get("field_key")
        uploaded_file = request.FILES.get("file")

        if not field_key:
            return Response({"error": "field_key is required"}, status=status.HTTP_400_BAD_REQUEST)

        if not uploaded_file:
            return Response({"error": "file is required"}, status=status.HTTP_400_BAD_REQUEST)

        # File size limit (10MB default)
        max_size = 10 * 1024 * 1024
        if uploaded_file.size > max_size:
            return Response(
                {"error": f"File too large. Maximum size is {max_size // (1024*1024)}MB"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Create file record
        submission_file = FormSubmissionFile.objects.create(
            submission=submission,
            field_key=field_key,
            file=uploaded_file,
            original_name=uploaded_file.name,
            content_type=uploaded_file.content_type or "application/octet-stream",
            size=uploaded_file.size,
            uploaded_by=request.user,
        )

        return Response(
            {
                "id": str(submission_file.id),
                "name": submission_file.original_name,
                "url": submission_file.url,
                "size": submission_file.size,
                "type": submission_file.content_type,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["delete"], url_path="files/(?P<file_id>[^/.]+)")
    def delete_file(self, request, pk=None, file_id=None):
        """
        Delete an uploaded file.

        DELETE /form-submissions/{id}/files/{file_id}/
        """
        from .models import FormSubmissionFile

        submission = self.get_object()

        # Tenant security check
        request_tenant = getattr(request, "tenant", None)
        if not request_tenant or submission.tenant_id != request_tenant.id:
            return Response({"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN)

        try:
            submission_file = FormSubmissionFile.objects.get(id=file_id, submission=submission)
        except FormSubmissionFile.DoesNotExist:
            return Response({"error": "File not found"}, status=status.HTTP_404_NOT_FOUND)

        # Delete the actual file and record
        if submission_file.file:
            submission_file.file.delete(save=False)
        submission_file.delete()

        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(tags=["Workflows", "Quick Actions"])
class AvailableFormsViewSet(viewsets.ReadOnlyModelViewSet):
    """List Quick Actions targets.

    Returns a unified list including:
    - TenantForm (data capture forms)
    - TenantWorkForm (workflow graphs from the WorkForms editor)

    Both are filtered to status in (active, draft).
    """

    permission_classes = [IsAuthenticated]
    serializer_class = AvailableFormSerializer

    def get_queryset(self):
        """Tenant-scoped TenantForms for Quick Actions.

        NOTE: This ViewSet is used as a backing queryset for filtering/pagination.
        We *only* return the workflows app TenantForm model here.

        WorkForms (apps.system.TenantWorkForm) are added in `list()` as a second query
        to avoid cross-model unions.
        """
        tenant = _get_request_tenant(self.request)
        if not tenant:
            return TenantForm.objects.none()

        return (
            TenantForm.objects.filter(
                tenant=tenant,
                status__in=['active', 'draft'],
            ).order_by('-created_at')
        )

    def _get_workforms(self, request):
        """Tenant-scoped WorkForms for Quick Actions."""
        from apps.system.models import TenantWorkForm

        tenant = _get_request_tenant(request)
        if not tenant:
            return TenantWorkForm.objects.none()

        return TenantWorkForm.objects.filter(tenant=tenant, status__in=['active', 'draft']).order_by('-updated_at')

    @extend_schema(responses={200: AvailableQuickActionTargetSerializer(many=True)})
    def list(self, request, *args, **kwargs):
        """Return Quick Action targets (forms + workforms).

        Response rows are normalized to the `AvailableQuickActionTargetSerializer` schema.
        """

        forms_qs = self.filter_queryset(self.get_queryset())
        forms_data = AvailableFormSerializer(forms_qs, many=True).data
        for row in forms_data:
            row['type'] = 'form'
            row['node_count'] = None

        workforms_data = []
        for wf in self._get_workforms(request):
            workforms_data.append(
                {
                    'id': str(wf.id),
                    'type': 'workflow',
                    'name': wf.name,
                    'description': wf.description or '',
                    'icon': 'workflow',
                    'status': wf.status,
                    'is_default': False,
                    'is_quick_action_enabled': True,
                    'step_count': None,
                    'node_count': wf.get_node_count() if hasattr(wf, 'get_node_count') else None,
                }
            )

        data = forms_data + workforms_data
        data.sort(key=lambda r: str(r.get('name') or '').lower())
        return Response(data)


@extend_schema(tags=["Workflows", "Quick Actions"])
class QuickActionsAPIView(APIView):
    """
    API endpoint for managing user's quick actions.

    GET - Get user's current quick actions
    PUT - Update user's quick actions
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: QuickActionsGetResponseSerializer})
    def get(self, request):
        """Get user's quick actions from preferences."""
        try:
            prefs = request.user.preferences
            quick_actions = prefs.quick_menu_items or []
        except Exception:
            quick_actions = []

        return Response({"items": quick_actions})

    @extend_schema(
        request=QuickActionsSerializer,
        responses={200: QuickActionsPutResponseSerializer},
    )
    def put(self, request):
        """Update user's quick actions."""
        try:
            logger.info(f"Quick actions update request: {request.data}")
            logger.info(
                f"Request tenant: {request.tenant}, User: {request.user}, Is superuser: {request.user.is_superuser}"
            )

            serializer = QuickActionsSerializer(data=request.data)
            if not serializer.is_valid():
                logger.error(f"Quick actions serializer errors: {serializer.errors}")
                return Response(
                    {"error": "Validation failed", "details": serializer.errors}, status=status.HTTP_400_BAD_REQUEST
                )

            items = serializer.validated_data["items"]

            # Validate that referenced targets exist and are available
            from apps.system.models.tenant_workform import TenantWorkForm

            for item in items:
                if item["type"] == "form" and item.get("form_id"):
                    form = (
                        TenantForm.objects.filter(
                            tenant=request.tenant,
                            id=item["form_id"],
                            status__in=[FormStatus.DRAFT, FormStatus.ACTIVE],
                        ).first()
                        if request.tenant
                        else None
                    )

                    if not form:
                        return Response(
                            {"error": f'Form {item["form_id"]} not found'},
                            status=status.HTTP_400_BAD_REQUEST,
                        )

                if item["type"] == "workflow" and item.get("workflow_id"):
                    wf = (
                        TenantWorkForm.objects.filter(
                            tenant=request.tenant,
                            id=item["workflow_id"],
                            status__in=['draft', 'active'],
                        ).first()
                        if request.tenant
                        else None
                    )

                    if not wf:
                        return Response(
                            {"error": f'WorkForm {item["workflow_id"]} not found'},
                            status=status.HTTP_400_BAD_REQUEST,
                        )


            # Update preferences
            from apps.core.models import UserPreferences

            prefs, created = UserPreferences.objects.get_or_create(user=request.user)

            # Convert UUID objects to strings for JSON storage
            serializable_items = []
            for item in items:
                serializable_item = dict(item)
                if "form_id" in serializable_item and serializable_item["form_id"]:
                    serializable_item["form_id"] = str(serializable_item["form_id"])
                if "workflow_id" in serializable_item and serializable_item["workflow_id"]:
                    serializable_item["workflow_id"] = str(serializable_item["workflow_id"])
                serializable_items.append(serializable_item)

            prefs.quick_menu_items = serializable_items
            prefs.save(update_fields=["quick_menu_items", "updated_at"])

            return Response({"success": True, "items": serializable_items})
        except Exception as e:
            from apps.core.utils.logging import capture_exception

            capture_exception(e, request=request, extra={"endpoint": "workflows/quick-actions"})
            logger.exception(f"Error updating quick actions: {e}")
            return Response(
                {"error": f"Failed to update quick actions: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


@extend_schema(tags=["Workflows", "Entities"])
class EntityOptionsAPIView(APIView):
    """
    API endpoint for getting entity options for select fields.

    Returns the actual records for a given entity type, suitable for
    populating select/dropdown fields in forms.

    Supports search with ?q= parameter for large datasets.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: EntityOptionsResponseSerializer})
    def get(self, request, entity_type):
        """Get options for an entity type."""
        from django.db.models import Q

        from .services.field_registry import FieldRegistry

        # Get the model for this entity type
        model = FieldRegistry.get_model_for_entity(entity_type)
        if not model:
            return Response({"error": f"Unknown entity type: {entity_type}"}, status=status.HTTP_404_NOT_FOUND)

        # Filter by tenant
        tenant = getattr(request, "tenant", None)
        if not tenant:
            return Response({"error": "Tenant context required"}, status=status.HTTP_400_BAD_REQUEST)

        # Query records - filter by tenant if the model has tenant field
        try:
            if hasattr(model, "tenant"):
                queryset = model.objects.filter(tenant=tenant)
            elif entity_type == "product":
                # system.Product is global (no tenant FK).
                # Apply central visibility rules so we do not leak:
                # - tenant-hidden system products
                # - tenant-owned custom products (is_system=False)
                from django.db.models import Prefetch

                from apps.system.models import TenantProductPreference
                from apps.system.services.product_visibility import visible_products_qs

                queryset = visible_products_qs(tenant=tenant, qs=model.objects.all()).prefetch_related(
                    Prefetch(
                        "tenant_preferences",
                        queryset=TenantProductPreference.objects.filter(tenant=tenant),
                    )
                )
            else:
                # Fail closed for global/non-tenant models (unless explicitly allowlisted).
                return Response(
                    {"error": "Entity options are not available for this entity type."},
                    status=status.HTTP_403_FORBIDDEN,
                )

            # Search functionality
            search_query = request.query_params.get("q", "").strip()
            if search_query:
                # Build search filter based on common fields
                search_filter = Q()
                searchable_fields = [
                    "name",
                    "title",
                    "code",
                    "product_code",
                    "email",
                    "first_name",
                    "last_name",
                    "company_name",
                ]
                for field_name in searchable_fields:
                    if hasattr(model, field_name):
                        search_filter |= Q(**{f"{field_name}__icontains": search_query})

                # Also search the __str__ representation via annotation if possible
                if search_filter:
                    queryset = queryset.filter(search_filter)

            # Get total count before limiting
            total_count = queryset.count()

            # Limit results for performance
            limit = int(request.query_params.get("limit", 100))
            limit = min(limit, 500)  # Cap at 500
            queryset = queryset[:limit]

            # Build options list
            options = []
            for obj in queryset:
                # Try to get a display label
                label = str(obj)

                if entity_type == "product":
                    # Prefer tenant override when present.
                    pref = None
                    try:
                        pref = obj.tenant_preferences.all()[0] if hasattr(obj, "tenant_preferences") else None
                    except Exception:
                        pref = None

                    effective_name = getattr(pref, "effective_name", "") or getattr(obj, "name", "") or str(obj)
                    product_code = getattr(obj, "product_code", "")
                    label = f"{product_code} - {effective_name}" if product_code else effective_name
                elif hasattr(obj, "name"):
                    label = obj.name
                elif hasattr(obj, "title"):
                    label = obj.title
                elif hasattr(obj, "code"):
                    label = obj.code

                options.append({"value": str(obj.pk), "label": label})

            # Determine if user can create new records.
            # Many ProjectMeats APIs use tenant membership / app-level RBAC rather than Django model permissions.
            QUICK_CREATE_MEMBER_ENTITY_TYPES = {
                "supplier",
                "customer",
                "contact",
                "carrier",
                "plant",
                "location",
            }

            def _is_active_tenant_member() -> bool:
                try:
                    from apps.tenants.models import TenantUser

                    return TenantUser.objects.filter(user=request.user, tenant=tenant, is_active=True).exists()
                except Exception:
                    return False

            is_global_admin = request.user.groups.filter(name='Global System Admins').exists()

            if entity_type == "product":
                # Products are system-wide; only superusers/global admins should create them.
                can_create = bool(getattr(request.user, "is_superuser", False)) or is_global_admin
            elif entity_type in QUICK_CREATE_MEMBER_ENTITY_TYPES:
                can_create = bool(getattr(request.user, "is_superuser", False)) or is_global_admin or _is_active_tenant_member()
            else:
                can_create = request.user.has_perm(f"{model._meta.app_label}.add_{model._meta.model_name}")

            return Response(
                {
                    "entity_type": entity_type,
                    "options": options,
                    "count": len(options),
                    "total_count": total_count,
                    "can_create": can_create,
                    "entity_label": entity_type.replace("_", " ").title(),
                    "has_more": total_count > len(options),
                }
            )
        except Exception as e:
            logger.exception(f"Error fetching entity options: {e}")
            return Response(
                {"error": f"Failed to fetch options: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


@extend_schema(tags=["Workflows", "Entities"])
class QuickCreateEntityAPIView(APIView):
    """
    API endpoint for quick-creating entity records from within forms.

    Accepts minimal required fields and creates a new record,
    returning the ID and label for immediate use in the form.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: QuickCreateFieldsResponseSerializer})
    def get(self, request, entity_type):
        """Get the required fields for quick-creating an entity."""
        from .services.field_registry import FieldRegistry

        model = FieldRegistry.get_model_for_entity(entity_type)
        if not model:
            return Response({"error": f"Unknown entity type: {entity_type}"}, status=status.HTTP_404_NOT_FOUND)

        # Get required fields (excluding system fields)
        required_fields = []

        # Optional quick-create fields we still want to expose for better UX.
        # Keep this ordered (so forms feel consistent) and conservative (so quick create doesn't become overwhelming).
        common_extra_keys = [
            "name",
            "title",
            "company_name",
            "contact_person",
            "first_name",
            "last_name",
            "email",
            "phone",
            "address",
            "city",
            "state",
            "zip_code",
            "country",
            "notes",
            "description",
        ]

        # Entity-specific extras appended after the common set.
        # These are especially important for Master Product compliance.
        extra_fields_by_entity = {
            "customer": [
                "phone_mobile",
                "phone_office",
                "phone_office_extension",
                "industry_array",
                "preferred_protein_types",
                "products",
            ],
            "supplier": [
                "phone_mobile",
                "phone_office",
                "phone_office_extension",
                "departments_array",
                "preferred_protein_types",
                "products",
            ],
            "contact": ["position", "department"],
        }
        excluded = {
            "id",
            "pk",
            "tenant",
            "created_on",
            "modified_on",
            "created_at",
            "updated_at",
            "created_by",
            "modified_by",
            "custom_data",
            "uuid",
        }

        for field in model._meta.get_fields():
            if not hasattr(field, "name") or field.name in excluded:
                continue

            # Check if required
            if hasattr(field, "null") and not field.null and not getattr(field, "blank", True):
                # Skip auto fields
                if getattr(field, "auto_now", False) or getattr(field, "auto_now_add", False):
                    continue

                # Skip fields with defaults
                if field.has_default():
                    continue

                field_type = type(field).__name__
                form_type = "text"
                if field_type in ("IntegerField", "DecimalField", "FloatField"):
                    form_type = "number"
                elif field_type == "EmailField":
                    form_type = "email"
                elif field_type == "BooleanField":
                    form_type = "checkbox"
                elif field_type == "DateField":
                    form_type = "date"
                elif field_type == "ArrayField":
                    form_type = "multiselect"
                elif getattr(field, "many_to_many", False):
                    form_type = "multiselect"

                required_fields.append(
                    {
                        "key": field.name,
                        "label": str(getattr(field, "verbose_name", field.name)).replace("_", " ").title(),
                        "type": form_type,
                        "required": True,
                    }
                )

        # If no required fields, use 'name' or first text field as minimum
        if not required_fields:
            for field in model._meta.get_fields():
                if hasattr(field, "name") and field.name == "name":
                    required_fields.append({"key": "name", "label": "Name", "type": "text", "required": True})
                    break

        # Add a small allowlisted set of optional fields (non-breaking additive change).
        # These fields are not required but are critical for the create flow UX.
        extras = []
        already = {f["key"] for f in required_fields}

        # Build an ordered allowlist: common keys first, then entity-specific keys.
        allow_order = list(common_extra_keys) + list(extra_fields_by_entity.get(entity_type, []))

        # Customer/Supplier UX: we collect mobile + office + extension explicitly.
        # Hide the legacy single phone field from quick-create to avoid confusion.
        if entity_type in {'customer', 'supplier'}:
            allow_order = [k for k in allow_order if k != 'phone']

        for key in allow_order:
            if key in excluded or key in already:
                continue

            field = next((f for f in model._meta.get_fields() if hasattr(f, "name") and f.name == key), None)
            if not field:
                continue

            # Skip reverse/auto-created relations.
            if getattr(field, "auto_created", False) and not getattr(field, "concrete", False):
                continue

            field_type = type(field).__name__
            form_type = "text"
            if field_type in ("IntegerField", "DecimalField", "FloatField"):
                form_type = "number"
            elif field_type == "EmailField":
                form_type = "email"
            elif field_type == "BooleanField":
                form_type = "checkbox"
            elif field_type == "DateField":
                form_type = "date"
            elif field_type == "ArrayField":
                form_type = "multiselect"
            elif getattr(field, "many_to_many", False):
                form_type = "multiselect"

            extras.append(
                {
                    "key": field.name,
                    "label": str(getattr(field, "verbose_name", field.name)).replace("_", " ").title(),
                    "type": form_type,
                    "required": False,
                }
            )

        return Response(
            {
                "entity_type": entity_type,
                "entity_label": entity_type.replace("_", " ").title(),
                "fields": required_fields + extras,
            }
        )

    @extend_schema(
        request=OpenApiTypes.OBJECT,
        responses={201: QuickCreateCreateResponseSerializer},
    )
    def post(self, request, entity_type):
        """Quick-create an entity record."""
        from .services.field_registry import FieldRegistry

        model = FieldRegistry.get_model_for_entity(entity_type)
        if not model:
            return Response({"error": f"Unknown entity type: {entity_type}"}, status=status.HTTP_404_NOT_FOUND)

        tenant = getattr(request, "tenant", None)
        if not tenant:
            return Response({"error": "Tenant context required"}, status=status.HTTP_400_BAD_REQUEST)

        # Check permission.
        # Quick-create is primarily for reference data (supplier/customer/contact/etc.).
        # For those, we rely on tenant membership (plus Global System Admin / superuser),
        # which matches the permission model of many tenant ViewSets.
        QUICK_CREATE_MEMBER_ENTITY_TYPES = {
            "supplier",
            "customer",
            "contact",
            "carrier",
            "plant",
            "location",
        }

        def _is_active_tenant_member() -> bool:
            try:
                from apps.tenants.models import TenantUser

                return TenantUser.objects.filter(user=request.user, tenant=tenant, is_active=True).exists()
            except Exception:
                return False

        is_global_admin = request.user.groups.filter(name='Global System Admins').exists()

        if entity_type == "product":
            # Products are system-wide master data.
            if not (getattr(request.user, "is_superuser", False) or is_global_admin):
                return Response({"error": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)
        elif entity_type in QUICK_CREATE_MEMBER_ENTITY_TYPES:
            if not (getattr(request.user, "is_superuser", False) or is_global_admin or _is_active_tenant_member()):
                return Response({"error": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)
        else:
            if not request.user.has_perm(f"{model._meta.app_label}.add_{model._meta.model_name}"):
                return Response({"error": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)

        try:
            # Build kwargs from request data
            create_kwargs = {}
            m2m_to_set = {}
            data = request.data

            for field in model._meta.get_fields():
                if not hasattr(field, "name"):
                    continue

                # Skip reverse/auto-created relations
                if getattr(field, "auto_created", False) and not getattr(field, "concrete", False):
                    continue

                if field.name in data:
                    # If it's a ManyToManyField, set after instance is created
                    if getattr(field, "many_to_many", False) and not getattr(field, "auto_created", False):
                        m2m_to_set[field.name] = data[field.name]
                        continue

                    # If it's a ForeignKey/relation, assign via _id to accept string UUIDs
                    if field.is_relation and (getattr(field, "many_to_one", False) or getattr(field, "one_to_one", False)):
                        create_kwargs[f"{field.name}_id"] = data[field.name]
                    else:
                        create_kwargs[field.name] = data[field.name]

            # Add tenant if model has it
            if hasattr(model, "tenant"):
                create_kwargs["tenant"] = tenant

            # Customer/Supplier quick-create: sync legacy phone fields for backward compatibility.
            if entity_type in {'customer', 'supplier'}:
                mobile = str(create_kwargs.get('phone_mobile') or '').strip()
                office = str(create_kwargs.get('phone_office') or '').strip()
                legacy_phone = str(create_kwargs.get('phone') or '').strip()

                # If new fields provided but legacy isn't, derive legacy.
                if (mobile or office) and not legacy_phone:
                    if office:
                        create_kwargs['phone'] = office
                        create_kwargs['phone_type'] = 'office'
                    else:
                        create_kwargs['phone'] = mobile
                        create_kwargs['phone_type'] = 'mobile'

                # If an older client sends legacy only, populate new slots.
                if legacy_phone and not (mobile or office):
                    if str(create_kwargs.get('phone_type') or '').strip() == 'mobile':
                        create_kwargs['phone_mobile'] = legacy_phone
                    else:
                        create_kwargs['phone_office'] = legacy_phone

            # Add created_by if model has it
            if hasattr(model, "created_by"):
                create_kwargs["created_by"] = request.user

            # Create the record
            with transaction.atomic():
                obj = model.objects.create(**create_kwargs)

                for field_name, raw_vals in m2m_to_set.items():
                    vals = raw_vals
                    if vals is None:
                        vals = []
                    if not isinstance(vals, (list, tuple)):
                        vals = [vals]
                    getattr(obj, field_name).set(list(vals))

            # Get display label
            label = str(obj)
            if hasattr(obj, "name"):
                label = obj.name
            elif hasattr(obj, "title"):
                label = obj.title
            elif hasattr(obj, "code"):
                label = obj.code

            return Response(
                {"success": True, "id": str(obj.pk), "value": str(obj.pk), "label": label, "entity_type": entity_type},
                status=status.HTTP_201_CREATED,
            )

        except Exception as e:
            from apps.core.utils.logging import capture_exception

            capture_exception(e, request=request, extra={"endpoint": "workflows/quick-create", "entity_type": entity_type})
            logger.exception(f"Error quick-creating entity: {e}")
            return Response({"error": f"Failed to create {entity_type}: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)


class FieldTemplatesAPIView(APIView):
    """
    API endpoint for field templates.
    Provides pre-defined field groups for quick form building.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, template_id=None):
        """
        Get all templates or a specific template.

        GET /api/v1/workflows/field-templates/ - List all templates
        GET /api/v1/workflows/field-templates/{template_id}/ - Get specific template
        """
        from .services.field_templates import get_all_templates, get_template, get_template_fields

        if template_id:
            # Get specific template with fields
            template = get_template(template_id)
            if not template:
                return Response({"error": f"Template not found: {template_id}"}, status=status.HTTP_404_NOT_FOUND)

            # Include full field definitions
            prefix = request.query_params.get("prefix", "")
            return Response(
                {
                    "id": template_id,
                    "name": template["name"],
                    "description": template["description"],
                    "icon": template["icon"],
                    "fields": get_template_fields(template_id, prefix),
                }
            )

        # List all templates
        return Response(get_all_templates())


# =============================================================================
# FORM IMPORT/EXPORT API VIEWS
# =============================================================================


class FormExportAPIView(APIView):
    """
    API endpoint for exporting form configurations.

    GET /api/v1/workflows/forms/{form_id}/export/
    """

    permission_classes = [IsAdminUser]

    def get(self, request, form_id):
        """Export a form configuration as JSON."""
        from .services.import_export import export_form

        tenant, error = _require_tenant(request)
        if error:
            return error

        try:
            form = TenantForm.objects.get(pk=form_id, tenant=tenant)
        except TenantForm.DoesNotExist:
            return Response({"error": "Form not found"}, status=status.HTTP_404_NOT_FOUND)

        include_metadata = request.query_params.get("metadata", "true").lower() == "true"
        export_data = export_form(form, include_metadata=include_metadata)

        return Response(export_data)


class FormImportAPIView(APIView):
    """
    API endpoint for importing form configurations.

    POST /api/v1/workflows/forms/import/
    """

    permission_classes = [IsAdminUser]

    def post(self, request):
        """Import a form configuration from JSON."""
        from .services.import_export import import_form, validate_import_data

        # Get tenant
        tenant = getattr(request, "tenant", None)
        if not tenant:
            return Response({"error": "Tenant context required"}, status=status.HTTP_400_BAD_REQUEST)

        # Parse import data
        import_data = request.data
        if not import_data:
            return Response({"error": "No import data provided"}, status=status.HTTP_400_BAD_REQUEST)

        # Validate
        errors = validate_import_data(import_data)
        if errors:
            return Response({"error": "Validation failed", "details": errors}, status=status.HTTP_400_BAD_REQUEST)

        # Import
        name_suffix = request.data.get("_options", {}).get("name_suffix", " (Imported)")

        try:
            form = import_form(import_data, tenant=tenant, name_suffix=name_suffix, created_by=request.user)

            return Response(
                {
                    "status": "success",
                    "message": f"Form imported successfully",
                    "form": {
                        "id": str(form.id),
                        "name": form.name,
                        "entity_type": form.entity_type,
                    },
                },
                status=status.HTTP_201_CREATED,
            )

        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": f"Import failed: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class FormDuplicateAPIView(APIView):
    """
    API endpoint for duplicating a form.

    POST /api/v1/workflows/forms/{form_id}/duplicate/
    """

    permission_classes = [IsAdminUser]

    def post(self, request, form_id):
        """Duplicate a form within the same tenant."""
        from .services.import_export import duplicate_form

        tenant, error = _require_tenant(request)
        if error:
            return error

        try:
            form = TenantForm.objects.get(pk=form_id, tenant=tenant)
        except TenantForm.DoesNotExist:
            return Response({"error": "Form not found"}, status=status.HTTP_404_NOT_FOUND)

        new_name = request.data.get("name")

        try:
            new_form = duplicate_form(form, new_name=new_name)

            return Response(
                {
                    "status": "success",
                    "message": f"Form duplicated successfully",
                    "form": {
                        "id": str(new_form.id),
                        "name": new_form.name,
                        "entity_type": new_form.entity_type,
                    },
                },
                status=status.HTTP_201_CREATED,
            )

        except Exception as e:
            return Response({"error": f"Duplication failed: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# =============================================================================
# FORM ANALYTICS API VIEWS
# =============================================================================


class FormAnalyticsAPIView(APIView):
    """
    API endpoint for form analytics.

    GET /api/v1/workflows/forms/{form_id}/analytics/
    GET /api/v1/workflows/analytics/summary/
    """

    permission_classes = [IsAdminUser]

    def get(self, request, form_id=None):
        """Get form analytics or tenant summary."""
        from .services.analytics import get_form_analytics, get_tenant_form_summary

        days = int(request.query_params.get("days", 30))
        include_events = request.query_params.get("events", "true").lower() == "true"

        if form_id:
            # Specific form analytics
            tenant, error = _require_tenant(request)
            if error:
                return error

            try:
                form = TenantForm.objects.get(pk=form_id, tenant=tenant)
            except TenantForm.DoesNotExist:
                return Response({"error": "Form not found"}, status=status.HTTP_404_NOT_FOUND)

            analytics = get_form_analytics(form, days=days, include_events=include_events)
            return Response(analytics)

        else:
            # Tenant summary
            tenant = getattr(request, "tenant", None)
            if not tenant:
                return Response({"error": "Tenant context required"}, status=status.HTTP_400_BAD_REQUEST)

            summary = get_tenant_form_summary(tenant, days=days)
            return Response(summary)


class FormEventAPIView(APIView):
    """
    API endpoint for recording form analytics events.

    POST /api/v1/workflows/form-submissions/{submission_id}/events/
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, submission_id):
        """Record a form analytics event."""
        from .services.analytics import record_form_event

        tenant, error = _require_tenant(request)
        if error:
            return error

        try:
            submission = FormSubmission.objects.get(pk=submission_id, tenant=tenant)
        except FormSubmission.DoesNotExist:
            return Response({"error": "Submission not found"}, status=status.HTTP_404_NOT_FOUND)

        event_type = request.data.get("event_type")
        if not event_type:
            return Response({"error": "event_type is required"}, status=status.HTTP_400_BAD_REQUEST)

        event = record_form_event(
            submission=submission,
            event_type=event_type,
            step_id=request.data.get("step_id"),
            field_key=request.data.get("field_key", ""),
            metadata=request.data.get("metadata", {}),
            duration_ms=request.data.get("duration_ms"),
        )

        return Response(
            {
                "status": "success",
                "event_id": str(event.id),
            },
            status=status.HTTP_201_CREATED,
        )


class FormTestDataAPIView(APIView):
    """
    API endpoint for generating test data for form preview.

    GET /api/v1/workflows/forms/{form_id}/test-data/
    """

    permission_classes = [IsAdminUser]

    def get(self, request, form_id):
        """Generate test data for a form."""
        from .services.test_data import generate_form_test_data

        tenant, error = _require_tenant(request)
        if error:
            return error

        try:
            form = TenantForm.objects.get(pk=form_id, tenant=tenant)
        except TenantForm.DoesNotExist:
            return Response({"error": "Form not found"}, status=status.HTTP_404_NOT_FOUND)

        # Get form snapshot
        form_snapshot = form.form_snapshot
        if not form_snapshot:
            # Build snapshot if not available
            from .signals import _build_form_snapshot

            form_snapshot = _build_form_snapshot(form)

        # Generate test data
        test_data = generate_form_test_data(form_snapshot)

        return Response(
            {
                "form_id": str(form.id),
                "form_name": form.name,
                "test_data": test_data,
            }
        )


# =============================================================================
# WAVE 3: FORMS & FLOWS ENHANCEMENT VIEWS
# =============================================================================

from .serializers import (
    ActionItemCountsSerializer,
    ActionItemSerializer,
    FormStatusHistorySerializer,
    StepAssignmentSerializer,
    UserNotificationPreferencesSerializer,
    UserNotificationSerializer,
)


class FormStatusHistoryViewSet(mixins.ListModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet):
    """
    API endpoint for form status history.

    GET /api/v1/workflows/form-submissions/{submission_id}/history/
    POST /api/v1/workflows/form-submissions/{submission_id}/history/
    """

    serializer_class = FormStatusHistorySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        tenant = getattr(self.request, 'tenant', None)
        if not tenant:
            return FormStatusHistory.objects.none()

        submission_id = self.kwargs.get('submission_id')
        return (
            FormStatusHistory.objects.filter(submission_id=submission_id, submission__tenant=tenant)
            .select_related('changed_by', 'submission')
        )

    def perform_create(self, serializer):
        tenant = getattr(self.request, 'tenant', None)
        if not tenant:
            raise serializers.ValidationError('Tenant context is required (X-Tenant-ID header).')

        submission_id = self.kwargs.get('submission_id')
        try:
            submission = FormSubmission.objects.get(pk=submission_id, tenant=tenant)
        except FormSubmission.DoesNotExist:
            raise serializers.ValidationError('Submission not found')

        # Get current status before change
        from_status = submission.status
        to_status = self.request.data.get("to_status")

        # Update submission status
        submission.status = to_status
        submission.save(update_fields=["status", "updated_at"])

        # Create history record
        serializer.save(submission=submission, from_status=from_status, changed_by=self.request.user)


class StepAssignmentViewSet(viewsets.ModelViewSet):
    """
    API endpoint for step assignments.

    GET /api/v1/workflows/step-assignments/
    POST /api/v1/workflows/step-assignments/
    PUT/PATCH /api/v1/workflows/step-assignments/{id}/
    DELETE /api/v1/workflows/step-assignments/{id}/
    """

    serializer_class = StepAssignmentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = StepAssignment.objects.select_related(
            "tenant", "form", "step", "assigned_user", "escalation_user", "created_by"
        )

        # Filter by tenant (fail closed)
        tenant = getattr(self.request, "tenant", None)
        if not tenant:
            return queryset.none()

        queryset = queryset.filter(tenant=tenant)

        # Filter by form
        form_id = self.request.query_params.get("form")
        if form_id:
            queryset = queryset.filter(form_id=form_id)

        # Filter by step
        step_id = self.request.query_params.get("step")
        if step_id:
            queryset = queryset.filter(step_id=step_id)

        # Filter by assigned user
        user_id = self.request.query_params.get("assigned_user")
        if user_id:
            queryset = queryset.filter(assigned_user_id=user_id)

        # Filter by my assignments
        if self.request.query_params.get("my_assignments") == "true":
            queryset = queryset.filter(assigned_user=self.request.user)

        return queryset


class UserNotificationViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet
):
    """
    API endpoint for user notifications.

    GET /api/v1/workflows/notifications/
    GET /api/v1/workflows/notifications/{id}/
    DELETE /api/v1/workflows/notifications/{id}/
    POST /api/v1/workflows/notifications/{id}/read/
    POST /api/v1/workflows/notifications/mark-all-read/
    """

    serializer_class = UserNotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = UserNotification.objects.filter(user=self.request.user, is_dismissed=False).select_related("tenant")

        # Filter by tenant (fail closed)
        tenant = getattr(self.request, "tenant", None)
        if not tenant:
            return queryset.none()

        queryset = queryset.filter(tenant=tenant)

        # Filter by read status
        is_read = self.request.query_params.get("is_read")
        if is_read == "true":
            queryset = queryset.filter(is_read=True)
        elif is_read == "false":
            queryset = queryset.filter(is_read=False)

        # Filter by type
        notification_type = self.request.query_params.get("type")
        if notification_type:
            queryset = queryset.filter(notification_type=notification_type)

        # Filter by priority
        priority = self.request.query_params.get("priority")
        if priority:
            queryset = queryset.filter(priority=priority)

        return queryset.order_by("-created_at")

    @action(detail=True, methods=["post"])
    def read(self, request, pk=None):
        """Mark a notification as read."""
        notification = self.get_object()
        notification.mark_read()
        return Response({"status": "success"})

    @action(detail=False, methods=["post"], url_path="mark-all-read")
    def mark_all_read(self, request):
        """Mark all notifications as read."""
        from django.utils import timezone

        queryset = self.get_queryset().filter(is_read=False)
        count = queryset.update(is_read=True, read_at=timezone.now())
        return Response({"status": "success", "count": count})

    @action(detail=False, methods=["get"], url_path="unread-count")
    def unread_count(self, request):
        """Get count of unread notifications."""
        count = self.get_queryset().filter(is_read=False).count()
        return Response({"count": count})


class UserNotificationPreferencesView(APIView):
    """
    API endpoint for notification preferences.

    GET /api/v1/workflows/notification-preferences/
    PUT /api/v1/workflows/notification-preferences/
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get or create notification preferences for current user."""
        tenant = getattr(request, 'tenant', None)
        if not tenant:
            return Response({"error": "Tenant context required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Ensure RLS session vars are set before touching tenant-aware tables.
            from apps.tenants.rls import set_current_tenant

            set_current_tenant(str(tenant.id))

            defaults = {"type_preferences": UserNotificationPreferences.get_defaults()}

            prefs, _created = UserNotificationPreferences.objects.get_or_create(
                user=request.user,
                tenant=tenant,
                defaults=defaults,
            )

        except Exception as e:
            logger.error(f"[NotificationPreferences] get_or_create failed: {e}", exc_info=True)
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        serializer = UserNotificationPreferencesSerializer(prefs)
        return Response(serializer.data)

    def put(self, request):
        """Update notification preferences."""
        tenant = getattr(request, 'tenant', None)
        if not tenant:
            return Response({"error": "Tenant context required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            from apps.tenants.rls import set_current_tenant

            set_current_tenant(str(tenant.id))

            defaults = {"type_preferences": UserNotificationPreferences.get_defaults()}

            prefs, _created = UserNotificationPreferences.objects.get_or_create(
                user=request.user,
                tenant=tenant,
                defaults=defaults,
            )

        except Exception as e:
            logger.error(f"[NotificationPreferences] get_or_create failed: {e}", exc_info=True)
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        serializer = UserNotificationPreferencesSerializer(prefs, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@extend_schema(tags=["Workflows", "Action Items"], responses={200: ActionItemSerializer(many=True)})
class ActionItemsAPIView(APIView):
    """
    API endpoint for action items (tasks assigned to user).

    GET /api/v1/workflows/action-items/

    Safety:
    - If tenant context is missing (RLS session variable not set), return empty results (200) instead of 500.
    - Always filter by tenant to avoid cross-tenant leakage and RLS surprises.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get action items for current user."""
        from datetime import timedelta

        from django.utils import timezone

        user = request.user
        tenant = getattr(request, "tenant", None)

        # Graceful fallback if tenant not available (prevents RLS current_setting() errors)
        if not tenant:
            logger.warning("[ActionItems] No tenant found in request")
            return Response([])

        try:
            now = timezone.now()

            action_items = []

            # Get step assignments for user (explicit tenant filter)
            assignments = list(
                StepAssignment.objects.filter(
                    assigned_user=user,
                    tenant=tenant,
                ).select_related("form", "step")
            )

            if not assignments:
                return Response([])

            assignment_by_step_id = {a.step_id: a for a in assignments}
            step_ids = list(assignment_by_step_id.keys())

            # Bulk fetch step submissions in action_needed status.
            # Both tenant= and submission__tenant= are set intentionally for defense-in-depth RLS.
            step_submissions = (
                FormStepSubmission.objects.filter(
                    step_id__in=step_ids,
                    tenant=tenant,
                    status=StepSubmissionStatus.ACTION_NEEDED,
                    submission__status="in_progress",
                    submission__tenant=tenant,
                )
                .select_related("submission", "submission__form", "step")
                .order_by("-created_at")
            )

            for step_sub in step_submissions:
                assignment = assignment_by_step_id.get(step_sub.step_id)
                if not assignment:
                    continue

                form = assignment.form or getattr(step_sub.submission, "form", None)
                form_name = form.name if form else ""
                form_description = getattr(form, "description", "") or ""

                step = assignment.step or step_sub.step
                step_name = (step.step_name if step else None) or (step.entity_type if step else "")

                due_date = None
                is_overdue = False
                if assignment.due_days:
                    due_date = step_sub.created_at + timedelta(days=assignment.due_days)
                    is_overdue = due_date < now

                action_items.append(
                    {
                        "id": step_sub.id,
                        "type": "form_step",
                        "title": f"{form_name}: {step_name}",
                        "description": form_description,
                        "form_name": form_name,
                        "step_name": step_name,
                        "submission_id": step_sub.submission_id,
                        "priority": "urgent" if is_overdue else ("high" if assignment.is_required else "normal"),
                        "status": step_sub.status,
                        "due_date": due_date,
                        "is_overdue": is_overdue,
                        "assigned_at": step_sub.created_at,
                        "entity_type": step.entity_type if step else "",
                        "entity_id": step_sub.id,
                        "related_po_value": None,
                        "related_po_currency": None,
                    }
                )

            # Sort by priority and due date
            action_items.sort(
                key=lambda x: (
                    {"urgent": 0, "high": 1, "normal": 2, "low": 3}.get(x["priority"], 2),
                    x["due_date"] or now + timedelta(days=365),
                    x["assigned_at"],
                )
            )

            serializer = ActionItemSerializer(action_items, many=True)
            return Response(serializer.data)

        except Exception as e:
            logger.error(f"[ActionItems] Failed to fetch action items: {str(e)}", exc_info=True)
            try:
                import sentry_sdk

                sentry_sdk.capture_exception(e)
            except ImportError:
                pass

            # Return 200 with empty data, not 500
            return Response([], status=status.HTTP_200_OK)


@extend_schema(tags=["Workflows", "Action Items"])
class ActionItemCountsAPIView(APIView):
    """
    API endpoint for action item counts.

    GET /api/v1/workflows/action-items/counts/
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: ActionItemCountsSerializer})
    def get(self, request):
        """Get counts of action items for current user."""
        from collections import defaultdict
        from datetime import timedelta

        from django.utils import timezone
        user = request.user
        tenant = getattr(request, 'tenant', None)

        # Graceful fallback if tenant not available
        if not tenant:
            logger.warning('[ActionItemCounts] No tenant found in request')
            return Response({
                "total": 0,
                "overdue": 0,
                "due_today": 0,
                "due_this_week": 0,
                "by_priority": {},
                "by_form": [],
            })

        try:
            now = timezone.now()
            today = now.date()
            week_from_now = today + timedelta(days=7)

            counts = {
                "total": 0,
                "overdue": 0,
                "due_today": 0,
                "due_this_week": 0,
                "by_priority": defaultdict(int),
                "by_form": [],
            }
            form_counts = defaultdict(int)

            # Get step assignments for user with explicit tenant filter
            assignments = list(
                StepAssignment.objects.filter(
                    assigned_user=user,
                    tenant=tenant,
                ).select_related("form", "step")
            )

            if not assignments:
                serializer = ActionItemCountsSerializer({
                    **counts,
                    "by_priority": {},
                    "by_form": [],
                })
                return Response(serializer.data)

            assignment_by_step_id = {a.step_id: a for a in assignments}
            step_ids = list(assignment_by_step_id.keys())

            # Bulk fetch step submissions in action_needed status.
            step_submissions = (
                FormStepSubmission.objects.filter(
                    step_id__in=step_ids,
                    tenant=tenant,
                    status=StepSubmissionStatus.ACTION_NEEDED,
                    submission__status="in_progress",
                    submission__tenant=tenant,
                )
                .select_related("submission", "submission__form", "step")
                .order_by("-created_at")
            )

            for step_sub in step_submissions:
                assignment = assignment_by_step_id.get(step_sub.step_id)
                if not assignment:
                    continue

                counts["total"] += 1

                form = assignment.form or getattr(step_sub.submission, "form", None)
                if form:
                    form_counts[form.name] += 1

                due_date = None
                is_overdue = False
                if assignment.due_days:
                    due_date = step_sub.created_at + timedelta(days=assignment.due_days)
                    is_overdue = due_date < now

                    if is_overdue:
                        counts["overdue"] += 1
                    elif due_date.date() == today:
                        counts["due_today"] += 1
                    elif due_date.date() <= week_from_now:
                        counts["due_this_week"] += 1

                priority = "urgent" if is_overdue else ("high" if assignment.is_required else "normal")
                counts["by_priority"][priority] += 1

            counts["by_form"] = [
                {"form_name": name, "count": count} for name, count in sorted(form_counts.items(), key=lambda x: -x[1])
            ]
            counts["by_priority"] = dict(counts["by_priority"])

            serializer = ActionItemCountsSerializer(counts)
            return Response(serializer.data)

        except Exception as e:
            # Log error to Sentry if available
            logger.error(f'[ActionItemCounts] Failed to fetch counts: {str(e)}', exc_info=True)
            
            # Send to Sentry if configured
            try:
                import sentry_sdk
                sentry_sdk.capture_exception(e)
            except ImportError:
                pass  # Sentry not configured
            
            # Return graceful empty response
            return Response({
                "total": 0,
                "overdue": 0,
                "due_today": 0,
                "due_this_week": 0,
                "by_priority": {},
                "by_form": [],
            }, status=status.HTTP_200_OK)  # Return 200 with empty data, not 500


# =============================================================================
# WORKFORMS PERMISSION API (Phase 4.2)
# =============================================================================


class WorkFormPermissionsAPIView(APIView):
    """
    API endpoint for getting user's WorkForms permissions.

    Phase 4.2: Enterprise-grade permission system.
    Returns comprehensive permission metadata based on user's tenant role.

    GET /api/v1/workflows/permissions/

    Returns:
        {
            'can_create': bool,
            'can_edit': bool,
            'can_publish': bool,
            'can_archive': bool,
            'can_delete': bool,
            'allowed_modes': ['wizard', 'visual', 'expert'],
            'allowed_node_categories': ['triggers', 'forms', ...],
            'can_access_system_templates': bool,
            'can_create_global_templates': bool,
            'max_active_flows': int | None,
            'role': str
        }
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get permission metadata for the current user."""
        user = request.user
        tenant = getattr(request, "tenant", None)

        if not tenant:
            return Response({"error": "No tenant context available"}, status=status.HTTP_400_BAD_REQUEST)

        permissions = WorkFormPermissionHelper.get_permissions_for_user(user, tenant)

        return Response(permissions)


# =============================================================================
# AI WORKFLOW SUGGESTION API (Phase 2.1 Prep)
# =============================================================================


class SuggestNodesView(APIView):
    """
    API endpoint for AI-powered workflow node suggestions.
    
    Phase 2.1: AI Field Suggestions with graceful degradation.
    Uses OpenAI to suggest next workflow steps based on context.
    Falls back to static templates if AI is unavailable.
    
    POST /api/v1/workflows/suggest-nodes/
    
    Request:
        {
            'current_flow': {...},  # Current workflow state
            'context': {...}        # Additional context
        }
    
    Response:
        {
            'suggestions': [{type, label, description, reasoning, priority}],
            'confidence': float,
            'mode': 'ai' | 'static'
        }
    """
    
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        """Generate workflow node suggestions."""
        from .services.prompter import AIPrompter
        from django.core.cache import cache
        import hashlib
        import json
        
        try:
            prompter = AIPrompter()
            tenant = getattr(request, 'tenant', None)
            
            if not tenant:
                return Response(
                    {"error": "No tenant context available"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            current_flow = request.data.get('current_flow', {})
            context = request.data.get('context', {})
            
            # Generate cache key based on flow state + context
            cache_input = json.dumps({
                'tenant_id': str(tenant.id),
                'flow': current_flow,
                'context': context
            }, sort_keys=True)
            cache_key = f"ai_suggestions_{hashlib.md5(cache_input.encode()).hexdigest()}"
            
            # Check Redis cache (10 minute TTL)
            cached_result = cache.get(cache_key)
            if cached_result:
                logger.debug(f"Returning cached AI suggestions for tenant {tenant.id}")
                cached_result['cached'] = True
                return Response(cached_result)
            
            # Try AI-powered suggestions
            try:
                import os
                from openai import OpenAI
                
                openai_key = os.environ.get('OPENAI_API_KEY')
                
                if not openai_key:
                    raise ValueError("OpenAI API key not configured")
                
                # Build prompt with context
                prompt = prompter.build_suggestion_prompt(
                    tenant=tenant,
                    current_flow=current_flow,
                    additional_context=context
                )
                
                # Call OpenAI API
                client = OpenAI(api_key=openai_key)
                
                response = client.chat.completions.create(
                    model="gpt-4o-mini",  # Fast, cost-effective model
                    messages=[
                        {
                            "role": "system",
                            "content": "You are a workflow automation expert. Suggest the next logical steps in a workflow."
                        },
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ],
                    temperature=0.7,
                    max_tokens=500,
                    response_format={"type": "json_object"}
                )
                
                # Parse AI response
                ai_result = json.loads(response.choices[0].message.content)
                
                result = {
                    'suggestions': ai_result.get('suggestions', []),
                    'confidence': ai_result.get('confidence', 0.8),
                    'mode': 'ai',
                    'reasoning': ai_result.get('reasoning', ''),
                    'cached': False
                }
                
                # Cache for 10 minutes
                cache.set(cache_key, result, 600)
                
                logger.info(f"AI suggestions generated for tenant {tenant.id}")
                return Response(result)
                
            except (ValueError, ImportError) as e:
                # Service not configured - graceful degradation
                logger.info(f"AI suggestions unavailable ({e}), using static fallback")
                fallback = prompter.get_fallback_suggestions(tenant, current_flow)
                
                return Response({
                    'suggestions': fallback['suggestions'],
                    'confidence': fallback['confidence'],
                    'mode': fallback['mode'],
                    'reason': 'AI unavailable - using static templates',
                    'cached': False
                })
            
            except Exception as e:
                # AI call failed - graceful degradation
                logger.warning(f"AI call failed ({e}), using static fallback")
                fallback = prompter.get_fallback_suggestions(tenant, current_flow)
                
                return Response({
                    'suggestions': fallback['suggestions'],
                    'confidence': fallback['confidence'],
                    'mode': fallback['mode'],
                    'reason': f'AI error: {str(e)[:100]}',
                    'cached': False
                })
                
        except Exception as e:
            logger.error(f"Suggestion generation failed: {e}")
            return Response(
                {"error": "Failed to generate suggestions"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
