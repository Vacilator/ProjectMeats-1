"""Simulate an AI document multipart upload for a specific tenant.

This is a diagnostic tool intended to capture the exact traceback in the same
codepath as the API endpoint.

Default tenant: 0f024884-b9ef-4e50-8fc0-89b2eb7c8c69

Usage:
  python manage.py test_document_upload \
    --tenant-id 0f024884-b9ef-4e50-8fc0-89b2eb7c8c69 \
    --username admin

Notes:
- Uses a temp MEDIA_ROOT by default to avoid persistent artifacts.
- Never prints file contents.
"""

from __future__ import annotations

import json
import os
import traceback
from pathlib import Path
from tempfile import TemporaryDirectory

from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management.base import BaseCommand
from django.test.utils import override_settings


class Command(BaseCommand):
    help = "Simulate a multipart upload against AIDocumentViewSet to capture tracebacks"

    def add_arguments(self, parser):
        parser.add_argument(
            "--tenant-id",
            type=str,
            default="0f024884-b9ef-4e50-8fc0-89b2eb7c8c69",
            help="Tenant UUID to upload under",
        )
        parser.add_argument(
            "--create-tenant-if-missing",
            action="store_true",
            help="If set, create a placeholder Tenant row when the tenant-id is missing.",
        )
        parser.add_argument(
            "--username",
            type=str,
            default="",
            help="Username/email to authenticate as (defaults to first superuser)",
        )
        parser.add_argument(
            "--filename",
            type=str,
            default="diagnostic-upload.pdf",
            help="Uploaded file name to simulate",
        )
        parser.add_argument(
            "--content-type",
            type=str,
            default="application/pdf",
            help="MIME type for uploaded file",
        )
        parser.add_argument(
            "--session-id",
            type=str,
            default="",
            help="Optional ChatSession UUID to associate with the upload",
        )
        parser.add_argument(
            "--use-real-media-root",
            action="store_true",
            help="If set, writes to configured MEDIA_ROOT (not recommended).",
        )

    def handle(self, *args, **options):
        from django.contrib.auth import get_user_model
        from rest_framework.test import APIRequestFactory, force_authenticate

        from tenant_apps.ai_assistant.views import AIDocumentViewSet

        from apps.tenants.models import Tenant
        from apps.tenants.rls import set_current_tenant

        tenant_id = str(options["tenant_id"]).strip()
        username = str(options.get("username") or "").strip()

        tenant = Tenant.objects.filter(id=tenant_id).first()
        if not tenant:
            if options.get("create_tenant_if_missing"):
                try:
                    # Minimal placeholder tenant for diagnostics only.
                    tenant = Tenant.objects.create(
                        id=tenant_id,
                        name=f"Diagnostic Tenant {tenant_id[:8]}",
                        slug=f"diagnostic-{tenant_id[:8]}",
                        contact_email=f"diagnostic+{tenant_id[:8]}@example.com",
                        is_active=True,
                    )
                except Exception as e:
                    self.stdout.write(
                        json.dumps(
                            {
                                "ok": False,
                                "error_type": "TENANT_CREATE_FAILED",
                                "tenant_id": tenant_id,
                                "message": f"{type(e).__name__}: {e}",
                            }
                        )
                    )
                    return
            else:
                self.stdout.write(
                    json.dumps(
                        {
                            "ok": False,
                            "error_type": "TENANT_NOT_FOUND",
                            "tenant_id": tenant_id,
                            "message": "Tenant not found (rerun with --create-tenant-if-missing to create a placeholder).",
                        }
                    )
                )
                return

        User = get_user_model()
        user = None
        if username:
            user = User.objects.filter(username=username).first() or User.objects.filter(email=username).first()
        if not user:
            user = User.objects.filter(is_superuser=True).order_by("id").first()
        if not user:
            self.stdout.write(
                json.dumps(
                    {
                        "ok": False,
                        "error_type": "USER_NOT_FOUND",
                        "tenant_id": tenant_id,
                        "message": "No user found (provide --username or create a superuser)",
                    }
                )
            )
            return

        set_current_tenant(tenant_id)

        # Build a fake PDF payload.
        filename = str(options.get("filename") or "diagnostic-upload.pdf")
        content_type = str(options.get("content_type") or "application/pdf")
        uploaded = SimpleUploadedFile(filename, b"%PDF-1.4\n% Diagnostic\n", content_type=content_type)

        data = {"file": uploaded}
        session_id = str(options.get("session_id") or "").strip()
        if session_id:
            data["session"] = session_id

        factory = APIRequestFactory()
        req = factory.post("/api/v1/ai-assistant/ai-documents/", data=data, format="multipart")
        # Ensure tenant context exists even without middleware.
        req.tenant = tenant
        # For parity with middleware resolution.
        req.META["HTTP_X_TENANT_ID"] = tenant_id

        force_authenticate(req, user=user)

        view = AIDocumentViewSet.as_view({"post": "create"})

        def _run_once():
            resp = view(req)
            return resp

        use_real = bool(options.get("use_real_media_root"))

        if use_real:
            try:
                resp = _run_once()
                self.stdout.write(
                    json.dumps(
                        {"ok": True, "status_code": resp.status_code, "data": getattr(resp, "data", None)}, default=str
                    )
                )
            except Exception as e:
                tb = traceback.format_exc()
                self.stdout.write(
                    json.dumps(
                        {
                            "ok": False,
                            "tenant_id": tenant_id,
                            "error_type": type(e).__name__,
                            "message": str(e),
                            "traceback": tb,
                        },
                        default=str,
                    )
                )
            return

        # Default safe mode: temp MEDIA_ROOT.
        with TemporaryDirectory(prefix="pm_ai_doc_upload_") as tmp:
            media_root = str(Path(tmp).resolve())
            os.makedirs(media_root, exist_ok=True)
            with override_settings(MEDIA_ROOT=media_root):
                try:
                    resp = _run_once()
                    payload = {
                        "ok": True,
                        "tenant_id": tenant_id,
                        "media_root": media_root,
                        "status_code": resp.status_code,
                        "data": getattr(resp, "data", None),
                    }
                    self.stdout.write(json.dumps(payload, default=str))
                except Exception as e:
                    tb = traceback.format_exc()
                    payload = {
                        "ok": False,
                        "tenant_id": tenant_id,
                        "media_root": media_root,
                        "error_type": type(e).__name__,
                        "message": str(e),
                        "traceback": tb,
                    }
                    self.stdout.write(json.dumps(payload, default=str))
