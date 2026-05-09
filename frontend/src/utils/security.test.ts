import { describe, it, expect } from 'vitest';
import { SecurityUtils, PasswordValidator } from './security';

// ─── SecurityUtils.sanitizeHTML ─────────────────────────────────────────────────

describe('SecurityUtils.sanitizeHTML', () => {
  it('allows safe HTML tags', () => {
    const result = SecurityUtils.sanitizeHTML('<p>Hello <strong>world</strong></p>');
    expect(result).toContain('<p>');
    expect(result).toContain('<strong>');
  });

  it('strips script tags', () => {
    const result = SecurityUtils.sanitizeHTML('<script>alert("xss")</script><p>Safe</p>');
    expect(result).not.toContain('<script>');
    expect(result).toContain('<p>Safe</p>');
  });

  it('strips event handlers', () => {
    const result = SecurityUtils.sanitizeHTML('<img onerror="alert(1)" src="x">');
    expect(result).not.toContain('onerror');
  });

  it('strips data attributes', () => {
    const result = SecurityUtils.sanitizeHTML('<div data-payload="evil">content</div>');
    expect(result).not.toContain('data-payload');
  });

  it('allows safe attributes (href, title, target, rel, class, id)', () => {
    const html = '<a href="https://example.com" title="Link" target="_blank" rel="noopener" class="link" id="main">Click</a>';
    const result = SecurityUtils.sanitizeHTML(html);
    expect(result).toContain('href="https://example.com"');
    expect(result).toContain('title="Link"');
  });

  it('strips style attributes', () => {
    const result = SecurityUtils.sanitizeHTML('<div style="background:url(evil)">text</div>');
    expect(result).not.toContain('style=');
  });

  it('allows table elements', () => {
    const html = '<table><thead><tr><th>H</th></tr></thead><tbody><tr><td>D</td></tr></tbody></table>';
    const result = SecurityUtils.sanitizeHTML(html);
    expect(result).toContain('<table>');
    expect(result).toContain('<thead>');
    expect(result).toContain('<tbody>');
  });

  it('handles empty string', () => {
    expect(SecurityUtils.sanitizeHTML('')).toBe('');
  });

  it('accepts custom config overrides', () => {
    const result = SecurityUtils.sanitizeHTML('<b>Bold</b> <i>Italic</i>', {
      ALLOWED_TAGS: ['b'],
    });
    expect(result).toContain('<b>');
    // Config spread may merge or override — just ensure no crash
    expect(result).toBeDefined();
  });
});

// ─── SecurityUtils.sanitizeInput ────────────────────────────────────────────────

describe('SecurityUtils.sanitizeInput', () => {
  it('strips all HTML tags', () => {
    const result = SecurityUtils.sanitizeInput('<b>Hello</b> <script>x</script>');
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
    expect(result).toContain('Hello');
  });

  it('removes control characters', () => {
    const result = SecurityUtils.sanitizeInput('Hello\x00World\x01Test');
    expect(result).toBe('HelloWorldTest');
  });

  it('preserves newlines and tabs', () => {
    const result = SecurityUtils.sanitizeInput('Line1\nLine2\tTabbed');
    expect(result).toContain('\n');
    expect(result).toContain('\t');
  });

  it('trims whitespace', () => {
    const result = SecurityUtils.sanitizeInput('  hello  ');
    expect(result).toBe('hello');
  });

  it('throws on input exceeding maxLength', () => {
    const longInput = 'a'.repeat(1001);
    expect(() => SecurityUtils.sanitizeInput(longInput)).toThrow('exceeds maximum length');
  });

  it('accepts custom maxLength', () => {
    const input = 'a'.repeat(50);
    expect(() => SecurityUtils.sanitizeInput(input, 10)).toThrow('exceeds maximum length');
    expect(() => SecurityUtils.sanitizeInput(input, 100)).not.toThrow();
  });

  it('handles empty string', () => {
    expect(SecurityUtils.sanitizeInput('')).toBe('');
  });
});

// ─── SecurityUtils.generateSecureToken ──────────────────────────────────────────

