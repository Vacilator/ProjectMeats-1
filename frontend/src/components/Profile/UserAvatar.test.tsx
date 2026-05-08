/**
 * UserAvatar Component Tests
 *
 * Tests for user avatar display and upload functionality:
 * - Avatar display with image or initials
 * - Edit mode with upload overlay
 * - File validation (type, size)
 * - Upload flow and error handling
 * - Accessibility
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UserAvatar from './UserAvatar';

// Mock ThemeContext
vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({
    theme: { name: 'dark', colors: { primary: '#667eea' } },
  }),
}));

// Mock notify
vi.mock('../../utils/notify', () => ({
  notify: {
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  },
}));

import { notify } from '../../utils/notify';

describe('UserAvatar', () => {
  const defaultProps = {
    isEditMode: false,
    initials: 'JD',
    onUpload: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Avatar Display', () => {
    it('should render initials when no image provided', () => {
      render(<UserAvatar {...defaultProps} />);

      expect(screen.getByText('JD')).toBeInTheDocument();
    });

    it('should render image when imageUrl provided', () => {
      render(<UserAvatar {...defaultProps} imageUrl="https://example.com/avatar.jpg" />);

      const img = screen.getByAltText('User profile');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', 'https://example.com/avatar.jpg');
    });

    it('should accept custom size prop', () => {
      render(<UserAvatar {...defaultProps} size={150} />);

      // Verify component renders with size prop
      expect(screen.getByText('JD')).toBeInTheDocument();
    });

    it('should render with default size', () => {
      render(<UserAvatar {...defaultProps} />);

      // Verify component renders with default props
      expect(screen.getByText('JD')).toBeInTheDocument();
    });
  });

  describe('Edit Mode', () => {
    it('should not show upload overlay when not in edit mode', () => {
      render(<UserAvatar {...defaultProps} isEditMode={false} />);

      expect(screen.queryByText('Upload')).not.toBeInTheDocument();
    });

    it('should show upload overlay when in edit mode', () => {
      render(<UserAvatar {...defaultProps} isEditMode={true} />);

      expect(screen.getByText('Upload')).toBeInTheDocument();
    });

    it('should have file input with correct accept attribute', () => {
      render(<UserAvatar {...defaultProps} isEditMode={true} />);

      const fileInput = screen.getByLabelText('Upload profile picture');
      expect(fileInput).toHaveAttribute('accept', 'image/jpeg,image/jpg,image/png,image/gif,image/webp');
    });

    it('should have camera icon in edit mode', () => {
      render(<UserAvatar {...defaultProps} isEditMode={true} />);

      expect(screen.getByText('📷')).toBeInTheDocument();
    });
  });

  describe('File Upload', () => {
    it('should call onUpload with valid file', async () => {
      const onUpload = vi.fn().mockResolvedValue(undefined);
      render(<UserAvatar {...defaultProps} isEditMode={true} onUpload={onUpload} />);

      const file = new File(['test'], 'avatar.jpg', { type: 'image/jpeg' });
      const fileInput = screen.getByLabelText('Upload profile picture');

      await userEvent.upload(fileInput, file);

      await waitFor(() => {
        expect(onUpload).toHaveBeenCalledWith(file);
      });

      expect(notify.success).toHaveBeenCalledWith('Image uploaded successfully');
    });

    it('should reject invalid file type', async () => {
      const onUpload = vi.fn();
      render(<UserAvatar {...defaultProps} isEditMode={true} onUpload={onUpload} />);

      const file = new File(['test'], 'document.pdf', { type: 'application/pdf' });
      const fileInput = screen.getByLabelText('Upload profile picture');

      // Use fireEvent to bypass the accept attribute validation
      Object.defineProperty(fileInput, 'files', { value: [file] });
      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(onUpload).not.toHaveBeenCalled();
        expect(notify.warning).toHaveBeenCalledWith('Please upload a valid image file (JPEG, PNG, GIF, or WebP)');
      });
    });

    it('should reject file larger than 5MB', async () => {
      const onUpload = vi.fn();
      render(<UserAvatar {...defaultProps} isEditMode={true} onUpload={onUpload} />);

      // Create a file larger than 5MB
      const largeContent = new Array(6 * 1024 * 1024).fill('a').join('');
      const file = new File([largeContent], 'large.jpg', { type: 'image/jpeg' });
      const fileInput = screen.getByLabelText('Upload profile picture');

      await userEvent.upload(fileInput, file);

      expect(onUpload).not.toHaveBeenCalled();
      expect(notify.warning).toHaveBeenCalledWith('File size must be less than 5MB');
    });

    it('should handle upload error', async () => {
      const onUpload = vi.fn().mockRejectedValue(new Error('Upload failed'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(<UserAvatar {...defaultProps} isEditMode={true} onUpload={onUpload} />);

      const file = new File(['test'], 'avatar.jpg', { type: 'image/jpeg' });
      const fileInput = screen.getByLabelText('Upload profile picture');

      await userEvent.upload(fileInput, file);

      await waitFor(() => {
        expect(notify.error).toHaveBeenCalledWith('Failed to upload image. Please try again.');
      });

      consoleSpy.mockRestore();
    });

    it('should accept PNG files', async () => {
      const onUpload = vi.fn().mockResolvedValue(undefined);
      render(<UserAvatar {...defaultProps} isEditMode={true} onUpload={onUpload} />);

      const file = new File(['test'], 'avatar.png', { type: 'image/png' });
      const fileInput = screen.getByLabelText('Upload profile picture');

      await userEvent.upload(fileInput, file);

      await waitFor(() => {
        expect(onUpload).toHaveBeenCalledWith(file);
      });
    });

    it('should accept GIF files', async () => {
      const onUpload = vi.fn().mockResolvedValue(undefined);
      render(<UserAvatar {...defaultProps} isEditMode={true} onUpload={onUpload} />);

      const file = new File(['test'], 'avatar.gif', { type: 'image/gif' });
      const fileInput = screen.getByLabelText('Upload profile picture');

      await userEvent.upload(fileInput, file);

      await waitFor(() => {
        expect(onUpload).toHaveBeenCalledWith(file);
      });
    });

    it('should accept WebP files', async () => {
      const onUpload = vi.fn().mockResolvedValue(undefined);
      render(<UserAvatar {...defaultProps} isEditMode={true} onUpload={onUpload} />);

      const file = new File(['test'], 'avatar.webp', { type: 'image/webp' });
      const fileInput = screen.getByLabelText('Upload profile picture');

      await userEvent.upload(fileInput, file);

      await waitFor(() => {
        expect(onUpload).toHaveBeenCalledWith(file);
      });
    });
  });

  describe('No File Selected', () => {
    it('should do nothing when no file is selected', async () => {
      const onUpload = vi.fn();
      render(<UserAvatar {...defaultProps} isEditMode={true} onUpload={onUpload} />);

      const fileInput = screen.getByLabelText('Upload profile picture');

      // Simulate change event with no files
      fireEvent.change(fileInput, { target: { files: [] } });

      expect(onUpload).not.toHaveBeenCalled();
      expect(notify.warning).not.toHaveBeenCalled();
    });
  });
});
