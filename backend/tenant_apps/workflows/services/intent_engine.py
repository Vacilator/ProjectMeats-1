"""
AI Intent Recognition Engine

Processes unstructured email content to determine user intent and extract
structured data for workflow automation.

Features:
- Distinguishes between Order Requests (create) vs Status Inquiries (read)
- Extracts structured variables from natural language
- Integrates with OpenAI ChatCompletions API
- Triggers appropriate workflows based on recognized intent

Usage:
    from tenant_apps.workflows.services.intent_engine import IntentEngine
    
    engine = IntentEngine()
    result = engine.recognize_intent(email_body)
    
    if result['intent'] == 'order_request':
        trigger_order_workflow(result['variables'])
    elif result['intent'] == 'status_inquiry':
        search_and_respond(result['query'])

Created: 2026-03-04 - Phase 10.3: AI Intent Recognition
"""
import os
import json
import logging
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)


def analyze_document_intent(
    email_body: str,
    attachment_text: str = '',
    subject: str | None = None,
    sender_email: str | None = None,
) -> Dict[str, Any]:
    """Analyze an email + attachment text and return a structured intent payload.

    Phase 6.5 scaffolding: meat-industry specific document classification.

    Document types to classify:
    - Purchase Order
    - Invoice
    - Claim
    - Bill of Lading
    - Spec Sheet

    Output JSON shape (example):
    {
      "document_type": "PURCHASE_ORDER",
      "confidence": 0.92,
      "metadata": {
        "sender": "buyer@customer.com",
        "urgency": "medium",
        "order_numbers": ["PO-12345"],
        "invoice_numbers": [],
        "bill_of_lading_numbers": [],
        "keywords": ["ribeye", "delivery"],
        "received_channel": "email"
      },
      "routing": {
        "suggested_trigger": "EMAIL_RECEIVED",
        "requires_human_review": false
      },
      "reasoning": "..."
    }

    If OpenAI is not configured, returns a conservative heuristic result.
    """

    def heuristic() -> Dict[str, Any]:
        text = f"{subject or ''}\n{email_body or ''}\n{attachment_text or ''}".lower()
        if any(k in text for k in ['bill of lading', 'bol', 'b/l']):
            doc = 'BILL_OF_LADING'
        elif any(k in text for k in ['invoice', 'inv#', 'inv #']):
            doc = 'INVOICE'
        elif any(k in text for k in ['claim', 'shortage', 'damage', 'complaint']):
            doc = 'CLAIM'
        elif any(k in text for k in ['spec sheet', 'specification', 'specs']):
            doc = 'SPEC_SHEET'
        elif any(k in text for k in ['purchase order', 'po#', 'po #', 'p.o.']):
            doc = 'PURCHASE_ORDER'
        else:
            doc = 'UNKNOWN'

        # Very light extraction for routing/triggering scaffolding.
        keywords = [k for k in ['beef', 'pork', 'chicken', 'ribeye', 'tenderloin', 'delivery', 'urgent'] if k in text]
        urgency = 'high' if 'urgent' in text or 'asap' in text else 'medium' if 'today' in text else 'low'

        return {
            'document_type': doc,
            'confidence': 0.25,
            'metadata': {
                'sender': sender_email,
                'urgency': urgency,
                'order_numbers': [],
                'invoice_numbers': [],
                'bill_of_lading_numbers': [],
                'keywords': keywords,
                'received_channel': 'email',
            },
            'routing': {
                'suggested_trigger': 'EMAIL_RECEIVED',
                'requires_human_review': True,
            },
            'reasoning': 'Heuristic fallback (OpenAI not configured).',
        }

    api_key = os.environ.get('OPENAI_API_KEY')
    if not api_key:
        return heuristic()

    system_prompt = """You are an AI document understanding assistant for a meat industry company.

Your job:
1) Classify the incoming email + any extracted attachment text into ONE document_type:
   - PURCHASE_ORDER
   - INVOICE
   - CLAIM
   - BILL_OF_LADING
   - SPEC_SHEET
   - UNKNOWN

2) Extract metadata useful for automation:
   - sender (email)
   - urgency: low | medium | high
   - order_numbers (PO numbers, order refs)
   - invoice_numbers
   - bill_of_lading_numbers
   - keywords relevant to meat ops (cuts, quantities, delivery, temperature, QA)

Rules:
- If uncertain, choose UNKNOWN and set requires_human_review=true.
- Do NOT hallucinate identifiers: only include numbers explicitly present.
- Output MUST be valid JSON.

Return JSON with keys: document_type, confidence (0-1), metadata, routing, reasoning.
"""

    user_parts = []
    if sender_email:
        user_parts.append(f"From: {sender_email}")
    if subject:
        user_parts.append(f"Subject: {subject}")
    user_parts.append("Email Body:\n" + (email_body or ''))
    if attachment_text:
        user_parts.append("Attachment Text (extracted):\n" + attachment_text)

    user_message = "\n\n".join(user_parts)

    try:
        import openai

        openai.api_key = api_key
        response = openai.chat.completions.create(
            model='gpt-4',
            messages=[
                {'role': 'system', 'content': system_prompt},
                {'role': 'user', 'content': user_message},
            ],
            temperature=0.2,
            response_format={'type': 'json_object'},
        )
        result_text = response.choices[0].message.content
        return json.loads(result_text)
    except Exception as e:
        logger.warning('analyze_document_intent failed; falling back to heuristic: %s', str(e), exc_info=True)
        return heuristic()


