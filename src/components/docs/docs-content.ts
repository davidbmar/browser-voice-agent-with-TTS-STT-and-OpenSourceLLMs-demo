/**
 * docs-content.ts — Full HTML content for the documentation window.
 *
 * This is rendered into a new browser window via `window.open()` so it
 * needs to be a self-contained HTML string with inline styles.
 * The dark theme matches the main app's color palette.
 */

export function getDocsHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bug Loop Voice Agent — Documentation</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: ui-sans-serif, system-ui, sans-serif;
      background: hsl(222.2 84% 4.9%);
      color: hsl(210 40% 90%);
      line-height: 1.7;
      padding: 2rem 3rem;
      max-width: 960px;
      margin: 0 auto;
    }
    h1 { font-size: 2rem; margin-bottom: 0.5rem; color: hsl(142 76% 50%); }
    h2 { font-size: 1.4rem; margin: 2.5rem 0 0.75rem; color: hsl(142 76% 50%); border-bottom: 1px solid hsl(217.2 32.6% 20%); padding-bottom: 0.4rem; }
    h3 { font-size: 1.1rem; margin: 1.5rem 0 0.5rem; color: hsl(210 40% 85%); }
    p { margin-bottom: 1rem; }
    a { color: hsl(142 76% 55%); text-decoration: none; }
    a:hover { text-decoration: underline; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; background: hsl(217.2 32.6% 12%); padding: 0.15em 0.4em; border-radius: 4px; font-size: 0.9em; }
    pre { background: hsl(217.2 32.6% 10%); padding: 1rem; border-radius: 8px; overflow-x: auto; margin-bottom: 1rem; border: 1px solid hsl(217.2 32.6% 17.5%); }
    pre code { background: none; padding: 0; font-size: 0.85em; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 1.5rem; }
    th, td { text-align: left; padding: 0.5rem 0.75rem; border-bottom: 1px solid hsl(217.2 32.6% 17.5%); font-size: 0.9rem; }
    th { color: hsl(142 76% 50%); font-weight: 600; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; }
    ul, ol { margin-bottom: 1rem; padding-left: 1.5rem; }
    li { margin-bottom: 0.3rem; }
    .subtitle { color: hsl(215 20.2% 65.1%); font-size: 1rem; margin-bottom: 2rem; }
    .badge { display: inline-block; background: hsl(142 76% 36% / 0.15); color: hsl(142 76% 50%); padding: 0.1em 0.5em; border-radius: 4px; font-size: 0.8em; font-weight: 600; margin-left: 0.3rem; }
    .stage-flow { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; margin: 1rem 0; }
    .stage-box { background: hsl(217.2 32.6% 12%); border: 1px solid hsl(217.2 32.6% 22%); border-radius: 6px; padding: 0.3rem 0.7rem; font-family: monospace; font-size: 0.85rem; }
    .stage-arrow { color: hsl(215 20.2% 55%); font-size: 1.1rem; }
    .tip { background: hsl(142 76% 36% / 0.08); border-left: 3px solid hsl(142 76% 40%); padding: 0.75rem 1rem; border-radius: 0 6px 6px 0; margin-bottom: 1rem; font-size: 0.9rem; }
    .warn { background: hsl(40 90% 50% / 0.08); border-left: 3px solid hsl(40 90% 50%); padding: 0.75rem 1rem; border-radius: 0 6px 6px 0; margin-bottom: 1rem; font-size: 0.9rem; }
    .section-nav { background: hsl(217.2 32.6% 8%); border: 1px solid hsl(217.2 32.6% 17.5%); border-radius: 8px; padding: 1rem 1.5rem; margin-bottom: 2rem; }
    .section-nav ul { list-style: none; padding: 0; columns: 2; }
    .section-nav li { margin-bottom: 0.2rem; }
    .section-nav a { font-size: 0.9rem; }
    hr { border: none; border-top: 1px solid hsl(217.2 32.6% 17.5%); margin: 2rem 0; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    @media (max-width: 700px) { .two-col { grid-template-columns: 1fr; } .section-nav ul { columns: 1; } body { padding: 1rem; } }
  </style>
</head>
<body>
  <h1>Bug Loop Voice Agent</h1>
  <p class="subtitle">A browser-native finite state machine that listens, thinks, and speaks — no server required.</p>

  <div class="section-nav">
    <strong>Contents</strong>
    <ul>
      <li><a href="#getting-started">Getting Started</a></li>
      <li><a href="#how-it-works">How It Works</a></li>
      <li><a href="#fsm">State Machine</a></li>
      <li><a href="#turn-detection">Turn Detection</a></li>
      <li><a href="#classification">Classification</a></li>
      <li><a href="#response-gen">Response Generation</a></li>
      <li><a href="#streaming-tts">Streaming TTS Pipeline</a></li>
      <li><a href="#dual-voice">Dual Voice System</a></li>
      <li><a href="#bias">Adaptive Bias System</a></li>
      <li><a href="#models">Model Catalog</a></li>
      <li><a href="#ui-panels">UI Panels Guide</a></li>
      <li><a href="#tech-stack">Technology Stack</a></li>
      <li><a href="#architecture">Code Architecture</a></li>
      <li><a href="#troubleshooting">Troubleshooting</a></li>
    </ul>
  </div>

  <h2 id="getting-started">Getting Started</h2>

  <h3>Prerequisites</h3>
  <ul>
    <li><strong>Node.js 18+</strong> and <strong>npm</strong></li>
    <li>A <strong>WebGPU-capable</strong> browser (Chrome 113+, Edge 113+) for LLM inference</li>
    <li>A microphone (optional — Simulate Input works without one)</li>
  </ul>

  <h3>Install &amp; Run</h3>
  <pre><code>npm install
npm run dev</code></pre>
  <p>Then open <code>http://localhost:5173</code> in your browser.</p>

  <h3>Quick Walkthrough</h3>
  <ol>
    <li><strong>Without a model:</strong> Type something in the "Simulate Input" box and press Enter. The FSM cycles through all stages using rule-based fallbacks — no download needed.</li>
    <li><strong>Load a model:</strong> Select a model from the header dropdown (start with a small one like <code>Qwen3 0.6B</code> at 1.4 GB). Click <strong>Load</strong>. First download takes ~30s–2min depending on your connection; subsequent loads are instant (cached in IndexedDB).</li>
    <li><strong>Microphone mode:</strong> Click <strong>Start</strong> to begin listening. Speak naturally — the agent detects turn boundaries automatically and responds with TTS.</li>
  </ol>

  <div class="tip">
    <strong>Tip:</strong> Use "Speak Test" to verify audio output works before testing the full loop. Some browsers require a user interaction before allowing audio playback.
  </div>

  <h2 id="how-it-works">How It Works</h2>
  <p>The Bug Loop is an <strong>audio-native primitive brain</strong>. It continuously loops through a cycle of listening, understanding, responding, and adapting. Everything runs entirely in your browser:</p>
  <ul>
    <li><strong>Speech-to-Text</strong> uses the browser's built-in Web Speech API (no cloud calls)</li>
    <li><strong>LLM inference</strong> runs locally via WebGPU using <code>@mlc-ai/web-llm</code></li>
    <li><strong>Text-to-Speech</strong> uses ONNX-based Piper voices via <code>@diffusionstudio/vits-web</code></li>
    <li><strong>No backend server</strong> — all state, models, and processing happen client-side</li>
  </ul>

  <h2 id="fsm">State Machine (FSM)</h2>
  <p>The core loop cycles through 8 stages. Each stage has a specific responsibility and transitions to the next via events.</p>

  <div class="stage-flow">
    <span class="stage-box">IDLE</span><span class="stage-arrow">&rarr;</span>
    <span class="stage-box">LISTENING</span><span class="stage-arrow">&rarr;</span>
    <span class="stage-box">SIGNAL_DETECT</span><span class="stage-arrow">&rarr;</span>
    <span class="stage-box">CLASSIFY</span><span class="stage-arrow">&rarr;</span>
    <span class="stage-box">MICRO_RESPONSE</span><span class="stage-arrow">&rarr;</span>
    <span class="stage-box">SPEAK</span><span class="stage-arrow">&rarr;</span>
    <span class="stage-box">FEEDBACK_OBSERVE</span><span class="stage-arrow">&rarr;</span>
    <span class="stage-box">UPDATE_BIAS</span><span class="stage-arrow">&harr;</span>
    <span class="stage-box">LISTENING</span>
  </div>

  <table>
    <thead><tr><th>Stage</th><th>What Happens</th><th>Event Out</th></tr></thead>
    <tbody>
      <tr><td><code>IDLE</code></td><td>Waiting for Start or Simulate Input</td><td><code>MIC_START</code> or <code>SIMULATE_INPUT</code></td></tr>
      <tr><td><code>LISTENING</code></td><td>Microphone active, Web Speech API transcribing</td><td><code>AUDIO_FRAME</code> with interim text</td></tr>
      <tr><td><code>SIGNAL_DETECT</code></td><td>Speech detected — monitoring silence for turn end</td><td><code>TURN_END</code> with final text + confidence</td></tr>
      <tr><td><code>CLASSIFY</code></td><td>Determines intent: question, command, greeting, etc.</td><td><code>CLASSIFY_DONE</code></td></tr>
      <tr><td><code>MICRO_RESPONSE</code></td><td>Generates a short response (rule-based or LLM streaming)</td><td><code>MICRO_RESPONSE_DONE</code> or direct to SPEAK</td></tr>
      <tr><td><code>SPEAK</code></td><td>TTS plays the response aloud; mic is paused (echo cancel)</td><td><code>SPEAK_DONE</code></td></tr>
      <tr><td><code>FEEDBACK_OBSERVE</code></td><td>Watches for user reaction (2s window)</td><td><code>REACTION_DETECTED</code></td></tr>
      <tr><td><code>UPDATE_BIAS</code></td><td>Adjusts behavior parameters, saves to history, loops back</td><td>Auto-transition</td></tr>
    </tbody>
  </table>

  <h3>Event Types</h3>
  <table>
    <thead><tr><th>Event</th><th>Payload</th><th>Description</th></tr></thead>
    <tbody>
      <tr><td><code>MIC_START</code></td><td>—</td><td>User clicks Start</td></tr>
      <tr><td><code>MIC_STOP</code></td><td>—</td><td>User clicks Stop</td></tr>
      <tr><td><code>AUDIO_FRAME</code></td><td>audioLevel, interimText</td><td>Real-time audio data from mic</td></tr>
      <tr><td><code>TURN_END</code></td><td>finalText, confidence</td><td>User finished speaking</td></tr>
      <tr><td><code>SIMULATE_INPUT</code></td><td>text</td><td>Manual text entry (skips mic)</td></tr>
      <tr><td><code>CLASSIFY_DONE</code></td><td>classification</td><td>Intent classification complete</td></tr>
      <tr><td><code>MICRO_RESPONSE_DONE</code></td><td>response, tokenCount</td><td>Response text generated</td></tr>
      <tr><td><code>SPEAK_DONE</code></td><td>—</td><td>TTS playback finished</td></tr>
      <tr><td><code>REACTION_DETECTED</code></td><td>reactionType</td><td>User reaction observed</td></tr>
      <tr><td><code>RESET</code></td><td>—</td><td>Full state reset</td></tr>
    </tbody>
  </table>

  <h2 id="turn-detection">Turn Detection</h2>
  <p>The system uses two complementary signals to determine when the user has finished speaking:</p>
  <ol>
    <li><strong>Web Speech API <code>isFinal</code></strong> — The browser's speech recognizer marks segments as final with a confidence score. This is the primary signal.</li>
    <li><strong>Silence timer</strong> — If audio level stays below the speech threshold (level &lt; 8) for <code>silenceThresholdMs</code> (default 1500ms) and there's accumulated interim text, a turn end is triggered with 0.7 confidence.</li>
  </ol>
  <div class="tip">
    <strong>Tip:</strong> Adjust the <strong>Silence threshold</strong> slider to tune responsiveness. Lower = faster (may cut off speech), Higher = more patient (waits longer before responding).
  </div>

  <h3>Echo Cancellation</h3>
  <p>When the agent speaks (SPEAK stage), the microphone's <code>SpeechRecognition</code> is <strong>paused</strong> to prevent the agent from hearing its own voice. It resumes automatically after playback completes. This is a simple but effective approach — no acoustic echo cancellation math is needed.</p>

  <h2 id="classification">Classification</h2>
  <p>Classification determines the user's intent from their transcript. Two modes are available:</p>

  <div class="two-col">
    <div>
      <h3>Rule-Based <span class="badge">Default</span></h3>
      <p>Fast keyword matching with zero latency. Checks for:</p>
      <ul>
        <li>Question words: what, where, when, why, how...</li>
        <li>Command words: stop, start, play, open...</li>
        <li>Acknowledgements: okay, got it, sure, thanks...</li>
        <li>Greetings: hello, hi, hey...</li>
        <li>Farewells: bye, goodbye, see you...</li>
        <li>Low confidence &rarr; clarification_needed</li>
      </ul>
    </div>
    <div>
      <h3>LLM-Based</h3>
      <p>Uses the loaded model to classify with a structured JSON prompt. Enable with the <strong>Classify w/ LLM</strong> toggle. Outputs:</p>
      <pre><code>{
  "intent": "question",
  "confidence": 0.92,
  "topics": ["weather"],
  "needsClarification": false
}</code></pre>
      <p>Falls back to rule-based if LLM fails or returns invalid JSON.</p>
    </div>
  </div>

  <h2 id="response-gen">Response Generation</h2>
  <div class="two-col">
    <div>
      <h3>Rule-Based</h3>
      <p>Canned responses per intent type:</p>
      <ul>
        <li>Greeting &rarr; "Hi there.", "Hello.", "Hey."</li>
        <li>Question &rarr; "Interesting question.", "Good question."</li>
        <li>Command &rarr; "On it.", "Will do."</li>
        <li>Acknowledgement &rarr; "Got it.", "Okay."</li>
        <li>Clarification &rarr; "Say again?", "Can you clarify?"</li>
      </ul>
    </div>
    <div>
      <h3>LLM-Based <span class="badge">Default when loaded</span></h3>
      <p>Generates a conversational response using the prompt template with context about the user's intent. Key parameters:</p>
      <ul>
        <li><code>maxTokens</code>: 512</li>
        <li><code>maxWords</code>: 60 + (verbosity &times; 30)</li>
        <li><code>temperature</code>: 0.7</li>
      </ul>
      <p>When streaming, tokens are pushed to TTS sentence-by-sentence.</p>
    </div>
  </div>

  <h2 id="streaming-tts">Streaming TTS Pipeline</h2>
  <p>When using an LLM, the agent doesn't wait for the full response before speaking. The pipeline works like this:</p>
  <ol>
    <li><strong>Tokens stream in</strong> from the LLM one at a time</li>
    <li><strong>Sentence detection</strong> — as each complete sentence is found (ending in <code>.</code>, <code>!</code>, or <code>?</code>), it's immediately pushed to the TTS engine</li>
    <li><strong>Concurrent generation</strong> — up to 2 sentences can be generating audio simultaneously</li>
    <li><strong>Sequential playback</strong> — sentences play in order; while one plays, the next is being generated</li>
    <li><strong>Final flush</strong> — any trailing text (no sentence-ending punctuation) is pushed as a final chunk</li>
  </ol>

  <div class="tip">
    <strong>Result:</strong> Time-to-first-audio is dramatically reduced. The user hears the first sentence while the LLM is still generating the rest of the response.
  </div>

  <h3>Pipeline Diagram</h3>
  <pre><code>LLM tokens:   [The][weather][is][sunny][today][.][It][will][be][warm][.]
                                                 |                      |
Sentence 1 detected ─────────────────────────────┘                      |
  → TTS generate audio for "The weather is sunny today."                |
  → Play audio ▶ ▶ ▶                                                    |
                                                                        |
Sentence 2 detected ────────────────────────────────────────────────────┘
  → TTS generate (concurrent with sentence 1 playback)
  → Queue for playback after sentence 1 finishes
  → Play audio ▶ ▶ ▶</code></pre>

  <h2 id="dual-voice">Dual Voice System</h2>
  <p>Models that output reasoning in <code>&lt;think&gt;...&lt;/think&gt;</code> tags (Qwen3, DeepSeek R1) receive special treatment:</p>

  <table>
    <thead><tr><th>Content</th><th>Voice</th><th>Settings</th></tr></thead>
    <tbody>
      <tr>
        <td><strong>Internal Monologue</strong> (inside think tags)</td>
        <td><code>en_US-hfc_female-medium</code> — soft female</td>
        <td>55% volume, 1.15x speed</td>
      </tr>
      <tr>
        <td><strong>Response</strong> (outside think tags)</td>
        <td><code>en_GB-cori-high</code> — British</td>
        <td>Normal volume, normal speed</td>
      </tr>
    </tbody>
  </table>

  <p>In streaming mode, the monologue is queued and spoken first, then response sentences stream in. The internal monologue gives the listener a "peek into the agent's reasoning" before hearing the actual answer.</p>

  <h2 id="bias">Adaptive Bias System</h2>
  <p>After each loop iteration, the agent observes the user's reaction during the <code>FEEDBACK_OBSERVE</code> stage (2-second window). Based on the reaction, bias values are adjusted:</p>

  <table>
    <thead><tr><th>Parameter</th><th>What It Controls</th><th>Default</th><th>Range</th></tr></thead>
    <tbody>
      <tr><td><strong>Silence threshold</strong></td><td>How long to wait before assuming turn is over</td><td>1500ms</td><td>500–3000ms</td></tr>
      <tr><td><strong>Confidence floor</strong></td><td>Below this, ask for clarification instead of answering</td><td>0.60</td><td>0.1–0.9</td></tr>
      <tr><td><strong>Verbosity</strong></td><td>How many words in LLM prompt (affects maxWords)</td><td>0.0</td><td>-1.0–1.0</td></tr>
      <tr><td><strong>Interruption sensitivity</strong></td><td>How responsive to mid-speech interruptions</td><td>0.50</td><td>0.0–1.0</td></tr>
    </tbody>
  </table>

  <h3>Automatic Adjustments</h3>
  <table>
    <thead><tr><th>Reaction</th><th>Effect</th></tr></thead>
    <tbody>
      <tr><td><strong>silence</strong></td><td>Slight decrease to clarification threshold</td></tr>
      <tr><td><strong>repeat_request</strong></td><td>Increase verbosity</td></tr>
      <tr><td><strong>interruption</strong></td><td>Decrease verbosity, increase interruption sensitivity</td></tr>
      <tr><td><strong>correction</strong></td><td>Lower confidence floor (accept more inputs)</td></tr>
      <tr><td><strong>acknowledgement</strong></td><td>No change (positive signal — keep current settings)</td></tr>
    </tbody>
  </table>

  <p>You can also manually adjust all bias values using the <strong>Bias Sliders</strong> panel on the right side of the UI.</p>

  <h2 id="models">Model Catalog</h2>
  <p>All models run locally in your browser via WebGPU. They are downloaded once and cached in IndexedDB for instant reloads.</p>

  <table>
    <thead><tr><th>Model</th><th>VRAM</th><th>Speed</th><th>Notes</th></tr></thead>
    <tbody>
      <tr><td>SmolLM2 360M</td><td style="color:hsl(142,76%,50%)">0.4 GB</td><td>Fastest</td><td>Best for testing, lowest quality</td></tr>
      <tr><td>TinyLlama 1.1B</td><td style="color:hsl(142,76%,50%)">0.7 GB</td><td>Fast</td><td>Good testing model</td></tr>
      <tr><td>Qwen2.5 0.5B</td><td style="color:hsl(142,76%,50%)">0.9 GB</td><td>Fast</td><td>Surprisingly capable for its size</td></tr>
      <tr><td>Llama 3.2 1B</td><td style="color:hsl(142,76%,50%)">0.9 GB</td><td>Fast</td><td>Meta, good balance</td></tr>
      <tr><td>Qwen3 0.6B</td><td style="color:hsl(50,90%,55%)">1.4 GB</td><td>Fast</td><td>Newest, supports think tags</td></tr>
      <tr><td>Qwen2.5 1.5B</td><td style="color:hsl(50,90%,55%)">1.6 GB</td><td>Medium</td><td>Strong for its size</td></tr>
      <tr><td>SmolLM2 1.7B</td><td style="color:hsl(50,90%,55%)">1.7 GB</td><td>Medium</td><td>Fast and balanced</td></tr>
      <tr><td>Gemma 2 2B</td><td style="color:hsl(50,90%,55%)">1.9 GB</td><td>Medium</td><td>Google's compact model</td></tr>
      <tr><td>Qwen3 1.7B</td><td style="color:hsl(50,90%,55%)">2.0 GB</td><td>Medium</td><td>Think tags, good quality</td></tr>
      <tr><td>Llama 3.2 3B</td><td style="color:hsl(30,80%,55%)">2.2 GB</td><td>Medium</td><td>Strong all-around</td></tr>
      <tr><td>Qwen2.5 3B</td><td style="color:hsl(30,80%,55%)">2.4 GB</td><td>Medium</td><td>Excellent quality/size ratio</td></tr>
      <tr><td>Phi 3.5 Mini</td><td style="color:hsl(30,80%,55%)">2.4 GB</td><td>Medium</td><td>Microsoft, reasoning-focused</td></tr>
      <tr><td>Qwen3 4B</td><td style="color:hsl(30,80%,55%)">2.8 GB</td><td>Slower</td><td>Best balance of quality and speed</td></tr>
      <tr><td>Qwen2.5 7B</td><td style="color:hsl(0,65%,55%)">4.5 GB</td><td>Slow</td><td>High quality, needs GPU VRAM</td></tr>
      <tr><td>DeepSeek R1 7B</td><td style="color:hsl(0,65%,55%)">4.5 GB</td><td>Slow</td><td>Reasoning model, think tags</td></tr>
      <tr><td>Llama 3.1 8B</td><td style="color:hsl(0,65%,55%)">5.1 GB</td><td>Slow</td><td>Meta's flagship compact model</td></tr>
      <tr><td>Qwen3 8B</td><td style="color:hsl(0,65%,55%)">5.5 GB</td><td>Slow</td><td>Top quality, think tags</td></tr>
    </tbody>
  </table>

  <div class="warn">
    <strong>Note:</strong> VRAM column shows approximate GPU memory usage. If your GPU doesn't have enough VRAM, the model will fail to load. Start with a green-colored model (&le;1 GB) and work up.
  </div>

  <h2 id="ui-panels">UI Panels Guide</h2>

  <h3>Left Side</h3>
  <ul>
    <li><strong>Stage Pipeline</strong> — Visual diagram of all 8 FSM stages. The active stage glows green and shows elapsed time in milliseconds.</li>
    <li><strong>Controls</strong> — Start/Stop the microphone, Reset state, Speak Test (verifies TTS), and Simulate Input textbox (manual text entry bypassing the mic).</li>
    <li><strong>LLM Toggles</strong> — Enable/disable the LLM for classification and/or response generation. Both require a loaded model. Classification defaults to OFF (rule-based is faster), Response defaults to ON.</li>
    <li><strong>A/B Model Comparison</strong> — Collapsible panel for loading two models and comparing their outputs side-by-side (experimental).</li>
  </ul>

  <h3>Right Side</h3>
  <ul>
    <li><strong>Internal State (Summary)</strong> — Human-readable view of the current FSM state: stage, VAD metrics (audio level, speaking, silence duration), transcript, classification, response, and all bias values. Internal monologue (from think tags) is shown in a blue box.</li>
    <li><strong>Internal State (JSON)</strong> — Raw JSON dump of the complete state object for debugging.</li>
    <li><strong>Prompts</strong> — Collapsible panel showing the filled prompt templates sent to the LLM. Shows both the CLASSIFY and MICRO_RESPONSE prompts, with their raw outputs. Each has a copy button.</li>
    <li><strong>Decision Trace</strong> — Mechanical log of every FSM decision. Shows timestamps, stage names, and details like <code>silence_ms=1520 >= 1500 => turn_end</code>. Auto-scrolls to latest entry.</li>
    <li><strong>Bias Sliders</strong> — Manual controls for all bias parameters: silence threshold, confidence floor, verbosity, interruption sensitivity. Changes take effect on the next loop iteration.</li>
  </ul>

  <h3>Bottom</h3>
  <ul>
    <li><strong>History Timeline</strong> — Horizontal scrollable list of all completed loop iterations. Each card shows: loop number, total duration, transcript, intent (color-coded), and response. Auto-scrolls right to show the latest iteration.</li>
  </ul>

  <h2 id="tech-stack">Technology Stack</h2>
  <table>
    <thead><tr><th>Component</th><th>Technology</th><th>Purpose</th></tr></thead>
    <tbody>
      <tr><td>Framework</td><td>React + TypeScript + Vite</td><td>UI and hot-reload bundling</td></tr>
      <tr><td>Styling</td><td>Tailwind CSS v4 + shadcn/ui</td><td>Dark theme, component library</td></tr>
      <tr><td>Speech-to-Text</td><td>Web Speech API</td><td>Browser-native ASR (no cloud)</td></tr>
      <tr><td>Audio Levels</td><td>AudioContext + AnalyserNode</td><td>Real-time audio level monitoring</td></tr>
      <tr><td>Text-to-Speech</td><td>@diffusionstudio/vits-web</td><td>Piper voices via ONNX in browser</td></tr>
      <tr><td>LLM Inference</td><td>@mlc-ai/web-llm</td><td>In-browser LLM via WebGPU</td></tr>
      <tr><td>Icons</td><td>Lucide React</td><td>UI iconography</td></tr>
    </tbody>
  </table>

  <h3>Integration Sources</h3>
  <p>This project integrates patterns from three repositories:</p>
  <ul>
    <li><a href="https://github.com/davidbmar/Browser-Text-to-Speech-TTS-Realtime">Browser-Text-to-Speech-TTS-Realtime</a> — TTS engine with chunked generation + concurrent playback loop, and ASR listener patterns</li>
    <li><a href="https://github.com/davidbmar/browser-llm-local-ai-chat">browser-llm-local-ai-chat</a> — WebLLM integration with streaming token generation</li>
  </ul>

  <h2 id="architecture">Code Architecture</h2>

  <h3>Key Design Decision</h3>
  <p><code>LoopController</code> is a <strong>plain TypeScript class</strong> — not a React hook. This keeps the FSM testable and framework-independent. The <code>useLoop</code> hook is a thin subscriber wrapper using <code>useSyncExternalStore</code>.</p>

  <h3>Directory Structure</h3>
  <pre><code>src/
  lib/                         # Framework-independent core logic
    loop-types.ts              # All types, constants, model catalog
    loop-controller.ts         # Core FSM — transition table + side effects
    audio-listener.ts          # Web Speech API + AudioContext wrapper
    tts-speaker.ts             # Streaming TTS with concurrent generation
    llm-engine.ts              # WebLLM wrapper with streaming inference
    prompt-templates.ts        # Classify + response prompt templates
    decision-trace.ts          # Observable trace log accumulator
    bias-store.ts              # Bias values + reaction-based update rules
  hooks/
    use-loop.ts                # React hook: subscribes to LoopController
  components/
    ui/                        # shadcn base components
    layout/app-layout.tsx      # Top-level grid layout
    loop/                      # Stage diagram, controls
    state/                     # Internal state panel, bias sliders
    prompts/                   # Prompt viewer with copy
    trace/                     # Decision trace panel
    model/                     # Model selector, toggles, A/B panel
    history/                   # History timeline
    docs/                      # Documentation window</code></pre>

  <h3>Data Flow</h3>
  <pre><code>AudioListener ──→ LoopController.dispatch(AUDIO_FRAME / TURN_END)
                       │
                       ▼
              ┌─ Transition Table ─┐
              │  stage + event     │
              │  → new stage       │
              │  → side effect     │
              └────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
   runClassify()  runMicroResponse() runSpeak()
   (LLM or rules) (LLM streaming    (TTSSpeaker
                   → TTS push)       .speak())
                       │
                       ▼
              notifyListeners()
                       │
                       ▼
           useSyncExternalStore
                       │
                       ▼
              React re-renders</code></pre>

  <h2 id="troubleshooting">Troubleshooting</h2>
  <table>
    <thead><tr><th>Issue</th><th>Solution</th></tr></thead>
    <tbody>
      <tr><td>Model failed to load</td><td>Check that your browser supports WebGPU (Chrome 113+). Open DevTools console for specific errors. Try a smaller model first.</td></tr>
      <tr><td>No audio output</td><td>Click "Speak Test" first. Some browsers block autoplay — you need to interact with the page before audio can play.</td></tr>
      <tr><td>Speech recognition not working</td><td>Grant microphone permission. Web Speech API requires HTTPS or localhost.</td></tr>
      <tr><td>Agent hears its own voice</td><td>Echo cancellation pauses the mic during TTS. If issues persist, use headphones.</td></tr>
      <tr><td>Model downloads every time</td><td>Models are cached in IndexedDB. Clearing site data removes the cache.</td></tr>
      <tr><td>Responses cut off mid-sentence</td><td>Increase the verbosity slider, or check the response in the Prompts panel.</td></tr>
      <tr><td>Same responses every time</td><td>No model is loaded — you're seeing rule-based responses. Load a model from the dropdown.</td></tr>
      <tr><td>High latency before first word</td><td>Streaming TTS is only active with LLM responses. Rule-based responses generate the full text first.</td></tr>
    </tbody>
  </table>

  <hr />
  <p style="color: hsl(215 20.2% 55%); font-size: 0.85rem; margin-top: 2rem; text-align: center;">
    Bug Loop Voice Agent &mdash; Built with React, WebGPU, Web Speech API, and Piper TTS. All processing runs locally in your browser.
  </p>
</body>
</html>`;
}
