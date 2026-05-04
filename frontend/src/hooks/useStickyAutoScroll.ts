import { DependencyList, useCallback, useEffect, useRef } from 'react';

export const useStickyAutoScroll = <T extends HTMLElement>(
  dependencies: DependencyList,
  threshold = 72,
) => {
  const containerRef = useRef<T | null>(null);
  const shouldStickRef = useRef(true);

  const updateStickiness = useCallback(() => {
    const node = containerRef.current;
    if (!node) {
      return;
    }

    const distanceFromBottom = node.scrollHeight - node.scrollTop - node.clientHeight;
    shouldStickRef.current = distanceFromBottom <= threshold;
  }, [threshold]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    const node = containerRef.current;
    if (!node) {
      return;
    }

    shouldStickRef.current = true;
    if (typeof node.scrollTo === 'function') {
      node.scrollTo({ top: node.scrollHeight, behavior });
      return;
    }

    node.scrollTop = node.scrollHeight;
  }, []);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) {
      return;
    }

    updateStickiness();
    node.addEventListener('scroll', updateStickiness, { passive: true });
    return () => node.removeEventListener('scroll', updateStickiness);
  }, [updateStickiness]);

  useEffect(() => {
    if (!shouldStickRef.current) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      scrollToBottom('auto');
    });
    return () => window.cancelAnimationFrame(frame);
  }, [scrollToBottom, ...dependencies]);

  return {
    containerRef,
    scrollToBottom,
  };
};
