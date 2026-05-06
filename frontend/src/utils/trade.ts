import { formatCalendarDate, formatDateLocal, formatToLocal } from './formatters';

export interface TradeWeightPayload {
  entered_value: string;
  entered_unit: string;
  normalized_lbs: string;
  normalized_kg: string;
}

export interface TradeTimelinePayload {
  storage_timezone: string;
  render_timezone: string;
  datetime_fields: Record<string, string>;
  date_fields: Record<string, string>;
}

export interface TradeRecord {
  trade_weight?: TradeWeightPayload | null;
  trade_timeline?: TradeTimelinePayload | null;
  total_weight?: number | string | null;
  weight_unit?: string | null;
}

const formatWeightNumber = (value: string): string => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;

  const [, decimalPart = ''] = value.split('.');
  const precision = Math.min(decimalPart.length, 2);

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: precision,
    maximumFractionDigits: 2,
  }).format(numeric);
};

export const normalizeTradeUnit = (value?: string | null): string =>
  String(value || '').trim().toUpperCase();

export const formatTradeWeight = (
  record: TradeRecord | null | undefined,
  fallback = '—'
): string => {
  const enteredValue =
    record?.trade_weight?.entered_value ??
    (record?.total_weight != null && record?.total_weight !== '' ? String(record.total_weight) : null);

  if (!enteredValue) {
    return fallback;
  }

  const unit = normalizeTradeUnit(record?.trade_weight?.entered_unit ?? record?.weight_unit);
  const formattedValue = formatWeightNumber(enteredValue);

  return unit ? `${formattedValue} ${unit}` : formattedValue;
};

const getTradeDateValue = (
  timeline: TradeTimelinePayload | null | undefined,
  fieldName: string,
  fallback?: string | null
): string | null => {
  if (timeline?.date_fields?.[fieldName]) {
    return timeline.date_fields[fieldName];
  }
  if (timeline?.datetime_fields?.[fieldName]) {
    return timeline.datetime_fields[fieldName];
  }
  return fallback ?? null;
};

export const formatTradeDate = (
  timeline: TradeTimelinePayload | null | undefined,
  fieldName: string,
  fallback?: string | null,
  emptyValue = '—'
): string => {
  const value = getTradeDateValue(timeline, fieldName, fallback);
  if (!value) {
    return emptyValue;
  }

  return timeline?.date_fields?.[fieldName] ? formatCalendarDate(value) : formatDateLocal(value);
};

export const formatTradeDateTime = (
  timeline: TradeTimelinePayload | null | undefined,
  fieldName: string,
  fallback?: string | null,
  emptyValue = '—'
): string => {
  const value = getTradeDateValue(timeline, fieldName, fallback);
  if (!value) {
    return emptyValue;
  }

  return timeline?.date_fields?.[fieldName] ? formatCalendarDate(value) : formatToLocal(value);
};

export const getTradeDateInputValue = (
  timeline: TradeTimelinePayload | null | undefined,
  fieldName: string,
  fallback?: string | null
): string => {
  const value = getTradeDateValue(timeline, fieldName, fallback);
  if (!value) {
    return '';
  }

  return value.slice(0, 10);
};

export const getTradeWeightInputValue = (
  record: TradeRecord | null | undefined
): { totalWeight: string; weightUnit: string } => ({
  totalWeight:
    record?.trade_weight?.entered_value ??
    (record?.total_weight != null && record?.total_weight !== '' ? String(record.total_weight) : ''),
  weightUnit: normalizeTradeUnit(record?.trade_weight?.entered_unit ?? record?.weight_unit) || 'LBS',
});
