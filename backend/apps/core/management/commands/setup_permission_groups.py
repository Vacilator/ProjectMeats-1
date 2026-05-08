"""
Management command to set up default permission groups.

Creates standard role-based permission groups:
- Administrators: Full access to all business entities
- Managers: Business operations (CRUD on core entities)
- Sales Team: Customer and sales-focused permissions
- Purchasing Team: Supplier and purchasing-focused permissions
- Accounting: Financial data access
- Read Only: View-only access to all entities
"""
from django.contrib.auth.models import Group, Permission
from django.core.management.base import BaseCommand
from django.db import transaction

# Business entity apps and models that should have permissions
BUSINESS_ENTITIES = {
    "suppliers": ["supplier"],
    "customers": ["customer"],
    "contacts": ["contact", "activitylog", "scheduledcall"],
    "carriers": ["carrier"],
    "purchase_orders": ["purchaseorder", "purchaseorderline"],
    "sales_orders": ["salesorder", "salesorderline"],
    "invoices": ["invoice", "invoiceline"],
    # 'accounts_receivables' removed in v2.0 Wave 1 (merged into invoices/accounting)
    "products": ["product", "productcategory"],
    "plants": ["plant"],
    "locations": ["location"],
    "workflows": ["tenantform", "tenantformfield", "formsubmission"],
}

# System/internal apps - permissions generally not user-facing
EXCLUDED_APPS = [
    "admin",
    "auth",
    "authtoken",
    "contenttypes",
    "sessions",
    "system_config",
    "ai_assistant",
    "bug_reports",
]


class Command(BaseCommand):
    help = "Set up default permission groups for role-based access control"

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Remove all existing group permissions before setting up",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be done without making changes",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        reset = options["reset"]

        if dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN - No changes will be made"))

        with transaction.atomic():
            if reset and not dry_run:
                self.reset_groups()

            groups = self.setup_groups(dry_run)

            self.stdout.write("")
            self.stdout.write(self.style.SUCCESS("Permission groups setup complete!"))
            self.stdout.write("")

            # Print summary
            for group_name, perms in groups.items():
                self.stdout.write(f"  {group_name}: {len(perms)} permissions")

    def reset_groups(self):
        """Remove all permissions from existing groups."""
        self.stdout.write("Resetting existing group permissions...")
        for group in Group.objects.all():
            group.permissions.clear()
        self.stdout.write(self.style.SUCCESS("  Done"))

    def setup_groups(self, dry_run=False):
        """Create and configure permission groups."""
        groups = {}

        # 1. Administrators - Full Access
        admin_perms = self.get_all_business_permissions()
        groups["Administrators"] = admin_perms
        if not dry_run:
            self.create_group("Administrators", admin_perms)

        # 2. Managers - Business Operations
        manager_perms = self.get_crud_permissions(
            [
                "suppliers",
                "customers",
                "contacts",
                "carriers",
                "purchase_orders",
                "sales_orders",
                "invoices",
            ]
        )
        manager_perms += self.get_view_permissions(["products", "plants", "locations"])
        groups["Managers"] = manager_perms
        if not dry_run:
            self.create_group("Managers", manager_perms)

        # 3. Sales Team
        sales_perms = self.get_permissions(["customers", "contacts"], ["add", "change", "view"])
        sales_perms += self.get_crud_permissions(["sales_orders"])
        sales_perms += self.get_view_permissions(["products", "invoices"])
        groups["Sales Team"] = sales_perms
        if not dry_run:
            self.create_group("Sales Team", sales_perms)

        # 4. Purchasing Team
        purchasing_perms = self.get_permissions(["suppliers", "contacts"], ["add", "change", "view"])
        purchasing_perms += self.get_crud_permissions(["purchase_orders"])
        purchasing_perms += self.get_view_permissions(["products", "plants"])
        groups["Purchasing Team"] = purchasing_perms
        if not dry_run:
            self.create_group("Purchasing Team", purchasing_perms)

        # 5. Accounting
        accounting_perms = self.get_crud_permissions(["invoices"])  # accounts_receivables removed in v2.0
        accounting_perms += self.get_view_permissions(["sales_orders", "purchase_orders", "customers"])
        groups["Accounting"] = accounting_perms
        if not dry_run:
            self.create_group("Accounting", accounting_perms)

        # 6. Read Only
        readonly_perms = self.get_view_permissions(list(BUSINESS_ENTITIES.keys()))
        groups["Read Only"] = readonly_perms
        if not dry_run:
            self.create_group("Read Only", readonly_perms)

        return groups

    def create_group(self, name, permissions):
        """Create or update a group with the given permissions."""
        group, created = Group.objects.get_or_create(name=name)

        if created:
            self.stdout.write(f"Created group: {name}")
        else:
            self.stdout.write(f"Updated group: {name}")
            group.permissions.clear()

        # Add permissions
        perm_objects = Permission.objects.filter(codename__in=[p["codename"] for p in permissions])
        group.permissions.add(*perm_objects)

    def get_all_business_permissions(self):
        """Get all permissions for business entities."""
        perms = []
        for app_label, models in BUSINESS_ENTITIES.items():
            for model in models:
                for action in ["add", "change", "delete", "view"]:
                    perms.append(
                        {
                            "codename": f"{action}_{model}",
                            "app_label": app_label,
                        }
                    )
        return perms

    def get_crud_permissions(self, apps):
        """Get full CRUD permissions for specified apps."""
        return self.get_permissions(apps, ["add", "change", "delete", "view"])

    def get_view_permissions(self, apps):
        """Get view-only permissions for specified apps."""
        return self.get_permissions(apps, ["view"])

    def get_permissions(self, apps, actions):
        """Get specific permissions for specified apps and actions."""
        perms = []
        for app_label in apps:
            if app_label not in BUSINESS_ENTITIES:
                continue
            for model in BUSINESS_ENTITIES[app_label]:
                for action in actions:
                    perms.append(
                        {
                            "codename": f"{action}_{model}",
                            "app_label": app_label,
                        }
                    )
        return perms
