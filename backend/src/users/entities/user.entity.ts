import { Name } from "../value-objects/name.value-object";

export class User {
  #name: Name;

  constructor(name: Name) {
    this.#name = name;
  }
}
