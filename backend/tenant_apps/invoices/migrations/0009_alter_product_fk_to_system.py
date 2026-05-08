# Generated manually for FK migration from products.Product to system.Product
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("invoices", "0008_alter_invoice_invoice_number_and_more"),
        ("system", "0002_add_product_model"),
    ]

    operations = [
        # Remove old FK
        migrations.RemoveField(
            model_name="invoice",
            name="product",
        ),
        # Add new UUID FK
        migrations.AddField(
            model_name="invoice",
            name="product",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="invoices",
                to="system.product",
            ),
        ),
    ]
