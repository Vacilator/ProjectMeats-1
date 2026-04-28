export interface ChoiceOptionShape {
  value: string;
  label: string;
}

export const EMPTY_CHOICES: readonly ChoiceOptionShape[] = Object.freeze([]);