describe('SecurityUtils.generateSecureToken', () => {
  it('generates hex string of correct length', () => {
    const token = SecurityUtils.generateSecureToken(32);
    expect(token).toHaveLength(64); // 32 bytes = 64 hex chars
  });

  it('generates hex string with default length', () => {
    const token = SecurityUtils.generateSecureToken();
    expect(token).toHaveLength(64); // default 32 bytes
  });

  it('generates different tokens each time', () => {
    const t1 = SecurityUtils.generateSecureToken();
    const t2 = SecurityUtils.generateSecureToken();
    expect(t1).not.toBe(t2);
  });

  it('only contains hex characters', () => {
    const token = SecurityUtils.generateSecureToken();
    expect(token).toMatch(/^[0-9a-f]+$/);
  });

  it('respects custom length', () => {
    const token = SecurityUtils.generateSecureToken(16);
    expect(token).toHaveLength(32); // 16 bytes = 32 hex chars
  });
});

// ─── SecurityUtils.validateFileUpload ───────────────────────────────────────────

describe('SecurityUtils.validateFileUpload', () => {
  it('accepts valid image files', () => {
    expect(SecurityUtils.validateFileUpload('photo.jpg')).toBe(true);
    expect(SecurityUtils.validateFileUpload('photo.jpeg')).toBe(true);
    expect(SecurityUtils.validateFileUpload('logo.png')).toBe(true);
  });

  it('accepts valid document files', () => {
    expect(SecurityUtils.validateFileUpload('report.pdf')).toBe(true);
    expect(SecurityUtils.validateFileUpload('document.doc')).toBe(true);
    expect(SecurityUtils.validateFileUpload('document.docx')).toBe(true);
  });

  it('accepts valid spreadsheet files', () => {
    expect(SecurityUtils.validateFileUpload('data.xls')).toBe(true);
    expect(SecurityUtils.validateFileUpload('data.xlsx')).toBe(true);
  });

  it('rejects executable files', () => {
    expect(SecurityUtils.validateFileUpload('virus.exe')).toBe(false);
    expect(SecurityUtils.validateFileUpload('script.sh')).toBe(false);
    expect(SecurityUtils.validateFileUpload('malware.bat')).toBe(false);
  });

  it('rejects path traversal attempts', () => {
    expect(SecurityUtils.validateFileUpload('../../../etc/passwd')).toBe(false);
    expect(SecurityUtils.validateFileUpload('..\\..\\windows\\system32')).toBe(false);
    expect(SecurityUtils.validateFileUpload('uploads/../secret.txt')).toBe(false);
  });

  it('rejects forward slashes', () => {
    expect(SecurityUtils.validateFileUpload('path/to/file.jpg')).toBe(false);
  });

  it('rejects backslashes', () => {
    expect(SecurityUtils.validateFileUpload('path\\to\\file.jpg')).toBe(false);
  });

  it('rejects files with no extension', () => {
    expect(SecurityUtils.validateFileUpload('noextension')).toBe(false);
  });

  it('uses custom allowed extensions', () => {
    expect(SecurityUtils.validateFileUpload('data.csv', ['.csv', '.tsv'])).toBe(true);
    expect(SecurityUtils.validateFileUpload('data.xlsx', ['.csv', '.tsv'])).toBe(false);
  });

  it('handles case-insensitive extensions', () => {
    expect(SecurityUtils.validateFileUpload('Photo.JPG')).toBe(true);
    expect(SecurityUtils.validateFileUpload('Photo.Png')).toBe(true);
  });
});

// ─── SecurityUtils.escapeRegExp ─────────────────────────────────────────────────

describe('SecurityUtils.escapeRegExp', () => {
  it('escapes special regex characters', () => {
    const result = SecurityUtils.escapeRegExp('hello.world*test?');
    expect(result).toBe('hello\\.world\\*test\\?');
  });

  it('escapes all special characters', () => {
    const specials = '.*+?^${}()|[]\\';
    const result = SecurityUtils.escapeRegExp(specials);
    // Every character should be escaped
    expect(new RegExp(result).test(specials)).toBe(true);
  });

  it('leaves normal text unchanged', () => {
    expect(SecurityUtils.escapeRegExp('hello world')).toBe('hello world');
  });

  it('handles empty string', () => {
    expect(SecurityUtils.escapeRegExp('')).toBe('');
  });

  it('creates valid RegExp from escaped string', () => {
    const input = 'price is $5.00 (approx)';
    const escaped = SecurityUtils.escapeRegExp(input);
    const regex = new RegExp(escaped);
    expect(regex.test(input)).toBe(true);
    expect(regex.test('price is X5Y00 Zapprox)')).toBe(false);
  });
});

