# Generated manually for FK migration from products.Product to system.Product
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("sales_orders", "0010_update_plant_fk_to_location"),
        ("system", "0002_add_product_model"),
    ]

    operations = [
        # Remove old FK
        migrations.RemoveField(
            model_name="salesorder",
            name="product",
        ),
        # Add new UUID FK
        migrations.AddField(
            model_name="salesorder",
            name="product",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="sales_orders",
                to="system.product",
            ),
        ),
    ]
