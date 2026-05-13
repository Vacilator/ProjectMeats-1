"""
Celery tasks for email integrations.

Background tasks for periodic email syncing, AI classification, and order ingestion.
"""
import logging
import random
from typing import Any

from celery import group, shared_task
from tenant_apps.ai_assistant.tasks.watchdog import sync_ai_feedback_queue_for_tenant
from tenant_apps.integrations.services.email_ingestion import EmailIngestionService

from apps.integrations.email_failure_contract import build_sync_action, failure_from_stats
from apps.integrations.models import ExternalAuthProvider
from apps.tenants.models import Tenant
from apps.tenants.rls import tenant_rls

logger = logging.getLogger(__name__)


def _build_sync_progress(*, phase: str, percent: int, summary: str) -> dict[str, Any]:
    return {
        "phase": phase,
        "percent": max(0, min(int(percent), 100)),
        "summary": summary,
    }


def _summarize_sync_result(*, stats: dict[str, Any] | None, ai_inbox: dict[str, Any] | None) -> str:
    stats = stats or {}
    ai_inbox = ai_inbox or {}

    scanned = int(stats.get("emails_scanned") or 0)
    saved = int(stats.get("emails_saved") or 0)
    skipped = int(stats.get("emails_skipped") or 0)
    unread = int(ai_inbox.get("unread_count") or 0)

    if saved > 0:
        return (
            f"Saved {saved} new email{'s' if saved != 1 else ''} from {scanned} scanned. "
            f"AI Inbox now has {unread} pending item{'s' if unread != 1 else ''}."
        )

    if skipped > 0:
        return (
            f"No new emails were saved. {skipped} existing email{'s' if skipped != 1 else ''} "
            f"were skipped; AI Inbox has {unread} pending item{'s' if unread != 1 else ''}."
        )

    return (
        f"Email sync completed after scanning {scanned} email{'s' if scanned != 1 else ''}. "
        f"AI Inbox has {unread} pending item{'s' if unread != 1 else ''}."
    )


