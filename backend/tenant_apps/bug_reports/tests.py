"""
Tests for Bug Reports app models.

Uses shared-schema multi-tenancy with tenant ForeignKey isolation.
"""
import uuid

from django.contrib.auth.models import User
from django.test import TestCase

from tenant_apps.bug_reports.models import BugReport

from apps.tenants.models import Tenant, TenantUser


class BugReportModelTest(TestCase):
    """Test cases for BugReport model."""

    @classmethod
    def setUpTestData(cls):
        """Set up test data shared across all tests."""
        unique_id = uuid.uuid4().hex[:8]
        cls.user = User.objects.create_user(
            username=f"testuser-{unique_id}", email=f"test-{unique_id}@example.com", password="testpass123"
        )
        cls.tenant = Tenant.objects.create(
            name=f"Test Company {unique_id}",
            slug=f"test-company-{unique_id}",
            contact_email=f"admin-{unique_id}@testcompany.com",
            created_by=cls.user,
        )
        TenantUser.objects.create(tenant=cls.tenant, user=cls.user, role="owner")

    def test_create_bug_report(self):
        """Test creating a bug report."""
        report = BugReport.objects.create(
            title="Login button not working",
            description="The login button doesn't respond to clicks",
            category="bug",
            severity="high",
            reporter=self.user,
            tenant=self.tenant,
        )

        self.assertEqual(report.title, "Login button not working")
        self.assertEqual(report.category, "bug")
        self.assertEqual(report.severity, "high")
        self.assertEqual(report.status, "new")  # Default status
        self.assertEqual(report.reporter, self.user)
        self.assertEqual(report.tenant, self.tenant)

    def test_bug_report_severity_choices(self):
        """Test different severity levels."""
        severities = ["low", "medium", "high", "critical"]

        for severity in severities:
            report = BugReport.objects.create(
                title=f"{severity.capitalize()} Bug",
                description="Description",
                severity=severity,
                tenant=self.tenant,
            )
            self.assertEqual(report.severity, severity)

    def test_bug_report_status_choices(self):
        """Test different status values."""
        statuses = ["new", "in_progress", "resolved", "closed", "wont_fix"]

        for status in statuses:
            report = BugReport.objects.create(
                title=f"Bug with {status}",
                description="Description",
                status=status,
                tenant=self.tenant,
            )
            self.assertEqual(report.status, status)

    def test_bug_report_category_choices(self):
        """Test different category values."""
        categories = ["bug", "feature_request", "question", "feedback"]

        for category in categories:
            report = BugReport.objects.create(
                title=f"Report: {category}",
                description="Description",
                category=category,
                tenant=self.tenant,
            )
            self.assertEqual(report.category, category)

    def test_bug_report_with_technical_details(self):
        """Test bug report with technical details."""
        report = BugReport.objects.create(
            title="UI Bug",
            description="Elements overlapping",
            browser="Chrome 120",
            os="Windows 11",
            screen_resolution="1920x1080",
            url="https://app.example.com/dashboard",
            tenant=self.tenant,
        )

        self.assertEqual(report.browser, "Chrome 120")
        self.assertEqual(report.os, "Windows 11")
        self.assertEqual(report.screen_resolution, "1920x1080")
        self.assertEqual(report.url, "https://app.example.com/dashboard")

    def test_bug_report_with_reproduction_steps(self):
        """Test bug report with reproduction details."""
        report = BugReport.objects.create(
            title="Form Submission Error",
            description="Form fails silently",
            steps_to_reproduce="1. Open form\n2. Fill fields\n3. Click submit",
            expected_behavior="Form should submit and show success message",
            actual_behavior="Nothing happens, no error shown",
            tenant=self.tenant,
        )

        self.assertIn("Open form", report.steps_to_reproduce)
        self.assertIn("success message", report.expected_behavior)
        self.assertIn("Nothing happens", report.actual_behavior)

    def test_bug_report_str_representation(self):
        """Test string representation of bug report."""
        report = BugReport.objects.create(
            title="Critical Bug",
            description="Description",
            severity="critical",
            tenant=self.tenant,
        )

        str_repr = str(report)
        self.assertIn("CRITICAL", str_repr)
        self.assertIn("Critical Bug", str_repr)

    def test_bug_report_tenant_isolation(self):
        """Test that bug reports are properly isolated by tenant."""
        unique_id = uuid.uuid4().hex[:8]

        # Create bug report for first tenant
        report1 = BugReport.objects.create(
            title="Bug 1",
            description="Description",
            tenant=self.tenant,
        )

        # Create second tenant
        other_user = User.objects.create_user(
            username=f"otheruser-{unique_id}", email=f"other-{unique_id}@example.com", password="testpass123"
        )
        other_tenant = Tenant.objects.create(
            name=f"Other Company {unique_id}",
            slug=f"other-company-{unique_id}",
            contact_email=f"admin-{unique_id}@othercompany.com",
            created_by=other_user,
        )

        # Create bug report for second tenant
        report2 = BugReport.objects.create(
            title="Bug 2",
            description="Description",
            tenant=other_tenant,
        )

        # Verify isolation
        tenant1_reports = BugReport.objects.for_tenant(self.tenant)
        tenant2_reports = BugReport.objects.for_tenant(other_tenant)

        self.assertEqual(tenant1_reports.count(), 1)
        self.assertEqual(tenant2_reports.count(), 1)
        self.assertIn(report1, tenant1_reports)
        self.assertNotIn(report2, tenant1_reports)

    def test_bug_report_ordering(self):
        """Test that bug reports are ordered by created_at descending."""
        BugReport.objects.create(
            title="First Bug",
            description="Description",
            tenant=self.tenant,
        )
        BugReport.objects.create(
            title="Second Bug",
            description="Description",
            tenant=self.tenant,
        )

        reports = list(BugReport.objects.for_tenant(self.tenant))
        self.assertEqual(reports[0].title, "Second Bug")  # Most recent first
        self.assertEqual(reports[1].title, "First Bug")
