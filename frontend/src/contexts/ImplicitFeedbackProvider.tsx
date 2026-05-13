/**
 * ImplicitFeedbackProvider — Mounts useImplicitFeedback at app root.
 *
 * Provides trackEvent() via context to the entire app.
 * ZERO UI — completely invisible.
 */

import React from 'react';
import {
  useImplicitFeedback,
  ImplicitFeedbackContext,
} from '../hooks/useImplicitFeedback';

export const ImplicitFeedbackProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { trackEvent } = useImplicitFeedback();

  return (
    <ImplicitFeedbackContext.Provider value={{ trackEvent }}>
      {children}
    </ImplicitFeedbackContext.Provider>
  );
};
