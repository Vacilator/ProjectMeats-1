import pytest
from tenant_apps.ai_assistant.swarm.executor import ToolExecutor


@pytest.mark.unit
def test_extract_purchase_order_fields_fallback_parses_po_18132():
    text = """
    Purchase Order PO-18132
    Vendor: North American Meats
    Item: Beef Heart Cap
    Quantity: 40,000 lbs
    """.strip()

    executor = ToolExecutor()
    out = executor._extract_purchase_order_fields({"text": text}, tenant=None, user=None)

    assert out["order_number"] == "18132"
    assert out["vendor_name"] == "North American Meats"
    assert out["items"] and out["items"][0]["description"] == "Beef Heart Cap"
    assert out["items"][0]["total_weight"] == 40000.0
    assert out["items"][0]["weight_unit"] == "LBS"
