import type { IValueObject } from "~/backend/domain/shared";

const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_ALTERNATE_NAMES = 20;

export class InvalidProfileIdentityError extends Error {
  readonly name = "InvalidProfileIdentityError";
}

export interface ProfileIdentityFields {
  /** 英語での名前。画面では本名の後ろに括弧で添える。 */
  readonly nameEn?: string;
  readonly familyName?: string;
  readonly givenName?: string;
  /** 別名 (ハンドルネームと、実際に使っている別の表記)。書いた順。 */
  readonly alternateNames?: readonly string[];
  /** 肩書き。1 行。 */
  readonly jobTitle?: string;
  /** 検索エンジンと AI 向けの説明文。三人称で「何者か」を言う。`tagline` とは別物。 */
  readonly description?: string;
  readonly descriptionEn?: string;
}

/**
 * 書き手が機械 (検索エンジンと AI) に名乗るための、名前まわりの欄。
 *
 * 本名 (`ProfileName`) と短い自己紹介 (`Tagline`) は読み手に見せる主役で、省略できない。
 * こちらは**どれも省略できる**添え物で、英語名を除いて画面には出ない。まとめて 1 つの
 * 値にしてあるのは、足し引きのたびにエンティティの欄を 7 つ動かさないため。
 *
 * ⚠️ **経歴はここに入れない。** 学歴・生年月日・出身地・所属は、機械に名乗る身元の
 * 一部にしない (ADR 0044 / #508)。入れるのは「この人を何と呼ぶか」と「何者か」まで。
 */
export class ProfileIdentity implements IValueObject<ProfileIdentity> {
  private constructor(private readonly fields: Required<ProfileIdentityFields>) {}

  /** 何も書いていないプロフィールのもの。 */
  static empty(): ProfileIdentity {
    return ProfileIdentity.create({});
  }

  static create(raw: ProfileIdentityFields): ProfileIdentity {
    const alternateNames = (raw.alternateNames ?? []).map((name) => line(name, "alternateNames"));
    if (alternateNames.length > MAX_ALTERNATE_NAMES) {
      throw new InvalidProfileIdentityError(
        `Profile may list at most ${String(MAX_ALTERNATE_NAMES)} alternate names`,
      );
    }
    if (new Set(alternateNames).size !== alternateNames.length) {
      throw new InvalidProfileIdentityError("Profile lists the same alternate name twice");
    }

    return new ProfileIdentity({
      nameEn: optionalLine(raw.nameEn, "nameEn"),
      familyName: optionalLine(raw.familyName, "familyName"),
      givenName: optionalLine(raw.givenName, "givenName"),
      alternateNames,
      jobTitle: optionalLine(raw.jobTitle, "jobTitle"),
      description: optionalLine(raw.description, "description", MAX_DESCRIPTION_LENGTH),
      descriptionEn: optionalLine(raw.descriptionEn, "descriptionEn", MAX_DESCRIPTION_LENGTH),
    });
  }

  /** 書いていなければ空文字ではなく undefined を返す (下の getter はどれも同じ)。 */
  get nameEn(): string | undefined {
    return present(this.fields.nameEn);
  }

  get familyName(): string | undefined {
    return present(this.fields.familyName);
  }

  get givenName(): string | undefined {
    return present(this.fields.givenName);
  }

  get alternateNames(): readonly string[] {
    return this.fields.alternateNames;
  }

  get jobTitle(): string | undefined {
    return present(this.fields.jobTitle);
  }

  get description(): string | undefined {
    return present(this.fields.description);
  }

  get descriptionEn(): string | undefined {
    return present(this.fields.descriptionEn);
  }

  equals(other: ProfileIdentity): boolean {
    return JSON.stringify(this.toJSON()) === JSON.stringify(other.toJSON());
  }

  toJSON(): ProfileIdentityFields {
    return {
      ...(this.nameEn === undefined ? {} : { nameEn: this.nameEn }),
      ...(this.familyName === undefined ? {} : { familyName: this.familyName }),
      ...(this.givenName === undefined ? {} : { givenName: this.givenName }),
      alternateNames: this.alternateNames,
      ...(this.jobTitle === undefined ? {} : { jobTitle: this.jobTitle }),
      ...(this.description === undefined ? {} : { description: this.description }),
      ...(this.descriptionEn === undefined ? {} : { descriptionEn: this.descriptionEn }),
    };
  }
}

/** 中では「書いていない」を空文字で持つ。外へは undefined で出す。 */
function present(value: string): string | undefined {
  return value === "" ? undefined : value;
}

function optionalLine(raw: string | undefined, field: string, max = MAX_NAME_LENGTH): string {
  return raw === undefined ? "" : line(raw, field, max);
}

/**
 * 1 行の値。前後の空白を落とし、空・長すぎ・改行入りを弾く。
 *
 * 改行を弾くのは、どの欄も JSON-LD の 1 つの値や `<title>` にそのまま入るため。
 */
function line(raw: string, field: string, max = MAX_NAME_LENGTH): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > max) {
    throw new InvalidProfileIdentityError(
      `Profile ${field} must be 1..${String(max)} characters long`,
    );
  }
  if (/[\n\r]/.test(trimmed)) {
    throw new InvalidProfileIdentityError(`Profile ${field} must be a single line`);
  }
  return trimmed;
}
