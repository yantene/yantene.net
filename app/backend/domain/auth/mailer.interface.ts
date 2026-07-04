export interface IMailer {
  send(params: { to: string; subject: string; body: string }): Promise<void>;
}
