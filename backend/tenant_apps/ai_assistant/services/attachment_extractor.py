"""Attachment text extraction for AI email ingestion.

Extracts readable text from email attachments to enrich AI classification.
Supports PDF, Excel, CSV, Word, images, and plain text using only stdlib +
already-installed packages (openpyxl, xlrd, Pillow, openai).

Zero new dependencies.
"""

from __future__ import annotations

import base64
import csv
import io
import logging
import os
import re
import zipfile
from typing import Any
from xml.etree import ElementTree

from django.conf import settings

logger = logging.getLogger(__name__)

# Limits to prevent runaway processing
MAX_TEXT_CHARS_PER_ATTACHMENT = 12_000
MAX_TOTAL_ATTACHMENT_TEXT = 30_000
MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024  # 20 MB
MAX_ATTACHMENTS_TO_PROCESS = 10

# Extension → handler mapping
SUPPORTED_EXTENSIONS = frozenset({
    'pdf', 'txt', 'csv', 'xls', 'xlsx',
    'doc', 'docx', 'jpg', 'jpeg', 'png',
    'gif', 'bmp', 'tiff', 'tif', 'webp',
})

IMAGE_EXTENSIONS = frozenset({
    'jpg', 'jpeg', 'png', 'gif', 'bmp',
    'tiff', 'tif', 'webp',
})


def get_extension(filename: str | None) -> str:
    """Return lowercase file extension without dot."""
    if not filename:
        return ''
    return os.path.splitext(str(filename))[1].lower().lstrip('.')


def is_supported_attachment(filename: str | None, content_type: str | None = None) -> bool:
    """Check if an attachment type is supported for text extraction."""
    ext = get_extension(filename)
    if ext in SUPPORTED_EXTENSIONS:
        return True
    ct = str(content_type or '').lower()
    return any(k in ct for k in ('pdf', 'spreadsheet', 'excel', 'csv', 'word', 'text/', 'image/'))


def extract_text_from_attachment(
    content: bytes,
    *,
    filename: str = '',
    content_type: str = '',
) -> str:
    """Extract readable text from a single attachment.

    Returns extracted text or empty string on failure.
    Never raises — all errors are caught and logged.
    """
    if not content:
        return ''

    if len(content) > MAX_ATTACHMENT_BYTES:
        logger.warning('Attachment too large for extraction: %s (%d bytes)', filename, len(content))
        return f'[Attachment "{filename}" skipped: file too large ({len(content)} bytes)]'

    ext = get_extension(filename)
    ct = str(content_type or '').lower()

    try:
        if ext == 'txt' or 'text/plain' in ct:
            return _extract_text_plain(content)
        elif ext == 'csv' or 'text/csv' in ct:
            return _extract_csv(content)
        elif ext == 'xlsx' or 'spreadsheetml' in ct:
            return _extract_xlsx(content)
        elif ext == 'xls' or 'vnd.ms-excel' in ct:
            return _extract_xls(content)
        elif ext == 'docx' or 'wordprocessingml' in ct:
            return _extract_docx(content)
        elif ext == 'doc' and 'wordprocessingml' not in ct:
            return f'[Attachment "{filename}": legacy .doc format — text extraction limited]'
        elif ext == 'pdf' or 'application/pdf' in ct:
            return _extract_pdf(content, filename=filename)
        elif ext in IMAGE_EXTENSIONS or ct.startswith('image/'):
            return _extract_image_via_vision(content, filename=filename, content_type=content_type)
        else:
            return f'[Attachment "{filename}": unsupported type ({ext or ct})]'
    except Exception:
        logger.exception('Failed to extract text from attachment: %s', filename)
        return f'[Attachment "{filename}": extraction failed]'


