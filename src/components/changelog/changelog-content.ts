/**
 * changelog-content.ts — Full HTML content for the Project Memory changelog window.
 *
 * Reads from docs/project-memory/.index/metadata.json and displays sessions
 * as a timeline. Self-contained HTML with inline styles.
 */

import metadata from '../../../docs/project-memory/.index/metadata.json';
import keywordIndex from '../../../docs/project-memory/.index/keywords.json';

interface SessionMetadata {
  sessionId: string;
  file: string;
  date: string;
  author: string;
  goal: string;
  keywords: string[];
}

export function getChangelogHTML(): string {
  const sessions = metadata as SessionMetadata[];

  // Group sessions by date
  const sessionsByDate = new Map<string, SessionMetadata[]>();
  for (const session of sessions) {
    if (!sessionsByDate.has(session.date)) {
      sessionsByDate.set(session.date, []);
    }
    sessionsByDate.get(session.date)!.push(session);
  }

  // Sort dates descending (newest first)
  const sortedDates = Array.from(sessionsByDate.keys()).sort().reverse();

  // Generate session HTML with data attributes for searching
  const sessionHTML = sortedDates.map(date => {
    const dateSessions = sessionsByDate.get(date)!;

    const sessionsHTML = dateSessions.map(session => `
      <div class="session"
           data-session-id="${escapeHTML(session.sessionId)}"
           data-goal="${escapeHTML(session.goal)}"
           data-author="${escapeHTML(session.author)}"
           data-keywords="${session.keywords.join(' ')}">
        <div class="session-header">
          <span class="session-id">🎯 ${session.sessionId}</span>
        </div>
        <div class="session-goal">${escapeHTML(session.goal)}</div>
        <div class="session-meta">
          <span class="meta-item">👤 ${escapeHTML(session.author)}</span>
          ${session.keywords.length > 0 ? `<span class="meta-item">🏷️ ${session.keywords.slice(0, 5).join(', ')}</span>` : ''}
        </div>
      </div>
    `).join('');

    return `
      <div class="date-group">
        <h2 class="date-header">📅 ${formatDate(date)}</h2>
        <div class="sessions">${sessionsHTML}</div>
      </div>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Project Memory Changelog</title>
  <script src="https://cdn.jsdelivr.net/npm/marked@11.1.1/marked.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: ui-sans-serif, system-ui, sans-serif;
      background: hsl(222.2 84% 4.9%);
      color: hsl(210 40% 90%);
      line-height: 1.6;
      padding: 2rem 3rem;
      max-width: 960px;
      margin: 0 auto;
    }
    .qa-box {
      background: hsl(217.2 32.6% 8%);
      border: 1px solid hsl(217.2 32.6% 17.5%);
      border-radius: 8px;
      padding: 1.5rem;
      margin-bottom: 2rem;
    }
    .qa-box h3 {
      font-size: 1.1rem;
      color: hsl(142 76% 50%);
      margin-bottom: 1rem;
    }
    .qa-input-wrapper {
      display: flex;
      gap: 0.75rem;
      margin-bottom: 1rem;
    }
    #qaInput {
      flex: 1;
      background: hsl(217.2 32.6% 10%);
      border: 1px solid hsl(217.2 32.6% 17.5%);
      border-radius: 6px;
      padding: 0.75rem;
      color: hsl(210 40% 90%);
      font-size: 0.95rem;
      font-family: inherit;
      outline: none;
      transition: border-color 0.2s;
    }
    #qaInput:focus {
      border-color: hsl(142 76% 40%);
    }
    #qaInput::placeholder {
      color: hsl(215 20.2% 55%);
    }
    #askButton {
      background: hsl(142 76% 36%);
      color: white;
      border: none;
      border-radius: 6px;
      padding: 0.75rem 1.5rem;
      cursor: pointer;
      font-weight: 500;
      transition: background 0.2s;
    }
    #askButton:hover:not(:disabled) {
      background: hsl(142 76% 42%);
    }
    #askButton:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .qa-status {
      font-size: 0.85rem;
      color: hsl(215 20.2% 65.1%);
      margin-bottom: 0.75rem;
      min-height: 1.2em;
    }
    .qa-answer {
      background: hsl(217.2 32.6% 10%);
      border-left: 3px solid hsl(142 76% 40%);
      padding: 1rem;
      border-radius: 6px;
      line-height: 1.6;
      display: none;
    }
    .qa-answer.visible {
      display: block;
    }
    /* Markdown styling within qa-answer */
    .qa-answer h1, .qa-answer h2, .qa-answer h3 {
      color: hsl(142 76% 50%);
      margin-top: 1em;
      margin-bottom: 0.5em;
      font-weight: 600;
    }
    .qa-answer h1 { font-size: 1.4em; }
    .qa-answer h2 { font-size: 1.2em; }
    .qa-answer h3 { font-size: 1.1em; }
    .qa-answer p {
      margin-bottom: 0.75em;
    }
    .qa-answer ul, .qa-answer ol {
      margin-left: 1.5em;
      margin-bottom: 0.75em;
    }
    .qa-answer li {
      margin-bottom: 0.3em;
    }
    .qa-answer code {
      background: hsl(217.2 32.6% 15%);
      padding: 0.15em 0.4em;
      border-radius: 3px;
      font-family: ui-monospace, monospace;
      font-size: 0.9em;
      color: hsl(142 76% 60%);
    }
    .qa-answer pre {
      background: hsl(217.2 32.6% 8%);
      border: 1px solid hsl(217.2 32.6% 17.5%);
      border-radius: 6px;
      padding: 0.75rem;
      overflow-x: auto;
      margin-bottom: 0.75em;
    }
    .qa-answer pre code {
      background: transparent;
      padding: 0;
      color: hsl(210 40% 85%);
    }
    .qa-answer blockquote {
      border-left: 3px solid hsl(217.2 32.6% 25%);
      padding-left: 1em;
      margin-left: 0;
      margin-bottom: 0.75em;
      color: hsl(215 20.2% 70%);
    }
    .qa-answer strong {
      color: hsl(210 40% 95%);
      font-weight: 600;
    }
    .qa-answer a {
      color: hsl(142 76% 50%);
      text-decoration: none;
    }
    .qa-answer a:hover {
      text-decoration: underline;
    }
    h1 {
      font-size: 2rem;
      margin-bottom: 0.5rem;
      color: hsl(142 76% 50%);
    }
    .subtitle {
      color: hsl(215 20.2% 65.1%);
      font-size: 1rem;
      margin-bottom: 2.5rem;
    }
    .date-group {
      margin-bottom: 3rem;
    }
    .date-header {
      font-size: 1.3rem;
      color: hsl(142 76% 50%);
      margin-bottom: 1.5rem;
      padding-bottom: 0.5rem;
      border-bottom: 2px solid hsl(217.2 32.6% 20%);
    }
    .sessions {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }
    .session {
      background: hsl(217.2 32.6% 10%);
      border: 1px solid hsl(217.2 32.6% 17.5%);
      border-left: 3px solid hsl(142 76% 40%);
      border-radius: 8px;
      padding: 1.25rem 1.5rem;
      transition: border-color 0.2s, background 0.2s;
    }
    .session:hover {
      background: hsl(217.2 32.6% 12%);
      border-left-color: hsl(142 76% 50%);
    }
    .session-header {
      margin-bottom: 0.75rem;
    }
    .session-id {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 0.85rem;
      font-weight: 600;
      color: hsl(210 40% 98%);
      letter-spacing: -0.02em;
    }
    .session-goal {
      font-size: 0.95rem;
      line-height: 1.5;
      color: hsl(210 40% 85%);
      margin-bottom: 0.75rem;
    }
    .session-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      font-size: 0.8rem;
      color: hsl(215 20.2% 65.1%);
    }
    .meta-item {
      display: flex;
      align-items: center;
      gap: 0.3rem;
    }
    .empty-state {
      text-align: center;
      padding: 4rem 2rem;
      color: hsl(215 20.2% 65.1%);
    }
    .empty-state-icon {
      font-size: 3rem;
      margin-bottom: 1rem;
    }
    .search-box {
      position: sticky;
      top: 0;
      background: hsl(222.2 84% 4.9%);
      padding: 1rem 0 1.5rem;
      margin-bottom: 1.5rem;
      border-bottom: 1px solid hsl(217.2 32.6% 17.5%);
      z-index: 10;
    }
    .search-input-wrapper {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      background: hsl(217.2 32.6% 10%);
      border: 1px solid hsl(217.2 32.6% 17.5%);
      border-radius: 8px;
      padding: 0.75rem 1rem;
      transition: border-color 0.2s;
    }
    .search-input-wrapper:focus-within {
      border-color: hsl(142 76% 40%);
    }
    .search-icon {
      font-size: 1.2rem;
      color: hsl(215 20.2% 65.1%);
    }
    #searchInput {
      flex: 1;
      background: transparent;
      border: none;
      outline: none;
      color: hsl(210 40% 90%);
      font-size: 0.95rem;
      font-family: inherit;
    }
    #searchInput::placeholder {
      color: hsl(215 20.2% 55%);
    }
    .search-results {
      margin-top: 0.5rem;
      font-size: 0.85rem;
      color: hsl(215 20.2% 65.1%);
    }
    .session.hidden {
      display: none;
    }
    .session.match {
      border-left-color: hsl(142 76% 50%);
      background: hsl(217.2 32.6% 12%);
    }
    mark {
      background: hsl(142 76% 36% / 0.3);
      color: hsl(142 76% 70%);
      padding: 0.1em 0.2em;
      border-radius: 3px;
    }
  </style>
</head>
<body>
  <h1>📖 Project Memory Changelog</h1>
  <p class="subtitle">A timeline of all coding sessions and decisions</p>

  <div class="qa-box">
    <h3>💬 Ask Questions</h3>
    <div class="qa-input-wrapper">
      <input
        type="text"
        id="qaInput"
        placeholder="Ask about project history... (e.g., 'Why did we add audio mute?')"
        autocomplete="off"
      />
      <button id="askButton">Ask</button>
    </div>
    <div class="qa-status" id="qaStatus"></div>
    <div class="qa-answer" id="qaAnswer"></div>
  </div>

  <div class="search-box">
    <div class="search-input-wrapper">
      <span class="search-icon">🔍</span>
      <input
        type="text"
        id="searchInput"
        placeholder="Search sessions... (try 'audio', 'bug', 'testing')"
        autocomplete="off"
      />
    </div>
    <div class="search-results" id="searchResults"></div>
  </div>

  ${sessions.length === 0 ? `
    <div class="empty-state">
      <div class="empty-state-icon">📭</div>
      <p>No sessions yet. Create your first session to get started!</p>
    </div>
  ` : sessionHTML}

  <script>
    const searchInput = document.getElementById('searchInput');
    const searchResults = document.getElementById('searchResults');
    const allSessions = document.querySelectorAll('.session');
    const totalSessions = allSessions.length;

    function searchSessions() {
      const query = searchInput.value.toLowerCase().trim();

      if (!query) {
        // Show all sessions
        allSessions.forEach(session => {
          session.classList.remove('hidden', 'match');
        });
        searchResults.textContent = '';
        return;
      }

      let matchCount = 0;

      allSessions.forEach(session => {
        const sessionId = session.dataset.sessionId.toLowerCase();
        const goal = session.dataset.goal.toLowerCase();
        const author = session.dataset.author.toLowerCase();
        const keywords = session.dataset.keywords.toLowerCase();

        const searchText = sessionId + ' ' + goal + ' ' + author + ' ' + keywords;
        const matches = searchText.includes(query);

        if (matches) {
          session.classList.remove('hidden');
          session.classList.add('match');
          matchCount++;
        } else {
          session.classList.add('hidden');
          session.classList.remove('match');
        }
      });

      // Update results text
      if (matchCount === 0) {
        searchResults.textContent = '❌ No matches found';
      } else if (matchCount === totalSessions) {
        searchResults.textContent = \`✅ Showing all \${totalSessions} sessions\`;
      } else {
        searchResults.textContent = \`✅ Found \${matchCount} of \${totalSessions} sessions\`;
      }
    }

    // Search on input
    searchInput.addEventListener('input', searchSessions);

    // Focus search on Ctrl+F or Cmd+F
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        searchInput.focus();
      }
    });

    // --- Q&A with LLM via BroadcastChannel ---
    const qaInput = document.getElementById('qaInput');
    const askButton = document.getElementById('askButton');
    const qaAnswer = document.getElementById('qaAnswer');
    const qaStatus = document.getElementById('qaStatus');

    const channel = new BroadcastChannel('llm-service');
    const keywordIndex = ${JSON.stringify(keywordIndex)};
    const metadataList = ${JSON.stringify(metadata)};

    // Search for relevant sessions using keyword index
    function searchRelevantSessions(query) {
      const queryWords = query.toLowerCase().split(/\\s+/);
      const sessionMatches = new Map();

      // Find sessions matching query words
      for (const word of queryWords) {
        if (keywordIndex[word]) {
          for (const sessionId of keywordIndex[word]) {
            sessionMatches.set(
              sessionId,
              (sessionMatches.get(sessionId) || 0) + 1
            );
          }
        }
      }

      // Sort by match count (most relevant first)
      return Array.from(sessionMatches.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5) // Top 5 most relevant
        .map(([sessionId]) => sessionId);
    }

    askButton.addEventListener('click', async () => {
      const query = qaInput.value.trim();
      if (!query) return;

      const id = Math.random().toString(36).substring(7);

      // Disable button during processing
      askButton.disabled = true;
      qaAnswer.classList.remove('visible');
      qaAnswer.textContent = '';

      // Step 1: Search for relevant sessions
      qaStatus.textContent = '🔍 Searching for relevant sessions...';

      const relevantSessions = searchRelevantSessions(query);

      if (relevantSessions.length === 0) {
        qaStatus.textContent = '❌ No relevant sessions found';
        qaAnswer.textContent = 'Try different keywords or check the search box below to browse all sessions.';
        qaAnswer.classList.add('visible');
        askButton.disabled = false;
        return;
      }

      // Step 2: Ask LLM with relevant session IDs
      qaStatus.textContent = \`🤔 Analyzing \${relevantSessions.length} session(s) with LLM...\`;

      // Set timeout (30 seconds for LLM)
      const timeout = setTimeout(() => {
        qaStatus.textContent = '⏱️ Timeout - make sure main app is open with model loaded';
        qaAnswer.textContent = 'The main app must be running with an LLM loaded to answer questions.';
        qaAnswer.classList.add('visible');
        askButton.disabled = false;
        channel.removeEventListener('message', handler);
      }, 30000);

      // Listen for response
      const handler = (e) => {
        if (e.data.id === id) {
          clearTimeout(timeout);
          channel.removeEventListener('message', handler);
          askButton.disabled = false;

          if (e.data.type === 'answer') {
            qaStatus.textContent = \`✅ Answer (based on \${relevantSessions.length} session(s)):\`;
            // Render markdown to HTML
            qaAnswer.innerHTML = marked.parse(e.data.text);
            qaAnswer.classList.add('visible');
          } else if (e.data.type === 'error') {
            qaStatus.textContent = '❌ Error:';
            qaAnswer.textContent = e.data.error;
            qaAnswer.classList.add('visible');
          }
        }
      };

      channel.addEventListener('message', handler);

      // Send question with relevant session IDs
      channel.postMessage({
        id,
        type: 'ask',
        query,
        sessionIds: relevantSessions
      });
    });

    // Allow Enter key to submit question
    qaInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !askButton.disabled) {
        askButton.click();
      }
    });
  </script>
</body>
</html>
`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function escapeHTML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
