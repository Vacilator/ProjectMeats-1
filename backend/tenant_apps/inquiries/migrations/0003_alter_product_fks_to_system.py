# Generated manually for FK migration from products.Product to system.Product
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("inquiries", "0002_add_inquiry_templates"),
        ("system", "0002_add_product_model"),
    ]

    operations = [
        # InquiryProduct: Remove old FK, add new UUID FK (nullable)
        migrations.RemoveField(
            model_name="inquiryproduct",
            name="product",
        ),
        migrations.AddField(
            model_name="inquiryproduct",
            name="product",
            field=models.ForeignKey(
                null=True,
                blank=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="inquiry_lines",
                to="system.product",
            ),
        ),
        # InquiryTemplateProduct: Remove old FK, add new UUID FK (nullable)
        migrations.RemoveField(
            model_name="inquirytemplateproduct",
            name="product",
        ),
        migrations.AddField(
            model_name="inquirytemplateproduct",
            name="product",
            field=models.ForeignKey(
                null=True,
                blank=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="template_lines",
                to="system.product",
            ),
        ),
    ]
