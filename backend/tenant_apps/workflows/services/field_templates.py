"""
Field Templates Service

Provides pre-defined field templates for common form patterns.
Speeds up form creation by allowing one-click addition of field groups.
"""

from typing import Any, Dict, List

# Common field templates
FIELD_TEMPLATES = {
    "address": {
        "name": "Address",
        "description": "Standard mailing address fields",
        "icon": "📍",
        "fields": [
            {
                "key": "street_address",
                "label": "Street Address",
                "type": "text",
                "required": False,
                "placeholder": "Enter street address...",
            },
            {
                "key": "street_address_2",
                "label": "Address Line 2",
                "type": "text",
                "required": False,
                "placeholder": "Apt, Suite, Building...",
            },
            {
                "key": "city",
                "label": "City",
                "type": "text",
                "required": False,
                "placeholder": "Enter city...",
            },
            {
                "key": "state",
                "label": "State / Province",
                "type": "text",
                "required": False,
                "placeholder": "Enter state...",
            },
            {
                "key": "postal_code",
                "label": "Postal Code",
                "type": "text",
                "required": False,
                "placeholder": "Enter postal code...",
            },
            {
                "key": "country",
                "label": "Country",
                "type": "text",
                "required": False,
                "placeholder": "Enter country...",
            },
        ],
    },
    "contact_info": {
        "name": "Contact Information",
        "description": "Phone, email, and web contact fields",
        "icon": "📞",
        "fields": [
            {
                "key": "email",
                "label": "Email Address",
                "type": "email",
                "required": False,
                "placeholder": "name@example.com",
                "validation_rules": {
                    "pattern": r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$",
                },
            },
            {
                "key": "phone",
                "label": "Phone Number",
                "type": "phone",
                "required": False,
                "placeholder": "(555) 123-4567",
            },
            {
                "key": "mobile",
                "label": "Mobile Phone",
                "type": "phone",
                "required": False,
                "placeholder": "(555) 123-4567",
            },
            {
                "key": "fax",
                "label": "Fax Number",
                "type": "phone",
                "required": False,
                "placeholder": "(555) 123-4567",
            },
            {
                "key": "website",
                "label": "Website",
                "type": "url",
                "required": False,
                "placeholder": "https://example.com",
            },
        ],
    },
    "person_name": {
        "name": "Person Name",
        "description": "Standard name fields for a person",
        "icon": "👤",
        "fields": [
            {
                "key": "first_name",
                "label": "First Name",
                "type": "text",
                "required": True,
                "placeholder": "Enter first name...",
            },
            {
                "key": "middle_name",
                "label": "Middle Name",
                "type": "text",
                "required": False,
                "placeholder": "Enter middle name...",
            },
            {
                "key": "last_name",
                "label": "Last Name",
                "type": "text",
                "required": True,
                "placeholder": "Enter last name...",
            },
            {
                "key": "suffix",
                "label": "Suffix",
                "type": "text",
                "required": False,
                "placeholder": "Jr., Sr., III, etc.",
            },
        ],
    },
    "business_info": {
        "name": "Business Information",
        "description": "Common business entity fields",
        "icon": "🏢",
        "fields": [
            {
                "key": "company_name",
                "label": "Company Name",
                "type": "text",
                "required": True,
                "placeholder": "Enter company name...",
            },
            {
                "key": "tax_id",
                "label": "Tax ID / EIN",
                "type": "text",
                "required": False,
                "placeholder": "XX-XXXXXXX",
            },
            {
                "key": "duns_number",
                "label": "DUNS Number",
                "type": "text",
                "required": False,
                "placeholder": "9-digit DUNS",
            },
            {
                "key": "industry",
                "label": "Industry",
                "type": "text",
                "required": False,
                "placeholder": "Enter industry...",
            },
        ],
    },
    "payment_terms": {
        "name": "Payment Terms",
        "description": "Payment and billing configuration",
        "icon": "💳",
        "fields": [
            {
                "key": "payment_terms",
                "label": "Payment Terms",
                "type": "select",
                "required": False,
                "choices": [
                    {"value": "net_10", "label": "Net 10"},
                    {"value": "net_15", "label": "Net 15"},
                    {"value": "net_30", "label": "Net 30"},
                    {"value": "net_45", "label": "Net 45"},
                    {"value": "net_60", "label": "Net 60"},
                    {"value": "net_90", "label": "Net 90"},
                    {"value": "due_on_receipt", "label": "Due on Receipt"},
                    {"value": "cod", "label": "COD"},
                ],
            },
            {
                "key": "credit_limit",
                "label": "Credit Limit",
                "type": "currency",
                "required": False,
                "placeholder": "0.00",
            },
            {
                "key": "currency",
                "label": "Currency",
                "type": "select",
                "required": False,
                "choices": [
                    {"value": "USD", "label": "USD - US Dollar"},
                    {"value": "CAD", "label": "CAD - Canadian Dollar"},
                    {"value": "EUR", "label": "EUR - Euro"},
                    {"value": "GBP", "label": "GBP - British Pound"},
                    {"value": "MXN", "label": "MXN - Mexican Peso"},
                ],
            },
        ],
    },
    "shipping_info": {
        "name": "Shipping Information",
        "description": "Shipping and delivery fields",
        "icon": "🚚",
        "fields": [
            {
                "key": "shipping_method",
                "label": "Shipping Method",
                "type": "select",
                "required": False,
                "choices": [
                    {"value": "ground", "label": "Ground"},
                    {"value": "express", "label": "Express"},
                    {"value": "overnight", "label": "Overnight"},
                    {"value": "freight", "label": "Freight"},
                    {"value": "pickup", "label": "Customer Pickup"},
                ],
            },
            {
                "key": "carrier",
                "label": "Carrier",
                "type": "select",
                "required": False,
                "related_entity_type": "carrier",
            },
            {
                "key": "tracking_number",
                "label": "Tracking Number",
                "type": "text",
                "required": False,
                "placeholder": "Enter tracking number...",
            },
            {
                "key": "estimated_delivery",
                "label": "Estimated Delivery Date",
                "type": "date",
                "required": False,
            },
        ],
    },
    "notes": {
        "name": "Notes & Comments",
        "description": "Free-form notes and internal comments",
        "icon": "📝",
        "fields": [
            {
                "key": "notes",
                "label": "Notes",
                "type": "textarea",
                "required": False,
                "placeholder": "Enter notes...",
                "rows": 4,
            },
            {
                "key": "internal_notes",
                "label": "Internal Notes",
                "type": "textarea",
                "required": False,
                "placeholder": "Internal use only...",
                "rows": 3,
            },
        ],
    },
    "dates": {
        "name": "Important Dates",
        "description": "Common date fields",
        "icon": "📅",
        "fields": [
            {
                "key": "start_date",
                "label": "Start Date",
                "type": "date",
                "required": False,
            },
            {
                "key": "end_date",
                "label": "End Date",
                "type": "date",
                "required": False,
            },
            {
                "key": "due_date",
                "label": "Due Date",
                "type": "date",
                "required": False,
            },
            {
                "key": "completed_date",
                "label": "Completed Date",
                "type": "date",
                "required": False,
            },
        ],
    },
    "meat_product": {
        "name": "Meat Product Details",
        "description": "Specific fields for meat products (ProjectMeats)",
        "icon": "🥩",
        "fields": [
            {
                "key": "species",
                "label": "Species",
                "type": "select",
                "required": True,
                "choices": [
                    {"value": "beef", "label": "Beef"},
                    {"value": "pork", "label": "Pork"},
                    {"value": "poultry", "label": "Poultry"},
                    {"value": "lamb", "label": "Lamb"},
                    {"value": "goat", "label": "Goat"},
                    {"value": "seafood", "label": "Seafood"},
                    {"value": "other", "label": "Other"},
                ],
            },
            {
                "key": "cut",
                "label": "Cut / Primal",
                "type": "text",
                "required": False,
                "placeholder": "e.g., Ribeye, Tenderloin, Ground",
            },
            {
                "key": "grade",
                "label": "Grade",
                "type": "select",
                "required": False,
                "choices": [
                    {"value": "prime", "label": "Prime"},
                    {"value": "choice", "label": "Choice"},
                    {"value": "select", "label": "Select"},
                    {"value": "standard", "label": "Standard"},
                    {"value": "commercial", "label": "Commercial"},
                    {"value": "utility", "label": "Utility"},
                ],
            },
            {
                "key": "weight",
                "label": "Weight (lbs)",
                "type": "decimal",
                "required": False,
                "placeholder": "0.00",
            },
            {
                "key": "pack_date",
                "label": "Pack Date",
                "type": "date",
                "required": False,
            },
            {
                "key": "sell_by_date",
                "label": "Sell By Date",
                "type": "date",
                "required": False,
            },
            {
                "key": "lot_number",
                "label": "Lot Number",
                "type": "text",
                "required": False,
                "placeholder": "Enter lot number...",
            },
        ],
    },
    "feedback": {
        "name": "Feedback & Survey",
        "description": "Customer feedback fields with ratings and signatures",
        "icon": "📊",
        "fields": [
            {
                "key": "overall_rating",
                "label": "Overall Rating",
                "type": "rating",
                "required": True,
                "max": 5,
            },
            {
                "key": "quality_rating",
                "label": "Product Quality",
                "type": "rating",
                "required": False,
                "max": 5,
            },
            {
                "key": "service_rating",
                "label": "Service Quality",
                "type": "rating",
                "required": False,
                "max": 5,
            },
            {
                "key": "recommendation_score",
                "label": "How likely to recommend? (0-10)",
                "type": "slider",
                "required": False,
                "min": 0,
                "max": 10,
                "step": 1,
            },
            {
                "key": "comments",
                "label": "Additional Comments",
                "type": "richtext",
                "required": False,
                "placeholder": "Share your detailed feedback...",
            },
            {
                "key": "signature",
                "label": "Signature",
                "type": "signature",
                "required": False,
            },
        ],
    },
    "agreement": {
        "name": "Agreement & Consent",
        "description": "Terms acceptance with signature capture",
        "icon": "📜",
        "fields": [
            {
                "key": "terms_accepted",
                "label": "I accept the terms and conditions",
                "type": "checkbox",
                "required": True,
            },
            {
                "key": "privacy_accepted",
                "label": "I accept the privacy policy",
                "type": "checkbox",
                "required": True,
            },
            {
                "key": "marketing_consent",
                "label": "I consent to receive marketing communications",
                "type": "checkbox",
                "required": False,
            },
            {
                "key": "signature",
                "label": "Signature",
                "type": "signature",
                "required": True,
            },
            {
                "key": "signature_date",
                "label": "Date",
                "type": "date",
                "required": True,
            },
        ],
    },
}


def get_all_templates() -> List[Dict[str, Any]]:
    """Get all available field templates."""
    return [
        {
            "id": key,
            "name": template["name"],
            "description": template["description"],
            "icon": template["icon"],
            "field_count": len(template["fields"]),
        }
        for key, template in FIELD_TEMPLATES.items()
    ]


def get_template(template_id: str) -> Dict[str, Any] | None:
    """Get a specific field template by ID."""
    return FIELD_TEMPLATES.get(template_id)


def get_template_fields(template_id: str, prefix: str = "") -> List[Dict[str, Any]]:
    """
    Get fields for a template, optionally prefixed to avoid key conflicts.

    Args:
        template_id: The template identifier
        prefix: Optional prefix to add to all field keys

    Returns:
        List of field definitions ready to add to a form step
    """
    template = FIELD_TEMPLATES.get(template_id)
    if not template:
        return []

    fields = []
    for field in template["fields"]:
        field_copy = field.copy()
        if prefix:
            field_copy["key"] = f"{prefix}_{field_copy['key']}"
        fields.append(field_copy)

    return fields
