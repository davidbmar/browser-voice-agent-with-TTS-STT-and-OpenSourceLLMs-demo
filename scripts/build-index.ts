#!/usr/bin/env tsx
/**
 * Build searchable index for Project Memory
 *
 * Generates:
 * - keywords.json: keyword → session IDs mapping
 * - metadata.json: session metadata for quick lookup
 * - last-updated.txt: timestamp of index build
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'fs';
import { join } from 'path';

interface SessionMetadata {
  sessionId: string;
  title: string;
  file: string;
  date: string;
  author: string;
  goal: string;
  keywords: string[];
}

interface KeywordIndex {
  [keyword: string]: string[];
}

// Common words to exclude from keywords
const STOP_WORDS = new Set([
  'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'but', 'in', 'with',
  'to', 'for', 'of', 'as', 'by', 'this', 'that', 'from', 'was', 'were', 'been',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
  'may', 'might', 'must', 'can', 'be', 'are', 'am', 'it', 'its', 'we', 'they',
  'you', 'he', 'she', 'what', 'when', 'where', 'who', 'why', 'how'
]);

function extractKeywords(text: string): string[] {
  // Split on word boundaries, lowercase, remove punctuation
  const words = text
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter(word =>
      word.length > 2 &&
      !STOP_WORDS.has(word) &&
      !/^\d+$/.test(word) // exclude pure numbers
    );

  // Remove duplicates
  return [...new Set(words)];
}

function parseSession(content: string, filePath: string): SessionMetadata | null {
  // Extract Session-ID
  const sessionIdMatch = content.match(/Session-ID:\s*(S-[\w-]+)/);
  if (!sessionIdMatch) {
    console.warn(`No Session-ID found in ${filePath}`);
    return null;
  }

  const sessionId = sessionIdMatch[1];
  const titleMatch = content.match(/Title:\s*(.+)/);
  const dateMatch = content.match(/Date:\s*([\d-]+)/);
  const authorMatch = content.match(/Author:\s*(.+)/);
  const goalMatch = content.match(/## Goal\n\n(.+?)(?:\n\n|$)/s);

  const title = titleMatch?.[1]?.trim() || '';
  const date = dateMatch?.[1] || '';
  const author = authorMatch?.[1]?.trim() || '';
  const goal = goalMatch?.[1]?.trim() || '';

  // Extract keywords from Goal, Context, Changes Made, Decisions Made
  const sections = [
    content.match(/## Goal\n\n(.+?)(?=##|$)/s)?.[1] || '',
    content.match(/## Context\n\n(.+?)(?=##|$)/s)?.[1] || '',
    content.match(/## Changes Made\n\n(.+?)(?=##|$)/s)?.[1] || '',
    content.match(/## Decisions Made\n\n(.+?)(?=##|$)/s)?.[1] || '',
  ].join(' ');

  const keywords = extractKeywords(sections);

  return {
    sessionId,
    title,
    file: filePath,
    date,
    author,
    goal,
    keywords
  };
}

function buildIndex() {
  console.log('Building Project Memory index...\n');

  const sessionsDir = 'docs/project-memory/sessions';
  const indexDir = 'docs/project-memory/.index';

  // Create index directory
  mkdirSync(indexDir, { recursive: true });

  // Read all session files (skip templates)
  const files = readdirSync(sessionsDir)
    .filter(f => f.startsWith('S-') && f.endsWith('.md'));

  console.log(`Found ${files.length} session files\n`);

  const metadata: SessionMetadata[] = [];
  const keywordIndex: KeywordIndex = {};

  // Process each session
  for (const file of files) {
    const filePath = join(sessionsDir, file);
    const content = readFileSync(filePath, 'utf-8');

    const session = parseSession(content, filePath);
    if (!session) continue;

    console.log(`✓ ${session.sessionId}`);
    console.log(`  Keywords: ${session.keywords.slice(0, 10).join(', ')}${session.keywords.length > 10 ? '...' : ''}`);

    metadata.push(session);

    // Build keyword → session ID mapping
    for (const keyword of session.keywords) {
      if (!keywordIndex[keyword]) {
        keywordIndex[keyword] = [];
      }
      if (!keywordIndex[keyword].includes(session.sessionId)) {
        keywordIndex[keyword].push(session.sessionId);
      }
    }
  }

  // Write index files
  const keywordsPath = join(indexDir, 'keywords.json');
  const metadataPath = join(indexDir, 'metadata.json');
  const timestampPath = join(indexDir, 'last-updated.txt');

  writeFileSync(keywordsPath, JSON.stringify(keywordIndex, null, 2));
  writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  writeFileSync(timestampPath, new Date().toISOString());

  console.log(`\n✅ Index built successfully!`);
  console.log(`   Sessions: ${metadata.length}`);
  console.log(`   Keywords: ${Object.keys(keywordIndex).length}`);
  console.log(`   Output: ${indexDir}/`);
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  buildIndex();
}
