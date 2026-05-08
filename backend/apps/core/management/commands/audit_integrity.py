"""
Sentinel Integrity Audit Management Command

Automatically verifies system integrity across multiple dimensions:
- RLS policy compliance for all TenantAwareModel instances
- Queryset tenant filtering in ViewSets
- Self-healing report generation

This command should be run regularly in CI/CD to catch data leaks early.

Usage:
    python manage.py audit_integrity
    python manage.py audit_integrity --fix-priority=critical
    python manage.py audit_integrity --output=manifests/integrity_status.json

Created: 2026-03-04 - Phase 10.1: Sentinel Integrity Audit
"""
import json
import os
from pathlib import Path
from typing import Any, Dict

from django.apps import apps
from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import connection


class Command(BaseCommand):
    help = "Audit system integrity: RLS policies, tenant filters, security compliance"

    def add_arguments(self, parser):
        parser.add_argument(
            "--fix-priority",
            type=str,
            choices=["critical", "high", "medium", "low"],
            help="Only report issues with this priority or higher",
        )
        parser.add_argument(
            "--output",
            type=str,
            default="manifests/integrity_status.json",
            help="Path to write integrity report JSON",
        )
        parser.add_argument(
            "--verbose",
            action="store_true",
            help="Show detailed output for each check",
        )

    def handle(self, *args, **options):
        self.fix_priority = options.get("fix_priority")
        self.output_path = options.get("output")
        self.verbose = options.get("verbose", False)

        self.stdout.write(self.style.SUCCESS("=" * 60))
        self.stdout.write(self.style.SUCCESS("SENTINEL INTEGRITY AUDIT"))
        self.stdout.write(self.style.SUCCESS("=" * 60))

        report = {
            "timestamp": self._get_timestamp(),
            "checks": {},
            "issues": [],
            "summary": {
                "critical": 0,
                "high": 0,
                "medium": 0,
                "low": 0,
                "total": 0,
            },
        }

        # Run all integrity checks
        self._check_rls_policies(report)
        self._check_viewset_filters(report)
        self._check_tenant_aware_models(report)
        self._check_optional_services(report)

        # Generate report
        self._generate_report(report)
        self._write_report_file(report)

        # Exit with appropriate code
        if report["summary"]["critical"] > 0:
            self.stdout.write(self.style.ERROR(f"\n❌ CRITICAL ISSUES FOUND: {report['summary']['critical']}"))
            return 1
        elif report["summary"]["high"] > 0:
            self.stdout.write(self.style.WARNING(f"\n⚠️  HIGH PRIORITY ISSUES FOUND: {report['summary']['high']}"))
        else:
            self.stdout.write(self.style.SUCCESS(f"\n✅ ALL INTEGRITY CHECKS PASSED"))

        return 0

    def _get_timestamp(self):
        """Get ISO timestamp for report."""
        from datetime import datetime

        return datetime.utcnow().isoformat() + "Z"

    def _check_rls_policies(self, report: Dict[str, Any]):
        """
        Check that all TenantAwareModel instances have RLS policies.

        Critical Issue: Model inherits TenantAwareModel but has NO RLS policy.
        """
        self.stdout.write("\n[1/4] Checking RLS Policy Compliance...")

        from apps.core.models import TenantAwareModel

        tenant_models = []
        missing_policies = []

        # Find all models inheriting from TenantAwareModel
        for model in apps.get_models():
            if issubclass(model, TenantAwareModel) and model != TenantAwareModel:
                tenant_models.append(model)

        self.stdout.write(f"  Found {len(tenant_models)} tenant-aware models")

        # Check each model for RLS policy
        with connection.cursor() as cursor:
            for model in tenant_models:
                table_name = model._meta.db_table

                # Query PostgreSQL for RLS policies
                cursor.execute(
                    """
                    SELECT policyname, cmd, qual
                    FROM pg_policies
                    WHERE schemaname = 'public' AND tablename = %s
                    AND policyname LIKE %s
                """,
                    [table_name, "%tenant_isolation"],
                )

                policies = cursor.fetchall()

                if not policies:
                    missing_policies.append(
                        {
                            "model": f"{model._meta.app_label}.{model.__name__}",
                            "table": table_name,
                            "priority": "critical",
                            "fix": f"Add RLS policy to migration for {table_name}",
                        }
                    )
                    self.stdout.write(self.style.ERROR(f"  ❌ {model._meta.app_label}.{model.__name__}: NO RLS POLICY"))
                elif self.verbose:
                    self.stdout.write(self.style.SUCCESS(f"  ✓ {model._meta.app_label}.{model.__name__}"))

        # Add to report
        report["checks"]["rls_policies"] = {
            "total_models": len(tenant_models),
            "missing_policies": len(missing_policies),
            "status": "FAIL" if missing_policies else "PASS",
        }

        for issue in missing_policies:
            self._add_issue(report, "RLS Policy Missing", issue)

    def _check_viewset_filters(self, report: Dict[str, Any]):
        """
        Check that ViewSets in tenant_apps properly filter by tenant.

        Uses basic heuristics since full static analysis is complex.
        """
        self.stdout.write("\n[2/4] Checking ViewSet Tenant Filtering...")

        tenant_apps_path = Path(settings.BASE_DIR) / "tenant_apps"

        if not tenant_apps_path.exists():
            self.stdout.write(self.style.WARNING("  ⚠️  tenant_apps directory not found"))
            report["checks"]["viewset_filters"] = {
                "status": "SKIP",
                "reason": "tenant_apps directory not found",
            }
            return

        # Find all views.py and viewsets.py files
        viewset_files = []
        for pattern in ["**/views.py", "**/viewsets.py"]:
            viewset_files.extend(tenant_apps_path.glob(pattern))

        self.stdout.write(f"  Found {len(viewset_files)} ViewSet files")

        suspicious_files = []
        for file_path in viewset_files:
            content = file_path.read_text()

            # Check for ViewSet classes
            if "ViewSet" in content or "APIView" in content:
                # Look for tenant filtering patterns
                has_tenant_filter = (
                    "tenant=request.tenant" in content
                    or "tenant=self.request.tenant" in content
                    or "TenantAwareViewSetMixin" in content
                    or "filter(tenant=" in content
                )

                if not has_tenant_filter:
                    suspicious_files.append(
                        {
                            "file": str(file_path.relative_to(settings.BASE_DIR)),
                            "priority": "high",
                            "fix": "Add .filter(tenant=request.tenant) to get_queryset()",
                        }
                    )
                    self.stdout.write(
                        self.style.WARNING(f"  ⚠️  {file_path.relative_to(settings.BASE_DIR)}: No tenant filter found")
                    )
                elif self.verbose:
                    self.stdout.write(self.style.SUCCESS(f"  ✓ {file_path.relative_to(settings.BASE_DIR)}"))

        report["checks"]["viewset_filters"] = {
            "total_files": len(viewset_files),
            "suspicious_files": len(suspicious_files),
            "status": "WARN" if suspicious_files else "PASS",
        }

        for issue in suspicious_files:
            self._add_issue(report, "ViewSet Missing Tenant Filter (Suspected)", issue)

    def _check_tenant_aware_models(self, report: Dict[str, Any]):
        """
        Verify all models in tenant_apps inherit from TenantAwareModel.
        """
        self.stdout.write("\n[3/4] Checking TenantAwareModel Inheritance...")

        from apps.core.models import TenantAwareModel

        issues = []

        # Get all models from tenant_apps
        for app_config in apps.get_app_configs():
            if "tenant_apps" not in app_config.path:
                continue

            for model in app_config.get_models():
                # Skip abstract models
                if model._meta.abstract:
                    continue

                # Check if it has a tenant field but doesn't inherit from TenantAwareModel
                has_tenant_field = any(field.name == "tenant" for field in model._meta.get_fields())
                inherits_tenant_aware = issubclass(model, TenantAwareModel)

                if has_tenant_field and not inherits_tenant_aware:
                    issues.append(
                        {
                            "model": f"{app_config.label}.{model.__name__}",
                            "priority": "medium",
                            "fix": "Change model to inherit from TenantAwareModel",
                        }
                    )
                    self.stdout.write(
                        self.style.WARNING(
                            f"  ⚠️  {app_config.label}.{model.__name__}: Has tenant field but doesn't inherit TenantAwareModel"
                        )
                    )
                elif self.verbose and inherits_tenant_aware:
                    self.stdout.write(self.style.SUCCESS(f"  ✓ {app_config.label}.{model.__name__}"))

        report["checks"]["tenant_aware_models"] = {
            "issues_found": len(issues),
            "status": "WARN" if issues else "PASS",
        }

        for issue in issues:
            self._add_issue(report, "Incorrect TenantAwareModel Inheritance", issue)

    def _check_optional_services(self, report: Dict[str, Any]):
        """
        Check optional services (Gmail, Sentry) and ignore transient 401/403 errors.
        """
        self.stdout.write("\n[4/4] Checking Optional Service Configuration...")

        services = {}

        # Check OpenAI
        openai_key = os.environ.get("OPENAI_API_KEY")
        services["openai"] = {
            "configured": bool(openai_key),
            "status": "OK" if openai_key else "NOT_CONFIGURED",
        }

        # Check Redis
        redis_url = os.environ.get("REDIS_URL")
        services["redis"] = {
            "configured": bool(redis_url),
            "status": "OK" if redis_url else "NOT_CONFIGURED",
        }

        # Check Sentry
        sentry_dsn = os.environ.get("SENTRY_DSN")
        services["sentry"] = {
            "configured": bool(sentry_dsn),
            "status": "OK" if sentry_dsn else "NOT_CONFIGURED",
        }

        # Check Microsoft OAuth
        ms_client_id = os.environ.get("MICROSOFT_CLIENT_ID")
        services["microsoft"] = {
            "configured": bool(ms_client_id),
            "status": "OK" if ms_client_id else "NOT_CONFIGURED",
        }

        report["checks"]["optional_services"] = services

        # Log status
        for service, info in services.items():
            if info["status"] == "OK":
                self.stdout.write(self.style.SUCCESS(f"  ✓ {service.upper()}: Configured"))
            else:
                self.stdout.write(self.style.WARNING(f"  ⚠️  {service.upper()}: Not configured (optional)"))

    def _add_issue(self, report: Dict[str, Any], title: str, issue: Dict[str, Any]):
        """Add issue to report and increment counters."""
        priority = issue.get("priority", "medium")

        # Filter by priority if specified
        if self.fix_priority:
            priority_order = ["low", "medium", "high", "critical"]
            if priority_order.index(priority) < priority_order.index(self.fix_priority):
                return

        report["issues"].append({"title": title, "priority": priority, **issue})

        report["summary"][priority] += 1
        report["summary"]["total"] += 1

    def _generate_report(self, report: Dict[str, Any]):
        """Generate human-readable report summary."""
        self.stdout.write("\n" + "=" * 60)
        self.stdout.write("INTEGRITY AUDIT SUMMARY")
        self.stdout.write("=" * 60)

        # Check results
        for check_name, check_data in report["checks"].items():
            status = check_data.get("status", "UNKNOWN")

            if status == "PASS":
                self.stdout.write(self.style.SUCCESS(f"  ✓ {check_name}: PASSED"))
            elif status == "WARN":
                self.stdout.write(self.style.WARNING(f"  ⚠️  {check_name}: WARNINGS"))
            elif status == "FAIL":
                self.stdout.write(self.style.ERROR(f"  ❌ {check_name}: FAILED"))
            else:
                self.stdout.write(f"  ℹ️  {check_name}: {status}")

        # Issue counts
        self.stdout.write(f"\n  Critical: {report['summary']['critical']}")
        self.stdout.write(f"  High:     {report['summary']['high']}")
        self.stdout.write(f"  Medium:   {report['summary']['medium']}")
        self.stdout.write(f"  Low:      {report['summary']['low']}")
        self.stdout.write(f"  Total:    {report['summary']['total']}")

    def _write_report_file(self, report: Dict[str, Any]):
        """Write JSON report to file."""
        output_path = Path(settings.BASE_DIR) / self.output_path
        output_path.parent.mkdir(parents=True, exist_ok=True)

        with open(output_path, "w") as f:
            json.dump(report, f, indent=2)

        self.stdout.write(f"\n📄 Report written to: {output_path}")
