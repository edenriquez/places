import { createMcpHandler, withMcpAuth } from "mcp-handler";
import type { AuthInfo } from "@modelcontextprotocol/server";
import { registerTools, userClient } from "@/lib/mcp";

/**
 * MCP remoto (Streamable HTTP) para ChatGPT/Claude. El token es un access token OAuth emitido por
 * el servidor OAuth 2.1 de Supabase Auth; el consentimiento se da en /oauth/consent. Solo admins.
 */
const handler = createMcpHandler(registerTools, {
  serverInfo: { name: "entrelugares", version: "1.0.0" },
  instructions:
    "Captura de eventos culturales de municipios de México para entrelugares. " +
    "Flujo: buscar_municipio → buscar_lugar → buscar_duplicados → crear_evento (con el flyer si lo tienes). " +
    "Todo queda pendiente de revisión; no inventes datos que no estén en el flyer o el post.",
});

async function verifyToken(_req: Request, token?: string): Promise<AuthInfo | undefined> {
  if (!token) return undefined;
  const sb = userClient(token);
  const { data, error } = await sb.auth.getClaims(token);
  if (error || !data) return undefined;
  const { data: isAdmin } = await sb.rpc("is_admin");
  if (!isAdmin) return undefined;
  const claims = data.claims as { sub: string; exp?: number; client_id?: string };
  return { token, clientId: claims.client_id ?? "supabase", scopes: [], expiresAt: claims.exp, extra: { userId: claims.sub } };
}

const authed = withMcpAuth(handler, verifyToken, {
  required: true,
  resourceMetadataPath: "/.well-known/oauth-protected-resource/api/mcp",
});

export { authed as GET, authed as POST, authed as DELETE };
