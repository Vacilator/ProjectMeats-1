# Generated manually for FK migration from products.Product to system.Product
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('customers', '0007_customer_custom_data_alter_customer_tenant'),
        ('system', '0002_add_product_model'),
    ]

    operations = [
        # Remove old M2M through table
        migrations.RemoveField(
            model_name='customer',
            name='products',
        ),
        # Add new M2M pointing to system.Product
        migrations.AddField(
            model_name='customer',
            name='products',
            field=models.ManyToManyField(
                blank=True,
                help_text='Products associated with this customer',
                related_name='customers',
                to='system.product',
            ),
        ),
    ]
