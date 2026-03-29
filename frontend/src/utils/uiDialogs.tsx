import React from 'react';
import { Input, Modal } from 'antd';

type AlertType = 'info' | 'success' | 'warning' | 'error';

export function showAlert(options: {
  title: React.ReactNode;
  content: React.ReactNode;
  type?: AlertType;
}): void {
  const { type = 'info', title, content } = options;

  const fn =
    type === 'success'
      ? Modal.success
      : type === 'warning'
        ? Modal.warning
        : type === 'error'
          ? Modal.error
          : Modal.info;

  fn({
    title,
    content,
    centered: true,
  });
}

export function confirmDialog(options: {
  title: React.ReactNode;
  content: React.ReactNode;
  okText?: string;
  cancelText?: string;
  danger?: boolean;
}): Promise<boolean> {
  const { title, content, okText, cancelText, danger } = options;

  return new Promise((resolve) => {
    Modal.confirm({
      title,
      content,
      centered: true,
      okText: okText ?? 'Confirm',
      cancelText: cancelText ?? 'Cancel',
      okButtonProps: danger ? { danger: true } : undefined,
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    });
  });
}

export function promptDialog(options: {
  title: React.ReactNode;
  defaultValue?: string;
  placeholder?: string;
  okText?: string;
  cancelText?: string;
}): Promise<string | null> {
  const { title, defaultValue, placeholder, okText, cancelText } = options;

  return new Promise((resolve) => {
    let value = defaultValue ?? '';

    Modal.confirm({
      title,
      centered: true,
      okText: okText ?? 'OK',
      cancelText: cancelText ?? 'Cancel',
      content: (
        <Input
          autoFocus
          defaultValue={value}
          placeholder={placeholder}
          onChange={(e) => {
            value = e.target.value;
          }}
        />
      ),
      onOk: () => resolve(value),
      onCancel: () => resolve(null),
    });
  });
}
