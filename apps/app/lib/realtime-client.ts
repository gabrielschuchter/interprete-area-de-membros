"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

interface RealtimeConfig {
  readonly configured?: boolean;
  readonly publishableKey?: string;
  readonly url?: string;
}

interface RealtimeToken {
  readonly expiresAt: number;
  readonly memberId: string;
  readonly token: string;
}

let clientPromise: Promise<SupabaseClient> | undefined;
const tokenPromises = new Map<string, Promise<RealtimeToken>>();
const cachedTokens = new Map<string, RealtimeToken>();

const fetchRealtimeConfig = async (): Promise<RealtimeConfig> => {
  const response = await fetch("/api/notifications/realtime-config", {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error("Configuração Realtime indisponível.");
  }
  const config = (await response.json()) as RealtimeConfig;
  if (config.configured === false || !(config.url && config.publishableKey)) {
    throw new Error("Supabase Realtime não configurado.");
  }
  return config;
};

const getClient = (): Promise<SupabaseClient> => {
  if (!clientPromise) {
    const nextClientPromise = (async () => {
      const config = await fetchRealtimeConfig();
      const { createClient } = await import("@supabase/supabase-js");
      return createClient(
        config.url as string,
        config.publishableKey as string,
        {
          auth: { autoRefreshToken: false, persistSession: false },
        }
      );
    })().catch((error: unknown) => {
      clientPromise = undefined;
      throw error;
    });
    clientPromise = nextClientPromise;
    return nextClientPromise;
  }
  return clientPromise;
};

const loadToken = (
  memberId: string,
  forceRefresh: boolean
): Promise<RealtimeToken> => {
  const cachedToken = cachedTokens.get(memberId);
  if (
    !forceRefresh &&
    cachedToken &&
    cachedToken.expiresAt - Date.now() > 15_000
  ) {
    return Promise.resolve(cachedToken);
  }
  const existingTokenPromise = tokenPromises.get(memberId);
  if (existingTokenPromise) {
    return existingTokenPromise;
  }
  const nextTokenPromise = fetch("/api/notifications/realtime-token", {
    headers: { Accept: "application/json" },
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error("Realtime não emitiu um token válido.");
      }
      const token = (await response.json()) as Partial<RealtimeToken>;
      if (
        typeof token.token !== "string" ||
        typeof token.expiresAt !== "number" ||
        token.expiresAt <= Date.now() ||
        token.memberId !== memberId
      ) {
        throw new Error("Realtime não emitiu um token válido.");
      }
      const authenticatedToken = {
        expiresAt: token.expiresAt,
        memberId,
        token: token.token,
      };
      cachedTokens.set(memberId, authenticatedToken);
      return authenticatedToken;
    })
    .finally(() => {
      tokenPromises.delete(memberId);
    });
  tokenPromises.set(memberId, nextTokenPromise);
  return nextTokenPromise;
};

export const getAuthenticatedRealtimeClient = async (memberId: string) => {
  const [client, token] = await Promise.all([
    getClient(),
    loadToken(memberId, false),
  ]);
  await client.realtime.setAuth(token.token);
  return { client, expiresAt: token.expiresAt };
};

export const refreshRealtimeAuth = async (memberId: string) => {
  const client = await getClient();
  const token = await loadToken(memberId, true);
  await client.realtime.setAuth(token.token);
  return token.expiresAt;
};
