/**
 * useZodForm
 *
 * Canonical React Hook Form + Zod wiring.
 * Keeps form setup DRY and consistent across the app.
 */

import { useForm } from 'react-hook-form';
import type { FieldValues, UseFormProps, UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';

export const useZodForm = <TFieldValues extends FieldValues>(
  schema: z.ZodTypeAny,
  formProps?: Omit<UseFormProps<TFieldValues>, 'resolver'>
): UseFormReturn<TFieldValues> => {
  return useForm<TFieldValues>({
    resolver: zodResolver(schema as any) as any,
    ...(formProps || {}),
  });
};
