import React, { createContext, useContext } from 'react';
import type { WidgetConfig } from './WidgetGrid';

export interface WidgetInstanceContextValue {
  widget: WidgetConfig;
  onPinWidget?: (widget: WidgetConfig) => void;
}

const WidgetInstanceContext = createContext<WidgetInstanceContextValue | undefined>(undefined);

export const useWidgetInstance = () => useContext(WidgetInstanceContext);

export const WidgetInstanceProvider: React.FC<{
  widget: WidgetConfig;
  onPinWidget?: (widget: WidgetConfig) => void;
  children: React.ReactNode;
}> = ({ widget, onPinWidget, children }) => {
  return (
    <WidgetInstanceContext.Provider value={{ widget, onPinWidget }}>
      {children}
    </WidgetInstanceContext.Provider>
  );
};
