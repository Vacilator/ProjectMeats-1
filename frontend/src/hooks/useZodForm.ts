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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- zodResolver generics don't align with react-hook-form's
  return useForm<TFieldValues>({
    resolver: zodResolver(schema as never) as never,
    ...(formProps || {}),
  });
};