@shared_task(
    name="integrations.classify_email_async",
    bind=True,
    max_retries=2,
    soft_time_limit=120,
    time_limit=150,
    acks_late=True,
)
def classify_email_async(self, email_log_id: str, tenant_id: str):
    """Run AI classification for an ingested email in the background.

    Extracted from the synchronous post_save signal handler so that OpenAI
    calls don't block the Django request/response cycle.
    """
    from tenant_apps.inquiries.services import parse_supplier_quote_reply

    from apps.integrations.ai_classification import classify_ingested_email
    from apps.integrations.dependency_drafter import build_related_entity_drafts
    from apps.integrations.inquiry_drafts import upsert_inquiry_draft_from_email
    from apps.integrations.models import EmailLog, EmailReviewDraft
    from apps.integrations.signals import (
        _notify_actionable_email,
        _record_email_lineage_event,
        _upsert_action_required_feedback,
    )

    try:
        with tenant_rls(tenant_id):
            instance = EmailLog.objects.get(pk=email_log_id)

            # Check for supplier RFQ reply first
            supplier_reply = parse_supplier_quote_reply(email_log=instance)
            if supplier_reply is not None:
                _upsert_action_required_feedback(instance, supplier_reply)
                supplier_reply_parse = supplier_reply.get("supplier_reply_parse") or {}
                supplier_lineage = supplier_reply_parse.get("lineage") or {}
                _record_email_lineage_event(
                    instance,
                    event_type="supplier_reply_parsed",
                    summary=str(supplier_reply.get("summary") or "AI parsed supplier quote reply."),
                    target_type="inquiry" if supplier_lineage.get("inquiry_id") else "",
                    target_id=str(supplier_lineage.get("inquiry_id") or ""),
                    metadata={
                        "category": str(supplier_reply.get("category") or ""),
                        "parse_status": str(supplier_reply_parse.get("parse_status") or ""),
                        "correlation_status": str(supplier_reply_parse.get("correlation_status") or ""),
                        "supplier_id": supplier_lineage.get("supplier_id"),
                        "rfq_id": supplier_lineage.get("rfq_id"),
                        "inquiry_id": supplier_lineage.get("inquiry_id"),
                    },
                )
                logger.info(
                    "Email %s matched supplier RFQ reply flow with parse_status=%s",
                    instance.id,
                    supplier_reply.get("supplier_reply_parse", {}).get("parse_status"),
                )
                instance.mark_as_completed(extracted_data=supplier_reply)
                return {"email_id": email_log_id, "result": "supplier_reply"}

            # Build combined attachment text
            attachment_text = ""
            attachment_meta = []
            if instance.attachment_data and isinstance(instance.attachment_data, dict):
                files = instance.attachment_data.get("files") or []
                text_parts = []
                for f in files:
                    extracted = f.get("extracted_text", "")
                    fname = f.get("name", "attachment")
                    attachment_meta.append(
                        {
                            "name": fname,
                            "content_type": f.get("content_type", ""),
                            "size": f.get("size", 0),
                            "extraction_status": f.get("extraction_status", ""),
                        }
                    )
                    if extracted and f.get("extraction_status") == "success":
                        text_parts.append(f"--- {fname} ---\n{extracted}")
                attachment_text = "\n\n".join(text_parts)

            if attachment_meta:
                _record_email_lineage_event(
                    instance,
                    event_type="email_attachments_extracted",
                    summary=f"Processed {len(attachment_meta)} attachment(s) for AI extraction.",
                    target_type="",
                    target_id="",
                    metadata={
                        "attachment_count": len(attachment_meta),
                        "attachment_names": [a["name"] for a in attachment_meta],
                        "extraction_statuses": [a["extraction_status"] for a in attachment_meta],
                    },
                )

            # Run AI classification (OpenAI call)
            classification = classify_ingested_email(
                subject=instance.subject,
                body_text=instance.body_text,
                sender_email=instance.sender_email,
                sender_name=instance.sender_name or "",
                has_attachments=instance.has_attachments,
                attachment_text=attachment_text,
            )

            # Enrich with attachment metadata
            if attachment_meta:
                classification["attachment_count"] = len(attachment_meta)
                classification["attachment_filenames"] = [a["name"] for a in attachment_meta]
                classification["attachment_details"] = attachment_meta

            # Build dependency-aware related entity drafts
            try:
                related_drafts = build_related_entity_drafts(
                    classification=classification,
                    email_log=instance,
                    tenant=instance.tenant,
                )
                if related_drafts:
                    classification["related_entity_drafts"] = related_drafts
                    _record_email_lineage_event(
                        instance,
                        event_type="dependency_drafts_proposed",
                        summary=f"Proposed {len(related_drafts)} related entity draft(s) from email.",
                        target_type="",
                        target_id="",
                        metadata={
                            "draft_count": len(related_drafts),
                            "entity_types": [d["entity_type"] for d in related_drafts],
                            "statuses": [d["status"] for d in related_drafts],
                        },
                    )
            except Exception:
                logger.warning(
                    "Dependency draft proposal failed for email %s; continuing without related drafts",
                    instance.id,
                    exc_info=True,
                )

            inquiry, _ = upsert_inquiry_draft_from_email(instance, classification)
            if inquiry is not None:
                classification = {
                    **classification,
                    "inquiry_id": str(inquiry.id),
                    "inquiry_number": inquiry.inquiry_number,
                }
                _record_email_lineage_event(
                    instance,
                    event_type="inquiry_draft_created_from_email",
                    summary=f"Created inquiry draft {inquiry.inquiry_number} from inbound email.",
                    target_type="inquiry",
                    target_id=str(inquiry.id),
                    metadata={
                        "inquiry_id": str(inquiry.id),
                        "inquiry_number": str(inquiry.inquiry_number or ""),
                        "draft_type": str(classification.get("draft_type") or ""),
                        "category": str(classification.get("category") or ""),
                    },
                )

            _upsert_action_required_feedback(instance, classification)

            # Build summary with file count
            base_summary = str(classification.get("summary") or "AI classified inbound email.")
            att_data = getattr(instance, "attachment_data", None)
            att_count = 0
            if isinstance(att_data, list):
                att_count = len(att_data)
            elif isinstance(att_data, dict) and att_data.get("files"):
                att_count = len(att_data["files"])
            if att_count > 0:
                base_summary = f"Email + {att_count} file(s) processed. {base_summary}"
            _record_email_lineage_event(
                instance,
                event_type="email_classified",
                summary=base_summary,
                target_type="inquiry" if inquiry is not None else "",
                target_id=str(getattr(inquiry, "id", "") or ""),
                metadata={
                    "category": str(classification.get("category") or ""),
                    "draft_type": str(classification.get("draft_type") or ""),
                    "actionable": bool(classification.get("actionable")),
                    "confidence_score": classification.get("confidence_score") or classification.get("confidence"),
                    "inquiry_id": str(getattr(inquiry, "id", "") or ""),
                    "inquiry_number": str(getattr(inquiry, "inquiry_number", "") or ""),
                },
            )

            if classification.get("actionable") and classification.get("draft_type"):
                confidence_score = float(
                    classification.get("confidence_score") or classification.get("confidence") or 0.0
                )
                draft_type = classification["draft_type"]

                # Phase 21: Auto-approve high-confidence PO drafts (≥0.98)
                from apps.integrations.auto_pipeline import AUTO_PROCESS_CONFIDENCE_THRESHOLD

                auto_approved = confidence_score >= AUTO_PROCESS_CONFIDENCE_THRESHOLD and draft_type == "purchase_order"
                initial_status = "reviewed" if auto_approved else "pending_review"

                draft, _ = EmailReviewDraft.objects.update_or_create(
                    email_log=instance,
                    defaults={
                        "tenant": instance.tenant,
                        "draft_type": draft_type,
                        "summary": str(classification.get("summary") or "").strip(),
                        "extracted_payload": classification,
                        "classification_confidence": confidence_score,
                        "status": initial_status,
                    },
                )
                _record_email_lineage_event(
                    instance,
                    event_type="email_review_draft_created",
                    summary=f"Created AI review draft for {draft.get_draft_type_display()}.",
                    target_type="email_review_draft",
                    target_id=str(draft.id),
                    metadata={
                        "draft_id": str(draft.id),
                        "draft_type": str(draft.draft_type or ""),
                        "category": str(classification.get("category") or ""),
                        "confidence_score": confidence_score,
                        "auto_approved": auto_approved,
                    },
                )
                if auto_approved:
                    _record_email_lineage_event(
                        instance,
                        event_type="email_draft_auto_approved",
                        summary=(
                            f"Auto-approved {draft.get_draft_type_display()} draft "
                            f"(confidence {confidence_score:.0%} ≥ {AUTO_PROCESS_CONFIDENCE_THRESHOLD:.0%})."
                        ),
                        target_type="email_review_draft",
                        target_id=str(draft.id),
                        metadata={
                            "draft_id": str(draft.id),
                            "confidence_score": confidence_score,
                            "threshold": AUTO_PROCESS_CONFIDENCE_THRESHOLD,
                        },
                    )
                    logger.info(
                        "Email %s auto-approved for zero-touch pipeline (confidence=%.2f)",
                        instance.id,
                        confidence_score,
                    )
                else:
                    _notify_actionable_email(instance, draft, classification)
                instance.mark_as_draft_created(extracted_data=classification)
            else:
                logger.info(
                    "Email %s classified as %s; leaving operator-visible for follow-up",
                    instance.id,
                    classification.get("category"),
                )
                instance.mark_as_completed(extracted_data=classification)

            return {
                "email_id": email_log_id,
                "result": "classified",
                "category": classification.get("category"),
                "draft_type": classification.get("draft_type"),
            }

    except EmailLog.DoesNotExist:
        logger.error("classify_email_async: EmailLog %s not found", email_log_id)
        return {"email_id": email_log_id, "result": "not_found"}
    except Exception as e:
        logger.exception("AI classification failed for email %s", email_log_id)
        try:
            with tenant_rls(tenant_id):
                from apps.integrations.email_failure_contract import build_email_failure

                instance = EmailLog.objects.get(pk=email_log_id)
                instance.mark_as_failed(
                    failure=build_email_failure(
                        "EMAIL_PROCESSING_FAILED",
                        message="AI email classification failed before it could complete.",
                        stage="ai_classification",
                        detail_type=e.__class__.__name__,
                    )
                )
        except Exception:
            logger.error("Failed to mark email %s as failed", email_log_id, exc_info=True)
        raise self.retry(exc=e, countdown=30)


