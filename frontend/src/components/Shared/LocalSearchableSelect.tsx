import React from 'react';

import SearchableSelect, { type SearchableSelectProps } from './SearchableSelect';
import { type LocalSearchableSelectProps } from './LocalSearchableSelectImpl';

export type { LocalSearchableSelectProps, SearchableSelectOption } from './LocalSearchableSelectImpl';

export const LocalSearchableSelect: React.FC<LocalSearchableSelectProps> = (props) => {
  const consolidatedProps: SearchableSelectProps = { variant: 'local', ...props };
  return <SearchableSelect {...consolidatedProps} />;
};

export default LocalSearchableSelect;
