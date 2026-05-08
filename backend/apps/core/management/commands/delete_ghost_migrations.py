"""
Management command to delete ghost migration records.

This command removes migration records from django_migrations table
that no longer exist in the codebase, allowing Django to re-apply
corrected migrations.

Usage:
    python manage.py delete_ghost_migrations workflows 0012 0013
"""

from django.core.management.base import BaseCommand
from django.db import connection


class Command(BaseCommand):
    help = "Delete ghost migration records from django_migrations table"

    def add_arguments(self, parser):
        parser.add_argument("app_label", type=str, help='App label (e.g., "workflows")')
        parser.add_argument(
            "migration_names", nargs="+", type=str, help='Migration name prefixes to delete (e.g., "0012" "0013")'
        )
        parser.add_argument(
            "--dry-run", action="store_true", help="Show what would be deleted without actually deleting"
        )

    def handle(self, *args, **options):
        app_label = options["app_label"]
        migration_prefixes = options["migration_names"]
        dry_run = options["dry_run"]

        self.stdout.write(
            self.style.WARNING(f"\n{'DRY RUN: ' if dry_run else ''}Deleting ghost migrations for app: {app_label}")
        )

        with connection.cursor() as cursor:
            for prefix in migration_prefixes:
                # Find migrations matching the prefix
                cursor.execute(
                    "SELECT id, name, applied FROM django_migrations " "WHERE app = %s AND name LIKE %s",
                    [app_label, f"{prefix}%"],
                )
                rows = cursor.fetchall()

                if not rows:
                    self.stdout.write(self.style.WARNING(f"  No migrations found for {app_label}.{prefix}%"))
                    continue

                # Display what will be deleted
                for row in rows:
                    migration_id, name, applied = row
                    self.stdout.write(f"  Found: {app_label}.{name} (ID: {migration_id}, Applied: {applied})")

                if not dry_run:
                    # Delete the records
                    cursor.execute(
                        "DELETE FROM django_migrations " "WHERE app = %s AND name LIKE %s", [app_label, f"{prefix}%"]
                    )
                    deleted_count = cursor.rowcount
                    self.stdout.write(
                        self.style.SUCCESS(f"  ✓ Deleted {deleted_count} record(s) for {app_label}.{prefix}%")
                    )
                else:
                    self.stdout.write(self.style.WARNING(f"  [DRY RUN] Would delete {len(rows)} record(s)"))

        if dry_run:
            self.stdout.write(self.style.WARNING("\nDRY RUN complete. Use without --dry-run to actually delete."))
        else:
            self.stdout.write(self.style.SUCCESS("\n✓ Ghost migration deletion complete!"))
            self.stdout.write(self.style.WARNING("Run 'python manage.py migrate' to apply corrected migrations."))
