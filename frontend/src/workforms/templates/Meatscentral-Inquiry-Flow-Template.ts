import type { Edge, Node } from '@xyflow/react';

import type { FlowTemplate } from '@/components/FlowEditor/templates/flowTemplates';

const CONTAINER_ID = 'mc-inquiry-formprocess';

// NOTE: This template is intentionally explicit (stable IDs, deterministic layout)
// so it can act as the canonical default blueprint.
export const MEATSCENTRAL_INQUIRY_FLOW_TEMPLATE: FlowTemplate = {
  id: 'meatscentral-inquiry-flow-template',
  name: 'Meatscentral-Inquiry-Flow-Template',
  description:
    'Main template blueprint for Inquiry → Sales Order → Customer PO → Supplier PO with bidding + confirmations.',
  category: 'orders',
  difficulty: 'advanced',
  estimatedSetupTime: '15 minutes',
  thumbnail: '🥩',
  tags: ['inquiry', 'sales', 'purchase-order', 'bids', 'meatscentral', 'vanguard'],
  popularity: 9999,
  variables: [],
  optionalExtensions: [],
  nodes: [
    // Trigger (top-level)
    {
      id: 'node-trigger-inquiry-created',
      type: 'triggerEvent',
      position: { x: 120, y: 80 },
      data: {
        label: 'New inquiry created',
        config: {
          trigger: 'new inquiry created',
          mode: 'auto',
          entity: 'Inquiry',
          event: 'created',
        },
      },
    },

    // Root container (top-level). This is the canonical "Form Process" blueprint.
    {
      id: CONTAINER_ID,
      type: 'formProcess',
      position: { x: 120, y: 180 },
      style: {
        width: 1700,
        height: 820,
        borderColor: 'rgb(var(--color-primary))',
      },
      data: {
        label: 'Inquiry Flow (Main)',
        // Semantic type used by config schemas (skip steps, navigation, etc.)
        nodeType: 'formMultiStepContainer',
        containerName: 'Inquiry Flow (Main)',
        containerDescription: 'Canonical inquiry-to-order blueprint for new workforms',
        isExpanded: true,
        isGroup: true,
        // Template-specific metadata
        trigger: 'new inquiry created',
      },
    },

    // === 4 sequential Form Nodes (inside container) ===
    {
      id: 'node-form-1-inquiry',
      type: 'form',
      parentId: CONTAINER_ID,
      extent: 'parent',
      expandParent: true,
      position: { x: 50, y: 80 },
      data: {
        label: '1. Inquiry',
        stepTitle: 'Inquiry',
        stepDescription: 'A. Availability • B. Price • C. Spec Sheet',
        sections: ['A. Availability', 'B. Price', 'C. Spec Sheet'],
      },
    },
    {
      id: 'node-form-2-sales-order',
      type: 'form',
      parentId: CONTAINER_ID,
      extent: 'parent',
      expandParent: true,
      position: { x: 400, y: 80 },
      data: {
        label: '2. Sales Order (to customer)',
        stepTitle: 'Sales Order (to customer)',
      },
    },
    {
      id: 'node-form-3-customer-po',
      type: 'form',
      parentId: CONTAINER_ID,
      extent: 'parent',
      expandParent: true,
      position: { x: 750, y: 80 },
      data: {
        label: '3. Purchase Order (from customer)',
        stepTitle: 'Purchase Order (from customer)',
      },
    },
    {
      id: 'node-form-4-supplier-po',
      type: 'form',
      parentId: CONTAINER_ID,
      extent: 'parent',
      expandParent: true,
      position: { x: 1100, y: 80 },
      data: {
        label: '4. Purchase Order (to supplier)',
        stepTitle: 'Purchase Order (to supplier)',
      },
    },

    // 4a / 4b branch (inside container)
    {
      id: 'node-branch-4a-4b',
      type: 'conditionIf',
      parentId: CONTAINER_ID,
      extent: 'parent',
      expandParent: true,
      position: { x: 1100, y: 430 },
      data: {
        label: '4a/4b Shipping Branch',
        config: {
          condition: 'shipping_terms == "FOB"',
        },
      },
    },
    {
      id: 'node-4a-fob',
      type: 'actionScript',
      parentId: CONTAINER_ID,
      extent: 'parent',
      expandParent: true,
      position: { x: 920, y: 580 },
      data: {
        label: '4a. FOB branch',
        config: { notes: 'FOB branch logic placeholder' },
      },
    },
    {
      id: 'node-4b-delivered',
      type: 'actionScript',
      parentId: CONTAINER_ID,
      extent: 'parent',
      expandParent: true,
      position: { x: 1280, y: 580 },
      data: {
        label: '4b. Delivered branch',
        config: { notes: 'Delivered branch logic placeholder' },
      },
    },

    // === Inside container (additive): loops, emails, waits, bids ===
    {
      id: 'node-loop-until-due-date',
      type: 'loopWhile',
      parentId: CONTAINER_ID,
      extent: 'parent',
      expandParent: true,
      position: { x: 50, y: 430 },
      data: {
        label: 'Do Until: Current Date ≥ Inquiry Due Date',
        config: {
          condition: 'current_date < inquiry_due_date',
          notes: 'Loops until due date is reached (Do Until equivalent).',
        },
      },
    },
    {
      id: 'node-loop-for-each-supplier',
      type: 'loopForEach',
      parentId: CONTAINER_ID,
      extent: 'parent',
      expandParent: true,
      position: { x: 400, y: 430 },
      data: {
        label: 'For Each supplier',
        config: {
          array: 'suppliers',
          itemName: 'supplier',
        },
      },
    },
    {
      id: 'node-email-request-spec',
      type: 'actionEmail',
      parentId: CONTAINER_ID,
      extent: 'parent',
      expandParent: true,
      position: { x: 400, y: 580 },
      data: {
        label: 'Email Supplier: Request Spec/Avail/Price/Plant',
        config: {
          subject: 'Requesting Spec Sheet + Availability Timeline + Price + Plant Location',
          body: 'Requesting Spec Sheet + Availability Timeline + Price + Plant Location + Confirm 90 days or newer.',
        },
      },
    },
    {
      id: 'node-wait-supplier-response',
      type: 'pendingResponse',
      parentId: CONTAINER_ID,
      extent: 'parent',
      expandParent: true,
      position: { x: 400, y: 710 },
      data: {
        label: 'Wait for Supplier Response',
        config: { timeoutHours: 72 },
      },
    },
    {
      id: 'node-add-to-inquiry-bids',
      type: 'actionCreateRecord',
      parentId: CONTAINER_ID,
      extent: 'parent',
      expandParent: true,
      position: { x: 750, y: 580 },
      data: {
        label: 'Add to Inquiry Bids',
        config: {
          entity: 'InquiryBid',
        },
      },
    },
    {
      id: 'node-bid-selection',
      type: 'actionScript',
      parentId: CONTAINER_ID,
      extent: 'parent',
      expandParent: true,
      position: { x: 750, y: 710 },
      data: {
        label: 'Select TOP 1 Bid (Bid Desc)',
        config: {
          expression: 'TOP 1 WHERE bid = actual_price - desired_price ORDER BY bid DESC',
        },
      },
    },

    // Generate Doc + email customer + wait confirm
    {
      id: 'node-generate-sales-order-doc',
      type: 'documentGenerate',
      parentId: CONTAINER_ID,
      extent: 'parent',
      expandParent: true,
      position: { x: 1100, y: 710 },
      data: {
        label: 'Generate Doc: Sales Order (+ attach customer PO)',
        config: {
          outputName: 'Sales Order',
        },
      },
    },
    {
      id: 'node-email-customer-sales-order',
      type: 'actionEmail',
      parentId: CONTAINER_ID,
      extent: 'parent',
      expandParent: true,
      position: { x: 1280, y: 710 },
      data: {
        label: 'Send Email to Customer (Sales Order)',
        config: {
          subject: 'Sales Order + Customer PO',
        },
      },
    },
    {
      id: 'node-wait-customer-confirmation',
      type: 'pendingResponse',
      parentId: CONTAINER_ID,
      extent: 'parent',
      expandParent: true,
      position: { x: 1460, y: 710 },
      data: {
        label: 'Wait for confirmation',
        config: { timeoutHours: 72 },
      },
    },

    // Steps 5–11 (after Form Node 4)
    {
      id: 'node-step-5-order-confirmation',
      type: 'pendingApproval',
      parentId: CONTAINER_ID,
      extent: 'parent',
      expandParent: true,
      position: { x: 1100, y: 300 },
      data: {
        label: '5. Order Confirmation',
      },
    },
    {
      id: 'node-step-6-request-proforma-bol',
      type: 'actionEmail',
      parentId: CONTAINER_ID,
      extent: 'parent',
      expandParent: true,
      position: { x: 1280, y: 300 },
      data: {
        label: '6. Request Proforma / Draft BOL',
        config: { subject: 'Request Proforma / Draft BOL' },
      },
    },
    {
      id: 'node-step-7-send-payment',
      type: 'pendingPayment',
      parentId: CONTAINER_ID,
      extent: 'parent',
      expandParent: true,
      position: { x: 1460, y: 300 },
      data: {
        label: '7. Send Payment (3 business days prior)',
      },
    },
    {
      id: 'node-step-8-receive-bol',
      type: 'pendingDocument',
      parentId: CONTAINER_ID,
      extent: 'parent',
      expandParent: true,
      position: { x: 1100, y: 380 },
      data: {
        label: '8. Receive BOL',
      },
    },
    {
      id: 'node-step-9-verify-bol',
      type: 'conditionIf',
      parentId: CONTAINER_ID,
      extent: 'parent',
      expandParent: true,
      position: { x: 1280, y: 380 },
      data: {
        label: '9. Verify BOL vs Proforma',
        config: { condition: 'bol_matches_proforma == true' },
      },
    },
    {
      id: 'node-step-9b-file-claim',
      type: 'actionCreateRecord',
      parentId: CONTAINER_ID,
      extent: 'parent',
      expandParent: true,
      position: { x: 1460, y: 380 },
      data: {
        label: 'If discrepancy: File Claim',
        config: { entity: 'Claim' },
      },
    },
    {
      id: 'node-step-10-send-invoice',
      type: 'documentGenerate',
      parentId: CONTAINER_ID,
      extent: 'parent',
      expandParent: true,
      position: { x: 1280, y: 460 },
      data: {
        label: '10. Send Invoice (based on BOL)',
        config: { outputName: 'Invoice' },
      },
    },
    {
      id: 'node-step-11-confirm-payment',
      type: 'pendingPayment',
      parentId: CONTAINER_ID,
      extent: 'parent',
      expandParent: true,
      position: { x: 1460, y: 460 },
      data: {
        label: '11. Confirm Received Payment',
      },
    },
  ] satisfies Node[],
  edges: [
    { id: 'e-trigger-to-container', source: 'node-trigger-inquiry-created', target: CONTAINER_ID },

    // 4 sequential forms
    { id: 'e-1-2', source: 'node-form-1-inquiry', target: 'node-form-2-sales-order' },
    { id: 'e-2-3', source: 'node-form-2-sales-order', target: 'node-form-3-customer-po' },
    { id: 'e-3-4', source: 'node-form-3-customer-po', target: 'node-form-4-supplier-po' },

    // After form 4 → order confirmation
    { id: 'e-4-5', source: 'node-form-4-supplier-po', target: 'node-step-5-order-confirmation' },

    // Steps 5–11 chain
    { id: 'e-5-6', source: 'node-step-5-order-confirmation', target: 'node-step-6-request-proforma-bol' },
    { id: 'e-6-7', source: 'node-step-6-request-proforma-bol', target: 'node-step-7-send-payment' },
    { id: 'e-7-8', source: 'node-step-7-send-payment', target: 'node-step-8-receive-bol' },
    { id: 'e-8-9', source: 'node-step-8-receive-bol', target: 'node-step-9-verify-bol' },
    { id: 'e-9-10', source: 'node-step-9-verify-bol', target: 'node-step-10-send-invoice', label: 'OK' },
    { id: 'e-9-9b', source: 'node-step-9-verify-bol', target: 'node-step-9b-file-claim', label: 'Discrepancy' },
    { id: 'e-10-11', source: 'node-step-10-send-invoice', target: 'node-step-11-confirm-payment' },

    // Shipping branch off Form 4
    { id: 'e-4-branch', source: 'node-form-4-supplier-po', target: 'node-branch-4a-4b' },
    { id: 'e-branch-fob', source: 'node-branch-4a-4b', target: 'node-4a-fob', label: 'FOB' },
    { id: 'e-branch-delivered', source: 'node-branch-4a-4b', target: 'node-4b-delivered', label: 'Delivered' },

    // Loops + bids path
    { id: 'e-1-loop-until', source: 'node-form-1-inquiry', target: 'node-loop-until-due-date' },
    { id: 'e-loop-until-foreach', source: 'node-loop-until-due-date', target: 'node-loop-for-each-supplier' },
    { id: 'e-foreach-email', source: 'node-loop-for-each-supplier', target: 'node-email-request-spec' },
    { id: 'e-email-wait', source: 'node-email-request-spec', target: 'node-wait-supplier-response' },
    { id: 'e-wait-add-bid', source: 'node-wait-supplier-response', target: 'node-add-to-inquiry-bids' },
    { id: 'e-add-bid-select', source: 'node-add-to-inquiry-bids', target: 'node-bid-selection' },

    // Doc + email + wait
    { id: 'e-bid-doc', source: 'node-bid-selection', target: 'node-generate-sales-order-doc' },
    { id: 'e-doc-email', source: 'node-generate-sales-order-doc', target: 'node-email-customer-sales-order' },
    { id: 'e-email-wait-confirm', source: 'node-email-customer-sales-order', target: 'node-wait-customer-confirmation' },
  ] satisfies Edge[],
};
