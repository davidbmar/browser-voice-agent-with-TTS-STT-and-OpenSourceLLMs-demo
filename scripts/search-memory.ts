#!/usr/bin/env tsx
/**
 * Search Project Memory
 *
 * Usage:
 *   npm run search "audio problems"
 *   npm run search "what testing was done"
 *
 * Searches sessions and ADRs using:
 * 1. Keyword index (fast)
 * 2. Full-text search (fallback)
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

interface KeywordIndex {
  [keyword: string]: string[];
}

interface SessionMetadata {
  sessionId: string;
  title: string;
  file: string;
  date: string;
  author: string;
  goal: string;
  keywords: string[];
}

function searchKeywordIndex(query: string): string[] {
  const indexPath = 'docs/project-memory/.index/keywords.json';

  if (!existsSync(indexPath)) {
    console.error('❌ Index not found. Run: npm run build-index');
    process.exit(1);
  }

  const index: KeywordIndex = JSON.parse(readFileSync(indexPath, 'utf-8'));
  const queryWords = query.toLowerCase().split(/\s+/);

  const matches = new Set<string>();

  for (const word of queryWords) {
    if (index[word]) {
      index[word].forEach(id => matches.add(id));
    }
  }

  return Array.from(matches);
}

function getSessionMetadata(sessionId: string): SessionMetadata | null {
  const metadataPath = 'docs/project-memory/.index/metadata.json';
  const metadata: SessionMetadata[] = JSON.parse(readFileSync(metadataPath, 'utf-8'));

  return metadata.find(s => s.sessionId === sessionId) || null;
}

function readSessionContent(sessionId: string): string {
  const metadata = getSessionMetadata(sessionId);
  if (!metadata) return '';

  return readFileSync(metadata.file, 'utf-8');
}

function highlightContext(content: string, query: string): string {
  const lines = content.split('\n');
  const queryWords = query.toLowerCase().split(/\s+/);

  // Find lines containing query words
  const relevantLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lowerLine = line.toLowerCase();

    if (queryWords.some(word => lowerLine.includes(word))) {
      // Include context: previous and next line
      if (i > 0) relevantLines.push(`  ${lines[i-1]}`);
      relevantLines.push(`▶ ${line}`);
      if (i < lines.length - 1) relevantLines.push(`  ${lines[i+1]}`);
      relevantLines.push('');
    }
  }

  return relevantLines.slice(0, 10).join('\n'); // Limit context
}

function search(query: string) {
  console.log(`🔍 Searching for: "${query}"\n`);

  // 1. Try keyword index first
  const sessionIds = searchKeywordIndex(query);

  if (sessionIds.length === 0) {
    console.log('❌ No results found');
    console.log('\nTry:');
    console.log('  - Different keywords');
    console.log('  - Rebuild index: npm run build-index');
    return;
  }

  console.log(`✅ Found ${sessionIds.length} session(s)\n`);
  console.log('─'.repeat(80));

  // 2. Display results with context
  for (const sessionId of sessionIds) {
    const metadata = getSessionMetadata(sessionId);
    if (!metadata) continue;

    console.log(`\n📄 ${metadata.sessionId}`);
    console.log(`   Date: ${metadata.date}`);
    console.log(`   Author: ${metadata.author}`);
    console.log(`   Goal: ${metadata.goal}\n`);

    // Show relevant context
    const content = readSessionContent(sessionId);
    const context = highlightContext(content, query);

    if (context) {
      console.log('   Context:');
      console.log(context);
    }

    console.log(`   File: ${metadata.file}`);
    console.log('─'.repeat(80));
  }

  // 3. Summary
  console.log(`\n💡 To read full session:`);
  console.log(`   cat ${getSessionMetadata(sessionIds[0])?.file}\n`);
}

// CLI entry point
const query = process.argv.slice(2).join(' ');

if (!query) {
  console.error('Usage: npm run search "your query here"');
  console.error('\nExamples:');
  console.error('  npm run search "audio problems"');
  console.error('  npm run search "testing"');
  console.error('  npm run search "UI improvements"');
  process.exit(1);
}

search(query);
