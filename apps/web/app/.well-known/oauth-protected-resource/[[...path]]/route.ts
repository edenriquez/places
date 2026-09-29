import { metadataCorsOptionsRequestHandler, protectedResourceHandler } from "mcp-handler";

// RFC 9728: le dice a ChatGPT/Claude que /api/mcp se autoriza con el servidor OAuth de Supabase Auth.
// Responde en la raíz y con sufijo (/.well-known/oauth-protected-resource/api/mcp); el recurso sale del sufijo.
const handler = protectedResourceHandler({
  authServerUrls: [`${process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, "")}/auth/v1`],
});

const options = metadataCorsOptionsRequestHandler();

export { handler as GET, options as OPTIONS };
