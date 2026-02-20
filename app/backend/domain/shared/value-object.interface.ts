export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | IJsonObject | IJsonArray;
export interface IJsonObject {
  [key: string]: JsonValue;
}
export type IJsonArray = JsonValue[];

export interface IValueObject<T> {
  equals(other: T): boolean;
  toJSON(): JsonValue;
}
