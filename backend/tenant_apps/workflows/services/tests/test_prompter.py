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
