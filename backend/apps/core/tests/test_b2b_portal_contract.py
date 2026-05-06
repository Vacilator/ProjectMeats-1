from django.test import SimpleTestCase

from apps.core.security import (
    B2B_PORTAL_ALLOWED_DOCUMENT_SOURCES,
    B2B_PORTAL_FORBIDDEN_AUTH_ENDPOINTS,
    B2B_PORTAL_FORBIDDEN_MODEL_SURFACES,
    B2B_PORTAL_REQUIRED_GRANT_FIELDS,
    get_b2b_portal_contract,
)


class B2BPortalContractTests(SimpleTestCase):
    def test_contract_forbids_legacy_guest_login_and_internal_auth_bootstrap(self):
        self.assertIn("/api/v1/auth/guest-login/", B2B_PORTAL_FORBIDDEN_AUTH_ENDPOINTS)
        self.assertIn("/api/v1/auth/token/", B2B_PORTAL_FORBIDDEN_AUTH_ENDPOINTS)

    def test_contract_blocks_direct_ai_document_exposure(self):
        self.assertEqual(B2B_PORTAL_FORBIDDEN_MODEL_SURFACES, {"AIDocument"})

    def test_contract_limits_allowed_document_sources(self):
        self.assertIn("invoice_pdf", B2B_PORTAL_ALLOWED_DOCUMENT_SOURCES)
        self.assertIn("fulfillment_tracking", B2B_PORTAL_ALLOWED_DOCUMENT_SOURCES)
        self.assertNotIn("ai_document", B2B_PORTAL_ALLOWED_DOCUMENT_SOURCES)

    def test_contract_requires_signed_grant_lifecycle_fields(self):
        self.assertEqual(
            B2B_PORTAL_REQUIRED_GRANT_FIELDS,
            (
                "tenant_id",
                "grant_id",
                "subject_email",
                "resource_scope",
                "document_sources",
                "expires_at",
                "revoked_at",
                "created_by",
            ),
        )

    def test_contract_helper_returns_all_guardrail_sections(self):
        contract = get_b2b_portal_contract()

        self.assertIn("forbidden_auth_endpoints", contract)
        self.assertIn("allowed_document_sources", contract)
        self.assertIn("forbidden_model_surfaces", contract)
        self.assertIn("required_grant_fields", contract)
