/**
 * Security utilities for frontend (OWASP Top 10 compliance)
 * 
 * Features:
 * - Token encryption (A02: Cryptographic Failures)
 * - XSS prevention (A07: Cross-Site Scripting)
 * - Input sanitization (A03: Injection)
 * - Secure storage helpers
 */

import DOMPurify, { type Config } from 'dompurify';
import { logger } from './logger';

/**
 * Security utility class for OWASP compliance
 */
export class SecurityUtils {
  /**
   * Sanitize HTML to prevent XSS attacks.
   * Uses DOMPurify for comprehensive XSS prevention.
   * 
   * @param html - HTML string to sanitize
   * @param config - Optional DOMPurify configuration
   * @returns Sanitized HTML string
   */
  static sanitizeHTML(html: string, config?: Config): string {
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        'p', 'br', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'code', 'pre',
        'span', 'div', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
      ],
      ALLOWED_ATTR: ['href', 'title', 'target', 'rel', 'class', 'id'],
      ALLOW_DATA_ATTR: false,
      ...config,
    }) as string;
  }

  /**
   * Sanitize user input (text only, no HTML).
   * Removes all HTML tags and dangerous characters.
   * 
   * @param input - User input to sanitize
   * @param maxLength - Maximum allowed length (default: 1000)
   * @returns Sanitized text string
   */
  static sanitizeInput(input: string, maxLength: number = 1000): string {
    if (input.length > maxLength) {
      throw new Error(`Input exceeds maximum length of ${maxLength}`);
    }

    // Strip all HTML tags
    const sanitized = DOMPurify.sanitize(input, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
    }) as string;

    // Remove control characters except newlines and tabs
    return sanitized
      .replace(/[^\x20-\x7E\n\t]/g, '')
      .trim();
  }

  /**
   * Encrypt token using Web Crypto API (async).
   * Uses AES-GCM for encryption.
   * 
   * @param token - Plain text token
   * @param key - Encryption key (base64 encoded)
   * @returns Encrypted token (base64)
   */
  static async encryptToken(token: string, key: string): Promise<string> {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(token);

      // Decode key from base64
      const keyData = Uint8Array.from(atob(key), c => c.charCodeAt(0));
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'AES-GCM' },
        false,
        ['encrypt']
      );

      // Generate IV
      const iv = crypto.getRandomValues(new Uint8Array(12));

      // Encrypt
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        cryptoKey,
        data
      );

      // Combine IV and encrypted data
      const combined = new Uint8Array(iv.length + encrypted.byteLength);
      combined.set(iv, 0);
      combined.set(new Uint8Array(encrypted), iv.length);

      // Return as base64
      return btoa(String.fromCharCode(...combined));
    } catch (error) {
      logger.error('Token encryption failed', { component: 'SecurityUtils' }, error);
      throw new Error('Token encryption failed');
    }
  }

  /**
   * Decrypt token using Web Crypto API (async).
   * 
   * @param encryptedToken - Encrypted token (base64)
   * @param key - Decryption key (base64 encoded)
   * @returns Decrypted token string
   */
  static async decryptToken(encryptedToken: string, key: string): Promise<string> {
    try {
      // Decode from base64
      const combined = Uint8Array.from(atob(encryptedToken), c => c.charCodeAt(0));

      // Extract IV and encrypted data
      const iv = combined.slice(0, 12);
      const encrypted = combined.slice(12);

      // Decode key from base64
      const keyData = Uint8Array.from(atob(key), c => c.charCodeAt(0));
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'AES-GCM' },
        false,
        ['decrypt']
      );

      // Decrypt
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        cryptoKey,
        encrypted
      );

      // Decode to string
      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
    } catch (error) {
      logger.error('Token decryption failed', { component: 'SecurityUtils' }, error);
      throw new Error('Token decryption failed');
    }
  }

  /**
   * Generate a cryptographically secure random token.
   * 
   * @param length - Token length in bytes (default: 32)
   * @returns Hex-encoded random token
   */
  static generateSecureToken(length: number = 32): string {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Validate file upload to prevent path traversal and malicious files.
   * 
   * @param filename - Uploaded filename
   * @param allowedExtensions - Array of allowed extensions (with dots)
   * @returns True if valid, false otherwise
   */
  static validateFileUpload(
    filename: string,
    allowedExtensions: string[] = ['.jpg', '.jpeg', '.png', '.pdf', '.doc', '.docx', '.xls', '.xlsx']
  ): boolean {
    // Check for path traversal attempts
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return false;
    }

    // Check file extension
    const ext = filename.lastIndexOf('.') > -1 
      ? filename.slice(filename.lastIndexOf('.')).toLowerCase()
      : '';
    
    return allowedExtensions.includes(ext);
  }

  /**
   * Escape special characters for use in RegExp.
   * Prevents ReDoS (Regular Expression Denial of Service) attacks.
   * 
   * @param str - String to escape
   * @returns Escaped string safe for RegExp
   */
  static escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Validate URL to prevent open redirect vulnerabilities.
   * 
   * @param url - URL to validate
   * @param allowedDomains - Array of allowed domain names
   * @returns True if URL is safe, false otherwise
   */
  static isValidURL(url: string, allowedDomains: string[] = []): boolean {
    try {
      const parsed = new URL(url);
      
      // Only allow http and https protocols
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return false;
      }

      // If allowedDomains specified, check hostname
      if (allowedDomains.length > 0) {
        return allowedDomains.some(domain => 
          parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`)
        );
      }

      return true;
    } catch (err) {
      logger.debug('URL validation failed (invalid URL format)', { component: 'SecurityUtils' }, err);
      return false;
    }
  }
}

/**
 * Secure storage wrapper for localStorage/sessionStorage.
 * Encrypts sensitive data before storage.
 */
export class SecureStorage {
  private storage: Storage;
  private encryptionKey: string | null = null;

  constructor(storageType: 'local' | 'session' = 'local') {
    this.storage = storageType === 'local' ? localStorage : sessionStorage;
  }

  /**
   * Set encryption key for secure storage.
   * Key should be generated server-side and provided securely.
   * 
   * @param key - Base64 encoded encryption key
   */
  setEncryptionKey(key: string): void {
    this.encryptionKey = key;
  }

  /**
   * Store item securely (encrypted if key is set).
   * 
   * @param key - Storage key
   * @param value - Value to store
   */
  async setItem(key: string, value: unknown): Promise<void> {
    const serialized = JSON.stringify(value);
    
    if (this.encryptionKey) {
      try {
        const encrypted = await SecurityUtils.encryptToken(serialized, this.encryptionKey);
        this.storage.setItem(key, encrypted);
      } catch (error) {
        logger.error('Secure storage setItem failed', { component: 'SecureStorage' }, error);
        throw error;
      }
    } else {
      this.storage.setItem(key, serialized);
    }
  }

  /**
   * Retrieve item from secure storage (decrypts if encrypted).
   * 
   * @param key - Storage key
   * @returns Retrieved value or null if not found
   */
  async getItem<T>(key: string): Promise<T | null> {
    const stored = this.storage.getItem(key);
    if (!stored) return null;

    try {
      if (this.encryptionKey) {
        const decrypted = await SecurityUtils.decryptToken(stored, this.encryptionKey);
        return JSON.parse(decrypted);
      } else {
        return JSON.parse(stored);
      }
    } catch (error) {
      logger.error('Secure storage getItem failed', { component: 'SecureStorage' }, error);
      return null;
    }
  }

  /**
   * Remove item from storage.
   * 
   * @param key - Storage key
   */
  removeItem(key: string): void {
    this.storage.removeItem(key);
  }

  /**
   * Clear all items from storage.
   */
  clear(): void {
    this.storage.clear();
  }
}

/**
 * Password strength validator.
 */
export class PasswordValidator {
  static readonly MIN_LENGTH = 12;
  static readonly PATTERNS = {
    uppercase: /[A-Z]/,
    lowercase: /[a-z]/,
    digit: /[0-9]/,
    special: /[!@#$%^&*(),.?":{}|<>]/
  };

  /**
   * Validate password strength.
   * 
   * @param password - Password to validate
   * @returns Object with isValid and error messages
   */
  static validate(password: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < this.MIN_LENGTH) {
      errors.push(`Password must be at least ${this.MIN_LENGTH} characters long`);
    }

    if (!this.PATTERNS.uppercase.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!this.PATTERNS.lowercase.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!this.PATTERNS.digit.test(password)) {
      errors.push('Password must contain at least one digit');
    }

    if (!this.PATTERNS.special.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    // Check for common passwords
    const commonPasswords = ['password123', 'admin123', 'qwerty123', '12345678'];
    if (commonPasswords.some(common => password.toLowerCase().includes(common))) {
      errors.push('Password is too common');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Calculate password strength score (0-100).
   * 
   * @param password - Password to evaluate
   * @returns Strength score
   */
  static calculateStrength(password: string): number {
    let score = 0;

    // Length score (max 30)
    score += Math.min(password.length * 2, 30);

    // Character variety score (max 40)
    if (this.PATTERNS.uppercase.test(password)) score += 10;
    if (this.PATTERNS.lowercase.test(password)) score += 10;
    if (this.PATTERNS.digit.test(password)) score += 10;
    if (this.PATTERNS.special.test(password)) score += 10;

    // Uniqueness score (max 30)
    const uniqueChars = new Set(password).size;
    score += Math.min(uniqueChars * 2, 30);

    return Math.min(score, 100);
  }
}
