import { logger } from '@/utils/logger';

export interface BuildCsvOptions {
  headers: string[];
  rows: unknown[][];
}

const normalizeCsvCell = (raw: unknown): string => {
  if (raw == null) return '';
  if (raw instanceof Date) return raw.toISOString();

  const asString =
    typeof raw === 'string'
      ? raw
      : typeof raw === 'number' || typeof raw === 'boolean' || typeof raw === 'bigint'
        ? String(raw)
        : (() => {
            try {
              return JSON.stringify(raw);
            } catch (err) {
              logger.debug('JSON.stringify failed for CSV cell value, falling back to String()', { component: 'csv' }, err);
              return String(raw);
            }
          })();

  // Prevent Excel/Sheets formula injection on export.
  if (/^[\t\r\n ]*[=+\-@]/.test(asString)) return `'${asString}`;
  return asString;
};

const escapeCsvCell = (value: string): string => {
  const next = value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const needsQuotes = /[\n",]/.test(next);
  const escaped = next.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
};

export const buildCsv = ({ headers, rows }: BuildCsvOptions): string => {
  const headerLine = headers.map((h) => escapeCsvCell(String(h ?? ''))).join(',');
  const lines = rows.map((row) => row.map((cell) => escapeCsvCell(normalizeCsvCell(cell))).join(','));
  return [headerLine, ...lines].join('\n');
};

export const downloadCsv = (fileName: string, csv: string) => {
  if (typeof document === 'undefined') return;

  const safeName = fileName.toLowerCase().endsWith('.csv') ? fileName : `${fileName}.csv`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', safeName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
};