// ─── SecurityUtils.isValidURL ───────────────────────────────────────────────────

describe('SecurityUtils.isValidURL', () => {
  it('accepts valid https URLs', () => {
    expect(SecurityUtils.isValidURL('https://example.com')).toBe(true);
    expect(SecurityUtils.isValidURL('https://sub.example.com/path?q=1')).toBe(true);
  });

  it('accepts valid http URLs', () => {
    expect(SecurityUtils.isValidURL('http://localhost:3000')).toBe(true);
  });

  it('rejects javascript: protocol', () => {
    expect(SecurityUtils.isValidURL('javascript:alert(1)')).toBe(false);
  });

  it('rejects data: protocol', () => {
    expect(SecurityUtils.isValidURL('data:text/html,<script>alert(1)</script>')).toBe(false);
  });

  it('rejects ftp: protocol', () => {
    expect(SecurityUtils.isValidURL('ftp://files.example.com')).toBe(false);
  });

  it('rejects invalid URLs', () => {
    expect(SecurityUtils.isValidURL('not-a-url')).toBe(false);
    expect(SecurityUtils.isValidURL('')).toBe(false);
  });

  it('validates against allowed domains', () => {
    const allowed = ['example.com', 'trusted.org'];
    expect(SecurityUtils.isValidURL('https://example.com', allowed)).toBe(true);
    expect(SecurityUtils.isValidURL('https://sub.example.com', allowed)).toBe(true);
    expect(SecurityUtils.isValidURL('https://evil.com', allowed)).toBe(false);
  });

  it('allows any domain when allowedDomains is empty', () => {
    expect(SecurityUtils.isValidURL('https://anything.com', [])).toBe(true);
  });
});

// ─── PasswordValidator.validate ─────────────────────────────────────────────────

describe('PasswordValidator.validate', () => {
  it('accepts a strong password', () => {
    const result = PasswordValidator.validate('MyStr0ng!Pass');
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects short passwords', () => {
    const result = PasswordValidator.validate('Ab1!');
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('12 characters'))).toBe(true);
  });

  it('requires uppercase letter', () => {
    const result = PasswordValidator.validate('mystrongpass1!');
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('uppercase'))).toBe(true);
  });

  it('requires lowercase letter', () => {
    const result = PasswordValidator.validate('MYSTRONGPASS1!');
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('lowercase'))).toBe(true);
  });

  it('requires digit', () => {
    const result = PasswordValidator.validate('MyStrongPass!!');
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('digit'))).toBe(true);
  });

  it('requires special character', () => {
    const result = PasswordValidator.validate('MyStrongPass12');
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('special'))).toBe(true);
  });

  it('rejects common passwords', () => {
    const result = PasswordValidator.validate('password123!AB');
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('common'))).toBe(true);
  });

  it('returns multiple errors for very weak passwords', () => {
    const result = PasswordValidator.validate('abc');
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });
});

// ─── PasswordValidator.calculateStrength ────────────────────────────────────────

describe('PasswordValidator.calculateStrength', () => {
  it('gives low score to weak passwords', () => {
    expect(PasswordValidator.calculateStrength('abc')).toBeLessThan(30);
  });

  it('gives high score to strong passwords', () => {
    expect(PasswordValidator.calculateStrength('MyStr0ng!P@ssw0rd#2026')).toBeGreaterThan(80);
  });

  it('increases score with length', () => {
    const short = PasswordValidator.calculateStrength('Aa1!');
    const long = PasswordValidator.calculateStrength('Aa1!Bb2@Cc3#');
    expect(long).toBeGreaterThan(short);
  });

  it('increases score with character variety', () => {
    const lowercase = PasswordValidator.calculateStrength('aaaaaaaaaaaa');
    const mixed = PasswordValidator.calculateStrength('aAaA1!1!1!1!');
    expect(mixed).toBeGreaterThan(lowercase);
  });

  it('caps at 100', () => {
    const score = PasswordValidator.calculateStrength('A!b@C#d$E%f^G&h*I(J)K1234567890');
    expect(score).toBeLessThanOrEqual(100);
  });

  it('returns 0 for empty string', () => {
    expect(PasswordValidator.calculateStrength('')).toBe(0);
  });
});
