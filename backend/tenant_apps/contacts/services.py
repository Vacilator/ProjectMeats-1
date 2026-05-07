from __future__ import annotations

import base64
from dataclasses import dataclass
from typing import TYPE_CHECKING, Sequence

from django.db.models import Q

from apps.core.models import StatusChoices
from tenant_apps.contacts.models import Contact, ContactDepartmentChoices

if TYPE_CHECKING:
    from tenant_apps.suppliers.models import Supplier


CONTACT_MASTER_DOCUMENT_OPTIONS = {
    "spec sheets": "Spec Sheets",
    "coas": "COAs",
    "picture of label": "Picture of Label",
    "certification documents": "Certification Documents",
    "log (letter of guarantee)": "LOG (Letter of Guarantee)",
    "plant type of certification": "Plant Type of Certification",
    "audit reports": "Audit Reports",
    "animal welfare": "Animal Welfare",
    "halal": "Halal",
    "kosher": "Kosher",
    "bols": "BOLs",
    "release number": "Release Number",
    "sales order confirmation": "Sales Order Confirmation",
    "loading instructions": "Loading Instructions",
    "appointment confirmations": "Appointment Confirmations",
    "statements": "Statements",
    "claims": "Claims",
    "credits": "Credits",
    "checks": "Checks",
    "bills": "Bills",
}

FOCUS_DEPARTMENT_ORDER = {
    "pricing": (
        ContactDepartmentChoices.SALES,
        ContactDepartmentChoices.QA,
        ContactDepartmentChoices.CERTIFICATION,
        ContactDepartmentChoices.SHIPPING,
        ContactDepartmentChoices.BOOKING,
        ContactDepartmentChoices.ACCOUNTING,
    ),
    "logistics": (
        ContactDepartmentChoices.SHIPPING,
        ContactDepartmentChoices.BOOKING,
        ContactDepartmentChoices.SALES,
        ContactDepartmentChoices.ACCOUNTING,
        ContactDepartmentChoices.QA,
        ContactDepartmentChoices.CERTIFICATION,
    ),
    "accounting": (
        ContactDepartmentChoices.ACCOUNTING,
        ContactDepartmentChoices.SALES,
        ContactDepartmentChoices.SHIPPING,
        ContactDepartmentChoices.BOOKING,
        ContactDepartmentChoices.QA,
        ContactDepartmentChoices.CERTIFICATION,
    ),
}

FOCUS_TITLE_KEYWORDS = {
    "pricing": ("sales", "account manager", "trader", "pricing"),
    "logistics": ("shipping", "load", "coordinator", "billing", "prepay", "frozen", "dc"),
    "accounting": ("accounting", "billing", "ap", "accounts payable", "claims", "credit"),
}

LEGACY_DEPARTMENT_MAP = {
    "sales": ContactDepartmentChoices.SALES,
    "accounting": ContactDepartmentChoices.ACCOUNTING,
    "shipping": ContactDepartmentChoices.SHIPPING,
    "receiving": ContactDepartmentChoices.SHIPPING,
    "operations": ContactDepartmentChoices.SHIPPING,
    "quality": ContactDepartmentChoices.QA,
    "coa": ContactDepartmentChoices.CERTIFICATION,
    "doc's coa": ContactDepartmentChoices.CERTIFICATION,
    "doc's bol": ContactDepartmentChoices.SHIPPING,
    "pod": ContactDepartmentChoices.SHIPPING,
}


@dataclass(frozen=True)
class EmailAttachmentPayload:
    name: str
    content_type: str
    content_base64: str
    label: str = ""

    def as_email_payload(self) -> dict[str, str]:
        return {
            "name": self.name,
            "content_type": self.content_type,
            "content_base64": self.content_base64,
        }

    def as_dict(self) -> dict[str, str]:
        return {
            "name": self.name,
            "content_type": self.content_type,
            "label": self.label,
        }


