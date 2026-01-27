import { Temporal } from "@js-temporal/polyfill";
import { describe, expect, it } from "vitest";
import { Click } from "./click.entity";

describe("Click Entity", () => {
  describe("create()", () => {
    it("should create unpersisted entity with timestamp", () => {
      const timestamp = Date.now();
      const click = Click.create({ timestamp });

      expect(click.id).toBeUndefined();
      expect(click.timestamp).toBe(timestamp);
      expect(click.createdAt).toBeUndefined();
      expect(click.updatedAt).toBeUndefined();
    });
  });

  describe("reconstruct()", () => {
    it("should reconstruct persisted entity from database data", () => {
      const id = "test-uuid";
      const timestamp = Date.now();
      const createdAt = Temporal.Now.instant();
      const updatedAt = Temporal.Now.instant();

      const click = Click.reconstruct({
        id,
        timestamp,
        createdAt,
        updatedAt,
      });

      expect(click.id).toBe(id);
      expect(click.timestamp).toBe(timestamp);
      expect(click.createdAt).toBe(createdAt);
      expect(click.updatedAt).toBe(updatedAt);
    });
  });

  describe("equals()", () => {
    it("should return true for entities with same id", () => {
      const id = "test-uuid";
      const timestamp = Date.now();
      const instant = Temporal.Now.instant();

      const click1 = Click.reconstruct({
        id,
        timestamp,
        createdAt: instant,
        updatedAt: instant,
      });
      const click2 = Click.reconstruct({
        id,
        timestamp: timestamp + 1000,
        createdAt: instant,
        updatedAt: instant,
      });

      expect(click1.equals(click2)).toBe(true);
    });

    it("should return false for different unpersisted entities", () => {
      const timestamp = Date.now();
      const click1 = Click.create({ timestamp });
      const click2 = Click.create({ timestamp });

      expect(click1.equals(click2)).toBe(false);
    });

    it("should return true for the same unpersisted entity reference", () => {
      const click = Click.create({ timestamp: Date.now() });

      expect(click.equals(click)).toBe(true);
    });

    it("should return false for entities with different id", () => {
      const timestamp = Date.now();
      const instant = Temporal.Now.instant();

      const click1 = Click.reconstruct({
        id: "uuid-1",
        timestamp,
        createdAt: instant,
        updatedAt: instant,
      });
      const click2 = Click.reconstruct({
        id: "uuid-2",
        timestamp,
        createdAt: instant,
        updatedAt: instant,
      });

      expect(click1.equals(click2)).toBe(false);
    });
  });

  describe("toJSON()", () => {
    it("should convert persisted entity to plain object", () => {
      const id = "test-uuid";
      const timestamp = Date.now();
      const createdAt = Temporal.Now.instant();
      const updatedAt = Temporal.Now.instant();

      const click = Click.reconstruct({
        id,
        timestamp,
        createdAt,
        updatedAt,
      });

      const json = click.toJSON();

      expect(json.id).toBe(id);
      expect(json.timestamp).toBe(timestamp);
      expect(json.createdAt).toBe(createdAt.toString());
      expect(json.updatedAt).toBe(updatedAt.toString());
    });

    it("should handle undefined fields in unpersisted entity", () => {
      const timestamp = Date.now();
      const click = Click.create({ timestamp });

      const json = click.toJSON();

      expect(json.id).toBeUndefined();
      expect(json.timestamp).toBe(timestamp);
      expect(json.createdAt).toBeUndefined();
      expect(json.updatedAt).toBeUndefined();
    });
  });
});
