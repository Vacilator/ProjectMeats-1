import django.contrib.postgres.fields
from django.db import migrations, models


def migrate_booking_department_to_shipping(apps, schema_editor):
    Contact = apps.get_model("contacts", "Contact")
    Contact.objects.filter(department="booking").update(department="shipping")


def migrate_shipping_department_to_booking(apps, schema_editor):
    Contact = apps.get_model("contacts", "Contact")
    Contact.objects.filter(department="shipping").update(department="booking")


class Migration(migrations.Migration):
    dependencies = [
        ("contacts", "0009_contactmasterproductresponsibility_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="contact",
            name="documents_responsible_for",
            field=django.contrib.postgres.fields.ArrayField(
                base_field=models.CharField(max_length=100),
                blank=True,
                default=list,
                help_text="Documents this contact is responsible for",
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="contact",
            name="notes",
            field=models.TextField(blank=True, help_text="Additional contact notes", null=True),
        ),
        migrations.AddField(
            model_name="contact",
            name="title",
            field=models.CharField(
                blank=True,
                help_text="Specific job title/role",
                max_length=100,
                null=True,
            ),
        ),
        migrations.RunPython(
            migrate_booking_department_to_shipping,
            reverse_code=migrate_shipping_department_to_booking,
        ),
        migrations.AlterField(
            model_name="contact",
            name="department",
            field=models.CharField(
                blank=True,
                choices=[
                    ("sales", "Sales"),
                    ("qa", "Quality Assurance"),
                    ("shipping", "Shipping / Loadout"),
                    ("certification", "Certification"),
                    ("accounting", "Accounting"),
                ],
                default="",
                help_text="Department this contact belongs to (Sales, QA, Shipping / Loadout, Certification, Accounting)",
                max_length=32,
                null=True,
            ),
        ),
    ]
