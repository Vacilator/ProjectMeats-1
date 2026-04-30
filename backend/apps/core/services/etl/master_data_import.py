"""Write-capable master-data ETL pass for GA-01.3."""

from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import dataclass
import hashlib
import json
from pathlib import Path
from typing import Any, Callable

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q

from apps.core.models import (
    AccountingPaymentTermsChoices,
    CreditLimitChoices,
    ETLImportBatch,
    ETLImportRowJournal,
    PhoneTypeChoices,
    ProteinTypeChoices,
    StatusChoices,
)
from tenant_apps.contacts.models import Contact, ContactDepartmentChoices
from tenant_apps.customers.models import Customer, IndustryChoices
from tenant_apps.locations.models import Location, LocationTypeChoices
from tenant_apps.plants.models import Plant
from tenant_apps.products.models import MasterProduct
from tenant_apps.suppliers.models import Supplier

from .context import etl_execution_context
from .contracts import ENTITY_CONTRACTS, SIDE_EFFECT_SUPPRESSION_RULES, BatchManifest, build_contract_preview
from .journal import (
    build_command_options,
    checksum_manifest_payload,
    finalize_batch,
    get_or_start_batch,
    upsert_row_journal,
)
from .runtime import LoadedSourceRow, load_source_rows


MASTER_DATA_APPLY_ORDER = (
    'products',
    'suppliers',
    'customers',
    'plants',
    'locations',
    'contacts',
)

TRUE_VALUES = {'1', 'true', 'yes', 'y', 'on'}
FALSE_VALUES = {'0', 'false', 'no', 'n', 'off'}


