/**
 * changelog-content.ts — Full HTML content for the Project Memory changelog window.
 *
 * Reads from docs/project-memory/.index/metadata.json and displays sessions
 * as a timeline. Self-contained HTML with inline styles.
 */

import metadata from '../../../docs/project-memory/.index/metadata.json';

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