@dataclass(frozen=True)
class SupplierContactResolution:
    recipient_email: str = ""
    recipient_name: str = ""
    phone: str = ""
    contact_id: int | None = None
    department: str = ""
    title: str = ""
    plant_id: int | None = None
    plant_name: str = ""
    source: str = ""
    focus: str = "pricing"
    responsible_documents: tuple[str, ...] = ()
    responsible_proteins: tuple[str, ...] = ()
    responsible_items: tuple[str, ...] = ()
    matched_documents: tuple[str, ...] = ()
    matched_proteins: tuple[str, ...] = ()
    matched_items: tuple[str, ...] = ()
    attachments: tuple[EmailAttachmentPayload, ...] = ()

    def as_dict(self) -> dict[str, object]:
        return {
            "recipient_email": self.recipient_email,
            "recipient_name": self.recipient_name,
            "phone": self.phone,
            "contact_id": self.contact_id,
            "department": self.department,
            "title": self.title,
            "plant_id": self.plant_id,
            "plant_name": self.plant_name,
            "source": self.source,
            "focus": self.focus,
            "responsible_documents": list(self.responsible_documents),
            "responsible_proteins": list(self.responsible_proteins),
            "responsible_items": list(self.responsible_items),
            "matched_documents": list(self.matched_documents),
            "matched_proteins": list(self.matched_proteins),
            "matched_items": list(self.matched_items),
            "attachments": [attachment.as_dict() for attachment in self.attachments],
        }


def resolve_supplier_contact_route(
    *,
    tenant,
    supplier: Supplier,
    inquiry=None,
    focus: str = "pricing",
    preferred_plant_ids: Sequence[int] | None = None,
    contacts: Sequence[Contact] | None = None,
) -> SupplierContactResolution:
    normalized_focus = _normalize_focus(focus)
    relevant_plant_ids = _relevant_plant_ids(
        inquiry=inquiry,
        supplier=supplier,
        preferred_plant_ids=preferred_plant_ids,
    )
    requested_items = _requested_items(inquiry)
    requested_proteins = _requested_proteins(inquiry)
    contact_candidates = list(contacts) if contacts is not None else list(_supplier_contact_candidates(tenant=tenant, supplier=supplier))

    ranked: list[tuple[int, int, int, int, SupplierContactResolution]] = []
    for contact in contact_candidates:
        email = _clean(contact.email)
        if not email:
            continue

        department, source = legacy_contact_routing_hints(contact)
        department_value = department or ""
        department_rank = _department_rank(department_value, normalized_focus)
        if department_rank < 0:
            department_rank = len(FOCUS_DEPARTMENT_ORDER[normalized_focus]) + 2

        responsible_proteins = _clean_values(contact.protein_types_responsible)
        responsible_items = _clean_values(contact.items_responsible)
        responsible_documents = _canonical_documents(contact.documents_responsible_for)
        matched_proteins = _matching_values(contact.protein_types_responsible, requested_proteins)
        matched_items = _matching_items(contact.items_responsible, requested_items)
        matched_documents = responsible_documents

        score = 10
        if department_value:
            score += 120 - (department_rank * 15)
        if matched_proteins:
            score += 30 if normalized_focus == "pricing" else 6
        if matched_items:
            score += 35 if normalized_focus == "pricing" else 8
        if matched_documents:
            score += 18
        if relevant_plant_ids and contact.plant_id in relevant_plant_ids:
            score += 45
        if contact.plant_id:
            score += 5
        score += _title_focus_score(contact=contact, focus=normalized_focus)

        resolution = SupplierContactResolution(
            recipient_email=email,
            recipient_name=_contact_name(contact) or supplier.name,
            phone=_contact_phone(contact),
            contact_id=contact.id,
            department=department_value,
            title=_clean(contact.title) or _clean(contact.position),
            plant_id=contact.plant_id,
            plant_name=_clean(getattr(contact.plant, "name", "")),
            source=source,
            focus=normalized_focus,
            responsible_documents=tuple(responsible_documents),
            responsible_proteins=tuple(responsible_proteins),
            responsible_items=tuple(responsible_items),
            matched_documents=tuple(matched_documents),
            matched_proteins=tuple(matched_proteins),
            matched_items=tuple(matched_items),
            attachments=tuple(
                _build_responsibility_attachment(
                    inquiry=inquiry,
                    supplier=supplier,
                    contact=contact,
                    matched_documents=matched_documents,
                    matched_proteins=matched_proteins,
                    matched_items=matched_items,
                    focus=normalized_focus,
                )
            ),
        )
        ranked.append((score, -department_rank, 1 if contact.plant_id in relevant_plant_ids else 0, -contact.id, resolution))

    if ranked:
        ranked.sort(reverse=True)
        return ranked[0][4]

    if normalized_focus == "logistics":
        booking_route = _resolve_booking_email_fallback(supplier=supplier, relevant_plant_ids=relevant_plant_ids)
        if booking_route:
            return booking_route

    supplier_email = _clean(getattr(supplier, "email", ""))
    if supplier_email:
        return SupplierContactResolution(
            recipient_email=supplier_email,
            recipient_name=_clean(getattr(supplier, "contact_person", "")) or supplier.name,
            phone=_clean(getattr(supplier, "phone", "")),
            source="supplier_email",
            focus=normalized_focus,
        )

    fallback_contact = next(
        (
            contact
            for contact in sorted(contact_candidates, key=lambda item: item.id)
            if _clean(contact.email)
        ),
        None,
    )
    if fallback_contact is not None:
        department, source = legacy_contact_routing_hints(fallback_contact)
        return SupplierContactResolution(
            recipient_email=_clean(fallback_contact.email),
            recipient_name=_contact_name(fallback_contact) or supplier.name,
            phone=_contact_phone(fallback_contact),
            contact_id=fallback_contact.id,
            department=department or "",
            title=_clean(fallback_contact.title) or _clean(fallback_contact.position),
            plant_id=fallback_contact.plant_id,
            plant_name=_clean(getattr(fallback_contact.plant, "name", "")),
            source=source or "supplier_contact_fallback",
            focus=normalized_focus,
            responsible_documents=tuple(_canonical_documents(fallback_contact.documents_responsible_for)),
            responsible_proteins=tuple(_clean_values(fallback_contact.protein_types_responsible)),
            responsible_items=tuple(_clean_values(fallback_contact.items_responsible)),
        )

    return SupplierContactResolution(focus=normalized_focus)


