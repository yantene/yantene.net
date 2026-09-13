import type { Temporal } from "@js-temporal/polyfill";
import type { EmailAddress } from "./email-address.vo";

export interface ISignInTokenQueryRepository {
  /** そのアドレス宛に、まだ生きているリンクが何本あるか。 */
  countLiveFor(email: EmailAddress, at: Temporal.Instant): Promise<number>;
}
