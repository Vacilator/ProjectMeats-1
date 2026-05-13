"""
Plants models for ProjectMeats.

Implements tenant ForeignKey field for shared-schema multi-tenancy.
"""

from django.contrib.auth.models import User
from django.contrib.postgres.fields import ArrayField
from django.db import models

from apps.core.models import PhoneTypeChoices, TenantAwareModel


class Plant(TenantAwareModel):
    PLANT_TYPE_CHOICES = [
        ("vertical", "Vertical (Kill to Fabrication)"),
        ("processing", "Processing Plant"),
        ("distribution", "Distribution Center"),
        ("warehouse", "Warehouse"),
        ("retail", "Retail Location"),
        ("other", "Other"),
    ]

    # Parent entity relationship (Phase 4: Contextual Supplier Selection)
    supplier = models.ForeignKey(
        'suppliers.Supplier',
        on_delete=models.CASCADE,
        related_name='supplier_plants',
        null=True,
        blank=True,
        help_text="Supplier that owns/operates this plant"
    )

    # Known products (legacy: system.Product)
    associated_products = models.ManyToManyField(
        'system.Product',
        through='PlantAssociatedProduct',
        related_name='sold_by_plants',
        blank=True,
        verbose_name='Known Products Sold',
        help_text='Legacy system.Product associations (deprecated).',
    )

    # Known products (new: tenant-scoped MasterProduct)
    associated_master_products = models.ManyToManyField(
        'products.MasterProduct',
        through='PlantAssociatedMasterProduct',
        related_name='known_by_plants',
        blank=True,
        verbose_name='Known Master Products',
        help_text='Master products commonly sold/produced by this plant.',
    )

    export_approved = models.BooleanField(
        default=False,
        help_text='Whether this plant is export approved.',
    )
    export_documents_handled = ArrayField(
        models.CharField(max_length=100),
        blank=True,
        default=list,
        help_text='Export documents handled when export approved.',
    )

    proteins_offered = models.ManyToManyField(
        'core.Protein',
        through='PlantProteinOffered',
        related_name='plants_offering',
        blank=True,
        help_text='Proteins offered by this plant (tenant-scoped link table).',
    )
    proteins_tested = models.ManyToManyField(
        'core.Protein',
        through='PlantProteinTested',
        related_name='plants_testing',
        blank=True,
        help_text='Proteins tested (COA) by this plant (tenant-scoped link table).',
    )

    name = models.CharField(max_length=200)
    plant_est_num = models.CharField(
        max_length=50,
        blank=True,
        default='',
        help_text="Plant establishment number",
    )
    site_code = models.CharField(
        max_length=50,
        blank=True,
        default='',
        help_text="Internal site code for the plant/facility",
    )
    plant_type = models.CharField(
        max_length=20, choices=PLANT_TYPE_CHOICES, default="processing"
    )
    address = models.TextField(default='', blank=True)
    city = models.CharField(max_length=100, default='', blank=True)
    state = models.CharField(max_length=100, default='', blank=True)
    zip_code = models.CharField(max_length=20, default='', blank=True)
    country = models.CharField(max_length=100, default="USA")

    booking_contact_email = models.EmailField(
        blank=True,
        default='',
        help_text='Booking contact email (optional)',
    )
    booking_contact_phone = models.CharField(
        max_length=20,
        blank=True,
        default='',
        help_text='Booking contact phone (optional)',
    )
    booking_contact_phone_type = models.CharField(
        max_length=10,
        choices=PhoneTypeChoices.choices,
        blank=True,
        default=PhoneTypeChoices.OFFICE,
        help_text='Booking contact phone type (mobile or office)',
    )

    capacity = models.PositiveIntegerField(
        help_text="Capacity in units", null=True, blank=True
    )
    is_active = models.BooleanField(default=True)
    fcfs = models.BooleanField(
        default=False,
        help_text='FCFS (First Come First Serve) plant scheduling/availability flag',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True
    )

    class Meta:
        ordering = ["name"]
        verbose_name = "Plant"
        verbose_name_plural = "Plants"
        indexes = [
            models.Index(fields=['tenant', 'name']),
            models.Index(fields=['tenant', 'plant_est_num']),
        ]

    def __str__(self):
        ident = (self.plant_est_num or '').strip()
        return f"{ident} - {self.name}" if ident else self.name


class PlantAssociatedProduct(TenantAwareModel):
    """Tenant-safe link table for Plant ↔ system.Product affinity (deprecated)."""

    plant = models.ForeignKey(
        Plant,
        on_delete=models.CASCADE,
        related_name='associated_product_links',
    )
    product = models.ForeignKey(
        'system.Product',
        on_delete=models.CASCADE,
        related_name='plant_affinity_links',
    )

    class Meta:
        verbose_name = 'Plant Known Product'
        verbose_name_plural = 'Plant Known Products'
        constraints = [
            models.UniqueConstraint(
                fields=['tenant', 'plant', 'product'],
                name='unique_plant_product_affinity_per_tenant',
            )
        ]
        indexes = [
            models.Index(fields=['tenant', 'plant']),
            models.Index(fields=['tenant', 'product']),
        ]


class PlantAssociatedMasterProduct(TenantAwareModel):
    """Tenant-safe link table for Plant ↔ products.MasterProduct affinity."""

    plant = models.ForeignKey(
        Plant,
        on_delete=models.CASCADE,
        related_name='associated_master_product_links',
    )
    master_product = models.ForeignKey(
        'products.MasterProduct',
        on_delete=models.CASCADE,
        related_name='plant_affinity_links',
    )

    class Meta:
        verbose_name = 'Plant Known Master Product'
        verbose_name_plural = 'Plant Known Master Products'
        constraints = [
            models.UniqueConstraint(
                fields=['tenant', 'plant', 'master_product'],
                name='unique_plant_master_product_affinity_per_tenant',
            )
        ]
        indexes = [
            models.Index(fields=['tenant', 'plant']),
            models.Index(fields=['tenant', 'master_product']),
        ]


class PlantProteinOffered(TenantAwareModel):
    """Tenant-safe link table for Plant ↔ core.Protein offered."""

    plant = models.ForeignKey(
        Plant,
        on_delete=models.CASCADE,
        related_name='protein_offered_links',
    )
    protein = models.ForeignKey(
        'core.Protein',
        on_delete=models.CASCADE,
        related_name='plant_offered_links',
    )

    class Meta:
        verbose_name = 'Plant Protein Offered'
        verbose_name_plural = 'Plant Proteins Offered'
        constraints = [
            models.UniqueConstraint(
                fields=['tenant', 'plant', 'protein'],
                name='unique_plant_protein_offered_per_tenant',
            )
        ]
        indexes = [
            models.Index(fields=['tenant', 'plant']),
            models.Index(fields=['tenant', 'protein']),
        ]


class PlantProteinTested(TenantAwareModel):
    """Tenant-safe link table for Plant ↔ core.Protein tested (COA)."""

    plant = models.ForeignKey(
        Plant,
        on_delete=models.CASCADE,
        related_name='protein_tested_links',
    )
    protein = models.ForeignKey(
        'core.Protein',
        on_delete=models.CASCADE,
        related_name='plant_tested_links',
    )

    class Meta:
        verbose_name = 'Plant Protein Tested'
        verbose_name_plural = 'Plant Proteins Tested'
        constraints = [
            models.UniqueConstraint(
                fields=['tenant', 'plant', 'protein'],
                name='unique_plant_protein_tested_per_tenant',
            )
        ]
        indexes = [
            models.Index(fields=['tenant', 'plant']),
            models.Index(fields=['tenant', 'protein']),
        ]