def resolve_supplier_order_contact_routes(
    *,
    tenant,
    supplier: Supplier,
    inquiry=None,
    preferred_plant_ids: Sequence[int] | None = None,
) -> dict[str, SupplierContactResolution]:
    contacts = list(_supplier_contact_candidates(tenant=tenant, supplier=supplier))
    return {
        "supplier_contact": resolve_supplier_contact_route(
            tenant=tenant,
            supplier=supplier,
            inquiry=inquiry,
            focus="pricing",
            preferred_plant_ids=preferred_plant_ids,
            contacts=contacts,
        ),
        "billing_contact": resolve_supplier_contact_route(
            tenant=tenant,
            supplier=supplier,
            inquiry=inquiry,
            focus="accounting",
            preferred_plant_ids=preferred_plant_ids,
            contacts=contacts,
        ),
        "shipping_contact": resolve_supplier_contact_route(
            tenant=tenant,
            supplier=supplier,
            inquiry=inquiry,
            focus="logistics",
            preferred_plant_ids=preferred_plant_ids,
            contacts=contacts,
        ),
    }


def legacy_contact_routing_hints(contact: Contact) -> tuple[str, str]:
    department = _normalize_department(contact.department)
    if department:
        return department, "department"

    for value in (contact.contact_type, contact.contact_title, contact.title, contact.position):
        department = _normalize_department(value)
        if department:
            return department, "legacy_contact_fields"

    return "", ""


def build_supplier_contact_context_lines(
    *,
    resolution: SupplierContactResolution,
    include_90_day_confirm: bool = True,
) -> list[str]:
    lines: list[str] = []
    if resolution.plant_name:
        lines.append(f"Preferred plant contact: {resolution.plant_name}")
    if resolution.title:
        lines.append(f"Recipient role: {resolution.title}")
    if resolution.matched_proteins:
        lines.append(f"Protein responsibility match: {', '.join(resolution.matched_proteins)}")
    if resolution.matched_items:
        lines.append(f"Item responsibility match: {', '.join(resolution.matched_items)}")
    if resolution.matched_documents:
        lines.append(f"Requested support documents: {', '.join(resolution.matched_documents)}")
    if include_90_day_confirm:
        lines.append("Please confirm plant, availability, pricing, and whether the quote can be held for 90 days.")
    return lines


