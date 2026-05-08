# Generated manually for FK migration from products.Product to system.Product
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("purchase_orders", "0010_update_plant_fk_to_location"),
        ("system", "0002_add_product_model"),
    ]

    operations = [
        # PurchaseOrder: Remove old FK, add new UUID FK
        migrations.RemoveField(
            model_name="purchaseorder",
            name="product",
        ),
        migrations.AddField(
            model_name="purchaseorder",
            name="product",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="purchase_orders",
                to="system.product",
            ),
        ),
        # CarrierPurchaseOrder: Remove old FK, add new UUID FK
        migrations.RemoveField(
            model_name="carrierpurchaseorder",
            name="product",
        ),
        migrations.AddField(
            model_name="carrierpurchaseorder",
            name="product",
            field=models.ForeignKey(
                blank=True,
                help_text="Product being ordered",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="carrier_purchase_orders",
                to="system.product",
            ),
        ),
        # ColdStorageEntry: Remove old FK, add new UUID FK
        migrations.RemoveField(
            model_name="coldstorageentry",
            name="product",
        ),
        migrations.AddField(
            model_name="coldstorageentry",
            name="product",
            field=models.ForeignKey(
                blank=True,
                help_text="Product being stored",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="cold_storage_entries",
                to="system.product",
            ),
        ),
    ]
