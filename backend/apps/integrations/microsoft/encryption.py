"""
Microsoft OAuth token encryption service.

Provides secure encryption/decryption of OAuth tokens using Django's SECRET_KEY.
CRITICAL: Never store raw Microsoft access tokens in plaintext.
"""

from django.conf import settings
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2
from base64 import urlsafe_b64encode
import logging

logger = logging.getLogger(__name__)


class TokenEncryptionService:
    """
    Service for encrypting and decrypting OAuth tokens.
    
    Uses Fernet symmetric encryption with key derived from DJANGO_SECRET_KEY.
    """
    
    def __init__(self):
        """Initialize encryption service with key derived from Django secret."""
        # Derive encryption key from Django SECRET_KEY
        self._encryption_key = self._derive_key(settings.SECRET_KEY)
        self._fernet = Fernet(self._encryption_key)
    
    def _derive_key(self, secret_key: str) -> bytes:
        """
        Derive a Fernet-compatible encryption key from Django SECRET_KEY.
        
        Uses PBKDF2 with SHA256 to derive a 32-byte key.
        
        Args:
            secret_key: Django SECRET_KEY
            
        Returns:
            32-byte encryption key (urlsafe base64 encoded)
        """
        # Use fixed salt (OK for application-level encryption with SECRET_KEY)
        salt = b'projectmeats_oauth_encryption_v1'
        
        # Derive 32 bytes using PBKDF2
        kdf = PBKDF2(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
        )
        key = kdf.derive(secret_key.encode('utf-8'))
        
        # Return urlsafe base64 encoded key (Fernet requirement)
        return urlsafe_b64encode(key)
    
    def encrypt_token(self, plaintext_token: str) -> str:
        """
        Encrypt an OAuth token for secure storage.
        
        Args:
            plaintext_token: Raw OAuth token (access or refresh)
            
        Returns:
            Encrypted token (base64 encoded string)
            
        Example:
            >>> service = TokenEncryptionService()
            >>> encrypted = service.encrypt_token("raw_access_token_abc123")
            >>> # Store encrypted in database
        """
        if not plaintext_token:
            raise ValueError("Cannot encrypt empty token")
        
        try:
            # Encrypt and return as string
            encrypted_bytes = self._fernet.encrypt(plaintext_token.encode('utf-8'))
            return encrypted_bytes.decode('utf-8')
        except Exception as e:
            logger.error(f"Token encryption failed: {e}")
            raise ValueError(f"Failed to encrypt token: {str(e)}")
    
    def decrypt_token(self, encrypted_token: str) -> str:
        """
        Decrypt a stored OAuth token for use.
        
        Args:
            encrypted_token: Encrypted token from database
            
        Returns:
            Plaintext OAuth token
            
        Raises:
            ValueError: If decryption fails (tampered data, wrong key, etc.)
            
        Example:
            >>> service = TokenEncryptionService()
            >>> plaintext = service.decrypt_token(encrypted_token_from_db)
            >>> # Use plaintext token for API calls
        """
        if not encrypted_token:
            raise ValueError("Cannot decrypt empty token")
        
        try:
            # Decrypt and return as string
            decrypted_bytes = self._fernet.decrypt(encrypted_token.encode('utf-8'))
            return decrypted_bytes.decode('utf-8')
        except Exception as e:
            logger.error(f"Token decryption failed: {e}")
            raise ValueError(f"Failed to decrypt token: {str(e)}")
    
    def rotate_token(self, encrypted_token: str, new_secret_key: str) -> str:
        """
        Re-encrypt a token with a new SECRET_KEY (for key rotation).
        
        Args:
            encrypted_token: Token encrypted with old key
            new_secret_key: New Django SECRET_KEY
            
        Returns:
            Token encrypted with new key
            
        Note:
            Use this during SECRET_KEY rotation to re-encrypt all stored tokens.
        """
        # Decrypt with current key
        plaintext = self.decrypt_token(encrypted_token)
        
        # Create new service with new key
        old_key = self._encryption_key
        self._encryption_key = self._derive_key(new_secret_key)
        self._fernet = Fernet(self._encryption_key)
        
        try:
            # Encrypt with new key
            return self.encrypt_token(plaintext)
        except Exception:
            # Restore old key on failure
            self._encryption_key = old_key
            self._fernet = Fernet(self._encryption_key)
            raise


# Singleton instance
_encryption_service = None


def get_encryption_service() -> TokenEncryptionService:
    """
    Get singleton instance of TokenEncryptionService.
    
    Returns:
        TokenEncryptionService instance
        
    Example:
        >>> from apps.integrations.microsoft.encryption import get_encryption_service
        >>> service = get_encryption_service()
        >>> encrypted = service.encrypt_token(access_token)
    """
    global _encryption_service
    if _encryption_service is None:
        _encryption_service = TokenEncryptionService()
    return _encryption_service


# Convenience functions
def encrypt_access_token(access_token: str) -> str:
    """Encrypt an access token for storage."""
    return get_encryption_service().encrypt_token(access_token)


def decrypt_access_token(encrypted_token: str) -> str:
    """Decrypt a stored access token."""
    return get_encryption_service().decrypt_token(encrypted_token)


def encrypt_refresh_token(refresh_token: str) -> str:
    """Encrypt a refresh token for storage."""
    return get_encryption_service().encrypt_token(refresh_token)


def decrypt_refresh_token(encrypted_token: str) -> str:
    """Decrypt a stored refresh token."""
    return get_encryption_service().decrypt_token(encrypted_token)
