export interface ISessionStore {
  create(userId: string): Promise<string>;
  get(sessionId: string): Promise<undefined | { userId: string }>;
  delete(sessionId: string): Promise<void>;
}
