import { describe, expect, it, vi } from "vitest";
import { ReactionNotificationService, type ReactionNotice } from "./reaction-notification.service";
import type { IMailer, MailMessage } from "~/backend/domain/auth";
import { EmailAddress } from "~/backend/domain/auth";
import type { INotificationQuotaCommandRepository } from "~/backend/domain/notification";
import type { ILogger } from "~/backend/domain/shared";

const ADMIN = EmailAddress.create("admin@example.com");

const NOTICE: ReactionNotice = {
  articleTitle: "Alpha",
  articleUrl: "https://yantene.net/articles/alpha",
  emoji: "❤️",
  previous: undefined,
  reactions: [{ emoji: "❤️", count: 1 }],
  day: "2026-11-25",
};

function fakeLogger(): ILogger & { readonly warns: string[]; readonly errors: string[] } {
  const warns: string[] = [];
  const errors: string[] = [];
  const logger = {
    warns,
    errors,
    debug: () => {},
    info: () => {},
    warn: (message: string) => warns.push(message),
    error: (message: string) => errors.push(message),
    child: () => logger,
  };
  return logger;
}

interface Harness {
  readonly service: ReactionNotificationService;
  readonly sent: MailMessage[];
  readonly quota: INotificationQuotaCommandRepository;
  readonly logger: ReturnType<typeof fakeLogger>;
}

function setup(options: {
  readonly to?: EmailAddress | undefined;
  readonly quotaLeft?: number;
  readonly send?: (message: MailMessage) => Promise<void>;
}): Harness {
  const sent: MailMessage[] = [];
  let left = options.quotaLeft ?? 10;
  const quota: INotificationQuotaCommandRepository = {
    tryTake: vi.fn(async () => {
      if (left <= 0) return false;
      left -= 1;
      return true;
    }),
  };
  const mailer: IMailer = {
    send:
      options.send ??
      (async (message) => {
        sent.push(message);
      }),
  };
  const logger = fakeLogger();
  const service = new ReactionNotificationService({
    mailer,
    quota,
    to: "to" in options ? options.to : ADMIN,
    dailyLimit: 30,
    subjectPrefix: "",
    logger,
  });
  return { service, sent, quota, logger };
}

describe("ReactionNotificationService", () => {
  it("書き手に 1 通送る", async () => {
    const { service, sent } = setup({});

    await service.notify(NOTICE);

    expect(sent).toHaveLength(1);
    expect(sent[0]?.to.toString()).toBe("admin@example.com");
    expect(sent[0]?.subject).toBe("「Alpha」に ❤️ が付きました");
  });

  it("枠はその日の日付と上限で取る", async () => {
    const { service, quota } = setup({});

    await service.notify(NOTICE);

    expect(quota.tryTake).toHaveBeenCalledWith({
      channel: "reaction-mail",
      day: "2026-11-25",
      limit: 30,
    });
  });

  it("その日の枠を使い切っていたら送らず、記録を残す", async () => {
    const { service, sent, logger } = setup({ quotaLeft: 0 });

    await service.notify(NOTICE);

    expect(sent).toHaveLength(0);
    expect(logger.warns).toHaveLength(1);
  });

  it("送れなくても投げず、記録を残す", async () => {
    const { service, logger } = setup({
      send: async () => {
        throw new Error("boom");
      },
    });

    await expect(service.notify(NOTICE)).resolves.toBeUndefined();
    expect(logger.errors).toHaveLength(1);
  });

  it("枠を数えられなければ送らず、投げずに記録を残す", async () => {
    const { service, sent, quota, logger } = setup({});
    vi.mocked(quota.tryTake).mockRejectedValueOnce(new Error("D1 is down"));

    await expect(service.notify(NOTICE)).resolves.toBeUndefined();
    expect(sent).toHaveLength(0);
    expect(logger.errors).toHaveLength(1);
  });

  it("宛先が無ければ枠も取らずに何もしない", async () => {
    const { service, sent, quota, logger } = setup({ to: undefined });

    await service.notify(NOTICE);

    expect(sent).toHaveLength(0);
    expect(quota.tryTake).not.toHaveBeenCalled();
    expect(logger.warns).toHaveLength(1);
  });
});
