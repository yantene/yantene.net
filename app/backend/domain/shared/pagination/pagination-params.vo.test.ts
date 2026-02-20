import { describe, expect, it } from "vitest";
import {
  PaginationParams,
  PaginationValidationError,
} from "./pagination-params.vo";

describe("PaginationParams", () => {
  describe("デフォルト値", () => {
    it("page と perPage が未指定の場合、デフォルト値 (page: 1, perPage: 20) を適用する", () => {
      const params = PaginationParams.create({});

      expect(params.page).toBe(1);
      expect(params.perPage).toBe(20);
    });

    it("page のみ指定された場合、perPage にデフォルト値を適用する", () => {
      const params = PaginationParams.create({ page: "3" });

      expect(params.page).toBe(3);
      expect(params.perPage).toBe(20);
    });

    it("perPage のみ指定された場合、page にデフォルト値を適用する", () => {
      const params = PaginationParams.create({ perPage: "50" });

      expect(params.page).toBe(1);
      expect(params.perPage).toBe(50);
    });
  });

  describe("正常なパラメータ", () => {
    it("page と perPage の両方が正の整数文字列の場合、正しく変換する", () => {
      const params = PaginationParams.create({ page: "2", perPage: "10" });

      expect(params.page).toBe(2);
      expect(params.perPage).toBe(10);
    });

    it("perPage が最大値 (100) の場合、正しく変換する", () => {
      const params = PaginationParams.create({ perPage: "100" });

      expect(params.perPage).toBe(100);
    });

    it("perPage が 1 の場合、正しく変換する", () => {
      const params = PaginationParams.create({ perPage: "1" });

      expect(params.perPage).toBe(1);
    });
  });

  describe("offset 計算", () => {
    it("page=1, perPage=20 の場合、offset は 0 を返す", () => {
      const params = PaginationParams.create({ page: "1", perPage: "20" });

      expect(params.offset).toBe(0);
    });

    it("page=2, perPage=20 の場合、offset は 20 を返す", () => {
      const params = PaginationParams.create({ page: "2", perPage: "20" });

      expect(params.offset).toBe(20);
    });

    it("page=3, perPage=10 の場合、offset は 20 を返す", () => {
      const params = PaginationParams.create({ page: "3", perPage: "10" });

      expect(params.offset).toBe(20);
    });

    it("page=5, perPage=50 の場合、offset は 200 を返す", () => {
      const params = PaginationParams.create({ page: "5", perPage: "50" });

      expect(params.offset).toBe(200);
    });
  });

  describe("定数", () => {
    it("DEFAULT_PAGE は 1 である", () => {
      expect(PaginationParams.DEFAULT_PAGE).toBe(1);
    });

    it("DEFAULT_PER_PAGE は 20 である", () => {
      expect(PaginationParams.DEFAULT_PER_PAGE).toBe(20);
    });

    it("MAX_PER_PAGE は 100 である", () => {
      expect(PaginationParams.MAX_PER_PAGE).toBe(100);
    });
  });

  describe("page のバリデーションエラー", () => {
    it("page が非数値文字列の場合、PaginationValidationError をスローする", () => {
      expect(() => PaginationParams.create({ page: "abc" })).toThrow(
        PaginationValidationError,
      );
    });

    it("page が 0 の場合、PaginationValidationError をスローする", () => {
      expect(() => PaginationParams.create({ page: "0" })).toThrow(
        PaginationValidationError,
      );
    });

    it("page が負数の場合、PaginationValidationError をスローする", () => {
      expect(() => PaginationParams.create({ page: "-1" })).toThrow(
        PaginationValidationError,
      );
    });

    it("page が小数の場合、PaginationValidationError をスローする", () => {
      expect(() => PaginationParams.create({ page: "1.5" })).toThrow(
        PaginationValidationError,
      );
    });

    it("page のバリデーションエラーのフィールド名は 'page' である", () => {
      try {
        PaginationParams.create({ page: "abc" });
        expect.fail("should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(PaginationValidationError);
        expect((error as PaginationValidationError).field).toBe("page");
      }
    });

    it("page のバリデーションエラーの reason に 'positive integer' を含む", () => {
      try {
        PaginationParams.create({ page: "-1" });
        expect.fail("should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(PaginationValidationError);
        expect((error as PaginationValidationError).reason).toContain(
          "positive integer",
        );
      }
    });
  });

  describe("perPage のバリデーションエラー", () => {
    it("perPage が非数値文字列の場合、PaginationValidationError をスローする", () => {
      expect(() => PaginationParams.create({ perPage: "abc" })).toThrow(
        PaginationValidationError,
      );
    });

    it("perPage が 0 の場合、PaginationValidationError をスローする", () => {
      expect(() => PaginationParams.create({ perPage: "0" })).toThrow(
        PaginationValidationError,
      );
    });

    it("perPage が負数の場合、PaginationValidationError をスローする", () => {
      expect(() => PaginationParams.create({ perPage: "-5" })).toThrow(
        PaginationValidationError,
      );
    });

    it("perPage が小数の場合、PaginationValidationError をスローする", () => {
      expect(() => PaginationParams.create({ perPage: "2.5" })).toThrow(
        PaginationValidationError,
      );
    });

    it("perPage が最大値 (100) を超える場合、PaginationValidationError をスローする", () => {
      expect(() => PaginationParams.create({ perPage: "101" })).toThrow(
        PaginationValidationError,
      );
    });

    it("perPage のバリデーションエラーのフィールド名は 'perPage' である", () => {
      try {
        PaginationParams.create({ perPage: "abc" });
        expect.fail("should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(PaginationValidationError);
        expect((error as PaginationValidationError).field).toBe("perPage");
      }
    });

    it("perPage が正の整数でない場合の reason に 'positive integer' を含む", () => {
      try {
        PaginationParams.create({ perPage: "-1" });
        expect.fail("should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(PaginationValidationError);
        expect((error as PaginationValidationError).reason).toContain(
          "positive integer",
        );
      }
    });

    it("perPage が最大値を超過した場合の reason に 'must not exceed 100' を含む", () => {
      try {
        PaginationParams.create({ perPage: "200" });
        expect.fail("should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(PaginationValidationError);
        expect((error as PaginationValidationError).reason).toContain(
          "must not exceed 100",
        );
      }
    });
  });
});

describe("PaginationValidationError", () => {
  it("Error を継承している", () => {
    const error = new PaginationValidationError("page", "must be positive");

    expect(error).toBeInstanceOf(Error);
  });

  it("field と reason を保持する", () => {
    const error = new PaginationValidationError(
      "perPage",
      "must not exceed 100",
    );

    expect(error.field).toBe("perPage");
    expect(error.reason).toBe("must not exceed 100");
  });

  it("name は 'PaginationValidationError' である", () => {
    const error = new PaginationValidationError("page", "test");

    expect(error.name).toBe("PaginationValidationError");
  });

  it("message にフィールド名と理由を含む", () => {
    const error = new PaginationValidationError(
      "page",
      "must be a positive integer",
    );

    expect(error.message).toContain("page");
    expect(error.message).toContain("must be a positive integer");
  });
});
