"""CSV export utilities.

Provides a DRF ViewSet mixin that can stream CSV exports from list endpoints
when the client requests `?format=csv`.

This is designed for large datasets:
- Uses StreamingHttpResponse (no materializing full dataset in RAM)
- Reuses `get_queryset()` + `filter_queryset()` so tenant filtering and
  user filters are honored

"""

from __future__ import annotations

import csv
import io
from datetime import date, datetime
from typing import Any, Callable, Iterator, Sequence, Tuple, Union

from django.http import StreamingHttpResponse
from django.utils import timezone

from apps.core.conversions import normalize_temporal_for_export

CsvAccessor = Union[str, Callable[[Any], Any]]
CsvColumn = Tuple[str, CsvAccessor]


def _normalize_cell(raw: Any, *, timezone_name: str | None = None) -> str:
    if raw is None:
        return ""

    if isinstance(raw, (datetime, date)):
        return normalize_temporal_for_export(raw, timezone_name=timezone_name)

    if isinstance(raw, (int, float, bool)):
        return str(raw)

    if isinstance(raw, str):
        s = raw
    else:
        try:
            s = str(raw)
        except Exception:
            s = ""

    # Prevent Excel/Sheets formula injection.
    # (Matches frontend behavior in frontend/src/utils/csv.ts)
    if s and s.lstrip(" \t\r\n").startswith(("=", "+", "-", "@")):
        return f"'{s}"

    return s


def _resolve_accessor(obj: Any, accessor: CsvAccessor) -> Any:
    if callable(accessor):
        return accessor(obj)

    # Attribute path, e.g. "supplier.name".
    current: Any = obj
    for part in accessor.split("."):
        if current is None:
            return None
        current = getattr(current, part, None)
    return current


class CsvExportMixin:
    """Mixin that adds `?format=csv` support to list endpoints."""

    csv_query_param: str = "format"
    csv_query_value: str = "csv"

    def is_csv_export_request(self) -> bool:
        value = (self.request.query_params.get(self.csv_query_param) or "").strip().lower()
        return value == self.csv_query_value

    def get_csv_export_columns(self) -> Sequence[CsvColumn]:
        """Return columns to export.

        Override per-ViewSet.
        """

        raise NotImplementedError("get_csv_export_columns() must be implemented")

    def get_csv_export_queryset(self, queryset):
        """Allow viewsets to optimize queryset for export (select_related/prefetch)."""

        return queryset

    def get_csv_export_filename(self) -> str:
        base = getattr(self, "basename", None) or self.__class__.__name__.replace("ViewSet", "").lower()
        return f"{base}_{timezone.now().date().isoformat()}.csv"

    def get_trade_render_timezone_name(self) -> str | None:
        """Override when a CSV export has an explicit facility timezone source."""

        return None

    def _iter_csv(self, queryset) -> Iterator[str]:
        columns = list(self.get_csv_export_columns())
        headers = [h for h, _ in columns]
        render_timezone_name = self.get_trade_render_timezone_name()

        buffer = io.StringIO()
        writer = csv.writer(buffer)

        writer.writerow(headers)
        yield buffer.getvalue()
        buffer.seek(0)
        buffer.truncate(0)

        for obj in queryset.iterator(chunk_size=2000):
            row = [
                _normalize_cell(_resolve_accessor(obj, accessor), timezone_name=render_timezone_name)
                for _, accessor in columns
            ]
            writer.writerow(row)
            yield buffer.getvalue()
            buffer.seek(0)
            buffer.truncate(0)

    def list(self, request, *args, **kwargs):  # noqa: A003 - DRF signature
        if not self.is_csv_export_request():
            return super().list(request, *args, **kwargs)

        queryset = self.filter_queryset(self.get_queryset())
        queryset = self.get_csv_export_queryset(queryset)

        response = StreamingHttpResponse(
            streaming_content=self._iter_csv(queryset),
            content_type="text/csv; charset=utf-8",
        )
        response["Content-Disposition"] = f'attachment; filename="{self.get_csv_export_filename()}"'
        return response