@shared_task(
    name="integrations.sync_tenant_emails",
    bind=True,
    max_retries=3,
    soft_time_limit=60,  # orchestrator should be fast
    time_limit=90,
)
def sync_tenant_emails(self):
    """Orchestrate email polling across tenants (Phase 8.3 fan-out).

    This task runs every 15 minutes via Celery Beat.

    IMPORTANT: ExternalAuthProvider is RLS-protected. Celery workers must set
    tenant context explicitly or queries will return 0 rows under FORCE RLS.

    Returns:
        dict: dispatch metadata (provider count + group id)
    """
    try:
        tenant_ids = list(Tenant.objects.filter(is_active=True).values_list("id", flat=True))
        tasks = []

        for tenant_id in tenant_ids:
            with tenant_rls(str(tenant_id)):
                provider_ids = list(
                    ExternalAuthProvider.objects.filter(
                        tenant_id=tenant_id,
                        provider_type="microsoft",
                        is_active=True,
                    ).values_list("id", flat=True)
                )

            for pid in provider_ids:
                # Jitter dispatch slightly to avoid stampedes against Graph API.
                tasks.append(sync_email_provider_inbox.s(pid, str(tenant_id)).set(countdown=random.randint(0, 15)))

        if not tasks:
            logger.info("No active Microsoft providers found; skipping email sync dispatch")
            return {
                "success": True,
                "providers_dispatched": 0,
                "group_id": None,
            }

        job = group(tasks)
        async_result = job.apply_async(expires=240)  # if beat lags, drop stale work

        logger.info("Dispatched email sync fan-out: %s providers (group=%s)", len(tasks), async_result.id)

        return {
            "success": True,
            "providers_dispatched": len(tasks),
            "group_id": async_result.id,
        }

    except Exception as e:
        logger.error("Email sync dispatch failed: %s", str(e), exc_info=True)
        raise self.retry(exc=e, countdown=60 * (2**self.request.retries))


