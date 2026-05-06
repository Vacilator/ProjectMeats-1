from __future__ import annotations

from typing import Final

SETTLEMENT_CONTRACT_VERSION: Final[str] = 'b2b-03.1.v1'
CANONICAL_POSTED_PAYMENT_LEDGER: Final[str] = 'tenant_apps.invoices.models.PaymentTransaction'
INITIAL_SETTLEMENT_ADAPTER: Final[str] = 'webhook'
RAW_PAYLOAD_HASH_ALGORITHM: Final[str] = 'sha256'
RAW_PAYLOAD_HASH_INPUT_RULE: Final[str] = 'utf8_exact_raw_payload_string'
RAW_EVENT_JOURNAL_STATES: Final[tuple[str, ...]] = (
    'received',
    'validated',
    'duplicate',
    'ready_to_post',
    'posted',
    'ignored',
    'failed',
)
RAW_EVENT_REQUIRED_FIELDS: Final[tuple[str, ...]] = (
    'tenant_id',
    'provider_code',
    'external_event_id',
    'provider_account_reference',
    'event_type',
    'direction',
    'occurred_at',
    'amount',
    'currency',
    'raw_payload',
    'raw_payload_sha256',
    'received_at',
)
IDEMPOTENCY_KEY_FIELDS: Final[tuple[str, ...]] = (
    'tenant_id',
    'provider_code',
    'external_event_id',
)
IDEMPOTENCY_FALLBACK_FIELDS: Final[tuple[str, ...]] = (
    'tenant_id',
    'provider_code',
    'provider_account_reference',
    'occurred_at',
    'amount',
    'direction',
    'raw_payload_sha256',
)
PAYMENT_TRANSACTION_PARENT_LINKS: Final[tuple[str, ...]] = (
    'invoice',
    'sales_order',
    'purchase_order',
)
ACCEPTED_SETTLEMENT_AUTH_MODES: Final[tuple[str, ...]] = (
    'tenant_api_key',
    'provider_hmac_signature',
)
DEFERRED_SETTLEMENT_ADAPTERS: Final[tuple[str, ...]] = (
    'direct_bank_feed',
    'file_import',
)
PROHIBITED_SETTLEMENT_SHORTCUTS: Final[tuple[str, ...]] = (
    'post_raw_event_directly_to_paymenttransaction',
    'cross_tenant_match_by_shared_reference',
    'bank_feed_first_mvp',
)


def get_settlement_reconciliation_contract() -> dict[str, object]:
    """Return the frozen settlement/reconciliation contract for downstream tickets."""

    return {
        'version': SETTLEMENT_CONTRACT_VERSION,
        'canonical_posted_payment_ledger': CANONICAL_POSTED_PAYMENT_LEDGER,
        'initial_adapter': INITIAL_SETTLEMENT_ADAPTER,
        'raw_payload_hash_algorithm': RAW_PAYLOAD_HASH_ALGORITHM,
        'raw_payload_hash_input_rule': RAW_PAYLOAD_HASH_INPUT_RULE,
        'raw_event_journal_states': RAW_EVENT_JOURNAL_STATES,
        'raw_event_required_fields': RAW_EVENT_REQUIRED_FIELDS,
        'idempotency_key_fields': IDEMPOTENCY_KEY_FIELDS,
        'idempotency_fallback_fields': IDEMPOTENCY_FALLBACK_FIELDS,
        'payment_transaction_parent_links': PAYMENT_TRANSACTION_PARENT_LINKS,
        'accepted_authentication_modes': ACCEPTED_SETTLEMENT_AUTH_MODES,
        'deferred_adapters': DEFERRED_SETTLEMENT_ADAPTERS,
        'prohibited_shortcuts': PROHIBITED_SETTLEMENT_SHORTCUTS,
    }