def extract_text_from_attachments(
    attachments: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Extract text from a list of attachments (from Graph API download).

    Each attachment dict should have: name, content_type, content_bytes (bytes | None), size.

    Returns enriched list with 'extracted_text' added to each dict.
    """
    results: list[dict[str, Any]] = []
    total_text_len = 0

    for i, att in enumerate(attachments[:MAX_ATTACHMENTS_TO_PROCESS]):
        name = str(att.get('name') or f'attachment_{i}')
        content_bytes = att.get('content_bytes')
        content_type = str(att.get('content_type') or '')

        if not content_bytes or not is_supported_attachment(name, content_type):
            results.append({
                **att,
                'extracted_text': '',
                'extraction_status': 'skipped',
            })
            continue

        if total_text_len >= MAX_TOTAL_ATTACHMENT_TEXT:
            results.append({
                **att,
                'extracted_text': '',
                'extraction_status': 'budget_exceeded',
            })
            continue

        text = extract_text_from_attachment(
            content_bytes,
            filename=name,
            content_type=content_type,
        )

        # Trim per-attachment
        if len(text) > MAX_TEXT_CHARS_PER_ATTACHMENT:
            text = text[:MAX_TEXT_CHARS_PER_ATTACHMENT] + '\n[...truncated]'

        total_text_len += len(text)

        results.append({
            **att,
            'extracted_text': text,
            'extraction_status': 'success' if text else 'empty',
        })

    return results


def build_combined_attachment_text(extracted_attachments: list[dict[str, Any]]) -> str:
    """Combine all extracted attachment texts into a single string for AI context."""
    sections: list[str] = []
    for att in extracted_attachments:
        text = att.get('extracted_text', '')
        if not text:
            continue
        name = att.get('name', 'unknown')
        sections.append(f'--- Attachment: {name} ---\n{text}')

    combined = '\n\n'.join(sections)
    if len(combined) > MAX_TOTAL_ATTACHMENT_TEXT:
        combined = combined[:MAX_TOTAL_ATTACHMENT_TEXT] + '\n[...attachment text truncated]'
    return combined


# ─── Per-Type Extractors ──────────────────────────────────────────────


def _extract_text_plain(content: bytes) -> str:
    """Extract text from plain text file."""
    for encoding in ('utf-8-sig', 'utf-8', 'latin-1'):
        try:
            return content.decode(encoding).strip()
        except (UnicodeDecodeError, ValueError):
            continue
    return content.decode('ascii', errors='replace').strip()


def _extract_csv(content: bytes) -> str:
    """Extract text from CSV using document_parser if available, fallback to stdlib."""
    try:
        from tenant_apps.ai_assistant.services.document_parser import parse_tabular_document
        result = parse_tabular_document(io.BytesIO(content), filename='data.csv')
        return result.text
    except Exception:
        pass

    # Fallback: basic CSV → markdown
    try:
        decoded = content.decode('utf-8-sig')
    except UnicodeDecodeError:
        decoded = content.decode('latin-1')

    reader = csv.reader(io.StringIO(decoded))
    rows = list(reader)
    if not rows:
        return ''

    header = rows[0]
    data = rows[1:100]  # Limit rows
    lines = [' | '.join(header), ' | '.join(['---'] * len(header))]
    for row in data:
        padded = row + [''] * (len(header) - len(row))
        lines.append(' | '.join(padded[:len(header)]))
    return '\n'.join(lines)


def _extract_xlsx(content: bytes) -> str:
    """Extract text from XLSX using document_parser."""
    try:
        from tenant_apps.ai_assistant.services.document_parser import parse_tabular_document
        result = parse_tabular_document(io.BytesIO(content), filename='data.xlsx')
        return result.text
    except ImportError:
        logger.warning('openpyxl not available for xlsx extraction')
        return '[XLSX attachment: openpyxl not available]'
    except Exception:
        logger.exception('XLSX extraction failed')
        return '[XLSX attachment: extraction failed]'


def _extract_xls(content: bytes) -> str:
    """Extract text from legacy XLS using document_parser."""
    try:
        from tenant_apps.ai_assistant.services.document_parser import parse_tabular_document
        result = parse_tabular_document(io.BytesIO(content), filename='data.xls')
        return result.text
    except ImportError:
        logger.warning('xlrd not available for xls extraction')
        return '[XLS attachment: xlrd not available]'
    except Exception:
        logger.exception('XLS extraction failed')
        return '[XLS attachment: extraction failed]'


def _extract_docx(content: bytes) -> str:
    """Extract text from DOCX using stdlib zipfile + xml parsing (no python-docx needed)."""
    try:
        with zipfile.ZipFile(io.BytesIO(content)) as zf:
            if 'word/document.xml' not in zf.namelist():
                return '[DOCX attachment: invalid format]'

            xml_content = zf.read('word/document.xml')
            tree = ElementTree.fromstring(xml_content)

            ns = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
            paragraphs = []
            for para in tree.iter(f'{ns}p'):
                texts = [node.text for node in para.iter(f'{ns}t') if node.text]
                if texts:
                    paragraphs.append(''.join(texts))

            return '\n'.join(paragraphs)
    except (zipfile.BadZipFile, KeyError):
        return '[DOCX attachment: could not parse]'
    except Exception:
        logger.exception('DOCX extraction failed')
        return '[DOCX attachment: extraction failed]'


def _extract_pdf(content: bytes, *, filename: str = '') -> str:
    """Extract text from PDF.

    Strategy:
    1. Try basic PDF text stream extraction (stdlib-only, no dependencies)
    2. If no text found (scanned PDF), fall back to OpenAI vision API
    """
    text = _extract_pdf_text_streams(content)
    if text and len(text.strip()) > 50:
        return text.strip()

    # Scanned PDF or no extractable text — try vision
    return _extract_image_via_vision(
        content,
        filename=filename,
        content_type='application/pdf',
    )


def _extract_pdf_text_streams(content: bytes) -> str:
    """Basic PDF text extraction from text streams (handles simple PDFs).

    This is a lightweight approach that works for text-based PDFs without
    any external dependencies. It extracts text from BT/ET blocks.
    """
    try:
        decoded = content.decode('latin-1')
    except Exception:
        return ''

    # Find all text between BT (Begin Text) and ET (End Text) markers
    text_blocks: list[str] = []
    bt_pattern = re.compile(r'BT\s(.*?)\sET', re.DOTALL)

    for match in bt_pattern.finditer(decoded):
        block = match.group(1)
        # Extract text from Tj and TJ operators
        tj_pattern = re.compile(r'\((.*?)\)\s*Tj', re.DOTALL)
        for tj_match in tj_pattern.finditer(block):
            raw = tj_match.group(1)
            # Unescape PDF string escapes
            raw = raw.replace('\\(', '(').replace('\\)', ')').replace('\\\\', '\\')
            if raw.strip():
                text_blocks.append(raw.strip())

        # TJ arrays: [(text) kerning (text) ...]
        tj_array_pattern = re.compile(r'\[(.*?)\]\s*TJ', re.DOTALL)
        for tj_arr_match in tj_array_pattern.finditer(block):
            arr_content = tj_arr_match.group(1)
            inner_strings = re.findall(r'\((.*?)\)', arr_content, re.DOTALL)
            line_parts = []
            for s in inner_strings:
                s = s.replace('\\(', '(').replace('\\)', ')').replace('\\\\', '\\')
                line_parts.append(s)
            combined = ''.join(line_parts).strip()
            if combined:
                text_blocks.append(combined)

    return '\n'.join(text_blocks)


def _extract_image_via_vision(
    content: bytes,
    *,
    filename: str = '',
    content_type: str = '',
) -> str:
    """Use OpenAI vision API to extract text from images and scanned PDFs."""
    openai_api_key = getattr(settings, 'OPENAI_API_KEY', None) or os.environ.get('OPENAI_API_KEY')
    if not openai_api_key:
        return f'[Attachment "{filename}": OCR unavailable (no OpenAI key)]'

    try:
        from openai import OpenAI
        from apps.system.services.ai_model_resolver import get_active_openai_model_id

        client = OpenAI(
            api_key=openai_api_key,
            organization=getattr(settings, 'OPENAI_ORG_ID', None) or os.environ.get('OPENAI_ORG_ID') or None,
        )

        b64 = base64.b64encode(content).decode('ascii')

        # Determine MIME type
        ct = content_type or ''
        if not ct or ct == 'application/octet-stream':
            ext = get_extension(filename)
            mime_map = {
                'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png',
                'gif': 'image/gif', 'webp': 'image/webp', 'bmp': 'image/bmp',
                'tiff': 'image/tiff', 'tif': 'image/tiff', 'pdf': 'application/pdf',
            }
            ct = mime_map.get(ext, 'application/octet-stream')

        model = get_active_openai_model_id(fallback='gpt-4o-mini')

        response = client.chat.completions.create(
            model=model,
            temperature=0,
            max_tokens=2000,
            messages=[
                {
                    'role': 'system',
                    'content': (
                        'You extract ALL text and data from document images for a meat trading business. '
                        'Return the extracted text as-is, preserving structure. '
                        'For tables, use markdown table format. '
                        'For forms, list field labels and values. '
                        'If no readable text, respond with "[No readable text found]".'
                    ),
                },
                {
                    'role': 'user',
                    'content': [
                        {
                            'type': 'text',
                            'text': f'Extract all text and data from this document ({filename}).',
                        },
                        {
                            'type': 'image_url',
                            'image_url': {
                                'url': f'data:{ct};base64,{b64}',
                                'detail': 'high',
                            },
                        },
                    ],
                },
            ],
        )

        result = response.choices[0].message.content if response.choices else ''
        return str(result or '').strip()

    except Exception:
        logger.exception('Vision API extraction failed for %s', filename)
        return f'[Attachment "{filename}": vision extraction failed]'