class RowPreparationError(ValueError):
    """Structured ETL row error for journal-friendly failures."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


@dataclass
class PreparedRow:
    entity: str
    target_model: str
    source_identifier: str
    lookup_key: str
    matched_instance: Any | None
    defaults: dict[str, Any]
    warnings: list[str]
    after_save: Callable[[Any], None] | None = None


def execute_master_data_import(
    manifest: BatchManifest,
    *,
    manifest_payload: dict[str, Any],
    manifest_path: str | Path,
    resolved_tenant,
    entity: str | None = None,
    limit: int | None = None,
    output_format: str = 'text',
    actor_user_id: int | None = None,
    actor_email: str | None = None,
) -> dict[str, Any]:
    """Execute the first write-capable master-data import pass."""

    manifest_dir = Path(manifest_path).resolve().parent
    actor = _resolve_actor(actor_user_id)
    effective_actor_email = actor_email or getattr(actor, 'email', '') or ''
    command_options = build_command_options(
        entity=entity,
        limit=limit,
        output_format=output_format,
        apply=True,
        actor_user_id=actor_user_id,
        actor_email=effective_actor_email,
    )
    manifest_checksum = checksum_manifest_payload(manifest_payload)
    batch, created = get_or_start_batch(
        tenant=resolved_tenant,
        manifest_payload=manifest_payload,
        manifest_checksum=manifest_checksum,
        command_options=command_options,
    )
    preview = build_contract_preview(manifest, resolved_tenant=resolved_tenant)

    try:
        with etl_execution_context(
            tenant=resolved_tenant,
            actor=actor,
            actor_email=effective_actor_email,
            suppress_external_side_effects=True,
        ):
            summary, entity_summaries, processed_rows, resume_cursor = _process_manifest(
                manifest,
                manifest_dir=manifest_dir,
                resolved_tenant=resolved_tenant,
                actor=actor,
                batch=batch,
                entity_filter=entity,
                limit=limit,
            )
        finalize_batch(
            batch=batch,
            summary=summary,
            resume_cursor=resume_cursor,
            status=ETLImportBatch.Status.COMPLETED,
        )
    except Exception as exc:
        finalize_batch(
            batch=batch,
            summary={},
            resume_cursor={},
            status=ETLImportBatch.Status.FAILED,
            failure_message=str(exc),
        )
        raise

    preview.update(
        {
            'batch_run': {
                'batch_id': str(batch.id),
                'run_key': batch.run_key,
                'created': created,
                'status': batch.status,
                'mode': batch.mode,
                'execution_mode': 'apply_master_data',
                'manifest_checksum': manifest_checksum,
                'command_options': command_options,
                'summary': summary,
                'resume_cursor': resume_cursor,
            },
            'entity_results': entity_summaries,
            'row_journal_count': processed_rows,
        }
    )
    return preview


def _process_manifest(
    manifest: BatchManifest,
    *,
    manifest_dir: Path,
    resolved_tenant,
    actor,
    batch: ETLImportBatch,
    entity_filter: str | None,
    limit: int | None,
) -> tuple[dict[str, Any], list[dict[str, Any]], int, dict[str, Any]]:
    selected_entities = _selected_entities(manifest, entity_filter=entity_filter)
    source_map: dict[str, list[Any]] = defaultdict(list)
    for source in manifest.sources:
        source_map[source.entity].append(source)

    counters = Counter()
    entity_counts: dict[str, Counter] = defaultdict(Counter)
    processed_rows = 0
    resume_cursor: dict[str, Any] = {}

    for entity_name in selected_entities:
        for source in source_map.get(entity_name, []):
            loaded_rows = load_source_rows(source, manifest_dir=manifest_dir)
            for loaded_row in loaded_rows:
                if limit is not None and processed_rows >= int(limit):
                    break

                with transaction.atomic():
                    row_result = _apply_row(
                        loaded_row,
                        tenant=resolved_tenant,
                        actor=actor,
                    )
                    upsert_row_journal(batch=batch, tenant=resolved_tenant, row_result=row_result)

                planned_action = row_result['planned_action']
                counters['total_rows'] += 1
                counters['processed_rows'] += 1
                counters[planned_action] += 1
                entity_counts[row_result['entity']]['rows'] += 1
                entity_counts[row_result['entity']][planned_action] += 1

                processed_rows += 1
                resume_cursor = {
                    'entity': row_result['entity'],
                    'source_path': row_result['source_path'],
                    'source_sheet': row_result['source_sheet'],
                    'source_row_number': row_result['source_row_number'],
                }

            if limit is not None and processed_rows >= int(limit):
                break
        if limit is not None and processed_rows >= int(limit):
            break

    summary = {
        'total_rows': counters['total_rows'],
        'processed_rows': counters['processed_rows'],
        'would_create_count': counters[ETLImportRowJournal.PlannedAction.WOULD_CREATE],
        'would_update_count': counters[ETLImportRowJournal.PlannedAction.WOULD_UPDATE],
        'would_skip_count': counters[ETLImportRowJournal.PlannedAction.WOULD_SKIP],
        'error_count': counters[ETLImportRowJournal.PlannedAction.ERROR],
        'created_count': counters[ETLImportRowJournal.PlannedAction.WOULD_CREATE],
        'updated_count': counters[ETLImportRowJournal.PlannedAction.WOULD_UPDATE],
        'skipped_count': counters[ETLImportRowJournal.PlannedAction.WOULD_SKIP],
    }
    entity_summaries = [
        {
            'entity': entity_name,
            'row_count': counter['rows'],
            'would_create_count': counter[ETLImportRowJournal.PlannedAction.WOULD_CREATE],
            'would_update_count': counter[ETLImportRowJournal.PlannedAction.WOULD_UPDATE],
            'would_skip_count': counter[ETLImportRowJournal.PlannedAction.WOULD_SKIP],
            'error_count': counter[ETLImportRowJournal.PlannedAction.ERROR],
            'created_count': counter[ETLImportRowJournal.PlannedAction.WOULD_CREATE],
            'updated_count': counter[ETLImportRowJournal.PlannedAction.WOULD_UPDATE],
            'skipped_count': counter[ETLImportRowJournal.PlannedAction.WOULD_SKIP],
        }
        for entity_name, counter in entity_counts.items()
    ]
    return summary, entity_summaries, processed_rows, resume_cursor


def _selected_entities(manifest: BatchManifest, *, entity_filter: str | None) -> tuple[str, ...]:
    declared_entities = tuple(dict.fromkeys(source.entity for source in manifest.sources))
    if entity_filter:
        if entity_filter not in MASTER_DATA_APPLY_ORDER:
            raise ValueError(f"Apply mode currently supports only master-data entities, not '{entity_filter}'.")
        if entity_filter not in declared_entities:
            raise ValueError(f"Entity '{entity_filter}' is not declared in the batch manifest.")
        return (entity_filter,)

    unsupported = [entity for entity in declared_entities if entity not in MASTER_DATA_APPLY_ORDER]
    if unsupported:
        joined = ', '.join(sorted(unsupported))
        raise ValueError(
            f"Apply mode currently supports only master-data entities; unsupported sources detected: {joined}."
        )

    return tuple(entity for entity in MASTER_DATA_APPLY_ORDER if entity in declared_entities)


def _apply_row(loaded_row: LoadedSourceRow, *, tenant, actor) -> dict[str, Any]:
    contract = ENTITY_CONTRACTS[loaded_row.entity]
    normalized_payload = _normalize_payload(loaded_row.payload)
    row_fingerprint = _build_row_fingerprint(loaded_row.entity, loaded_row.source_path, loaded_row.payload)

    try:
        prepared = _prepare_row(loaded_row, tenant=tenant, actor=actor, normalized_payload=normalized_payload)
        planned_action = _planned_action(prepared)
        target_identifier = str(prepared.matched_instance.pk) if prepared.matched_instance else ''

        if planned_action == ETLImportRowJournal.PlannedAction.WOULD_CREATE:
            instance = _create_instance(prepared, tenant=tenant)
            target_identifier = str(instance.pk)
        elif planned_action == ETLImportRowJournal.PlannedAction.WOULD_UPDATE:
            instance = _update_instance(prepared)
            target_identifier = str(instance.pk)

        return {
            'entity': loaded_row.entity,
            'source_path': loaded_row.source_path,
            'source_sheet': loaded_row.source_sheet or '',
            'source_row_number': loaded_row.source_row_number,
            'source_identifier': prepared.source_identifier,
            'normalized_lookup_key': prepared.lookup_key,
            'row_fingerprint': row_fingerprint,
            'planned_action': planned_action,
            'target_model': prepared.target_model,
            'target_identifier': target_identifier,
            'status': ETLImportRowJournal.Status.PLANNED,
            'error_code': '',
            'error_message': '',
            'side_effects_suppressed': list(SIDE_EFFECT_SUPPRESSION_RULES),
            'raw_payload': loaded_row.payload,
            'normalized_payload': normalized_payload,
            'warnings': prepared.warnings,
        }
    except RowPreparationError as exc:
        return {
            'entity': loaded_row.entity,
            'source_path': loaded_row.source_path,
            'source_sheet': loaded_row.source_sheet or '',
            'source_row_number': loaded_row.source_row_number,
            'source_identifier': '',
            'normalized_lookup_key': '',
            'row_fingerprint': row_fingerprint,
            'planned_action': ETLImportRowJournal.PlannedAction.ERROR,
            'target_model': contract.target_model,
            'target_identifier': '',
            'status': ETLImportRowJournal.Status.ERROR,
            'error_code': exc.code,
            'error_message': str(exc),
            'side_effects_suppressed': list(SIDE_EFFECT_SUPPRESSION_RULES),
            'raw_payload': loaded_row.payload,
            'normalized_payload': normalized_payload,
            'warnings': [],
        }


def _prepare_row(loaded_row: LoadedSourceRow, *, tenant, actor, normalized_payload: dict[str, Any]) -> PreparedRow:
    dispatch = {
        'products': _prepare_product,
        'suppliers': _prepare_supplier,
        'customers': _prepare_customer,
        'plants': _prepare_plant,
        'locations': _prepare_location,
        'contacts': _prepare_contact,
    }
    try:
        handler = dispatch[loaded_row.entity]
    except KeyError as exc:
        raise RowPreparationError('unsupported_entity', f"Unsupported master-data entity '{loaded_row.entity}'.") from exc
    return handler(normalized_payload, tenant=tenant, actor=actor)


def _prepare_product(payload: dict[str, Any], *, tenant, actor) -> PreparedRow:
    protein = _required(payload, 'protein', 'protein_type')
    item_name = _required(payload, 'item_name', 'name')
    product_type = _required(payload, 'type', 'product_type')
    trim = _required(payload, 'trim')
    defaults = {
        'protein': _normalize_choice(protein, ProteinTypeChoices.choices, 'protein'),
        'item_name': item_name,
        'type': _normalize_choice(product_type, MasterProduct.TYPE_CHOICES, 'type'),
        'trim': _normalize_choice(trim, MasterProduct.TRIM_CHOICES, 'trim'),
        'is_active': _normalize_bool(payload.get('is_active', True), default=True),
    }
    match_filter = {
        'tenant': tenant,
        'protein': defaults['protein'],
        'item_name': defaults['item_name'],
        'type': defaults['type'],
        'trim': defaults['trim'],
    }
    matched = MasterProduct.objects.filter(**match_filter).order_by('pk').first()
    identifier = (
        f"protein={defaults['protein']}|item_name={defaults['item_name']}|"
        f"type={defaults['type']}|trim={defaults['trim']}"
    )
    return PreparedRow(
        entity='products',
        target_model=ENTITY_CONTRACTS['products'].target_model,
        source_identifier=identifier,
        lookup_key=identifier,
        matched_instance=matched,
        defaults=defaults,
        warnings=[],
    )


def _prepare_supplier(payload: dict[str, Any], *, tenant, actor) -> PreparedRow:
    name = _required(payload, 'name')
    email = _value(payload, 'email')
    defaults = {
        'name': name,
        'contact_person': _value(payload, 'contact_person'),
        'email': email or None,
        'phone': _value(payload, 'phone'),
        'phone_type': _normalize_choice(
            _value(payload, 'phone_type') or PhoneTypeChoices.OFFICE,
            PhoneTypeChoices.choices,
            'phone_type',
        ),
        'phone_mobile': _value(payload, 'phone_mobile', 'mobile_phone'),
        'phone_office': _value(payload, 'phone_office', 'office_phone'),
        'phone_office_extension': _value(payload, 'phone_office_extension', 'office_phone_ext'),
        'street_address': _value(payload, 'street_address', 'address'),
        'address': _value(payload, 'address', 'street_address'),
        'city': _value(payload, 'city'),
        'state': _value(payload, 'state'),
        'zip_code': _value(payload, 'zip_code', 'state_zip'),
        'country': _value(payload, 'country') or 'USA',
        'preferred_protein_types': _normalize_choice_list(
            payload.get('preferred_protein_types'),
            ProteinTypeChoices.choices,
            'preferred_protein_types',
        ),
        'payment_terms': _normalize_optional_choice(
            payload.get('payment_terms', payload.get('accounting_payment_terms')),
            AccountingPaymentTermsChoices.choices,
            'payment_terms',
        ),
        'credit_limit': _normalize_optional_choice(
            payload.get('credit_limit', payload.get('credit_limits')),
            CreditLimitChoices.choices,
            'credit_limit',
        ),
        'account_line_of_credit': _value(payload, 'account_line_of_credit', 'accounting_line_of_credit'),
    }
    matched = _match_named_party(Supplier, tenant=tenant, name=defaults['name'], email=defaults['email'])
    identifier = f"name={defaults['name']}|email={defaults['email'] or ''}"
    return PreparedRow(
        entity='suppliers',
        target_model=ENTITY_CONTRACTS['suppliers'].target_model,
        source_identifier=identifier,
        lookup_key=identifier,
        matched_instance=matched,
        defaults=defaults,
        warnings=[],
    )


def _prepare_customer(payload: dict[str, Any], *, tenant, actor) -> PreparedRow:
    name = _required(payload, 'name')
    email = _value(payload, 'email')
    defaults = {
        'name': name,
        'contact_person': _value(payload, 'contact_person'),
        'email': email or None,
        'phone': _value(payload, 'phone'),
        'phone_type': _normalize_choice(
            _value(payload, 'phone_type') or PhoneTypeChoices.OFFICE,
            PhoneTypeChoices.choices,
            'phone_type',
        ),
        'phone_mobile': _value(payload, 'phone_mobile', 'mobile_phone'),
        'phone_office': _value(payload, 'phone_office', 'office_phone'),
        'phone_office_extension': _value(payload, 'phone_office_extension', 'office_phone_ext'),
        'street_address': _value(payload, 'street_address', 'address'),
        'address': _value(payload, 'address', 'street_address'),
        'city': _value(payload, 'city'),
        'state': _value(payload, 'state'),
        'zip_code': _value(payload, 'zip_code', 'state_zip'),
        'country': _value(payload, 'country') or 'USA',
        'buyer_contact_name': _value(payload, 'buyer_contact_name'),
        'buyer_contact_phone': _value(payload, 'buyer_contact_phone'),
        'buyer_contact_email': _value(payload, 'buyer_contact_email'),
        'preferred_protein_types': _normalize_choice_list(
            payload.get('preferred_protein_types'),
            ProteinTypeChoices.choices,
            'preferred_protein_types',
        ),
        'industry_array': _normalize_choice_list(
            payload.get('industry_array'),
            IndustryChoices.choices,
            'industry_array',
        ),
        'payment_terms': _normalize_optional_choice(
            payload.get('payment_terms', payload.get('accounting_payment_terms')),
            AccountingPaymentTermsChoices.choices,
            'payment_terms',
        ),
        'credit_limit': _normalize_optional_choice(
            payload.get('credit_limit', payload.get('credit_limits')),
            CreditLimitChoices.choices,
            'credit_limit',
        ),
        'account_line_of_credit': _value(payload, 'account_line_of_credit', 'accounting_line_of_credit'),
    }
    matched = _match_named_party(Customer, tenant=tenant, name=defaults['name'], email=defaults['email'])
    identifier = f"name={defaults['name']}|email={defaults['email'] or ''}"
    return PreparedRow(
        entity='customers',
        target_model=ENTITY_CONTRACTS['customers'].target_model,
        source_identifier=identifier,
        lookup_key=identifier,
        matched_instance=matched,
        defaults=defaults,
        warnings=[],
    )


def _prepare_plant(payload: dict[str, Any], *, tenant, actor) -> PreparedRow:
    name = _required(payload, 'name')
    supplier = _resolve_supplier(payload, tenant=tenant)
    plant_est_num = _value(payload, 'plant_est_num', 'plant_est_number')
    defaults = {
        'name': name,
        'plant_est_num': plant_est_num,
        'plant_type': _normalize_choice(
            _value(payload, 'plant_type', 'type_of_plant') or 'processing',
            Plant.PLANT_TYPE_CHOICES,
            'plant_type',
        ),
        'address': _value(payload, 'address', 'street_address'),
        'city': _value(payload, 'city'),
        'state': _value(payload, 'state'),
        'zip_code': _value(payload, 'zip_code', 'state_zip'),
        'country': _value(payload, 'country') or 'USA',
        'booking_contact_email': _value(payload, 'booking_contact_email', 'contact_email'),
        'booking_contact_phone': _value(payload, 'booking_contact_phone', 'contact_phone', 'phone'),
        'booking_contact_phone_type': _normalize_choice(
            _value(payload, 'booking_contact_phone_type', 'phone_type') or PhoneTypeChoices.OFFICE,
            PhoneTypeChoices.choices,
            'booking_contact_phone_type',
        ),
        'supplier': supplier,
        'is_active': _normalize_bool(payload.get('is_active', True), default=True),
    }
    if actor is not None and _model_has_field(Plant, 'created_by'):
        defaults['created_by'] = actor
    match_filter = {'tenant': tenant}
    if plant_est_num:
        match_filter['plant_est_num'] = plant_est_num
    else:
        match_filter['name'] = name
        if supplier is not None:
            match_filter['supplier'] = supplier
    matched = Plant.objects.filter(**match_filter).order_by('pk').first()
    identifier = f"name={name}"
    if plant_est_num:
        identifier = f"{identifier}|plant_est_num={plant_est_num}"
    return PreparedRow(
        entity='plants',
        target_model='tenant_apps.plants.models.Plant',
        source_identifier=identifier,
        lookup_key=identifier,
        matched_instance=matched,
        defaults=defaults,
        warnings=[],
    )


def _prepare_location(payload: dict[str, Any], *, tenant, actor) -> PreparedRow:
    name = _required(payload, 'name')
    supplier = _resolve_supplier(payload, tenant=tenant, required=False)
    customer = _resolve_customer(payload, tenant=tenant, required=False)
    code = _value(payload, 'code', 'location_code')
    defaults = {
        'name': name,
        'code': code,
        'location_type': _normalize_choice(
            _value(payload, 'location_type') or LocationTypeChoices.WAREHOUSE,
            LocationTypeChoices.choices,
            'location_type',
        ),
        'address': _value(payload, 'address', 'street_address'),
        'city': _value(payload, 'city'),
        'state': _value(payload, 'state'),
        'zip_code': _value(payload, 'zip_code', 'state_zip'),
        'country': _value(payload, 'country') or 'USA',
        'phone': _value(payload, 'phone'),
        'phone_type': _normalize_choice(
            _value(payload, 'phone_type') or PhoneTypeChoices.OFFICE,
            PhoneTypeChoices.choices,
            'phone_type',
        ),
        'email': _value(payload, 'email'),
        'contact_name': _value(payload, 'contact_name'),
        'supplier': supplier,
        'customer': customer,
        'is_active': _normalize_bool(payload.get('is_active', True), default=True),
    }
    if actor is not None and _model_has_field(Location, 'created_by'):
        defaults['created_by'] = actor
    match_filter = {'tenant': tenant}
    if code:
        match_filter['code'] = code
    else:
        match_filter['name'] = name
        match_filter['city'] = defaults['city']
        match_filter['state'] = defaults['state']
        if supplier is not None:
            match_filter['supplier'] = supplier
        if customer is not None:
            match_filter['customer'] = customer
    matched = Location.objects.filter(**match_filter).order_by('pk').first()
    identifier = f"name={name}|city={defaults['city']}|state={defaults['state']}"
    if code:
        identifier = f"code={code}"
    return PreparedRow(
        entity='locations',
        target_model=ENTITY_CONTRACTS['locations'].target_model,
        source_identifier=identifier,
        lookup_key=identifier,
        matched_instance=matched,
        defaults=defaults,
        warnings=[],
    )


def _prepare_contact(payload: dict[str, Any], *, tenant, actor) -> PreparedRow:
    first_name = _required(payload, 'first_name')
    last_name = _required(payload, 'last_name')
    supplier = _resolve_supplier(payload, tenant=tenant, required=False)
    customer = _resolve_customer(payload, tenant=tenant, required=False)
    plant = _resolve_plant(payload, tenant=tenant, required=False)
    location = _resolve_location(payload, tenant=tenant, required=False)

    if supplier is None and plant is not None:
        supplier = plant.supplier
    if customer is None and location is not None:
        customer = location.customer

    if supplier is None and customer is None and plant is None and location is None:
        raise RowPreparationError(
            'missing_parent_reference',
            'Contacts require at least one resolvable supplier, customer, plant, or location reference.',
        )

    email = _value(payload, 'email')
    phone = _value(payload, 'phone')
    defaults = {
        'first_name': first_name,
        'last_name': last_name,
        'email': email or None,
        'phone': phone or None,
        'phone_type': _normalize_choice(
            _value(payload, 'phone_type') or PhoneTypeChoices.OFFICE,
            PhoneTypeChoices.choices,
            'phone_type',
        ),
        'company': _value(payload, 'company') or _parent_company_name(
            supplier=supplier,
            customer=customer,
            plant=plant,
            location=location,
        ),
        'position': _value(payload, 'position'),
        'title': _value(payload, 'title', 'contact_title'),
        'department': _normalize_optional_choice(
            payload.get('department'),
            ContactDepartmentChoices.choices,
            'department',
        ),
        'status': _normalize_choice(
            _value(payload, 'status') or StatusChoices.ACTIVE,
            StatusChoices.choices,
            'status',
        ),
        'supplier': supplier,
        'customer': customer,
        'plant': plant,
        'location': location,
        'mobile_phone': _value(payload, 'mobile_phone'),
        'office_phone': _value(payload, 'office_phone'),
        'office_phone_ext': _value(payload, 'office_phone_ext'),
        'notes': _value(payload, 'notes'),
    }
    match_filter = {
        'tenant': tenant,
        'first_name': first_name,
        'last_name': last_name,
        'supplier': supplier,
        'customer': customer,
        'plant': plant,
        'location': location,
    }
    if email:
        match_filter['email'] = email
    elif phone:
        match_filter['phone'] = phone
    matched = Contact.objects.filter(**match_filter).order_by('pk').first()
    identifier_parts = [f"first_name={first_name}", f"last_name={last_name}"]
    if email:
        identifier_parts.append(f"email={email}")
    elif phone:
        identifier_parts.append(f"phone={phone}")
    if supplier is not None:
        identifier_parts.append(f"supplier={supplier.pk}")
    if customer is not None:
        identifier_parts.append(f"customer={customer.pk}")
    if plant is not None:
        identifier_parts.append(f"plant={plant.pk}")
    if location is not None:
        identifier_parts.append(f"location={location.pk}")
    identifier = '|'.join(identifier_parts)
    return PreparedRow(
        entity='contacts',
        target_model=ENTITY_CONTRACTS['contacts'].target_model,
        source_identifier=identifier,
        lookup_key=identifier,
        matched_instance=matched,
        defaults=defaults,
        warnings=[],
        after_save=_sync_contact_links,
    )


def _create_instance(prepared: PreparedRow, *, tenant):
    model_class = _resolve_model_class(prepared.entity)
    instance = model_class.objects.create(tenant=tenant, **prepared.defaults)
    if prepared.after_save is not None:
        prepared.after_save(instance)
    return instance


def _update_instance(prepared: PreparedRow):
    instance = prepared.matched_instance
    changed_fields: list[str] = []
    for field_name, value in prepared.defaults.items():
        if _values_equal(getattr(instance, field_name), value):
            continue
        setattr(instance, field_name, value)
        changed_fields.append(field_name)

    if changed_fields:
        instance.save(update_fields=changed_fields + ['updated_at'] if _model_has_field(instance.__class__, 'updated_at') else changed_fields)
    if prepared.after_save is not None:
        prepared.after_save(instance)
    return instance


def _planned_action(prepared: PreparedRow) -> str:
    if prepared.matched_instance is None:
        return ETLImportRowJournal.PlannedAction.WOULD_CREATE
    for field_name, value in prepared.defaults.items():
        if not _values_equal(getattr(prepared.matched_instance, field_name), value):
            return ETLImportRowJournal.PlannedAction.WOULD_UPDATE
    return ETLImportRowJournal.PlannedAction.WOULD_SKIP


def _resolve_model_class(entity: str):
    mapping = {
        'products': MasterProduct,
        'suppliers': Supplier,
        'customers': Customer,
        'plants': Plant,
        'locations': Location,
        'contacts': Contact,
    }
    return mapping[entity]


def _match_named_party(model_class, *, tenant, name: str | None = None, email: str | None = None):
    queryset = model_class.objects.filter(tenant=tenant)
    if name:
        queryset = queryset.filter(name=name)
    if email:
        queryset = queryset.filter(email=email)
    elif name:
        queryset = queryset.filter(Q(email__isnull=True) | Q(email=''))
    return queryset.order_by('pk').first()


def _resolve_actor(actor_user_id: int | None):
    if not actor_user_id:
        return None
    return get_user_model().objects.filter(pk=actor_user_id).first()


def _resolve_supplier(payload: dict[str, Any], *, tenant, required: bool = True):
    supplier_name = _value(payload, 'supplier_name')
    supplier_email = _value(payload, 'supplier_email')
    has_reference = bool(supplier_name or supplier_email)
    if not has_reference:
        if required:
            raise RowPreparationError(
                'missing_parent_reference',
                'Row is missing the supplier_name/supplier_email reference required for import.',
            )
        return None
    supplier = _match_named_party(
        Supplier,
        tenant=tenant,
        name=supplier_name or None,
        email=supplier_email or None,
    )
    if supplier is None and (required or has_reference):
        raise RowPreparationError(
            'parent_not_found',
            f"Supplier reference could not be resolved for name='{supplier_name}' email='{supplier_email}'.",
        )
    return supplier


def _resolve_customer(payload: dict[str, Any], *, tenant, required: bool = True):
    customer_name = _value(payload, 'customer_name')
    customer_email = _value(payload, 'customer_email')
    has_reference = bool(customer_name or customer_email)
    if not has_reference:
        if required:
            raise RowPreparationError(
                'missing_parent_reference',
                'Row is missing the customer_name/customer_email reference required for import.',
            )
        return None
    customer = _match_named_party(
        Customer,
        tenant=tenant,
        name=customer_name or None,
        email=customer_email or None,
    )
    if customer is None and (required or has_reference):
        raise RowPreparationError(
            'parent_not_found',
            f"Customer reference could not be resolved for name='{customer_name}' email='{customer_email}'.",
        )
    return customer


def _resolve_plant(payload: dict[str, Any], *, tenant, required: bool = True):
    plant_name = _value(payload, 'plant_name')
    plant_est_num = _value(payload, 'plant_est_num', 'plant_est_number')
    has_reference = bool(plant_name or plant_est_num)
    if not has_reference:
        if required:
            raise RowPreparationError(
                'missing_parent_reference',
                'Row is missing the plant_name/plant_est_num reference required for import.',
            )
        return None
    qs = Plant.objects.filter(tenant=tenant)
    if plant_est_num:
        qs = qs.filter(plant_est_num=plant_est_num)
    if plant_name:
        qs = qs.filter(name=plant_name)
    plant = qs.order_by('pk').first()
    if plant is None and (required or has_reference):
        raise RowPreparationError(
            'parent_not_found',
            f"Plant reference could not be resolved for name='{plant_name}' est='{plant_est_num}'.",
        )
    return plant


def _resolve_location(payload: dict[str, Any], *, tenant, required: bool = True):
    code = _value(payload, 'location_code', 'code')
    name = _value(payload, 'location_name', 'name')
    city = _value(payload, 'location_city', 'city')
    state = _value(payload, 'location_state', 'state')
    has_reference = bool(code or name)
    if not has_reference:
        if required:
            raise RowPreparationError(
                'missing_parent_reference',
                'Row is missing the location_code or location_name reference required for import.',
            )
        return None
    qs = Location.objects.filter(tenant=tenant)
    if code:
        qs = qs.filter(code=code)
    else:
        qs = qs.filter(name=name)
        if city:
            qs = qs.filter(city=city)
        if state:
            qs = qs.filter(state=state)
    location = qs.order_by('pk').first()
    if location is None and (required or has_reference):
        raise RowPreparationError(
            'parent_not_found',
            f"Location reference could not be resolved for code='{code}' name='{name}'.",
        )
    return location


def _sync_contact_links(contact: Contact) -> None:
    contact.suppliers.set([contact.supplier] if contact.supplier_id else [])
    contact.customers.set([contact.customer] if contact.customer_id else [])


def _parent_company_name(*, supplier, customer, plant, location) -> str:
    if supplier is not None:
        return supplier.name
    if customer is not None:
        return customer.name
    if plant is not None and plant.supplier is not None:
        return plant.supplier.name
    if location is not None and location.customer is not None:
        return location.customer.name
    if location is not None and location.supplier is not None:
        return location.supplier.name
    return ''


def _normalize_payload(payload: dict[str, Any]) -> dict[str, Any]:
    return {str(key): _normalize_value(value) for key, value in payload.items()}


def _normalize_value(value: Any) -> Any:
    if value is None:
        return ''
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value
    if isinstance(value, list):
        return [_normalize_value(item) for item in value]
    if isinstance(value, tuple):
        return [_normalize_value(item) for item in value]
    model_pk = getattr(value, 'pk', None)
    if model_pk is not None:
        return str(model_pk)
    return str(value).strip()


def _build_row_fingerprint(entity: str, source_path: str, payload: dict[str, Any]) -> str:
    encoded = json.dumps(
        {'entity': entity, 'source_path': source_path, 'payload': payload},
        sort_keys=True,
        default=str,
        separators=(',', ':'),
    ).encode('utf-8')
    return hashlib.sha256(encoded).hexdigest()


def _required(payload: dict[str, Any], *names: str) -> str:
    value = _value(payload, *names)
    if value:
        return value
    joined = ', '.join(names)
    raise RowPreparationError('missing_natural_key', f"Row is missing required field(s): {joined}.")


def _value(payload: dict[str, Any], *names: str) -> str:
    for name in names:
        value = _normalize_value(payload.get(name))
        if value not in ('', None):
            return value
    return ''


def _normalize_choice(value: Any, choices, field_name: str) -> str:
    normalized = _normalize_value(value)
    if normalized == '':
        raise RowPreparationError('missing_required_field', f"Row is missing required choice field '{field_name}'.")
    for option_value, option_label in _iter_choices(choices):
        if normalized.casefold() in {str(option_value).casefold(), str(option_label).casefold()}:
            return str(option_value)
    raise RowPreparationError('invalid_choice', f"Invalid value '{normalized}' for choice field '{field_name}'.")


def _normalize_optional_choice(value: Any, choices, field_name: str) -> str:
    normalized = _normalize_value(value)
    if normalized == '':
        return ''
    return _normalize_choice(normalized, choices, field_name)


def _normalize_choice_list(value: Any, choices, field_name: str) -> list[str]:
    raw_values = _as_list(value)
    if not raw_values:
        return []
    return [_normalize_choice(item, choices, field_name) for item in raw_values]


def _as_list(value: Any) -> list[str]:
    normalized = _normalize_value(value)
    if normalized in ('', None):
        return []
    if isinstance(normalized, list):
        return [str(item).strip() for item in normalized if str(item).strip()]
    if isinstance(normalized, str):
        parts = []
        for delimiter in (';', ','):
            if delimiter in normalized:
                parts = [segment.strip() for segment in normalized.split(delimiter)]
                break
        if not parts:
            parts = [normalized.strip()]
        return [part for part in parts if part]
    return [str(normalized).strip()]


def _normalize_bool(value: Any, *, default: bool = False) -> bool:
    normalized = _normalize_value(value)
    if normalized in ('', None):
        return default
    if isinstance(normalized, bool):
        return normalized
    if isinstance(normalized, (int, float)):
        return bool(normalized)
    lowered = str(normalized).casefold()
    if lowered in TRUE_VALUES:
        return True
    if lowered in FALSE_VALUES:
        return False
    raise RowPreparationError('invalid_boolean', f"Invalid boolean value '{normalized}'.")


def _iter_choices(choices):
    for option in choices:
        if isinstance(option, (tuple, list)) and len(option) == 2:
            yield option[0], option[1]
        else:
            yield option, option


def _model_has_field(model_class, field_name: str) -> bool:
    try:
        model_class._meta.get_field(field_name)
        return True
    except Exception:
        return False


def _values_equal(left: Any, right: Any) -> bool:
    return _normalize_value(left) == _normalize_value(right)
