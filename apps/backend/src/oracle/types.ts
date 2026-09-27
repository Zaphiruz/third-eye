export interface OracleRequest { system: string; user: string; schema: Record<string, unknown> }
export interface OracleResponse { text: string; model: string; stopReason: string | null }
/** The only door to the language model. Production: Anthropic. Tests: FakeOracleClient. */
export interface OracleClient { complete(req: OracleRequest): Promise<OracleResponse> }
