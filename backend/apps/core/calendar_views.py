"""Calendar event APIs.

Phase 5 Microsoft/Outlook integration is currently blocked on credentials.
However, the Cockpit/Workspace Calendar widget expects a stable endpoint at
`/api/v1/calendar/events/`.

This module provides a safe, tenant-aware placeholder that returns an empty
result set rather than a 404.
"""

from __future__ import annotations

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView


class CalendarEventsView(APIView):
    """Return calendar events for the current tenant.

    For now this is a compatibility/stability endpoint: it prevents noisy 404s
    in the UI while third-party calendar integrations are still blocked.

    Query params (accepted for forward compatibility):
    - start_date (ISO8601)
    - end_date (ISO8601)
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(
            {
                "configured": False,
                "results": [],
                "count": 0,
            }
        )
