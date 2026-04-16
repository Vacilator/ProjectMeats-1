import React from 'react';

import SearchableSelectEntity, { type SearchableSelectEntityProps } from './SearchableSelectEntity';
import LocalSearchableSelectImpl, { type LocalSearchableSelectProps } from './LocalSearchableSelectImpl';
import MultiSelectImpl, { type MultiSelectProps } from './MultiSelectImpl';

export type SearchableSelectVariant = 'entity' | 'api' | 'static' | 'local' | 'multi';

type EntityVariantProps = SearchableSelectEntityProps & {
  /**
   * Consolidated mode selector.
   * - entity/api/static: API-backed entity options (existing SearchableSelect behavior)
   * - local: Fuse-based in-memory filtering (existing LocalSearchableSelect behavior)
   * - multi: AntD multi-select for string[] (existing MultiSelect behavior)
   */
  variant?: 'entity' | 'api' | 'static';
};

type LocalVariantProps = LocalSearchableSelectProps & { variant: 'local' };

type MultiVariantProps = MultiSelectProps & { variant: 'multi' };

export type SearchableSelectProps = EntityVariantProps | LocalVariantProps | MultiVariantProps;

export const SearchableSelectConsolidated: React.FC<SearchableSelectProps> = (props) => {
  if (props.variant === 'local') {
    const { variant, ...rest } = props;
    return <LocalSearchableSelectImpl {...rest} />;
  }

  if (props.variant === 'multi') {
    const { variant, ...rest } = props;
    return <MultiSelectImpl {...rest} />;
  }

  const { variant, ...rest } = props as EntityVariantProps;
  return <SearchableSelectEntity {...rest} />;
};

export default SearchableSelectConsolidated;
