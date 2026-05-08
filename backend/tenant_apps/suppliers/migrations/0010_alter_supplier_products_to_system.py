# Generated manually for FK migration from products.Product to system.Product
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("suppliers", "0009_supplier_custom_data_alter_supplier_tenant"),
        ("system", "0002_add_product_model"),
    ]

    operations = [
        # Remove old M2M through table
        migrations.RemoveField(
            model_name="supplier",
            name="products",
        ),
        # Add new M2M pointing to system.Product
        migrations.AddField(
            model_name="supplier",
            name="products",
            field=models.ManyToManyField(
                blank=True,
                help_text="Products available from this supplier",
                related_name="suppliers",
                to="system.product",
            ),
        ),
    ]
