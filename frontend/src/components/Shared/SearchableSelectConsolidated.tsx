import React from 'react';

import SearchableSelectEntity, { type SearchableSelectEntityProps } from './SearchableSelectEntity';
import LocalSearchableSelectImpl, { type LocalSearchableSelectProps } from './LocalSearchableSelectImpl';
import MultiSelectImpl, { type MultiSelectProps } from './MultiSelectImpl';

export type SearchableSelectVariant = 'entity' | 'api' | 'static' | 'local' | 'multi';

type EntityVariantProps = SearchableSelectEntityProps & {
  /**
   * Consolidated mode selector.
   * - entity/api: API-backed entity options (existing SearchableSelect behavior)
   * - static: static option set (no API)
   * - local: Fuse-based in-memory filtering (existing LocalSearchableSelect behavior)
   * - multi: AntD multi-select for string[] (existing MultiSelect behavior)
   */
  variant?: 'entity' | 'api';
};

export type SearchableSelectStaticOption = {
  value: string;
  label: string;
};

type StaticVariantProps = {
  variant: 'static';
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectStaticOption[];
  placeholder?: string;
  hasError?: boolean;
  disabled?: boolean;
  onBlur?: () => void;
};

type LocalVariantProps = LocalSearchableSelectProps & { variant: 'local' };

type MultiVariantProps = MultiSelectProps & { variant: 'multi' };

export type SearchableSelectProps = EntityVariantProps | StaticVariantProps | LocalVariantProps | MultiVariantProps;

export const SearchableSelectConsolidated: React.FC<SearchableSelectProps> = (props) => {
  if (props.variant === 'static') {
    const { variant, options, ...rest } = props;

    return (
      <SearchableSelectEntity
        entityType=""
        initialOptions={options}
        threshold={Number.POSITIVE_INFINITY}
        allowCreate={false}
        {...rest}
      />
    );
  }

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
