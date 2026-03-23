"""
Security utilities for ProjectMeats backend.

Provides OWASP Top 10 compliance utilities including:
- Token encryption/decryption
- Input sanitization
- Security headers
- CSRF protection
"""

import hashlib
import hmac
import secrets
from typing import Any, Dict, Optional
from django.conf import settings
from django.core.exceptions import ValidationError
import bleach


class SecurityUtils:
    """
    Security utilities for OWASP Top 10 compliance.
    
    Features:
    - Token encryption (A02: Cryptographic Failures)
    - Input sanitization (A03: Injection, A07: XSS)
    - HMAC validation
    """
    
    @staticmethod
    def generate_secure_token(length: int = 32) -> str:
        """
        Generate cryptographically secure random token.
        
        Args:
            length: Token length in bytes (default 32)
            
        Returns:
            Hex-encoded secure random token
        """
        return secrets.token_hex(length)
    
    @staticmethod
    def encrypt_token(token: str, key: Optional[str] = None) -> str:
        """
        Encrypt a token using HMAC-SHA256.
        
        Args:
            token: Plain text token to encrypt
            key: Optional encryption key (uses SECRET_KEY if not provided)
            
        Returns:
            HMAC-encrypted token
        """
        key = key or settings.SECRET_KEY
        return hmac.new(
            key.encode('utf-8'),
            token.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
    
    @staticmethod
    def verify_token(token: str, encrypted_token: str, key: Optional[str] = None) -> bool:
        """
        Verify a token against its encrypted version.
        
        Args:
            token: Plain text token
            encrypted_token: HMAC-encrypted token
            key: Optional encryption key
            
        Returns:
            True if token is valid, False otherwise
        """
        key = key or settings.SECRET_KEY
        expected = hmac.new(
            key.encode('utf-8'),
            token.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(expected, encrypted_token)
    
    @staticmethod
    def sanitize_html(html: str, allowed_tags: Optional[list] = None) -> str:
        """
        Sanitize HTML to prevent XSS attacks.
        
        Args:
            html: HTML string to sanitize
            allowed_tags: List of allowed HTML tags (default: safe subset)
            
        Returns:
            Sanitized HTML string
        """
        if allowed_tags is None:
            allowed_tags = [
                'p', 'br', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li',
                'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'code', 'pre'
            ]
        
        allowed_attrs = {
            'a': ['href', 'title'],
            'img': ['src', 'alt', 'title'],
        }
        
        return bleach.clean(
            html,
            tags=allowed_tags,
            attributes=allowed_attrs,
            strip=True
        )
    
    @staticmethod
    def sanitize_input(user_input: str, max_length: int = 1000) -> str:
        """
        Sanitize user input to prevent injection attacks.
        
        Args:
            user_input: User-provided input string
            max_length: Maximum allowed length
            
        Returns:
            Sanitized input string
            
        Raises:
            ValidationError: If input exceeds max_length
        """
        if len(user_input) > max_length:
            raise ValidationError(f"Input exceeds maximum length of {max_length}")
        
        # Strip dangerous characters
        sanitized = bleach.clean(user_input, tags=[], strip=True)
        
        # Remove control characters except newlines/tabs
        sanitized = ''.join(char for char in sanitized if char.isprintable() or char in '\n\t')
        
        return sanitized.strip()
    
    @staticmethod
    def validate_file_upload(filename: str, allowed_extensions: Optional[list] = None) -> bool:
        """
        Validate file upload to prevent path traversal and malicious files.
        
        Args:
            filename: Uploaded filename
            allowed_extensions: List of allowed file extensions
            
        Returns:
            True if file is valid, False otherwise
        """
        if allowed_extensions is None:
            allowed_extensions = ['.jpg', '.jpeg', '.png', '.pdf', '.doc', '.docx', '.xls', '.xlsx']
        
        # Check for path traversal attempts
        if '..' in filename or '/' in filename or '\\' in filename:
            return False
        
        # Check file extension
        ext = '.' + filename.split('.')[-1].lower() if '.' in filename else ''
        return ext in allowed_extensions
    
    @staticmethod
    def get_security_headers() -> Dict[str, str]:
        """
        Get recommended security headers for OWASP compliance.
        
        Returns:
            Dictionary of security headers
        """
        return {
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'X-XSS-Protection': '1; mode=block',
            'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
            'Content-Security-Policy': (
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; "
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
                "font-src 'self' https://fonts.gstatic.com; "
                "img-src 'self' data: https:; "
                "connect-src 'self' https://api.meatscentral.com; "
                "frame-ancestors 'none';"
            ),
            'Referrer-Policy': 'strict-origin-when-cross-origin',
            'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
        }


class PasswordValidator:
    """
    Enhanced password validation for security compliance.
    """
    
    MIN_LENGTH = 12
    REQUIRED_CHARACTERS = {
        'uppercase': r'[A-Z]',
        'lowercase': r'[a-z]',
        'digit': r'[0-9]',
        'special': r'[!@#$%^&*(),.?":{}|<>]'
    }
    
    @classmethod
    def validate(cls, password: str) -> tuple[bool, list[str]]:
        """
        Validate password against security requirements.
        
        Args:
            password: Password to validate
            
        Returns:
            Tuple of (is_valid, list of error messages)
        """
        import re
        
        errors = []
        
        if len(password) < cls.MIN_LENGTH:
            errors.append(f"Password must be at least {cls.MIN_LENGTH} characters long")
        
        for char_type, pattern in cls.REQUIRED_CHARACTERS.items():
            if not re.search(pattern, password):
                errors.append(f"Password must contain at least one {char_type} character")
        
        # Check for common passwords (simplified check)
        common_passwords = ['password123', 'admin123', 'qwerty123', '12345678']
        if password.lower() in common_passwords:
            errors.append("Password is too common")
        
        return (len(errors) == 0, errors)
    
    @staticmethod
    def hash_password(password: str) -> str:
        """
        Hash password using Django's password hasher.
        
        Args:
            password: Plain text password
            
        Returns:
            Hashed password
        """
        from django.contrib.auth.hashers import make_password
        return make_password(password)


def require_secure_transport(view_func):
    """
    Decorator to require HTTPS for a view.
    
    Usage:
        @require_secure_transport
        def my_view(request):
            ...
    """
    from functools import wraps
    from django.http import HttpResponseForbidden
    
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if not request.is_secure() and not settings.DEBUG:
            return HttpResponseForbidden("HTTPS required")
        return view_func(request, *args, **kwargs)
    
    return wrapper
