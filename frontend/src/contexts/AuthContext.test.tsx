/**
 * AuthContext Tests
 * 
 * Tests for authentication context provider including:
 * - Provider rendering and context access
 * - Login/logout/signup flows
 * - User state management
 * - Loading states
 * - Error handling
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from './AuthContext';
import { authService } from '../services/authService';

// Mock authService
vi.mock('../services/authService', () => ({
  authService: {
    getCurrentUser: vi.fn(),
    login: vi.fn(),
    signUp: vi.fn(),
    logout: vi.fn(),
    isAdmin: vi.fn(),
  },
}));

// Test component to access context
const TestConsumer: React.FC<{ onAuth?: (auth: ReturnType<typeof useAuth>) => void }> = ({ onAuth }) => {
  const auth = useAuth();
  
  if (onAuth) {
    onAuth(auth);
  }
  
  return (
    <div>
      <div data-testid="loading">{auth.loading ? 'loading' : 'ready'}</div>
      <div data-testid="authenticated">{auth.isAuthenticated ? 'yes' : 'no'}</div>
      <div data-testid="admin">{auth.isAdmin ? 'admin' : 'user'}</div>
      <div data-testid="user">{auth.user?.email || 'none'}</div>
      <button onClick={() => auth.login({ email: 'test@example.com', password: 'password' })}>
        Login
      </button>
      <button onClick={() => auth.logout()}>Logout</button>
      <button onClick={() => auth.signUp({ email: 'new@example.com', password: 'pass123', firstName: 'New', lastName: 'User' })}>
        SignUp
      </button>
      <button onClick={() => auth.refreshUser()}>Refresh</button>
    </div>
  );
};

describe('AuthContext', () => {
  const mockUser = {
    id: 1,
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    isActive: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authService.isAdmin).mockReturnValue(false);
    vi.mocked(authService.getCurrentUser).mockResolvedValue(null);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Provider Setup', () => {
    it('should render children', async () => {
      render(
        <AuthProvider>
          <div>Child Content</div>
        </AuthProvider>
      );
      
      expect(screen.getByText('Child Content')).toBeInTheDocument();
    });

    it('should throw error when useAuth is used outside provider', () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      expect(() => render(<TestConsumer />)).toThrow('useAuth must be used within an AuthProvider');
      
      consoleSpy.mockRestore();
    });

    it('should initialize with loading state', async () => {
      vi.mocked(authService.getCurrentUser).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(null), 100))
      );
      
      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );
      
      expect(screen.getByTestId('loading')).toHaveTextContent('loading');
    });
  });

  describe('Initialization', () => {
    it('should load current user on mount', async () => {
      vi.mocked(authService.getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(authService.isAdmin).mockReturnValue(false);
      
      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('ready');
      });
      
      expect(screen.getByTestId('authenticated')).toHaveTextContent('yes');
      expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
    });

    it('should handle getCurrentUser failure gracefully', async () => {
      vi.mocked(authService.getCurrentUser).mockRejectedValue(new Error('Network error'));
      
      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('ready');
      });
      
      expect(screen.getByTestId('authenticated')).toHaveTextContent('no');
      expect(screen.getByTestId('user')).toHaveTextContent('none');
    });

    it('should set isAdmin based on authService.isAdmin', async () => {
      vi.mocked(authService.getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(authService.isAdmin).mockReturnValue(true);
      
      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('ready');
      });
      
      expect(screen.getByTestId('admin')).toHaveTextContent('admin');
    });
  });

  describe('Login', () => {
    it('should update user state on successful login', async () => {
      const user = userEvent.setup();
      vi.mocked(authService.login).mockResolvedValue(mockUser);
      
      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('ready');
      });
      
      await user.click(screen.getByText('Login'));
      
      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('yes');
      });
      
      expect(authService.login).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password',
      });
    });

    it('should set loading state during login', async () => {
      const user = userEvent.setup();
      let resolveLogin: (value: any) => void;
      vi.mocked(authService.login).mockImplementation(
        () => new Promise((resolve) => { resolveLogin = resolve; })
      );
      
      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('ready');
      });
      
      // Start login
      await user.click(screen.getByText('Login'));
      
      // Should show loading
      expect(screen.getByTestId('loading')).toHaveTextContent('loading');
      
      // Complete login
      await act(async () => {
        resolveLogin!(mockUser);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('ready');
      });
    });

    it('should clear user and throw on login failure', async () => {
      const user = userEvent.setup();
      const loginError = new Error('Invalid credentials');
      vi.mocked(authService.login).mockRejectedValue(loginError);
      
      // Start with authenticated user
      vi.mocked(authService.getCurrentUser).mockResolvedValue(mockUser);
      
      // Create a test component that catches login errors
      const TestWithErrorHandling: React.FC = () => {
        const auth = useAuth();
        const handleLogin = async () => {
          try {
            await auth.login({ email: 'test@example.com', password: 'password' });
          } catch {
            // Expected error - caught to prevent unhandled rejection
          }
        };
        return (
          <div>
            <div data-testid="authenticated">{auth.isAuthenticated ? 'yes' : 'no'}</div>
            <button onClick={handleLogin}>Login</button>
          </div>
        );
      };
      
      render(
        <AuthProvider>
          <TestWithErrorHandling />
        </AuthProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('yes');
      });
      
      // Attempt login (which will fail)
      await user.click(screen.getByText('Login'));
      
      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('no');
      });
    });
  });

  describe('SignUp', () => {
    it('should update user state on successful signup', async () => {
      const user = userEvent.setup();
      const newUser = { ...mockUser, email: 'new@example.com' };
      vi.mocked(authService.signUp).mockResolvedValue(newUser);
      
      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('ready');
      });
      
      await user.click(screen.getByText('SignUp'));
      
      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent('new@example.com');
      });
      
      expect(authService.signUp).toHaveBeenCalledWith({
        email: 'new@example.com',
        password: 'pass123',
        firstName: 'New',
        lastName: 'User',
      });
    });

    it('should clear user on signup failure', async () => {
      const user = userEvent.setup();
      vi.mocked(authService.signUp).mockRejectedValue(new Error('Email exists'));
      
      // Create a test component that catches signup errors
      const TestWithErrorHandling: React.FC = () => {
        const auth = useAuth();
        const handleSignUp = async () => {
          try {
            await auth.signUp({ email: 'new@example.com', password: 'pass123', firstName: 'New', lastName: 'User' });
          } catch {
            // Expected error - caught to prevent unhandled rejection
          }
        };
        return (
          <div>
            <div data-testid="loading">{auth.loading ? 'loading' : 'ready'}</div>
            <div data-testid="authenticated">{auth.isAuthenticated ? 'yes' : 'no'}</div>
            <button onClick={handleSignUp}>SignUp</button>
          </div>
        );
      };
      
      render(
        <AuthProvider>
          <TestWithErrorHandling />
        </AuthProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('ready');
      });
      
      await user.click(screen.getByText('SignUp'));
      
      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('no');
      });
    });
  });

  describe('Logout', () => {
    it('should clear user state on logout', async () => {
      const user = userEvent.setup();
      vi.mocked(authService.getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(authService.logout).mockResolvedValue(undefined);
      
      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('yes');
      });
      
      await user.click(screen.getByText('Logout'));
      
      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('no');
      });
      
      expect(authService.logout).toHaveBeenCalled();
    });

    it('should clear user even if logout API fails', async () => {
      const user = userEvent.setup();
      vi.mocked(authService.getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(authService.logout).mockRejectedValue(new Error('Logout failed'));
      
      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('yes');
      });
      
      await user.click(screen.getByText('Logout'));
      
      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('no');
      });
    });
  });

  describe('RefreshUser', () => {
    it('should refresh user data', async () => {
      const user = userEvent.setup();
      const updatedUser = { ...mockUser, email: 'updated@example.com' };
      
      vi.mocked(authService.getCurrentUser)
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(updatedUser);
      
      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
      });
      
      await user.click(screen.getByText('Refresh'));
      
      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent('updated@example.com');
      });
    });

    it('should clear user if refresh fails', async () => {
      const user = userEvent.setup();
      vi.mocked(authService.getCurrentUser)
        .mockResolvedValueOnce(mockUser)
        .mockRejectedValueOnce(new Error('Token expired'));
      
      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('yes');
      });
      
      await user.click(screen.getByText('Refresh'));
      
      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('no');
      });
    });
  });

  describe('Computed Properties', () => {
    it('should compute isAuthenticated as true when user exists', async () => {
      vi.mocked(authService.getCurrentUser).mockResolvedValue(mockUser);
      
      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('yes');
      });
    });

    it('should compute isAuthenticated as false when user is null', async () => {
      vi.mocked(authService.getCurrentUser).mockResolvedValue(null);
      
      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('ready');
      });
      
      expect(screen.getByTestId('authenticated')).toHaveTextContent('no');
    });

    it('should reflect isAdmin from authService', async () => {
      vi.mocked(authService.getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(authService.isAdmin).mockReturnValue(true);
      
      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('admin')).toHaveTextContent('admin');
      });
    });
  });
});
