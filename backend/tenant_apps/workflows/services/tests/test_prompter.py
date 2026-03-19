"""
Unit tests for AIPrompter service
"""

import json
from unittest.mock import Mock

from django.test import TestCase
from tenant_apps.workflows.services.prompter import AIPrompter


class AIPrompterTestCase(TestCase):
    """Test suite for AIPrompter service"""
    
    def setUp(self):
        self.prompter = AIPrompter()
        self.tenant = Mock()
        self.tenant.name = "Test Meat Co"
        self.tenant.custom_data = {"industry_type": "processor"}
        self.current_flow = {
            "nodes": [
                {"id": "node1", "type": "trigger", "data": {"label": "Start"}},
                {"id": "node2", "type": "input", "data": {"label": "Enter Data"}}
            ]
        }
    
    def test_load_template_success(self):
        template = self.prompter.load_template()
        self.assertIn("Meat Industry Workflow Architect", template)
    
    def test_parse_ai_response_valid(self):
        valid_response = json.dumps({
            "suggestions": [
                {"type": "condition", "label": "Check Temp", "description": "If > 40°F", "reasoning": "Safety", "priority": 1}
            ],
            "confidence": 0.95
        })
        parsed = self.prompter.parse_ai_response(valid_response)
        self.assertEqual(len(parsed["suggestions"]), 1)
    
    def test_get_fallback_suggestions(self):
        fallback = self.prompter.get_fallback_suggestions(self.tenant, self.current_flow)
        self.assertEqual(fallback["mode"], "static")
        self.assertEqual(fallback["confidence"], 0.0)

    # ------------------------------------------------------------------
    # Supply-chain template domain tests
    # ------------------------------------------------------------------

    def test_get_fallback_suggestions_cold_storage(self):
        """Cold-storage domain returns IoT + temperature-check suggestions."""
        fallback = self.prompter.get_fallback_suggestions(
            self.tenant, self.current_flow, template_domain="cold_storage_monitoring"
        )
        self.assertEqual(fallback["mode"], "static")
        self.assertEqual(fallback["template_domain"], "cold_storage_monitoring")
        types = [s["type"] for s in fallback["suggestions"]]
        self.assertIn("actionHTTP", types)
        self.assertIn("conditionIf", types)

    def test_get_fallback_suggestions_quality_inspection(self):
        """Quality-inspection domain returns NCR and lot-detail suggestions."""
        fallback = self.prompter.get_fallback_suggestions(
            self.tenant, self.current_flow, template_domain="quality_inspection"
        )
        self.assertEqual(fallback["mode"], "static")
        self.assertEqual(fallback["template_domain"], "quality_inspection")
        types = [s["type"] for s in fallback["suggestions"]]
        self.assertIn("FormStepSingle", types)
        self.assertIn("conditionIf", types)
        self.assertIn("actionCreateRecord", types)

    def test_get_fallback_suggestions_carrier_compliance(self):
        """Carrier-compliance domain returns FMCSA + pre-trip + BOL suggestions."""
        fallback = self.prompter.get_fallback_suggestions(
            self.tenant, self.current_flow, template_domain="carrier_compliance"
        )
        self.assertEqual(fallback["mode"], "static")
        self.assertEqual(fallback["template_domain"], "carrier_compliance")
        types = [s["type"] for s in fallback["suggestions"]]
        self.assertIn("actionHTTP", types)
        self.assertIn("FormStepSingle", types)
        self.assertIn("actionCreateRecord", types)

    def test_fallback_suggestions_max_three(self):
        """Each domain returns at most three suggestions."""
        for domain in ("cold_storage_monitoring", "quality_inspection", "carrier_compliance"):
            fallback = self.prompter.get_fallback_suggestions(
                self.tenant, self.current_flow, template_domain=domain
            )
            self.assertLessEqual(
                len(fallback["suggestions"]),
                3,
                f"Domain '{domain}' returned more than 3 suggestions",
            )

    def test_supply_chain_prompt_template_loads(self):
        """The dedicated supply-chain prompt file can be loaded."""
        supply_chain_prompter = AIPrompter(template_name="supply_chain_templates_v1.prompt")
        template = supply_chain_prompter.load_template()
        self.assertIn("Supply-Chain Automation Specialist", template)
        self.assertIn("cold_storage_monitoring", template)
        self.assertIn("quality_inspection", template)
        self.assertIn("carrier_compliance", template)

    def test_build_supply_chain_template_prompt(self):
        """build_supply_chain_template_prompt embeds domain and tenant context."""
        prompt = self.prompter.build_supply_chain_template_prompt(
            tenant=self.tenant,
            template_domain="quality_inspection",
            current_flow=self.current_flow,
        )
        self.assertIn("quality_inspection", prompt)
        self.assertIn(self.tenant.name, prompt)
