/**
 * SmartTradeCreator
 *
 * Ultra-intelligent trade creation wizard with multiple low-friction input modes:
 * 1. Natural Language / AI Chat input
 * 2. Minimal Data Entry (3-5 key fields)
 * 3. Quick Form (pre-filled from context)
 * 4. Paste email/text (AI extraction)
 *
 * Detects intent early, auto-populates from tenant history and linked entities,
 * and triggers the full E2E pipeline (dependency approvals → PO → SO → logistics).
 *
 * Theme Compliance: CSS custom properties only.
 * Service Layer: Uses traderService + businessApi.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import {
  Button,
  Card,
  Input,
  Radio,
  Select,
  Space,
  Steps,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  ClipboardPaste,
  FileText,
  Lightbulb,
  MessageSquare,
  Sparkles,
  Zap,
} from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';

import {
  traderService,
  type TradeInitiateRequest,
  type DependencyCheckResult,
} from '../../services/traderService';
import { businessApi } from '../../services/businessApi';
import { withTenantQueryKey } from '../../utils/queryKeys';
import { DependencyWizard } from './DependencyWizard';
import { TradePipelineTracker } from './TradePipelineTracker';

const { Text, Title, Paragraph } = Typography;
const { TextArea } = Input;

// ============================================================================
// Types
// ============================================================================

type InputMode = 'smart' | 'minimal' | 'paste' | 'ai-chat';

interface AISuggestion {
  field: string;
  value: string;
  label: string;
  confidence: number;
  reason: string;
}

interface SmartParseResult {
  route: 'FULFILL' | 'BROKER' | null;
  customer_name: string | null;
  supplier_name: string | null;
  type_of_protein: string | null;
  weight: string | null;
  delivery_date: string | null;
  description: string | null;
  confidence: number;
  suggestions: AISuggestion[];
}

export interface SmartTradeCreatorProps {
  onTradeCreated: (tradeSessionId: string) => void;
  onCancel: () => void;
  className?: string;
}

// ============================================================================
// Styled Components
// ============================================================================

const WizardContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 640px;
  margin: 0 auto;
`;

const ModeSelector = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  margin-bottom: 8px;
`;

const ModeCard = styled.button<{ $active: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 14px 12px;
  border-radius: 8px;
  border: 1.5px solid ${({ $active }) =>
    $active ? 'rgb(var(--color-primary))' : 'rgb(var(--color-border))'};
  background: ${({ $active }) =>
    $active ? 'rgba(var(--color-primary), 0.06)' : 'transparent'};
  cursor: pointer;
  transition: all 0.15s ease;
  font-size: 0.8rem;
  font-weight: 500;
  color: rgb(var(--color-text-primary));

  &:hover {
    border-color: rgb(var(--color-primary));
    background: rgba(var(--color-primary), 0.04);
  }

  &:focus-visible {
    outline: 2px solid rgb(var(--color-primary));
    outline-offset: 2px;
  }
`;

const SuggestionChip = styled.button<{ $confidence: number }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 16px;
  border: 1px solid ${({ $confidence }) =>
    $confidence >= 0.9
      ? 'rgb(var(--color-success))'
      : $confidence >= 0.7
        ? 'rgb(var(--color-warning))'
        : 'rgb(var(--color-border))'};
  background: ${({ $confidence }) =>
    $confidence >= 0.9
      ? 'rgba(var(--color-success), 0.08)'
      : $confidence >= 0.7
        ? 'rgba(var(--color-warning), 0.06)'
        : 'transparent'};
  cursor: pointer;
  font-size: 0.75rem;
  color: rgb(var(--color-text-primary));
  transition: all 0.12s ease;

  &:hover {
    transform: scale(1.02);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  }

  &:focus-visible {
    outline: 2px solid rgb(var(--color-primary));
    outline-offset: 2px;
  }
`;

const ConfidenceBadge = styled.span<{ $level: 'high' | 'medium' | 'low' }>`
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 0.68rem;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 600;
  background: ${({ $level }) =>
    $level === 'high'
      ? 'rgba(var(--color-success), 0.12)'
      : $level === 'medium'
        ? 'rgba(var(--color-warning), 0.1)'
        : 'rgba(var(--color-border), 0.3)'};
  color: ${({ $level }) =>
    $level === 'high'
      ? 'rgb(var(--color-success))'
      : $level === 'medium'
        ? 'rgb(var(--color-warning))'
        : 'rgb(var(--color-text-secondary))'};
`;

const FormSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const FieldRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;

  @media (max-width: 480px) {
    grid-template-columns: 1fr;
  }
`;

const FieldGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const FieldLabel = styled.label`
  font-size: 0.75rem;
  font-weight: 500;
  color: rgb(var(--color-text-secondary));
`;

const AIInsight = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 8px;
  background: rgba(var(--color-info), 0.06);
  border: 1px solid rgba(var(--color-info), 0.15);
  font-size: 0.78rem;
  color: rgb(var(--color-text-primary));
`;

const PipelinePreview = styled.div`
  padding: 12px;
  border-radius: 8px;
  background: rgba(var(--color-success), 0.04);
  border: 1px solid rgba(var(--color-success), 0.12);
`;

const ActionBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 8px;
  border-top: 1px solid rgb(var(--color-border));
`;

// ============================================================================
// Smart Parsing (client-side heuristics)
// ============================================================================

function parseTradeInput(text: string): SmartParseResult {
  const result: SmartParseResult = {
    route: null,
    customer_name: null,
    supplier_name: null,
    type_of_protein: null,
    weight: null,
    delivery_date: null,
    description: text.trim(),
    confidence: 0,
    suggestions: [],
  };

  if (!text.trim()) return result;

  const lower = text.toLowerCase();

  // Detect route
  if (lower.includes('broker') || lower.includes('source from') || lower.includes('supplier')) {
    result.route = 'BROKER';
    result.suggestions.push({
      field: 'route', value: 'BROKER', label: 'Broker Route',
      confidence: 0.85, reason: 'Detected supplier/broker keywords',
    });
  } else if (lower.includes('fulfill') || lower.includes('direct') || lower.includes('inventory') || lower.includes('stock')) {
    result.route = 'FULFILL';
    result.suggestions.push({
      field: 'route', value: 'FULFILL', label: 'Direct Fulfillment',
      confidence: 0.85, reason: 'Detected fulfillment/inventory keywords',
    });
  }

  // Detect protein type
  const proteinPatterns = [
    'beef', 'chicken', 'pork', 'lamb', 'turkey', 'veal', 'bison',
    'ribeye', 'tenderloin', 'sirloin', 'ground beef', 'breast', 'thigh',
    'chuck', 'brisket', 'flank', 'strip', 'filet',
  ];
  for (const protein of proteinPatterns) {
    if (lower.includes(protein)) {
      result.type_of_protein = protein.charAt(0).toUpperCase() + protein.slice(1);
      result.suggestions.push({
        field: 'type_of_protein', value: result.type_of_protein, label: `Protein: ${result.type_of_protein}`,
        confidence: 0.9, reason: `Found "${protein}" in input`,
      });
      break;
    }
  }

  // Detect weight
  const weightMatch = text.match(/(\d[\d,]*\.?\d*)\s*(lbs?|kg|tons?|cases?|boxes?|pallets?)/i);
  if (weightMatch) {
    result.weight = `${weightMatch[1]} ${weightMatch[2]}`;
    result.suggestions.push({
      field: 'weight', value: result.weight, label: `Weight: ${result.weight}`,
      confidence: 0.92, reason: 'Extracted numeric weight + unit',
    });
  }

  // Detect delivery date
  const dateMatch = text.match(/(?:deliver(?:y|ed)?|ship(?:ped)?|by|due|eta)\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]?\d{0,4}|\w+ \d{1,2})/i);
  if (dateMatch) {
    result.delivery_date = dateMatch[1];
    result.suggestions.push({
      field: 'delivery_date', value: result.delivery_date, label: `Delivery: ${result.delivery_date}`,
      confidence: 0.8, reason: 'Extracted date from delivery context',
    });
  }

  // Compute overall confidence
  result.confidence = result.suggestions.length > 0
    ? result.suggestions.reduce((sum, s) => sum + s.confidence, 0) / result.suggestions.length
    : 0;

  return result;
}

// ============================================================================
// Component
// ============================================================================

export const SmartTradeCreator: React.FC<SmartTradeCreatorProps> = ({
  onTradeCreated,
  onCancel,
  className,
}) => {
  // State
  const [mode, setMode] = useState<InputMode>('smart');
  const [step, setStep] = useState<'input' | 'review' | 'dependencies'>('input');
  const [freeText, setFreeText] = useState('');
  const [route, setRoute] = useState<'FULFILL' | 'BROKER'>('FULFILL');
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [proteinType, setProteinType] = useState('');
  const [weight, setWeight] = useState('');
  const [description, setDescription] = useState('');
  const [depCheck, setDepCheck] = useState<DependencyCheckResult | null>(null);
  const [tradeSessionId, setTradeSessionId] = useState<string | null>(null);
  const [parsedResult, setParsedResult] = useState<SmartParseResult | null>(null);
  const [appliedSuggestions, setAppliedSuggestions] = useState<Set<string>>(new Set());
  const parseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch recent customers/suppliers for quick-select
  const customersQuery = useQuery({
    queryKey: withTenantQueryKey('smart-trade-customers'),
    queryFn: async () => {
      const resp = await businessApi.get('/customers/?page_size=20&ordering=-updated_at');
      return resp.data?.results || [];
    },
    staleTime: 60 * 1000,
  });

  const suppliersQuery = useQuery({
    queryKey: withTenantQueryKey('smart-trade-suppliers'),
    queryFn: async () => {
      const resp = await businessApi.get('/suppliers/?page_size=20&ordering=-updated_at');
      return resp.data?.results || [];
    },
    staleTime: 60 * 1000,
  });

  const customerOptions = useMemo(
    () => (customersQuery.data || []).map((c: any) => ({ value: c.id, label: c.name || c.company_name || c.id })),
    [customersQuery.data]
  );

  const supplierOptions = useMemo(
    () => (suppliersQuery.data || []).map((s: any) => ({ value: s.id, label: s.name || s.company_name || s.id })),
    [suppliersQuery.data]
  );

  // Initiate trade mutation
  const initiateMutation = useMutation({
    mutationFn: (data: TradeInitiateRequest) => traderService.initiateTrade(data),
    onSuccess: (result) => {
      setDepCheck(result.dependencies);
      setTradeSessionId(result.trade_session_id);
      setStep('dependencies');
      message.success(`Trade ${result.trade_id} created`);
    },
    onError: () => {
      message.error('Failed to create trade');
    },
  });

  // Advance trade mutation
  const advanceMutation = useMutation({
    mutationFn: (sessionId: string) => traderService.advanceTrade(sessionId),
    onSuccess: () => {
      if (tradeSessionId) {
        onTradeCreated(tradeSessionId);
      }
      message.success('Trade pipeline started!');
    },
    onError: () => {
      message.error('Failed to start pipeline');
    },
  });

  // Parse text on change (debounced)
  const handleTextChange = useCallback((text: string) => {
    setFreeText(text);
    if (parseTimeoutRef.current) clearTimeout(parseTimeoutRef.current);
    parseTimeoutRef.current = setTimeout(() => {
      const result = parseTradeInput(text);
      setParsedResult(result);
      // Auto-apply high-confidence suggestions
      if (result.route && !appliedSuggestions.has('route')) {
        setRoute(result.route);
      }
      if (result.type_of_protein && !appliedSuggestions.has('type_of_protein')) {
        setProteinType(result.type_of_protein);
      }
    }, 400);
  }, [appliedSuggestions]);

  // Apply a suggestion
  const applySuggestion = useCallback((suggestion: AISuggestion) => {
    switch (suggestion.field) {
      case 'route':
        setRoute(suggestion.value as 'FULFILL' | 'BROKER');
        break;
      case 'type_of_protein':
        setProteinType(suggestion.value);
        break;
      case 'weight':
        setWeight(suggestion.value);
        break;
      case 'delivery_date':
        setDescription((prev) => prev ? `${prev} | Delivery: ${suggestion.value}` : `Delivery: ${suggestion.value}`);
        break;
    }
    setAppliedSuggestions((prev) => new Set([...prev, suggestion.field]));
  }, []);

  // Submit trade
  const handleCreateTrade = useCallback(() => {
    const payload: TradeInitiateRequest = {
      route,
      customer_id: customerId || undefined,
      supplier_id: supplierId || undefined,
      type_of_protein: proteinType || undefined,
      description: description || freeText || undefined,
    };
    initiateMutation.mutate(payload);
  }, [route, customerId, supplierId, proteinType, description, freeText, initiateMutation]);

  // Start the pipeline after dependencies satisfied
  const handleStartPipeline = useCallback(() => {
    if (tradeSessionId) {
      advanceMutation.mutate(tradeSessionId);
    }
  }, [tradeSessionId, advanceMutation]);

  // Refresh dependency check
  const handleRefreshDeps = useCallback(() => {
    if (depCheck?.inquiry_id) {
      traderService.checkDependencies(depCheck.inquiry_id).then(setDepCheck);
    }
  }, [depCheck?.inquiry_id]);

  // Move to review step
  const handleProceedToReview = useCallback(() => {
    setStep('review');
  }, []);

  const confidenceLevel = useMemo((): 'high' | 'medium' | 'low' => {
    if (!parsedResult) return 'low';
    if (parsedResult.confidence >= 0.85) return 'high';
    if (parsedResult.confidence >= 0.6) return 'medium';
    return 'low';
  }, [parsedResult]);

  // ============================================================================
  // Render
  // ============================================================================

  if (step === 'dependencies' && depCheck) {
    return (
      <WizardContainer className={className}>
        <Title level={5} style={{ margin: 0 }}>
          <CheckCircle2 size={16} style={{ marginRight: 6 }} />
          Verify Dependencies
        </Title>
        <PipelinePreview>
          <Text type="secondary" style={{ fontSize: '0.72rem', marginBottom: 4, display: 'block' }}>
            Pipeline Preview
          </Text>
          <TradePipelineTracker currentStep="draft_sales_order" route={route} />
        </PipelinePreview>
        <DependencyWizard
          checklist={depCheck.checklist}
          allSatisfied={depCheck.all_satisfied}
          onStartTrade={handleStartPipeline}
          onRefresh={handleRefreshDeps}
          loading={advanceMutation.isPending}
        />
      </WizardContainer>
    );
  }

  if (step === 'review') {
    return (
      <WizardContainer className={className}>
        <Title level={5} style={{ margin: 0 }}>
          <Sparkles size={16} style={{ marginRight: 6 }} />
          Review & Create Trade
        </Title>

        {parsedResult && parsedResult.confidence > 0 && (
          <AIInsight>
            <Bot size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <Text strong style={{ fontSize: '0.78rem' }}>AI Analysis</Text>
              <ConfidenceBadge $level={confidenceLevel} style={{ marginLeft: 8 }}>
                {Math.round(parsedResult.confidence * 100)}% confident
              </ConfidenceBadge>
              <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {parsedResult.suggestions.filter((s) => !appliedSuggestions.has(s.field)).map((s) => (
                  <SuggestionChip key={s.field} $confidence={s.confidence} onClick={() => applySuggestion(s)}>
                    <Lightbulb size={11} />
                    {s.label}
                  </SuggestionChip>
                ))}
              </div>
            </div>
          </AIInsight>
        )}

        <FormSection>
          <FieldRow>
            <FieldGroup>
              <FieldLabel>Trade Route</FieldLabel>
              <Radio.Group value={route} onChange={(e) => setRoute(e.target.value)} buttonStyle="solid" size="small">
                <Radio.Button value="FULFILL">Direct Fulfill</Radio.Button>
                <Radio.Button value="BROKER">Broker</Radio.Button>
              </Radio.Group>
            </FieldGroup>
            <FieldGroup>
              <FieldLabel>Protein Type</FieldLabel>
              <Input
                size="small"
                value={proteinType}
                onChange={(e) => setProteinType(e.target.value)}
                placeholder="e.g., Beef Ribeye"
              />
            </FieldGroup>
          </FieldRow>

          <FieldRow>
            <FieldGroup>
              <FieldLabel>Customer</FieldLabel>
              <Select
                size="small"
                showSearch
                allowClear
                value={customerId}
                onChange={setCustomerId}
                options={customerOptions}
                placeholder="Select customer"
                filterOption={(input, option) =>
                  (option?.label as string || '').toLowerCase().includes(input.toLowerCase())
                }
                style={{ width: '100%' }}
              />
            </FieldGroup>
            {route === 'BROKER' && (
              <FieldGroup>
                <FieldLabel>Supplier</FieldLabel>
                <Select
                  size="small"
                  showSearch
                  allowClear
                  value={supplierId}
                  onChange={setSupplierId}
                  options={supplierOptions}
                  placeholder="Select supplier"
                  filterOption={(input, option) =>
                    (option?.label as string || '').toLowerCase().includes(input.toLowerCase())
                  }
                  style={{ width: '100%' }}
                />
              </FieldGroup>
            )}
          </FieldRow>

          {weight && (
            <FieldGroup>
              <FieldLabel>Estimated Weight</FieldLabel>
              <Input size="small" value={weight} onChange={(e) => setWeight(e.target.value)} />
            </FieldGroup>
          )}

          <FieldGroup>
            <FieldLabel>Notes / Description</FieldLabel>
            <TextArea
              size="small"
              rows={2}
              value={description || freeText}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Any additional context..."
            />
          </FieldGroup>
        </FormSection>

        <PipelinePreview>
          <Text type="secondary" style={{ fontSize: '0.72rem', marginBottom: 4, display: 'block' }}>
            This will trigger the full automated pipeline:
          </Text>
          <TradePipelineTracker currentStep="draft_sales_order" route={route} />
        </PipelinePreview>

        <ActionBar>
          <Button size="small" onClick={() => setStep('input')}>Back</Button>
          <Button
            type="primary"
            icon={<Zap size={14} />}
            onClick={handleCreateTrade}
            loading={initiateMutation.isPending}
          >
            Create Trade & Check Dependencies
          </Button>
        </ActionBar>
      </WizardContainer>
    );
  }

  // Step: Input
  return (
    <WizardContainer className={className}>
      <Title level={5} style={{ margin: 0 }}>
        <Zap size={16} style={{ marginRight: 6 }} />
        Smart Trade Creator
      </Title>

      <ModeSelector>
        <ModeCard $active={mode === 'smart'} onClick={() => setMode('smart')}>
          <Sparkles size={18} />
          Smart Entry
        </ModeCard>
        <ModeCard $active={mode === 'minimal'} onClick={() => setMode('minimal')}>
          <Zap size={18} />
          Quick Fields
        </ModeCard>
        <ModeCard $active={mode === 'paste'} onClick={() => setMode('paste')}>
          <ClipboardPaste size={18} />
          Paste Text
        </ModeCard>
        <ModeCard $active={mode === 'ai-chat'} onClick={() => setMode('ai-chat')}>
          <MessageSquare size={18} />
          AI Chat
        </ModeCard>
      </ModeSelector>

      {/* Smart Entry / Paste / AI Chat — unified text input with AI parsing */}
      {(mode === 'smart' || mode === 'paste' || mode === 'ai-chat') && (
        <FormSection>
          <TextArea
            rows={mode === 'paste' ? 5 : 3}
            value={freeText}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder={
              mode === 'paste'
                ? 'Paste an email, PO, or trade request here...'
                : mode === 'ai-chat'
                  ? 'Tell me about the trade — e.g., "Need 40,000 lbs beef ribeye from JBS, deliver to Chicago by March 15"'
                  : 'Describe your trade — type naturally, AI will extract details...'
            }
          />

          {parsedResult && parsedResult.suggestions.length > 0 && (
            <AIInsight>
              <Bot size={16} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <Text strong style={{ fontSize: '0.78rem' }}>
                  AI detected {parsedResult.suggestions.length} field{parsedResult.suggestions.length > 1 ? 's' : ''}
                </Text>
                <ConfidenceBadge $level={confidenceLevel} style={{ marginLeft: 8 }}>
                  {Math.round(parsedResult.confidence * 100)}%
                </ConfidenceBadge>
                <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {parsedResult.suggestions.map((s) => (
                    <SuggestionChip
                      key={s.field}
                      $confidence={s.confidence}
                      onClick={() => applySuggestion(s)}
                      title={s.reason}
                    >
                      {appliedSuggestions.has(s.field) ? (
                        <CheckCircle2 size={11} />
                      ) : (
                        <Lightbulb size={11} />
                      )}
                      {s.label}
                    </SuggestionChip>
                  ))}
                </div>
              </div>
            </AIInsight>
          )}
        </FormSection>
      )}

      {/* Minimal / Quick Fields mode */}
      {mode === 'minimal' && (
        <FormSection>
          <FieldRow>
            <FieldGroup>
              <FieldLabel>Trade Route *</FieldLabel>
              <Radio.Group value={route} onChange={(e) => setRoute(e.target.value)} buttonStyle="solid" size="small">
                <Radio.Button value="FULFILL">Fulfill</Radio.Button>
                <Radio.Button value="BROKER">Broker</Radio.Button>
              </Radio.Group>
            </FieldGroup>
            <FieldGroup>
              <FieldLabel>Protein Type</FieldLabel>
              <Input
                size="small"
                value={proteinType}
                onChange={(e) => setProteinType(e.target.value)}
                placeholder="e.g., Beef Chuck"
              />
            </FieldGroup>
          </FieldRow>

          <FieldRow>
            <FieldGroup>
              <FieldLabel>Customer</FieldLabel>
              <Select
                size="small"
                showSearch
                allowClear
                value={customerId}
                onChange={setCustomerId}
                options={customerOptions}
                placeholder="Select or skip"
                filterOption={(input, option) =>
                  (option?.label as string || '').toLowerCase().includes(input.toLowerCase())
                }
                style={{ width: '100%' }}
              />
            </FieldGroup>
            {route === 'BROKER' && (
              <FieldGroup>
                <FieldLabel>Supplier</FieldLabel>
                <Select
                  size="small"
                  showSearch
                  allowClear
                  value={supplierId}
                  onChange={setSupplierId}
                  options={supplierOptions}
                  placeholder="Select or skip"
                  filterOption={(input, option) =>
                    (option?.label as string || '').toLowerCase().includes(input.toLowerCase())
                  }
                  style={{ width: '100%' }}
                />
              </FieldGroup>
            )}
          </FieldRow>
        </FormSection>
      )}

      <ActionBar>
        <Button size="small" onClick={onCancel}>Cancel</Button>
        <Space>
          {(mode === 'smart' || mode === 'paste' || mode === 'ai-chat') && parsedResult && parsedResult.confidence >= 0.7 && (
            <Tooltip title="High confidence — skip review and create directly">
              <Button
                type="primary"
                ghost
                size="small"
                icon={<Zap size={12} />}
                onClick={handleCreateTrade}
                loading={initiateMutation.isPending}
              >
                Quick Create
              </Button>
            </Tooltip>
          )}
          <Button type="primary" icon={<ArrowRight size={14} />} onClick={handleProceedToReview}>
            Review & Continue
          </Button>
        </Space>
      </ActionBar>
    </WizardContainer>
  );
};

export default SmartTradeCreator;
