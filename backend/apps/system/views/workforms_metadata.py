from __future__ import annotations

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.system.services.node_registry import get_registry


class WorkFormsMetadataView(APIView):
    """Serve WorkForms editor/runtime metadata.

    This is tenant-agnostic (no tenant data), but requires authentication.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        version = str(request.query_params.get("version") or "v1")
        payload = get_registry(version=version)
        return Response(payload)
