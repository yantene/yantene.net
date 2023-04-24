type JSONObject = { [key: string]: JSONValue | undefined };
type JSONArray = JSONValue[];

export type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONObject
  | JSONArray;
