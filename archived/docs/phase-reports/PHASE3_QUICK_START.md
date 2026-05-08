# Phase 3 Quick Start Guide: Dynamic Choice Engine

## For Backend Developers

### Using SystemChoiceList in Your Models

```python
from apps.system.models import SystemChoiceList, SystemChoiceItem

# Get choices for a dropdown
def get_protein_choices(tenant=None):
    """Get protein type choices for tenant."""
    protein_list = SystemChoiceList.objects.get(slug='protein_types')
    items = SystemChoiceItem.objects.filter(
        choice_list=protein_list,
        is_active=True
    )

    if tenant:
        # Include tenant custom items, exclude disabled system items
        items = items.filter(
            Q(tenant__isnull=True) | Q(tenant=tenant)
        )
    else:
        # System items only
        items = items.filter(tenant__isnull=True)

    return [(item.value, item.label) for item in items.order_by('order')]

# Use in model field
class Product(TenantAwareModel):
    protein_type = models.CharField(
        max_length=50,
        choices=get_protein_choices,  # Dynamically loaded
        help_text="Type of protein"
    )
```

### Adding Custom Fields to Entities

```python
from apps.system.models import TenantFieldDefinition

# Create a custom field
field_def = TenantFieldDefinition.objects.create(
    tenant=tenant,
    model_name='suppliers.Supplier',
    field_key='sustainability_score',
    field_type='number',
    label='Sustainability Score',
    help_text='1-10 rating',
    is_required=False,
    config={
        'min': 1,
        'max': 10,
        'step': 1
    },
    validation_rules={
        'min': 1,
        'max': 10
    }
)

# Store data
supplier.custom_data['sustainability_score'] = 8
supplier.save()

# Retrieve data
score = supplier.custom_data.get('sustainability_score')
```

### In Serializers

```python
from apps.system.models import TenantFieldDefinition

class SupplierSerializer(serializers.ModelSerializer):
    # Include custom_data in serialization
    custom_data = serializers.JSONField(read_only=False)

    class Meta:
        model = Supplier
        fields = ['id', 'name', 'custom_data', ...]

    def validate_custom_data(self, value):
        """Validate custom fields against TenantFieldDefinition."""
        tenant = self.context.get('tenant')
        if not tenant:
            return value

        field_defs = TenantFieldDefinition.objects.filter(
            tenant=tenant,
            model_name='suppliers.Supplier',
            is_active=True
        )

        for field_def in field_defs:
            if field_def.field_key in value:
                is_valid, error = field_def.validate_value(value[field_def.field_key])
                if not is_valid:
                    raise serializers.ValidationError({field_def.field_key: error})

        return value
```

---

## For Frontend Developers

### Using ChoiceListEditor Component

```tsx
import { ChoiceListEditor } from '@/components/Admin';

// In your admin page
export default function ChoiceManagementPage() {
  const [selectedList, setSelectedList] = useState('protein_types');

  return (
    <div>
      <h1>Manage Choice Lists</h1>
      <select onChange={(e) => setSelectedList(e.target.value)}>
        <option value="protein_types">Protein Types</option>
        <option value="packaging_types">Packaging Types</option>
        <option value="processing_grades">Processing Grades</option>
        <option value="cut_types">Cut Types</option>
      </select>

      <ChoiceListEditor choiceListSlug={selectedList} />
    </div>
  );
}
```

### Fetching Choice Items for Dropdowns

```tsx
import axios from 'axios';

// Fetch choice items
const fetchChoiceItems = async (slug: string) => {
  const response = await axios.get(
    `/api/v1/system/choice-lists/${slug}/items/`
  );
  return response.data;
};

// Use in a form
export function ProductForm() {
  const [proteinTypes, setProteinTypes] = useState([]);

  useEffect(() => {
    fetchChoiceItems('protein_types').then(setProteinTypes);
  }, []);

  return (
    <select name="protein_type">
      {proteinTypes.map(item => (
        <option key={item.id} value={item.value}>
          {item.label}
        </option>
      ))}
    </select>
  );
}
```

### Rendering Custom Fields

