from __future__ import annotations

from django.db import migrations


def seed_default_choice_lists(apps, schema_editor):
    SystemChoiceList = apps.get_model('system', 'SystemChoiceList')
    SystemChoiceItem = apps.get_model('system', 'SystemChoiceItem')

    # Minimal Tier-1 defaults so Admin Workspace Option Lists isn't empty.
    # Idempotent: update_or_create (does not delete existing records).
    choice_lists = [
        {
            'slug': 'protein_type',
            'name': 'Protein Type',
            'description': 'Types of protein products (beef, pork, poultry, etc.)',
            'model_field_path': 'products.product.protein_type',
            'is_extensible': True,
            'is_reorderable': True,
            'items': [
                {'value': 'beef', 'label': 'Beef', 'order': 1, 'extra_data': {'filter_key': 'beef'}},
                {'value': 'pork', 'label': 'Pork', 'order': 2, 'extra_data': {'filter_key': 'pork'}},
                {'value': 'poultry', 'label': 'Poultry', 'order': 3, 'extra_data': {'filter_key': 'poultry'}},
                {'value': 'seafood', 'label': 'Seafood', 'order': 4, 'extra_data': {'filter_key': 'seafood'}},
                {'value': 'lamb', 'label': 'Lamb', 'order': 5, 'extra_data': {'filter_key': 'lamb'}},
                {'value': 'other', 'label': 'Other', 'order': 99, 'extra_data': {'filter_key': 'other'}},
            ],
        },
        {
            'slug': 'fresh_or_frozen',
            'name': 'Fresh or Frozen',
            'description': 'Product storage state',
            'model_field_path': 'products.product.fresh_or_frozen',
            'is_extensible': False,
            'is_reorderable': False,
            'items': [
                {'value': 'FRESH', 'label': 'Fresh', 'order': 1},
                {'value': 'FROZEN', 'label': 'Frozen', 'order': 2},
            ],
        },
        {
            'slug': 'package_type',
            'name': 'Package Type',
            'description': 'Product packaging types',
            'model_field_path': 'products.product.package_type',
            'is_extensible': True,
            'is_reorderable': True,
            'items': [
                {'value': 'COMBO_BIN', 'label': 'Combo Bin', 'order': 1},
                {'value': 'CASES', 'label': 'Cases', 'order': 2},
                {'value': 'BAGS', 'label': 'Bags', 'order': 3},
                {'value': 'BULK', 'label': 'Bulk', 'order': 4},
                {'value': 'VACUUM_SEALED', 'label': 'Vacuum Sealed', 'order': 5},
                {'value': 'OTHER', 'label': 'Other', 'order': 99},
            ],
        },
        {
            'slug': 'payment_terms',
            'name': 'Payment Terms',
            'description': 'Accounting payment terms',
            'model_field_path': 'customers.customer.payment_terms',
            'is_extensible': True,
            'is_reorderable': True,
            'items': [
                {'value': 'NET7', 'label': 'Net 7', 'order': 1},
                {'value': 'NET10', 'label': 'Net 10', 'order': 2},
                {'value': 'NET15', 'label': 'Net 15', 'order': 3},
                {'value': 'NET30', 'label': 'Net 30', 'order': 4, 'is_default': True},
                {'value': 'NET45', 'label': 'Net 45', 'order': 5},
                {'value': 'NET60', 'label': 'Net 60', 'order': 6},
                {'value': 'NET90', 'label': 'Net 90', 'order': 7},
                {'value': 'COD', 'label': 'Cash on Delivery', 'order': 8},
                {'value': 'PREPAID', 'label': 'Prepaid', 'order': 9},
            ],
        },
        {
            'slug': 'weight_unit',
            'name': 'Weight Unit',
            'description': 'Unit of measure for weight',
            'model_field_path': 'products.product.weight_unit',
            'is_extensible': False,
            'is_reorderable': False,
            'items': [
                {'value': 'LBS', 'label': 'Pounds (lbs)', 'order': 1, 'is_default': True},
                {'value': 'KG', 'label': 'Kilograms (kg)', 'order': 2},
                {'value': 'OZ', 'label': 'Ounces (oz)', 'order': 3},
                {'value': 'G', 'label': 'Grams (g)', 'order': 4},
            ],
        },
        {
            'slug': 'contact_type',
            'name': 'Contact Type',
            'description': 'Types of contacts',
            'model_field_path': 'contacts.contact.contact_type',
            'is_extensible': True,
            'is_reorderable': True,
            'items': [
                {'value': 'PRIMARY', 'label': 'Primary Contact', 'order': 1},
                {'value': 'SALES', 'label': 'Sales', 'order': 2},
                {'value': 'ACCOUNTING', 'label': 'Accounting', 'order': 3},
                {'value': 'SHIPPING', 'label': 'Shipping', 'order': 4},
                {'value': 'RECEIVING', 'label': 'Receiving', 'order': 5},
                {'value': 'TECHNICAL', 'label': 'Technical', 'order': 6},
                {'value': 'OTHER', 'label': 'Other', 'order': 99},
            ],
        },
    ]

    for list_def in choice_lists:
        items = list_def.pop('items')
        choice_list, _ = SystemChoiceList.objects.update_or_create(
            slug=list_def['slug'],
            defaults={
                'name': list_def['name'],
                'description': list_def.get('description', ''),
                'model_field_path': list_def.get('model_field_path', ''),
                'is_extensible': list_def.get('is_extensible', True),
                'is_reorderable': list_def.get('is_reorderable', True),
            },
        )

        for item_def in items:
            SystemChoiceItem.objects.update_or_create(
                choice_list=choice_list,
                value=item_def['value'],
                tenant=None,
                defaults={
                    'label': item_def['label'],
                    'order': item_def.get('order', 0),
                    'extra_data': item_def.get('extra_data', {}),
                    'is_default': bool(item_def.get('is_default', False)),
                    'is_active': True,
                },
            )


class Migration(migrations.Migration):
    dependencies = [
        ('system', '0012_systemconfiguration'),
    ]

    operations = [
        migrations.RunPython(seed_default_choice_lists, migrations.RunPython.noop),
    ]
