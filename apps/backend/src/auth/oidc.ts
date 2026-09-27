/**
 * Minimal abstraction over the OIDC provider so routes can be tested without a real Authentik.
 * Discovery is deferred (and retried after failure) so the backend boots even if Authentik is down.
 */
export interface OidcAuthorizationArtifacts { url: string; state: string; nonce: string; codeVerifier: string }
export interface OidcUserinfo {
  sub: string; email: string; name?: string; preferred_username?: string; groups: string[]; idToken?: string;
}
export interface OidcClient {
  authorizationUrl(): OidcAuthorizationArtifacts | Promise<OidcAuthorizationArtifacts>;
  exchange(input: { code: string; state: string; nonce: string; codeVerifier: string }): Promise<OidcUserinfo>;
  endSessionUrl?(opts?: { idTokenHint?: string; postLogoutRedirectUri?: string }): string | null | Promise<string | null>;
}
export interface OidcConfig { issuer: string; clientId: string; clientSecret: string; redirectUri: string; scopesExtra?: string[] }

type InnerClient = {
  authorizationUrl(): OidcAuthorizationArtifacts;
  exchange(input: { code: string; state: string; nonce: string; codeVerifier: string }): Promise<OidcUserinfo>;
  endSessionUrl(opts?: { idTokenHint?: string; postLogoutRedirectUri?: string }): string | null;
};

export function createOidcClient(config: OidcConfig): OidcClient {
  let clientPromise: Promise<InnerClient> | undefined;
  function getClient(): Promise<InnerClient> {
    if (!clientPromise) {
      clientPromise = buildClient(config);
      // A single Authentik blip during boot must not poison the client until restart.
      clientPromise.catch(() => { clientPromise = undefined; });
    }
    return clientPromise;
  }
  return {
    async authorizationUrl() { return (await getClient()).authorizationUrl(); },
    async exchange(input) { return (await getClient()).exchange(input); },
    async endSessionUrl(opts) {
      try { return (await getClient()).endSessionUrl(opts); } catch { return null; }
    },
  };
}

async function buildClient(config: OidcConfig): Promise<InnerClient> {
  const { Issuer, generators, custom } = await import('openid-client');
  // Authentik behind Cloudflare can take several seconds on token POSTs; the 3500ms default is too tight.
  custom.setHttpOptionsDefaults({ timeout: 10000 });
  const issuer = await Issuer.discover(config.issuer);
  const client = new issuer.Client({
    client_id: config.clientId, client_secret: config.clientSecret,
    redirect_uris: [config.redirectUri], response_types: ['code'],
  });
  const scope = ['openid', 'profile', 'email', ...(config.scopesExtra ?? ['goauthentik.io/providers/oauth2/scope-groups'])].join(' ');

  return {
    authorizationUrl() {
      const state = generators.state();
      const nonce = generators.nonce();
      const codeVerifier = generators.codeVerifier();
      const url = client.authorizationUrl({
        scope, state, nonce, code_challenge: generators.codeChallenge(codeVerifier), code_challenge_method: 'S256',
      });
      return { url, state, nonce, codeVerifier };
    },
    async exchange({ code, state, nonce, codeVerifier }) {
      const tokenSet = await client.callback(config.redirectUri, { code, state }, { state, nonce, code_verifier: codeVerifier });
      const userinfo = await client.userinfo(tokenSet.access_token ?? '');
      const groupsRaw = (userinfo as unknown as { groups?: unknown }).groups;
      const groups = Array.isArray(groupsRaw) ? groupsRaw.filter((g): g is string => typeof g === 'string') : [];
      return {
        sub: userinfo.sub,
        email: (userinfo.email ?? '') as string,
        name: userinfo.name as string | undefined,
        preferred_username: userinfo.preferred_username as string | undefined,
        groups,
        idToken: tokenSet.id_token,
      };
    },
    endSessionUrl(opts) {
      try {
        const params: Record<string, string> = {};
        if (opts?.idTokenHint) params.id_token_hint = opts.idTokenHint;
        if (opts?.postLogoutRedirectUri) params.post_logout_redirect_uri = opts.postLogoutRedirectUri;
        return client.endSessionUrl(Object.keys(params).length > 0 ? params : undefined);
      } catch { return null; }
    },
  };
}
