/**
 * Types `this` inside an Alpine component's methods to include Alpine magic properties.
 */
export type AlpineComponent<T> = T &
  ThisType<
    T & {
      $root: HTMLElement;
      $el: HTMLElement;
      $refs: Record<string, HTMLElement>;
      $store: Record<string, unknown>;
      $nextTick: (cb: () => void) => void;
      $watch: (prop: string, cb: (value: unknown, oldValue: unknown) => void) => void;
    }
  >;
