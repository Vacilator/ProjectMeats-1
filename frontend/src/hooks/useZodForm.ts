/**
 * useZodForm
 *
 * Canonical React Hook Form + Zod wiring.
 * Keeps form setup DRY and consistent across the app.
 */

import { useForm } from 'react-hook-form';
import type { UseFormProps, UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';

export const useZodForm = <TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  formProps?: Omit<UseFormProps<z.infer<TSchema>>, 'resolver'>
): UseFormReturn<z.infer<TSchema>> => {
  return useForm<z.infer<TSchema>>({
    resolver: zodResolver(schema),
    ...(formProps || {}),
  });
};
