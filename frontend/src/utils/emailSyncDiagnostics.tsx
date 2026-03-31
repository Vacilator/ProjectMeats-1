import React from 'react';

export type EmailSyncErrorCode =
  | 'not_connected'
  | 'decryption_failed'
  | 'token_invalid'
  | 'token_refresh_failed'
  | 'token_missing'
  | 'sync_failed'
  | 'sync_exception'
  | 'unknown';

type AnyRecord = Record<string, unknown>;

const normalizeCode = (v: unknown): string => String(v ?? '').trim().toLowerCase();

export const getEmailSyncErrorCode = (data: unknown): EmailSyncErrorCode => {
  if (!data || typeof data !== 'object') return 'unknown';
  const obj = data as AnyRecord;
  const code = normalizeCode(obj.error_code ?? obj.code);

  if (
    code === 'not_connected' ||
    code === 'decryption_failed' ||
    code === 'token_invalid' ||
    code === 'token_refresh_failed' ||
    code === 'token_missing' ||
    code === 'sync_failed' ||
    code === 'sync_exception'
  ) {
    return code;
  }

  return code ? 'unknown' : 'unknown';
};

export const emailSyncNeedsReconnect = (code: EmailSyncErrorCode): boolean => {
  return code === 'decryption_failed' || code === 'token_invalid' || code === 'token_refresh_failed' || code === 'token_missing';
};

export const buildEmailSyncCtaMessage = (
  base: string,
  onOpenIntegrations: () => void,
  hint?: string
): React.ReactNode => {
  return (
    <span>
      {base}{' '}
      <a
        href="/settings/email-integrations"
        onClick={(e) => {
          e.preventDefault();
          onOpenIntegrations();
        }}
      >
        Open Email Integrations
      </a>
      {hint ? ` — ${hint}` : null}
    </span>
  );
};
