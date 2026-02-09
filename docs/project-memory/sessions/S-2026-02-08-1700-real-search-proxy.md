# Session

Session-ID: S-2026-02-08-1700-real-search-proxy
Date: 2026-02-08
Author: Claude

## Goal

Replace MockSearchProvider with real web search via AWS Lambda proxy. Cascade Google Custom Search (100 free/day) → Brave (2K free/month) → Tavily (1K free/month). Add quota tracking UI panel.

## Context

All search infrastructure exists (interface, detection, formatting, FSM integration, UI). Only missing piece is a real search API provider. Browser can't call search APIs directly due to CORS + API key security.

## Plan

1. Lambda function with cascading provider logic + DynamoDB quota tracking
2. Deploy script for Lambda + API Gateway + DynamoDB
3. Browser-side ProxySearchProvider
4. Quota tracking UI panel
5. Wire into app via build-time URL variable

## Changes Made

(to be filled)

## Decisions Made

(to be filled)

## Open Questions

- Need to sign up for Google CSE, Brave, and Tavily API keys

## Links

Commits:
- (to be added)
