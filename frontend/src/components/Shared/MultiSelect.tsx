import React from 'react';

import SearchableSelect, { type SearchableSelectProps } from './SearchableSelect';
import { type MultiSelectProps } from './MultiSelectImpl';

export type { MultiSelectOption, MultiSelectProps } from './MultiSelectImpl';

export const MultiSelect: React.FC<MultiSelectProps> = (props) => {
  const consolidatedProps: SearchableSelectProps = { variant: 'multi', ...props };
  return <SearchableSelect {...consolidatedProps} />;
};

export default MultiSelect;
