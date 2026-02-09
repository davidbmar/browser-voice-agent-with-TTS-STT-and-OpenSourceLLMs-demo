/**
 * handler.ts — AWS Lambda search proxy with cascading providers.
 *
 * Cascade order: Google Custom Search (100 free/day) → Brave (2K free/month) → Tavily (1K free/month).
 * DynamoDB tracks per-provider usage to avoid burning quota on requests that will fail.
 *
 * Endpoints:
 *   POST /search  — { query, maxResults? } → { query, results[], durationMs, provider, quota }
 *   GET  /quota   — → { quota }
 *   OPTIONS *     — CORS preflight
 *
 * Environment variables:
 *   GOOGLE_CSE_API_KEY, GOOGLE_CSE_CX — Google Custom Search
 *   BRAVE_API_KEY                     — Brave Search
 *   TAVILY_API_KEY                    — Tavily
 *   ALLOWED_ORIGIN                    — CORS origin (e.g. https://dmpt2ecfvyptf.cloudfront.net)
 *   QUOTA_TABLE                       — DynamoDB table name
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient, GetItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  publishedDate?: string;
}

interface ProviderQuota {
  used: number;
  limit: number;
  period: string;
}

interface QuotaInfo {
  google: ProviderQuota;
  brave: ProviderQuota;
  tavily: ProviderQuota;
}

interface ProviderConfig {
  name: string;
  quotaKey: string;
  limit: number;
  periodFn: () => string;
  search: (query: string, maxResults: number) => Promise<SearchResult[]>;
}

// ---------------------------------------------------------------------------
// DynamoDB client
// ---------------------------------------------------------------------------

const ddb = new DynamoDBClient({});
const QUOTA_TABLE = process.env.QUOTA_TABLE || "search-proxy-quota";

async function getQuotaCount(key: string): Promise<number> {
  try {
    const result = await ddb.send(new GetItemCommand({
      TableName: QUOTA_TABLE,
      Key: { pk: { S: key } },
    }));
    return Number(result.Item?.count?.N || "0");
  } catch {
    return 0;
  }
}

async function incrementQuota(key: string): Promise<number> {
  try {
    const result = await ddb.send(new UpdateItemCommand({
      TableName: QUOTA_TABLE,
      Key: { pk: { S: key } },
      UpdateExpression: "ADD #c :one",
      ExpressionAttributeNames: { "#c": "count" },
      ExpressionAttributeValues: { ":one": { N: "1" } },
      ReturnValues: "UPDATED_NEW",
    }));
    return Number(result.Attributes?.count?.N || "1");
  } catch {
    return -1;
  }
}

// ---------------------------------------------------------------------------
// Period helpers
// ---------------------------------------------------------------------------

function todayKey(): string {
  return new Date().toISOString().slice(0, 10); // 2026-02-08
}

function monthKey(): string {
  return new Date().toISOString().slice(0, 7); // 2026-02
}

// ---------------------------------------------------------------------------
// Provider implementations
// ---------------------------------------------------------------------------

function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 5000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

async function googleSearch(query: string, maxResults: number): Promise<SearchResult[]> {
  const key = process.env.GOOGLE_CSE_API_KEY;
  const cx = process.env.GOOGLE_CSE_CX;
  if (!key || !cx) throw new Error("Google CSE not configured");

  const params = new URLSearchParams({
    key, cx,
    q: query,
    num: String(Math.min(maxResults, 10)),
  });

  const resp = await fetchWithTimeout(
    `https://www.googleapis.com/customsearch/v1?${params}`,
    { method: "GET" },
  );

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Google ${resp.status}: ${text.slice(0, 200)}`);
  }

  const data = await resp.json();
  return (data.items || []).slice(0, maxResults).map((item: Record<string, string>) => ({
    title: item.title || "",
    url: item.link || "",
    snippet: item.snippet || "",
  }));
}

async function braveSearch(query: string, maxResults: number): Promise<SearchResult[]> {
  const key = process.env.BRAVE_API_KEY;
  if (!key) throw new Error("Brave not configured");

  const params = new URLSearchParams({
    q: query,
    count: String(Math.min(maxResults, 20)),
  });

  const resp = await fetchWithTimeout(
    `https://api.search.brave.com/res/v1/web/search?${params}`,
    {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": key,
      },
    },
  );

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Brave ${resp.status}: ${text.slice(0, 200)}`);
  }

  const data = await resp.json();
  return (data.web?.results || []).slice(0, maxResults).map((r: Record<string, string>) => ({
    title: r.title || "",
    url: r.url || "",
    snippet: r.description || "",
  }));
}

async function tavilySearch(query: string, maxResults: number): Promise<SearchResult[]> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) throw new Error("Tavily not configured");

  const resp = await fetchWithTimeout(
    "https://api.tavily.com/search",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        query,
        max_results: maxResults,
        search_depth: "basic",
      }),
    },
  );

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Tavily ${resp.status}: ${text.slice(0, 200)}`);
  }

  const data = await resp.json();
  return (data.results || []).slice(0, maxResults).map((r: Record<string, string>) => ({
    title: r.title || "",
    url: r.url || "",
    snippet: r.content || "",
  }));
}

// ---------------------------------------------------------------------------
// Build provider list
// ---------------------------------------------------------------------------

function getProviders(): ProviderConfig[] {
  const providers: ProviderConfig[] = [];

  if (process.env.GOOGLE_CSE_API_KEY && process.env.GOOGLE_CSE_CX) {
    providers.push({
      name: "google",
      quotaKey: "google",
      limit: 100,
      periodFn: todayKey,
      search: googleSearch,
    });
  }

  if (process.env.BRAVE_API_KEY) {
    providers.push({
      name: "brave",
      quotaKey: "brave",
      limit: 2000,
      periodFn: monthKey,
      search: braveSearch,
    });
  }

  if (process.env.TAVILY_API_KEY) {
    providers.push({
      name: "tavily",
      quotaKey: "tavily",
      limit: 1000,
      periodFn: monthKey,
      search: tavilySearch,
    });
  }

  return providers;
}

// ---------------------------------------------------------------------------
// Quota helpers
// ---------------------------------------------------------------------------

async function getQuotaInfo(): Promise<QuotaInfo> {
  const today = todayKey();
  const month = monthKey();

  const [googleCount, braveCount, tavilyCount] = await Promise.all([
    getQuotaCount(`google:${today}`),
    getQuotaCount(`brave:${month}`),
    getQuotaCount(`tavily:${month}`),
  ]);

  return {
    google: { used: googleCount, limit: 100, period: today },
    brave: { used: braveCount, limit: 2000, period: month },
    tavily: { used: tavilyCount, limit: 1000, period: month },
  };
}

// ---------------------------------------------------------------------------
// CORS response helper
// ---------------------------------------------------------------------------

function corsResponse(statusCode: number, body: object): APIGatewayProxyResult {
  const origin = process.env.ALLOWED_ORIGIN || "*";
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Cross-Origin-Resource-Policy": "cross-origin",
    },
    body: JSON.stringify(body),
  };
}

// ---------------------------------------------------------------------------
// Lambda handler
// ---------------------------------------------------------------------------

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return corsResponse(204, {});
  }

  // GET /quota
  if (event.httpMethod === "GET" && event.resource === "/quota") {
    const quota = await getQuotaInfo();
    return corsResponse(200, { quota });
  }

  // POST /search
  if (event.httpMethod !== "POST") {
    return corsResponse(405, { error: "Method not allowed" });
  }

  let query: string;
  let maxResults: number;
  try {
    const body = JSON.parse(event.body || "{}");
    query = (body.query || "").trim().slice(0, 200);
    maxResults = Math.min(Math.max(body.maxResults || 3, 1), 10);
  } catch {
    return corsResponse(400, { error: "Invalid JSON body" });
  }

  if (!query) {
    return corsResponse(400, { error: "Missing or empty 'query' field" });
  }

  const providers = getProviders();
  const start = Date.now();
  const errors: string[] = [];

  for (const provider of providers) {
    const quotaKey = `${provider.quotaKey}:${provider.periodFn()}`;
    const currentCount = await getQuotaCount(quotaKey);

    if (currentCount >= provider.limit) {
      errors.push(`${provider.name}: quota exhausted (${currentCount}/${provider.limit})`);
      continue;
    }

    try {
      const results = await provider.search(query, maxResults);
      await incrementQuota(quotaKey);
      const quota = await getQuotaInfo();

      return corsResponse(200, {
        query,
        results,
        durationMs: Date.now() - start,
        provider: provider.name,
        quota,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${provider.name}: ${msg}`);
      console.warn(`[search-proxy] ${provider.name} failed:`, msg);
    }
  }

  // All providers failed — return empty results (don't break the pipeline)
  const quota = await getQuotaInfo();
  return corsResponse(200, {
    query,
    results: [],
    durationMs: Date.now() - start,
    provider: "none",
    quota,
    errors,
  });
}
