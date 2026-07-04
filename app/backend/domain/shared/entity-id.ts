declare const brand: unique symbol;
export type EntityId<T extends string> = string & { readonly [brand]: T };

export function entityId<T extends string>(value: string): EntityId<T> {
  return value as EntityId<T>;
}
