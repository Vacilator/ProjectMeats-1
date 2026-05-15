/**
 * StableAntSelect — React #185-proof wrapper around AntD Select
 *
 * Problem: AntD Select's internal @rc-component/motion `useStatus` hook
 * calls setState whenever it detects prop changes. If a parent re-renders
 * and passes a new-but-equal `options` array, this creates an infinite
 * update loop → React error #185 (Maximum update depth exceeded).
 *
 * Solution:
 * 1. Deep-equality stabilise `options` via a ref so AntD never sees a
 *    new array reference unless the content actually changed.
 * 2. Stabilise callback props (`onChange`, `onSearch`, `onClear`) via
 *    refs so they always carry the latest closure but expose a fixed
 *    function identity to AntD.
 * 3. Wrap with React.memo as a belt-and-suspenders guard — the component
 *    will only re-render when *data* props genuinely differ.
 */

import React, { useRef, useCallback } from 'react';
import { Select } from 'antd';
import type { SelectProps } from 'antd';
import isEqual from 'lodash/isEqual';

/* ------------------------------------------------------------------ */
/*  Hooks                                                              */
/* ------------------------------------------------------------------ */

/** Return a referentially-stable value that only changes when deep-equal differs. */
function useDeepStable<T>(value: T): T {
  const ref = useRef(value);
  if (!isEqual(ref.current, value)) {
    ref.current = value;
  }
  return ref.current;
}

/** Return a stable function identity whose *implementation* always reflects the latest closure. */
function useStableFn<T extends ((...args: any[]) => any) | undefined>(fn: T): T {
  const ref = useRef(fn);
  ref.current = fn;
   
  const stable = useCallback((...args: any[]) => (ref.current as any)?.(...args), []);
  return (fn ? stable : undefined) as T;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const StableAntSelectInner = (props: SelectProps) => {
  const { options, onChange, onSearch, onClear, onSelect, onDeselect, ...rest } = props;

  const stableOptions = useDeepStable(options);
  const stableOnChange = useStableFn(onChange);
  const stableOnSearch = useStableFn(onSearch);
  const stableOnClear = useStableFn(onClear);
  const stableOnSelect = useStableFn(onSelect);
  const stableOnDeselect = useStableFn(onDeselect);

  return (
    <Select
      {...rest}
      options={stableOptions}
      onChange={stableOnChange}
      onSearch={stableOnSearch}
      onClear={stableOnClear}
      onSelect={stableOnSelect}
      onDeselect={stableOnDeselect}
    />
  );
};

StableAntSelectInner.displayName = 'StableAntSelect';

export const StableAntSelect = React.memo(StableAntSelectInner);
export default StableAntSelect;