def _clean(value: object) -> str:
    return str(value or "").strip()


def _contact_name(contact: Contact) -> str:
    return " ".join(part for part in [_clean(contact.first_name), _clean(contact.last_name)] if part).strip()


def _contact_phone(contact: Contact) -> str:
    for value in (
        contact.office_phone,
        contact.phone,
        contact.mobile_phone,
        contact.main_phone,
        contact.direct_phone,
        contact.cell_phone,
    ):
        cleaned = _clean(value)
        if cleaned:
            return cleaned
    return ""


def _normalize_focus(value: object) -> str:
    normalized = _clean(value).lower()
    return normalized if normalized in FOCUS_DEPARTMENT_ORDER else "pricing"


def _normalize_department(value: object) -> str:
    normalized = _clean(value).lower()
    if not normalized:
        return ""
    if normalized in {"shipping / loadout", "shipping/loadout", "loadout"}:
        return ContactDepartmentChoices.SHIPPING
    if normalized in {"quality assurance", "quality"}:
        return ContactDepartmentChoices.QA
    if normalized in {"booking", "doc's bol", "bol", "bills of lading"}:
        return ContactDepartmentChoices.BOOKING
    if normalized in {"certification", "coa", "doc's coa"}:
        return ContactDepartmentChoices.CERTIFICATION
    if normalized in {"accounting", "billing"}:
        return ContactDepartmentChoices.ACCOUNTING
    if normalized in {"sales"}:
        return ContactDepartmentChoices.SALES
    return LEGACY_DEPARTMENT_MAP.get(normalized, "")


def _department_rank(department: str, focus: str) -> int:
    try:
        return FOCUS_DEPARTMENT_ORDER[focus].index(department)
    except ValueError:
        return -1


def _title_focus_score(*, contact: Contact, focus: str) -> int:
    title_blob = " ".join(
        part for part in (_clean(contact.title), _clean(contact.position), _clean(contact.contact_title)) if part
    ).lower()
    if not title_blob:
        return 0
    return sum(8 for keyword in FOCUS_TITLE_KEYWORDS[focus] if keyword in title_blob)


def _matching_values(values: object, requested_values: set[str]) -> list[str]:
    if not requested_values:
        return []
    matches: list[str] = []
    for raw in values or []:
        candidate = _clean(raw)
        if candidate and candidate.lower() in requested_values and candidate not in matches:
            matches.append(candidate)
    return matches


def _matching_items(values: object, requested_values: set[str]) -> list[str]:
    if not requested_values:
        return []
    matches: list[str] = []
    for raw in values or []:
        candidate = _clean(raw)
        if not candidate:
            continue
        lowered = candidate.lower()
        if lowered in requested_values or any(token in lowered for token in requested_values):
            if candidate not in matches:
                matches.append(candidate)
    return matches


def _clean_values(values: object) -> list[str]:
    cleaned: list[str] = []
    for raw in values or []:
        candidate = _clean(raw)
        if candidate and candidate not in cleaned:
            cleaned.append(candidate)
    return cleaned


def _canonical_documents(values: object) -> list[str]:
    documents: list[str] = []
    for raw in values or []:
        key = _clean(raw).lower()
        if not key:
            continue
        label = CONTACT_MASTER_DOCUMENT_OPTIONS.get(key, _clean(raw))
        if label not in documents:
            documents.append(label)
    return documents


def _requested_proteins(inquiry) -> set[str]:
    requested: set[str] = set()
    protein = _clean(getattr(inquiry, "requested_protein", "")).lower()
    if protein:
        requested.add(protein)
    if inquiry is None:
        return requested
    for line in inquiry.products.select_related("product").all():
        product_protein = _clean(getattr(line.product, "protein_type", "")).lower()
        if product_protein:
            requested.add(product_protein)
    return requested


