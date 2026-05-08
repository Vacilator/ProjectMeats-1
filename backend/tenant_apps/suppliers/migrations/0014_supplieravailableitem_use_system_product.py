"""
Migration: Switch SupplierAvailableItem.master_product → product (system.Product).

Removes the FK to products.MasterProduct and adds a FK to system.Product,
which is the single source of truth for the product catalog.
The existing RLS policy on tenant_id remains valid and is unchanged.

NOTE: The new `product` FK is non-nullable. This migration assumes the
`suppliers_supplieravailableitem` table is empty at the time of migration
(the model was introduced in 0013 with no prior production data path).
If the table has rows, a data-migration step will be needed first.
"""
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("suppliers", "0013_remove_supplier_products_supplierplant_and_more"),
        ("system", "0011_tenantform_is_workform_tenantform_parent_workform"),
    ]

    operations = [
        # 1. Drop old unique constraint on (tenant, supplier, master_product)
        migrations.RemoveConstraint(
            model_name="supplieravailableitem",
            name="unique_supplier_master_product_per_tenant",
        ),
        # 2. Drop old index on (tenant, master_product)
        migrations.RemoveIndex(
            model_name="supplieravailableitem",
            name="suppliers_s_tenant__09f0b8_idx",
        ),
        # 3. Remove product_code field (no longer needed; product_code lives on system.Product)
        migrations.RemoveField(
            model_name="supplieravailableitem",
            name="product_code",
        ),
        # 4. Remove the old master_product FK
        migrations.RemoveField(
            model_name="supplieravailableitem",
            name="master_product",
        ),
        # 5. Add new product FK → system.Product
        migrations.AddField(
            model_name="supplieravailableitem",
            name="product",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name="supplier_available_items",
                to="system.product",
            ),
            preserve_default=False,
        ),
        # 6. Add new unique constraint on (tenant, supplier, product)
        migrations.AddConstraint(
            model_name="supplieravailableitem",
            constraint=models.UniqueConstraint(
                fields=("tenant", "supplier", "product"),
                name="unique_supplier_product_per_tenant",
            ),
        ),
        # 7. Add new index on (tenant, product)
        migrations.AddIndex(
            model_name="supplieravailableitem",
            index=models.Index(
                fields=["tenant", "product"],
                name="suppliers_s_tenant__product_idx",
            ),
        ),
        # 8. Update ordering (handled by model Meta; no SQL needed)
        migrations.AlterModelOptions(
            name="supplieravailableitem",
            options={"ordering": ["supplier", "product__name"]},
        ),
    ]