```tsx
import { useEffect, useState } from 'react';
import axios from 'axios';

interface CustomField {
  field_key: string;
  field_type: string;
  label: string;
  help_text: string;
  is_required: boolean;
  config: any;
  form_config: any;
}

export function DynamicFieldRenderer({ modelName }: { modelName: string }) {
  const [fields, setFields] = useState<CustomField[]>([]);

  useEffect(() => {
    axios.get('/api/v1/system/field-definitions/by-model/', {
      params: { model_name: modelName }
    }).then(res => setFields(res.data));
  }, [modelName]);

  return (
    <div className="space-y-4">
      {fields.map(field => (
        <div key={field.field_key}>
          <label className="block font-medium">
            {field.label}
            {field.is_required && <span className="text-red-500">*</span>}
          </label>
          {field.help_text && (
            <p className="text-sm text-gray-500">{field.help_text}</p>
          )}

          {field.field_type === 'text' && (
            <input type="text" className="w-full border rounded px-3 py-2" />
          )}
          {field.field_type === 'number' && (
            <input
              type="number"
              min={field.config.min}
              max={field.config.max}
              step={field.config.step}
              className="w-full border rounded px-3 py-2"
            />
          )}
          {field.field_type === 'select' && (
            <select className="w-full border rounded px-3 py-2">
              {field.config.options.map((opt: any) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}
          {field.field_type === 'checkbox' && (
            <input type="checkbox" className="h-5 w-5" />
          )}
        </div>
      ))}
    </div>
  );
}
```

---

## API Quick Reference

### Choice Lists

```bash
# List all choice lists
GET /api/v1/system/choice-lists/

# Get specific list with items
GET /api/v1/system/choice-lists/protein_types/

# Get items for a list (with tenant filtering)
GET /api/v1/system/choice-lists/protein_types/items/

# Add tenant custom item
POST /api/v1/system/choice-lists/protein_types/items/
{
  "value": "WAGYU",
  "label": "Wagyu Beef",
  "order": 100
}

# Reorder items
POST /api/v1/system/choice-lists/protein_types/reorder/
{
  "items": [
    {"id": "uuid1", "order": 10},
    {"id": "uuid2", "order": 20}
  ]
}
```

### Choice Overrides

```bash
# List tenant's overrides
GET /api/v1/system/choice-overrides/

# Create override to disable items
POST /api/v1/system/choice-overrides/
{
  "choice_list_slug": "protein_types",
  "disabled_system_items": ["uuid-of-seafood", "uuid-of-game"],
  "notes": "Customer doesn't handle seafood or game"
}

# Update override
PATCH /api/v1/system/choice-overrides/{id}/
{
  "disabled_system_items": ["uuid-of-seafood"]
}
```

### Field Definitions

```bash
# List tenant's custom fields
GET /api/v1/system/field-definitions/

# Get fields for specific model
GET /api/v1/system/field-definitions/by-model/?model_name=suppliers.Supplier

# Create custom field
POST /api/v1/system/field-definitions/
{
  "model_name": "suppliers.Supplier",
  "field_key": "halal_certified",
  "field_type": "checkbox",
  "label": "Halal Certified",
  "help_text": "Check if supplier is halal certified",
  "is_required": false,
  "display_order": 10
}

# Create select field
POST /api/v1/system/field-definitions/
{
  "model_name": "products.Product",
  "field_key": "quality_grade",
  "field_type": "select",
  "label": "Quality Grade",
  "config": {
    "options": [
      {"value": "A", "label": "Grade A"},
      {"value": "B", "label": "Grade B"}
    ]
  },
  "is_required": true
}
```

---

## Management Commands

```bash
# Seed meat industry choice lists
python manage.py seed_choice_lists

# Preview what would be created (dry run)
python manage.py seed_choice_lists --dry-run

# Force recreate existing lists
python manage.py seed_choice_lists --force

# Check for issues
python manage.py check

# View migrations
python manage.py showmigrations system
```

---

## Testing in Shell

