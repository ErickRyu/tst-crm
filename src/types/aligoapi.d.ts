declare module "aligoapi" {
  interface ReqLike {
    headers: Record<string, string>;
    body: Record<string, unknown>;
  }

  interface AuthData {
    key: string;
    user_id: string;
    testmode_yn?: string;
  }

  function send(req: ReqLike, auth: AuthData): Promise<Record<string, unknown>>;
  function sendMass(req: ReqLike, auth: AuthData): Promise<Record<string, unknown>>;
  function list(req: ReqLike, auth: AuthData): Promise<Record<string, unknown>>;
  function smsList(req: ReqLike, auth: AuthData): Promise<Record<string, unknown>>;
  function remain(req: ReqLike, auth: AuthData): Promise<Record<string, unknown>>;
  function cancel(req: ReqLike, auth: AuthData): Promise<Record<string, unknown>>;

  export { send, sendMass, list, smsList, remain, cancel };
}