class Intent(str, Enum):
    """Possible intents for email classification."""
    ORDER_REQUEST = 'order_request'
    STATUS_INQUIRY = 'status_inquiry'
    INFORMATION_REQUEST = 'information_request'
    COMPLAINT = 'complaint'
    UNKNOWN = 'unknown'


@dataclass
class IntentResult:
    """Result of intent recognition."""
    intent: Intent
    confidence: float  # 0.0-1.0
    variables: Dict[str, Any]  # Extracted structured data
    query: Optional[str] = None  # For status inquiries
    reasoning: Optional[str] = None  # Explanation of classification


class IntentEngine:
    """AI-powered intent recognition + document understanding for email processing.

    Phase 6.5 adds *document* classification (PO / invoice / claim / BOL / inquiry)
    in addition to the earlier intent classification.

    Design goals:
    - Tenant-aware credentials: prefer per-tenant AIConfiguration; fall back to env.
    - Soft dependency on openai: methods degrade gracefully if package/key missing.
    - Bounded prompts: cap attachment text to avoid token blowups.
    """

    DEFAULT_DOCUMENT_MODEL = os.environ.get('OPENAI_DOCUMENT_MODEL', 'gpt-4o-mini')

    def __init__(
        self,
        tenant=None,
        api_key: str | None = None,
        model_name: str | None = None,
    ):
        self.tenant = tenant
        self.api_key = api_key or os.environ.get('OPENAI_API_KEY')
        self.model_name = model_name or self.DEFAULT_DOCUMENT_MODEL

        # Prefer per-tenant AIConfiguration if available.
        if self.tenant and not api_key:
            try:
                from tenant_apps.ai_assistant.models import AIConfiguration

                cfg = (
                    AIConfiguration.objects.filter(tenant=self.tenant, is_active=True, is_default=True)
                    .only('api_key', 'model_name')
                    .first()
                )
                if cfg and getattr(cfg, 'api_key', None):
                    self.api_key = cfg.api_key
                    self.model_name = getattr(cfg, 'model_name', None) or self.model_name
            except Exception:
                logger.debug('AIConfiguration lookup failed; falling back to env', exc_info=True)

        if not self.api_key:
            logger.warning('OpenAI not configured (no api key) - intent engine will use fallbacks')

        # System prompt for intent recognition (legacy path)
        self.system_prompt = """You are an AI assistant for a meat processing company.
Your job is to analyze incoming emails and determine the sender's intent.

INTENTS TO CLASSIFY:
1. ORDER_REQUEST: Customer wants to place a new order
2. STATUS_INQUIRY: Customer asking about existing order status
3. INFORMATION_REQUEST: Customer asking for product info, pricing, availability
4. COMPLAINT: Customer reporting an issue or problem
5. UNKNOWN: Cannot determine intent

For ORDER_REQUEST emails, extract these variables:
- customer_name: Name of the customer
- product_type: Type of meat (beef, pork, chicken, etc.)
- quantity: Amount requested (with units)
- cut_type: Specific cut requested (ribeye, tenderloin, etc.)
- delivery_date: Requested delivery date (if mentioned)
- special_instructions: Any special handling requirements

For STATUS_INQUIRY emails, extract:
- order_number: Reference number mentioned (PO-XXX, Order #XXX, etc.)
- query: What specifically they're asking about

Respond in JSON format:
{
  "intent": "ORDER_REQUEST",
  "confidence": 0.95,
  "variables": {
    "customer_name": "Acme Corp",
    "product_type": "beef",
    "quantity": "100 kg",
    "cut_type": "ribeye"
  },
  "reasoning": "Email explicitly requests 100kg of ribeye beef"
}"""

        self.document_system_prompt = (
            "You are an AI data extraction specialist for a wholesale meat logistics platform.\n\n"
            "HYBRID PIPELINE CONTEXT (Phase 7.0):\n"
            "- Upstream, an open-source document model (e.g., LayoutLMv3 / Docling) performs OCR + layout parsing\n"
            "  and yields structured text blocks with bounding boxes.\n"
            "- This step is NOT implemented here yet; this service receives the resulting structured text summary\n"
            "  and produces normalized JSON for automation.\n\n"
            "Task:\n"
            "1) Classify the document_type: Purchase Order | Invoice | Claim | Bill of Lading | Inquiry\n"
            "2) Extract key metadata into JSON for automation.\n\n"
            "Output requirements:\n"
            "- MUST return valid JSON.\n"
            "- MUST include these root keys:\n"
            "  - confidence_score: number 0.0-1.0\n"
            "  - requires_human_review: boolean (true if confidence_score < 0.85)\n"
            "  - questions_for_user: array of strings (include when specific fields are ambiguous)\n\n"
            "Extraction requirements (include null/empty if missing):\n"
            "- urgency: low|medium|high\n"
            "- sender_intent: place_order|send_invoice|file_claim|provide_shipping_docs|general_inquiry|unknown\n"
            "- po_number, invoice_number, bol_number\n"
            "- items: [{item, cut, species, quantity, unit, pack, notes}]\n"
            "- ship_to, bill_to, requested_delivery_date\n\n"
            "Rules:\n"
            "- Do not hallucinate identifiers; only extract what exists.\n"
            "- If uncertain, set document_type=Inquiry and confidence_score<0.6 and ask questions_for_user.\n"
            "- If delivery date, address, or key identifiers are missing/ambiguous, set requires_human_review=true\n"
            "  and ask a targeted question in questions_for_user."
        )

    def analyze_document(self, email_body: str, attachments: List[Dict[str, Any]], subject: str | None = None, sender_email: str | None = None) -> Dict[str, Any]:
        """Analyze an email + attachments and return structured JSON for triggers.

        Phase 7.0: Hybrid Agentic Architecture (simulated)
        - Upstream: Layout-aware extraction (LayoutLMv3 / Docling) would produce structured blocks + bboxes.
        - Here: we only handle lightweight text extraction, then rely on OpenAI for schema-normalized JSON.
        """

        def _extract_attachment_text(att: Dict[str, Any]) -> str:
            name = att.get('name')
            ct = (att.get('content_type') or '').lower()
            raw = att.get('content_bytes')
            if not raw:
                return ''

            # Text-like content
            if ct.startswith('text/') or ct in {'application/json', 'application/xml'}:
                try:
                    return raw.decode('utf-8', errors='ignore')
                except Exception:
                    return ''

            # PDF (soft dependency)
            if ct == 'application/pdf':
                try:
                    from io import BytesIO
                    from pypdf import PdfReader  # type: ignore

                    reader = PdfReader(BytesIO(raw))
                    parts = []
                    for page in reader.pages[:10]:
                        parts.append(page.extract_text() or '')
                    return '\n'.join(parts)
                except Exception:
                    return ''

            # DOCX (soft dependency)
            if ct in {
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'application/msword',
            }:
                try:
                    from io import BytesIO
                    import docx  # type: ignore

                    doc = docx.Document(BytesIO(raw))
                    return '\n'.join([p.text for p in doc.paragraphs])
                except Exception:
                    return ''

            return ''

        def _normalize_result(payload: Dict[str, Any]) -> Dict[str, Any]:
            if not isinstance(payload, dict):
                payload = {'raw': payload}

            # Backward compatibility: allow `confidence` but standardize to `confidence_score`
            score = payload.get('confidence_score', payload.get('confidence', 0.0))
            try:
                score_f = float(score)
            except Exception:
                score_f = 0.0

            score_f = max(0.0, min(1.0, score_f))
            payload['confidence_score'] = score_f

            if 'requires_human_review' not in payload:
                payload['requires_human_review'] = score_f < 0.85
            else:
                payload['requires_human_review'] = bool(payload.get('requires_human_review'))

            q = payload.get('questions_for_user')
            payload['questions_for_user'] = q if isinstance(q, list) else []

            return payload

        # Fallback if OpenAI not configured
        if not self.api_key:
            return _normalize_result(
                {
                    'document_type': 'Inquiry',
                    'confidence_score': 0.0,
                    'requires_human_review': True,
                    'questions_for_user': ['AI is not configured for document understanding in this environment.'],
                    'error': 'OpenAI not configured',
                }
            )

        # Build bounded prompt
        attachment_texts: List[str] = []
        for att in attachments or []:
            t = _extract_attachment_text(att)
            if t:
                attachment_texts.append(f"--- Attachment: {att.get('name')} ---\n{t}")

        combined_attachments = '\n\n'.join(attachment_texts)
        if len(combined_attachments) > 30_000:
            combined_attachments = combined_attachments[:30_000] + '\n\n[TRUNCATED]'

        parts = []
        if sender_email:
            parts.append(f"From: {sender_email}")
        if subject:
            parts.append(f"Subject: {subject}")
        parts.append("Email Body:\n" + (email_body or ''))
        if combined_attachments:
            parts.append("Attachments (extracted text):\n" + combined_attachments)

        user_message = '\n\n'.join(parts)

        try:
            import openai

            openai.api_key = self.api_key
            response = openai.chat.completions.create(
                model=self.model_name,
                messages=[
                    {'role': 'system', 'content': self.document_system_prompt},
                    {'role': 'user', 'content': user_message},
                ],
                temperature=0.2,
                response_format={'type': 'json_object'},
            )
            text = response.choices[0].message.content
            return _normalize_result(json.loads(text))
        except ImportError:
            logger.error('openai package not installed')
            return _normalize_result(
                {
                    'document_type': 'Inquiry',
                    'confidence_score': 0.0,
                    'requires_human_review': True,
                    'questions_for_user': ['OpenAI package is not installed on this backend image.'],
                    'error': 'openai package not installed',
                }
            )
        except Exception as e:
            logger.warning('OpenAI document analysis failed: %s', str(e), exc_info=True)
            return _normalize_result(
                {
                    'document_type': 'Inquiry',
                    'confidence_score': 0.0,
                    'requires_human_review': True,
                    'questions_for_user': ['Document analysis failed. Please verify extracted fields manually.'],
                    'error': str(e),
                }
            )

    def recognize_intent(self, email_body: str, sender_email: str = None) -> IntentResult:
        """
        Analyze email and recognize intent.
        
        Args:
            email_body: Full text of email body
            sender_email: Optional sender email for context
        
        Returns:
            IntentResult with classified intent and extracted data
        """
        if not self.api_key:
            logger.warning('Intent recognition called but OpenAI not configured')
            return IntentResult(
                intent=Intent.UNKNOWN,
                confidence=0.0,
                variables={},
                reasoning='OpenAI API key not configured'
            )
        
        try:
            import openai
            openai.api_key = self.api_key
            
            # Build user message with context
            user_message = f"Email Body:\n{email_body}"
            if sender_email:
                user_message = f"From: {sender_email}\n\n{user_message}"
            
            # Call OpenAI ChatCompletions
            response = openai.chat.completions.create(
                model='gpt-4',
                messages=[
                    {'role': 'system', 'content': self.system_prompt},
                    {'role': 'user', 'content': user_message}
                ],
                temperature=0.3,  # Lower temperature for more consistent classification
                response_format={'type': 'json_object'}  # Force JSON response
            )
            
            # Parse response
            result_text = response.choices[0].message.content
            result_data = json.loads(result_text)
            
            # Convert to IntentResult
            return IntentResult(
                intent=Intent(result_data['intent'].lower()),
                confidence=result_data.get('confidence', 0.0),
                variables=result_data.get('variables', {}),
                query=result_data.get('query'),
                reasoning=result_data.get('reasoning')
            )
            
        except ImportError:
            logger.error('openai package not installed')
            return IntentResult(
                intent=Intent.UNKNOWN,
                confidence=0.0,
                variables={},
                reasoning='openai package not installed'
            )
        except Exception as e:
            logger.error(f'Intent recognition failed: {e}')
            return IntentResult(
                intent=Intent.UNKNOWN,
                confidence=0.0,
                variables={},
                reasoning=f'Error: {str(e)}'
            )
    
    def should_trigger_workflow(self, result: IntentResult, threshold: float = 0.7) -> bool:
        """
        Determine if confidence is high enough to trigger automated workflow.
        
        Args:
            result: IntentResult from recognize_intent()
            threshold: Minimum confidence required (default: 0.7)
        
        Returns:
            True if workflow should be auto-triggered
        """
        return (
            result.intent in [Intent.ORDER_REQUEST, Intent.INFORMATION_REQUEST] and
            result.confidence >= threshold
        )
    
    def get_workflow_type(self, result: IntentResult) -> Optional[str]:
        """
        Map intent to workflow type slug.
        
        Args:
            result: IntentResult from recognize_intent()
        
        Returns:
            Workflow type slug or None
        """
        workflow_map = {
            Intent.ORDER_REQUEST: 'order_creation',
            Intent.STATUS_INQUIRY: 'status_check',
            Intent.INFORMATION_REQUEST: 'information_request',
            Intent.COMPLAINT: 'complaint_handling',
        }
        return workflow_map.get(result.intent)


