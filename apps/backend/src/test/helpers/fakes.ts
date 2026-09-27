import type { OidcClient, OidcUserinfo } from '../../auth/oidc.js';
import type { OracleClient, OracleRequest, OracleResponse } from '../../oracle/types.js';

export class FakeOidcClient implements OidcClient {
  userinfo: OidcUserinfo = { sub: 'sub-0', email: 'fake@example.com', name: 'Fake', groups: [], idToken: 'idt' };
  authorizationUrl() {
    return { url: 'https://auth.example/authorize', state: 'state-0', nonce: 'nonce-0', codeVerifier: 'cv-0' };
  }
  async exchange() { return this.userinfo; }
  endSessionUrl() { return 'https://auth.example/logout'; }
}

type Scripted = OracleResponse | Error | ((req: OracleRequest) => OracleResponse);

/** Answers every method in the request's schema with valid JSON. */
export function autoAnswer(req: OracleRequest): OracleResponse {
  const methods = (req.schema as any).properties.readings.required as string[];
  return {
    text: JSON.stringify({ summary: 'The stars are kind today.', readings: Object.fromEntries(methods.map((m) => [m, `A reading for ${m}.`])) }),
    model: 'fake-model',
    stopReason: 'end_turn',
  };
}

export class FakeOracleClient implements OracleClient {
  requests: OracleRequest[] = [];
  private script: Scripted[] = [];
  private gate: Promise<void> | null = null;

  /** Queue responses/errors for the next calls; after the queue drains, calls get autoAnswer. */
  enqueue(...items: Scripted[]): void { this.script.push(...items); }

  /** Make calls block until the returned release() is called. */
  hold(): () => void {
    let release!: () => void;
    this.gate = new Promise<void>((r) => { release = r; });
    return () => { this.gate = null; release(); };
  }

  async complete(req: OracleRequest): Promise<OracleResponse> {
    this.requests.push(req);
    if (this.gate) await this.gate;
    const next = this.script.shift();
    if (next === undefined) return autoAnswer(req);
    if (next instanceof Error) throw next;
    return typeof next === 'function' ? next(req) : next;
  }
}

export const silentLog = { info: () => {}, warn: () => {}, error: () => {} };
