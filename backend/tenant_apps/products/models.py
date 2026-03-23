"""
Products models for ProjectMeats.

Master product list and related business logic.

Implements tenant ForeignKey field for shared-schema multi-tenancy.
"""
from django.db import models

from apps.core.models import ProteinTypeChoices, TenantAwareModel


class MasterProduct(TenantAwareModel):
    """Tenant-scoped master product definition.

    NOTE:
    This model intentionally excludes supplier/plant-specific attributes.
    Supplier-specific variants belong in SupplierAvailableItem.
    """

    TYPE_CHOICES = [
        ('whole', 'Whole'),
        ('flat', 'Flat'),
        ('point', 'Point'),
    ]

    TRIM_CHOICES = [
        ('trimmed', 'Trimmed'),
        ('not_trimmed', 'Not Trimmed (commodity trimmed)'),
        ('super_trimmed', 'Super Trimmed (x+)'),
    ]

    protein = models.CharField(max_length=50, choices=ProteinTypeChoices.choices)
    item_name = models.CharField(max_length=100)
    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    trim = models.CharField(max_length=30, choices=TRIM_CHOICES)

    display_name = models.CharField(max_length=255, editable=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['display_name']
        verbose_name = 'Master Product'
        verbose_name_plural = 'Master Products'
        constraints = [
            models.UniqueConstraint(
                fields=['tenant', 'protein', 'item_name', 'type', 'trim'],
                name='unique_master_product_per_tenant',
            ),
        ]

    def _build_display_name(self) -> str:
        protein = (self.protein or '').strip()
        item_name = (self.item_name or '').strip()
        type_label = (self.get_type_display() or '').title()
        trim_label = (self.get_trim_display() or '').title()

        parts = [p for p in [protein, item_name, type_label, trim_label] if p]
        return ' '.join(parts)[:255]

    def save(self, *args, **kwargs):
        self.display_name = self._build_display_name()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.display_name
