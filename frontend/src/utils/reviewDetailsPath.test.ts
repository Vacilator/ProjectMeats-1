import { describe, expect, it } from 'vitest';
import {
  buildRecordWorkflowPath,
  buildReviewDetailsPathFromTargetUrl,
  buildReviewDetailsPathFromItem,
} from './reviewDetailsPath';

describe('buildRecordWorkflowPath', () => {
  it('builds a path with tab=workflows and viewProcessFlow=1', () => {
    const result = buildRecordWorkflowPath('inquiry', '42');
    expect(result).toContain('/records/inquiry/42');
    expect(result).toContain('tab=workflows');
    expect(result).toContain('viewProcessFlow=1');
  });

  it('normalizes entity type', () => {
    const result = buildRecordWorkflowPath('purchase_order', '99');
    expect(result).toContain('/records/purchase_order/99');
  });

  it('includes executionId when provided', () => {
    const result = buildRecordWorkflowPath('inquiry', '5', { executionId: 'exec-abc' });
    expect(result).toContain('executionId=exec-abc');
  });

  it('omits executionId when null', () => {
    const result = buildRecordWorkflowPath('inquiry', '5', { executionId: null });
    expect(result).not.toContain('executionId');
  });

  it('encodes special characters', () => {
    const result = buildRecordWorkflowPath('inquiry', 'id with spaces');
    expect(result).toContain('id%20with%20spaces');
  });
});

describe('buildReviewDetailsPathFromTargetUrl', () => {
  it('returns null for empty/null input', () => {
    expect(buildReviewDetailsPathFromTargetUrl(null)).toBeNull();
    expect(buildReviewDetailsPathFromTargetUrl('')).toBeNull();
    expect(buildReviewDetailsPathFromTargetUrl('   ')).toBeNull();
  });

  it('parses /records/entity/id paths', () => {
    const result = buildReviewDetailsPathFromTargetUrl('/records/inquiry/42');
    expect(result).toContain('/records/inquiry/42');
    expect(result).toContain('tab=workflows');
  });

  it('parses /purchase-orders/id paths', () => {
    const result = buildReviewDetailsPathFromTargetUrl('/purchase-orders/99');
    expect(result).toContain('/records/purchase_order/99');
  });

  it('parses /sales-orders/id paths', () => {
    const result = buildReviewDetailsPathFromTargetUrl('/sales-orders/55');
    expect(result).toContain('/records/sales_order/55');
  });

  it('parses /inquiries?inquiry=id paths', () => {
    const result = buildReviewDetailsPathFromTargetUrl('/inquiries?inquiry=77');
    expect(result).toContain('/records/inquiry/77');
  });

  it('returns null for unrecognized paths', () => {
    expect(buildReviewDetailsPathFromTargetUrl('/unknown/path')).toBeNull();
    expect(buildReviewDetailsPathFromTargetUrl('/inquiries')).toBeNull();
  });

  it('handles full URLs', () => {
    const result = buildReviewDetailsPathFromTargetUrl('https://example.com/records/inquiry/10');
    expect(result).toContain('/records/inquiry/10');
  });

  it('returns null for invalid URLs', () => {
    expect(buildReviewDetailsPathFromTargetUrl('not a url %%')).toBeNull();
  });
});

describe('buildReviewDetailsPathFromItem', () => {
  it('returns null for null item', () => {
    expect(buildReviewDetailsPathFromItem(null)).toBeNull();
  });

  it('uses review_target_url when available', () => {
    const result = buildReviewDetailsPathFromItem({
      review_target_url: '/records/inquiry/42',
      review_entity_type: 'inquiry',
      original_extracted_data: {},
    });
    expect(result).toContain('/records/inquiry/42');
  });

  it('falls back to result id when target URL is not available', () => {
    const result = buildReviewDetailsPathFromItem(
      {
        review_target_url: null,
        review_entity_type: 'inquiry',
        original_extracted_data: {},
      },
      { id: '99' },
    );
    expect(result).toContain('/records/inquiry/99');
  });

  it('extracts id from original_extracted_data payload', () => {
    const result = buildReviewDetailsPathFromItem({
      review_target_url: null,
      review_entity_type: 'purchase_order',
      original_extracted_data: { purchase_order_id: '123' },
    });
    expect(result).toContain('/records/purchase_order/123');
  });

  it('returns null when no id can be resolved', () => {
    const result = buildReviewDetailsPathFromItem({
      review_target_url: null,
      review_entity_type: '',
      original_extracted_data: {},
    });
    expect(result).toBeNull();
  });

  it('handles numeric ids in payload', () => {
    const result = buildReviewDetailsPathFromItem({
      review_target_url: null,
      review_entity_type: 'inquiry',
      original_extracted_data: { inquiry_id: 42 },
    });
    expect(result).toContain('/records/inquiry/42');
  });
});
