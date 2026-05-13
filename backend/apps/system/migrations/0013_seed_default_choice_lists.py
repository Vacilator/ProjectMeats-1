from __future__ import annotations

from django.db import migrations


def seed_default_choice_lists(apps, schema_editor):
    SystemChoiceList = apps.get_model("system", "SystemChoiceList")
    SystemChoiceItem = apps.get_model("system", "SystemChoiceItem")

    # Minimal Tier-1 defaults so Admin Workspace Option Lists isn't empty.
    # Idempotent: update_or_create (does not delete existing records).
    choice_lists = [
        {
            "slug": "protein_type",
            "name": "Protein Type",
            "description": "Types of protein products (beef, pork, poultry, etc.)",
            "model_field_path": "products.product.protein_type",
            "is_extensible": True,
            "is_reorderable": True,
            "items": [
                {"value": "Beef", "label": "Beef", "order": 1, "extra_data": {"filter_key": "beef"}},
                {"value": "Chicken", "label": "Chicken", "order": 2, "extra_data": {"filter_key": "chicken"}},
                {"value": "Pork", "label": "Pork", "order": 3, "extra_data": {"filter_key": "pork"}},
                {"value": "Fowl", "label": "Fowl", "order": 4, "extra_data": {"filter_key": "fowl"}},
                {"value": "Turkey", "label": "Turkey", "order": 5, "extra_data": {"filter_key": "turkey"}},
                {"value": "Lamb", "label": "Lamb", "order": 6, "extra_data": {"filter_key": "lamb"}},
                {"value": "Veal", "label": "Veal", "order": 7, "extra_data": {"filter_key": "veal"}},
                {"value": "Seafood", "label": "Seafood", "order": 8, "extra_data": {"filter_key": "seafood"}},
                {"value": "Venison", "label": "Venison", "order": 9, "extra_data": {"filter_key": "venison"}},
                {"value": "Bison", "label": "Bison", "order": 10, "extra_data": {"filter_key": "bison"}},
                {"value": "Duck", "label": "Duck", "order": 11, "extra_data": {"filter_key": "duck"}},
                {"value": "Rabbit", "label": "Rabbit", "order": 12, "extra_data": {"filter_key": "rabbit"}},
                {"value": "Goat", "label": "Goat", "order": 13, "extra_data": {"filter_key": "goat"}},
                {"value": "Mutton", "label": "Mutton", "order": 14, "extra_data": {"filter_key": "mutton"}},
                {"value": "Horse", "label": "Horse", "order": 15, "extra_data": {"filter_key": "horse"}},
                {"value": "beef", "label": "Beef (Legacy)", "order": 101, "extra_data": {"filter_key": "beef"}},
                {
                    "value": "chicken",
                    "label": "Chicken (Legacy)",
                    "order": 102,
                    "extra_data": {"filter_key": "chicken"},
                },
                {"value": "pork", "label": "Pork (Legacy)", "order": 103, "extra_data": {"filter_key": "pork"}},
                {
                    "value": "poultry",
                    "label": "Poultry (Legacy)",
                    "order": 104,
                    "extra_data": {"filter_key": "poultry"},
                },
                {
                    "value": "seafood",
                    "label": "Seafood (Legacy)",
                    "order": 105,
                    "extra_data": {"filter_key": "seafood"},
                },
                {"value": "lamb", "label": "Lamb (Legacy)", "order": 106, "extra_data": {"filter_key": "lamb"}},
                {"value": "fish", "label": "Fish (Legacy)", "order": 107, "extra_data": {"filter_key": "fish"}},
                {"value": "horse", "label": "Horse (Legacy)", "order": 108, "extra_data": {"filter_key": "horse"}},
                {"value": "other", "label": "Other (Legacy)", "order": 109, "extra_data": {"filter_key": "other"}},
            ],
        },
        {
            "slug": "fresh_or_frozen",
            "name": "Fresh or Frozen",
            "description": "Product storage state",
            "model_field_path": "products.product.fresh_or_frozen",
            "is_extensible": False,
            "is_reorderable": False,
            "items": [
                {"value": "Fresh", "label": "Fresh", "order": 1},
                {"value": "Frozen", "label": "Frozen", "order": 2},
                {"value": "FRESH", "label": "Fresh (Legacy)", "order": 101},
                {"value": "FROZEN", "label": "Frozen (Legacy)", "order": 102},
            ],
        },
        {
            "slug": "package_type",
            "name": "Package Type",
            "description": "Product packaging types",
            "model_field_path": "products.product.package_type",
            "is_extensible": True,
            "is_reorderable": True,
            "items": [
                {"value": "Boxed wax lined", "label": "Boxed wax lined", "order": 1},
                {"value": "Boxed Poly", "label": "Boxed Poly", "order": 2},
                {"value": "Combos", "label": "Combos", "order": 3},
                {"value": "Nude Block", "label": "Nude Block", "order": 4},
                {"value": "Boxed COV", "label": "Boxed COV", "order": 5},
                {"value": "Boxed CO2", "label": "Boxed CO2", "order": 6},
                {"value": "COMBO_BIN", "label": "Combo Bin (Legacy)", "order": 101},
                {"value": "CASES", "label": "Cases (Legacy)", "order": 102},
                {"value": "BAGS", "label": "Bags (Legacy)", "order": 103},
                {"value": "BULK", "label": "Bulk (Legacy)", "order": 104},
                {"value": "VACUUM_SEALED", "label": "Vacuum Sealed (Legacy)", "order": 105},
                {"value": "OTHER", "label": "Other (Legacy)", "order": 106},
            ],
        },
        {
            "slug": "payment_terms",
            "name": "Payment Terms",
            "description": "Accounting payment terms",
            "model_field_path": "customers.customer.payment_terms",
            "is_extensible": True,
            "is_reorderable": True,
            "items": [
                {"value": "NET7", "label": "Net 7", "order": 1},
                {"value": "NET10", "label": "Net 10", "order": 2},
                {"value": "NET15", "label": "Net 15", "order": 3},
                {"value": "NET30", "label": "Net 30", "order": 4, "is_default": True},
                {"value": "NET45", "label": "Net 45", "order": 5},
                {"value": "NET60", "label": "Net 60", "order": 6},
                {"value": "NET90", "label": "Net 90", "order": 7},
                {"value": "COD", "label": "Cash on Delivery", "order": 8},
                {"value": "PREPAID", "label": "Prepaid", "order": 9},
            ],
        },
        {
            "slug": "weight_unit",
            "name": "Weight Unit",
            "description": "Unit of measure for weight",
            "model_field_path": "products.product.weight_unit",
            "is_extensible": False,
            "is_reorderable": False,
            "items": [
                {"value": "LBS", "label": "Pounds (lbs)", "order": 1, "is_default": True},
                {"value": "KG", "label": "Kilograms (kg)", "order": 2},
                {"value": "OZ", "label": "Ounces (oz)", "order": 3},
                {"value": "G", "label": "Grams (g)", "order": 4},
            ],
        },
        {
            "slug": "contact_type",
            "name": "Contact Type",
            "description": "Types of contacts",
            "model_field_path": "contacts.contact.contact_type",
            "is_extensible": True,
            "is_reorderable": True,
            "items": [
                {"value": "PRIMARY", "label": "Primary Contact", "order": 1},
                {"value": "SALES", "label": "Sales", "order": 2},
                {"value": "ACCOUNTING", "label": "Accounting", "order": 3},
                {"value": "SHIPPING", "label": "Shipping", "order": 4},
                {"value": "RECEIVING", "label": "Receiving", "order": 5},
                {"value": "TECHNICAL", "label": "Technical", "order": 6},
                {"value": "OTHER", "label": "Other", "order": 99},
            ],
        },
    ]

    for list_def in choice_lists:
        items = list_def.pop("items")
        choice_list, _ = SystemChoiceList.objects.update_or_create(
            slug=list_def["slug"],
            defaults={
                "name": list_def["name"],
                "description": list_def.get("description", ""),
                "model_field_path": list_def.get("model_field_path", ""),
                "is_extensible": list_def.get("is_extensible", True),
                "is_reorderable": list_def.get("is_reorderable", True),
            },
        )

        for item_def in items:
            SystemChoiceItem.objects.update_or_create(
                choice_list=choice_list,
                value=item_def["value"],
                tenant=None,
                defaults={
                    "label": item_def["label"],
                    "order": item_def.get("order", 0),
                    "extra_data": item_def.get("extra_data", {}),
                    "is_default": bool(item_def.get("is_default", False)),
                    "is_active": True,
                },
            )


class Migration(migrations.Migration):
    dependencies = [
        ("system", "0012_systemconfiguration"),
    ]

    operations = [
        migrations.RunPython(seed_default_choice_lists, migrations.RunPython.noop),
    ]