```python
from apps.system.models import SystemChoiceList, SystemChoiceItem
from apps.system.models import TenantChoiceOverride, TenantFieldDefinition
from apps.tenants.models import Tenant

# Get a choice list
protein_list = SystemChoiceList.objects.get(slug='protein_types')

# Get all items
items = protein_list.items.all()

# Get active system items only
system_items = protein_list.items.filter(tenant__isnull=True, is_active=True)

# Create tenant custom item
tenant = Tenant.objects.first()
custom_item = SystemChoiceItem.objects.create(
    choice_list=protein_list,
    tenant=tenant,
    value='WAGYU',
    label='Wagyu Beef',
    order=100
)

# Create field definition
field_def = TenantFieldDefinition.objects.create(
    tenant=tenant,
    model_name='suppliers.Supplier',
    field_key='test_field',
    field_type='text',
    label='Test Field'
)

# Validate a value
is_valid, error = field_def.validate_value('test value')
print(f"Valid: {is_valid}, Error: {error}")
```

---

## Troubleshooting

### Issue: "Choice list not found"
**Solution:** Run seed command: `python manage.py seed_choice_lists`

### Issue: "Tenant context required"
**Solution:** Ensure `TenantMiddleware` is active and user is authenticated with tenant

### Issue: "Cannot modify system-defined items"
**Solution:** System items (tenant=None) are read-only. Create tenant custom items instead.

### Issue: "Field key already exists"
**Solution:** Field keys must be unique per model per tenant. Use different key or update existing.

### Issue: Drag-and-drop not working
**Solution:** Install dependencies: `npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`

---

## Best Practices

### Backend
1. ✅ Always filter choice items by tenant
2. ✅ Validate custom_data against TenantFieldDefinition
3. ✅ Use `get_protein_choices(tenant)` pattern for dynamic choices
4. ✅ Never hardcode choice values - use SystemChoiceList
5. ✅ Include `custom_data` in serializers for extensible models

### Frontend
1. ✅ Load choice items from API (not hardcoded)
2. ✅ Render custom fields dynamically from field definitions
3. ✅ Show "System" vs "Custom" badges for clarity
4. ✅ Validate custom_data before submission
5. ✅ Cache choice lists to reduce API calls

### Security
1. ✅ Only tenant admins can modify choice overrides
2. ✅ Only tenant admins can create field definitions
3. ✅ System items cannot be deleted
4. ✅ Tenant isolation enforced at queryset level
5. ✅ Validate field types and configs before saving

---

## Example Use Cases

### 1. Kosher Meat Distributor
```python
# Disable non-kosher protein types
override = TenantChoiceOverride.objects.create(
    tenant=kosher_tenant,
    choice_list=protein_list,
    disabled_system_items=[pork_id, game_id],
    notes="Kosher certification - no pork or game"
)

# Add custom certification field
TenantFieldDefinition.objects.create(
    tenant=kosher_tenant,
    model_name='suppliers.Supplier',
    field_key='kosher_certification',
    field_type='text',
    label='Kosher Certification Number',
    is_required=True
)
```

### 2. Seafood Specialist
```python
# Add custom seafood types
SystemChoiceItem.objects.create(
    choice_list=protein_list,
    tenant=seafood_tenant,
    value='LOBSTER',
    label='Lobster',
    order=41
)

# Add seafood-specific fields
TenantFieldDefinition.objects.create(
    tenant=seafood_tenant,
    model_name='products.Product',
    field_key='catch_method',
    field_type='select',
    label='Catch Method',
    config={
        'options': [
            {'value': 'WILD', 'label': 'Wild Caught'},
            {'value': 'FARMED', 'label': 'Farm Raised'}
        ]
    }
)
```

### 3. Premium Beef Broker
```python
# Add custom grades
SystemChoiceItem.objects.create(
    choice_list=grades_list,
    tenant=premium_tenant,
    value='WAGYU_A5',
    label='Wagyu A5',
    order=5,
    extra_data={'description': 'Highest grade Japanese Wagyu'}
)

# Add marbling score field
TenantFieldDefinition.objects.create(
    tenant=premium_tenant,
    model_name='products.Product',
    field_key='marbling_score',
    field_type='number',
    label='Marbling Score',
    config={'min': 1, 'max': 12, 'step': 1},
    validation_rules={'min': 1, 'max': 12}
)
```

---

**Last Updated:** 2026-02-14
**Phase:** 3 - Dynamic Choice Engine & Virtual Schema
**Status:** Production Ready