def _requested_items(inquiry) -> set[str]:
    requested: set[str] = set()
    if inquiry is None:
        return requested
    master_product = getattr(inquiry, "requested_master_product", None)
    for value in (
        getattr(master_product, "display_name", ""),
        getattr(master_product, "item_name", ""),
        getattr(getattr(master_product, "system_product", None), "name", ""),
        getattr(getattr(master_product, "system_product", None), "product_code", ""),
    ):
        cleaned = _clean(value).lower()
        if cleaned:
            requested.add(cleaned)

    for line in inquiry.products.select_related("product").all():
        for value in (
            getattr(line.product, "name", ""),
            getattr(line.product, "product_code", ""),
        ):
            cleaned = _clean(value).lower()
            if cleaned:
                requested.add(cleaned)
    return requested


def _supplier_contact_candidates(*, tenant, supplier: Supplier):
    return (
        Contact.objects.filter(
            tenant=tenant,
            status=StatusChoices.ACTIVE,
        )
        .filter(
            Q(supplier=supplier)
            | Q(plant__supplier=supplier)
            | Q(suppliers=supplier)
        )
        .select_related("plant")
        .distinct()
    )


def _relevant_plant_ids(
    *,
    inquiry,
    supplier: Supplier,
    preferred_plant_ids: Sequence[int] | None = None,
) -> set[int]:
    relevant = {int(value) for value in preferred_plant_ids or [] if value}
    if inquiry is None:
        return relevant
    product_lines = inquiry.products.filter(plant__isnull=False)
    if product_lines.filter(supplier_id=supplier.id).exists():
        relevant.update(product_lines.filter(supplier_id=supplier.id).values_list("plant_id", flat=True))
        return relevant
    relevant.update(
        product_lines.filter(Q(supplier__isnull=True) | Q(supplier_id=supplier.id)).values_list("plant_id", flat=True)
    )
    return relevant


def _resolve_booking_email_fallback(*, supplier: Supplier, relevant_plant_ids: set[int]) -> SupplierContactResolution | None:
    plants = list(
        supplier.supplier_plants.exclude(booking_contact_email="").exclude(booking_contact_email__isnull=True).order_by("id")
    )
    if relevant_plant_ids:
        plants.sort(key=lambda plant: (0 if plant.id in relevant_plant_ids else 1, plant.id))
    plant = plants[0] if plants else None
    if plant is None:
        return None
    return SupplierContactResolution(
        recipient_email=_clean(plant.booking_contact_email),
        recipient_name=plant.name,
        plant_id=plant.id,
        plant_name=_clean(plant.name),
        department=ContactDepartmentChoices.BOOKING,
        source="plant_booking_email",
        focus="logistics",
    )


def _build_responsibility_attachment(
    *,
    inquiry,
    supplier: Supplier,
    contact: Contact,
    matched_documents: list[str],
    matched_proteins: list[str],
    matched_items: list[str],
    focus: str,
) -> list[EmailAttachmentPayload]:
    if not matched_documents:
        return []

    inquiry_number = _clean(getattr(inquiry, "inquiry_number", "")) or "inquiry"
    lines = [
        f"Supplier RFQ support packet for {inquiry_number}",
        f"Supplier: {supplier.name}",
        f"Recipient: {_contact_name(contact) or supplier.name}",
        f"Department: {_normalize_department(contact.department) or contact.department or contact.contact_type or 'Unspecified'}",
        f"Focus: {focus.title()}",
        "",
        "Requested documents:",
    ]
    lines.extend(f"- {document}" for document in matched_documents)
    if matched_proteins:
        lines.extend(["", f"Protein responsibility: {', '.join(matched_proteins)}"])
    if matched_items:
        lines.extend(["", f"Item responsibility: {', '.join(matched_items)}"])
    lines.extend(
        [
            "",
            "Please include current plant availability, price, and whether the quoted terms can be held for 90 days.",
        ]
    )

    attachment_bytes = "\n".join(lines).encode("utf-8")
    return [
        EmailAttachmentPayload(
            name=f"rfq-support-{inquiry_number}.txt",
            content_type="text/plain",
            content_base64=base64.b64encode(attachment_bytes).decode("ascii"),
            label="RFQ support packet",
        )
    ]