class IntentEngineBatchProcessor:
    """
    Batch processor for intent recognition on multiple emails.
    
    Useful for processing email backlogs or scheduled email checks.
    """
    
    def __init__(self, tenant_id: str):
        self.tenant_id = tenant_id
        self.engine = IntentEngine()
    
    def process_email_log(self, batch_size: int = 10) -> Dict[str, int]:
        """
        Process unprocessed emails from EmailLog.
        
        Args:
            batch_size: Number of emails to process per batch
        
        Returns:
            Stats: {'processed': N, 'orders_triggered': M, 'inquiries': K}
        """
        from apps.integrations.microsoft.models import EmailLog
        from apps.tenants.models import Tenant
        
        try:
            tenant = Tenant.objects.get(id=self.tenant_id)
        except Tenant.DoesNotExist:
            logger.error(f'Tenant {self.tenant_id} not found')
            return {'error': 'Tenant not found'}
        
        # Get unprocessed emails
        emails = EmailLog.objects.filter(
            tenant=tenant,
            processed=False
        ).order_by('received_at')[:batch_size]
        
        stats = {
            'processed': 0,
            'orders_triggered': 0,
            'inquiries': 0,
            'errors': 0
        }
        
        for email in emails:
            try:
                # Recognize intent
                result = self.engine.recognize_intent(
                    email_body=email.body_text or email.body_html or '',
                    sender_email=email.sender_email
                )
                
                # Store result in email metadata
                email.custom_data = {
                    'intent': result.intent.value,
                    'confidence': result.confidence,
                    'variables': result.variables,
                    'reasoning': result.reasoning
                }
                
                # Trigger workflow if confidence high enough
                if self.engine.should_trigger_workflow(result):
                    workflow_type = self.engine.get_workflow_type(result)
                    self._trigger_workflow(tenant, workflow_type, result.variables, email)
                    
                    if result.intent == Intent.ORDER_REQUEST:
                        stats['orders_triggered'] += 1
                    elif result.intent == Intent.STATUS_INQUIRY:
                        stats['inquiries'] += 1
                
                # Mark as processed
                email.processed = True
                email.save()
                stats['processed'] += 1
                
            except Exception as e:
                logger.error(f'Failed to process email {email.id}: {e}')
                stats['errors'] += 1
        
        return stats
    
    def _trigger_workflow(self, tenant, workflow_type: str, variables: Dict, email):
        """
        Trigger workflow instance based on recognized intent.
        
        This is a stub - actual implementation would:
        1. Look up workflow template by type
        2. Create WorkflowInstance
        3. Populate initial variables from email
        4. Start workflow execution
        """
        logger.info(f'Would trigger {workflow_type} workflow with variables: {variables}')
        # TODO: Implement actual workflow triggering
        pass


# Convenience functions for common use cases

def classify_email(email_body: str, sender_email: str = None) -> IntentResult:
    """
    Quick helper to classify a single email.
    
    Example:
        result = classify_email("Hi, I need 50kg of ribeye by Friday")
        if result.intent == Intent.ORDER_REQUEST:
            print(f"Order for {result.variables.get('quantity')}")
    """
    engine = IntentEngine()
    return engine.recognize_intent(email_body, sender_email)


def process_tenant_emails(tenant_id: str, batch_size: int = 10) -> Dict[str, int]:
    """
    Quick helper to process a tenant's email backlog.
    
    Example:
        stats = process_tenant_emails('tenant-uuid', batch_size=20)
        print(f"Processed {stats['processed']} emails")
    """
    processor = IntentEngineBatchProcessor(tenant_id)
    return processor.process_email_log(batch_size)