@shared_task(
    name="integrations.sync_email_provider_inbox",
    bind=True,
    max_retries=3,
    rate_limit="10/m",  # Max 10 provider syncs per minute to prevent overload
    soft_time_limit=300,  # 5 minutes
    time_limit=360,  # 6 minutes hard limit
)
def sync_email_provider_inbox(self, provider_id: int, tenant_id: str):
    """Poll inbox for a single ExternalAuthProvider (tenant-scoped)."""
    try:
        with tenant_rls(str(tenant_id)):
            service = EmailIngestionService()
            stats = service.poll_provider_by_id(provider_id, tenant_id=str(tenant_id))
            ai_inbox = sync_ai_feedback_queue_for_tenant(str(tenant_id))

        logger.info(
            "Email sync provider complete: provider_id=%s tenant=%s saved=%s fetched=%s errors=%s",
            provider_id,
            stats.get("tenant_id"),
            stats.get("emails_saved"),
            stats.get("emails_fetched"),
            stats.get("errors"),
        )

        return {
            "success": True,
            "provider_id": provider_id,
            "stats": stats,
            "ai_inbox": ai_inbox,
        }

    except Exception as e:
        logger.error("Provider sync failed provider_id=%s: %s", provider_id, str(e), exc_info=True)
        raise self.retry(exc=e, countdown=60 * (2**self.request.retries))


@shared_task(
    name="integrations.sync_single_tenant",
    bind=True,
    max_retries=2,
)
def sync_single_tenant(self, tenant_id: str):
    """Manually trigger email sync for a specific tenant.

    Used by the frontend "Sync Now" button or for debugging.

    Note: This intentionally runs a single-tenant sync synchronously inside the task.
    The high-volume optimization is handled by sync_tenant_emails fan-out.
    """
    try:
        logger.info("Manual sync triggered for tenant %s", tenant_id)
        task_request_id = str(getattr(getattr(self, "request", None), "id", "") or "").strip()
        if task_request_id:
            self.update_state(
                state="PROGRESS",
                meta={
                    "tenant_id": tenant_id,
                    "progress": _build_sync_progress(
                        phase="syncing_outlook",
                        percent=30,
                        summary="Syncing Outlook inbox…",
                    ),
                },
            )

        with tenant_rls(str(tenant_id)):
            service = EmailIngestionService()
            stats = service.poll_tenant_by_id(tenant_id)
            if task_request_id:
                self.update_state(
                    state="PROGRESS",
                    meta={
                        "tenant_id": tenant_id,
                        "progress": _build_sync_progress(
                            phase="refreshing_ai_inbox",
                            percent=80,
                            summary="Refreshing AI Inbox summaries…",
                        ),
                    },
                )
            ai_inbox = sync_ai_feedback_queue_for_tenant(str(tenant_id))

        failure = failure_from_stats(stats, stage="sync_auto")
        if failure:
            return {
                "success": False,
                "tenant_id": tenant_id,
                "stats": stats,
                "ai_inbox": ai_inbox,
                "summary": failure.get("message") or "Email sync failed before it could complete.",
                "failure": failure,
                "action": build_sync_action(failure, tenant_id=tenant_id),
                "progress": _build_sync_progress(
                    phase="failed",
                    percent=100,
                    summary=failure.get("message") or "Email sync failed before it could complete.",
                ),
            }

        summary = _summarize_sync_result(stats=stats, ai_inbox=ai_inbox)

        logger.info(
            "Manual sync completed for tenant %s: saved=%s fetched=%s errors=%s",
            tenant_id,
            stats.get("emails_saved"),
            stats.get("emails_fetched"),
            stats.get("errors"),
        )

        return {
            "success": True,
            "tenant_id": tenant_id,
            "stats": stats,
            "ai_inbox": ai_inbox,
            "summary": summary,
            "progress": _build_sync_progress(
                phase="completed",
                percent=100,
                summary=summary,
            ),
        }

    except Exception as e:
        logger.error("Manual sync failed for tenant %s: %s", tenant_id, str(e), exc_info=True)
        raise self.retry(exc=e, countdown=30)
