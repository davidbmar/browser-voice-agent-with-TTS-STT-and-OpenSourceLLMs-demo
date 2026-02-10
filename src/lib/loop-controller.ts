/**
 * loop-controller.ts — Core finite state machine for the Bug Loop Voice Agent.
 *
 * This is the brain of the application. It manages:
 *  - Stage transitions (IDLE → LISTENING → ... → UPDATE_BIAS → LISTENING)
 *  - Event dispatching (MIC_START, TURN_END, CLASSIFY_DONE, etc.)
 *  - Integration with AudioListener (ASR), TTSSpeaker (TTS), and LLMEngine
 *  - Streaming TTS pipeline (sentence detection + push during LLM generation)
 *  - Rule-based fallbacks when no LLM is loaded
 *  - State snapshots for React (useSyncExternalStore-compatible)
 *
 * Design: This is a plain TypeScript class with no React dependency.
 * The useLoop hook subscribes via getState()/subscribe().
 */

import type {
  Stage,
  LoopEvent,
  LoopState,
  Classification,
  BiasValues,
  LoopHistoryEntry,
} from "./loop-types.ts";
import { DEFAULT_LOOP_STATE } from "./loop-types.ts";
import { AudioListener } from "./audio-listener.ts";
import { TTSSpeaker } from "./tts-speaker.ts";
import { LLMEngine } from "./llm-engine.ts";
import { DecisionTrace } from "./decision-trace.ts";
import { BiasStore } from "./bias-store.ts";
import { buildClassifyPrompt, buildMicroResponsePrompt, buildSearchAugmentedResponsePrompt, parseThinkTags } from "./prompt-templates.ts";
import type { SearchProvider } from "./search-provider.ts";
import { MockSearchProvider } from "./search-provider.ts";
import { detectSearchNeed } from "./search-need-detector.ts";
import { formatSearchResults } from "./search-result-formatter.ts";
import { SpeechEventLog } from "./speech-event-log.ts";

// ---------------------------------------------------------------------------
// Rule-based fallbacks (used when LLM is not loaded or fails)
// ---------------------------------------------------------------------------

/** Classify user intent using keyword matching. Zero latency, no model needed. */
function classifyRuleBased(transcript: string, confidence: number, confidenceFloor: number): Classification {
  const lower = transcript.toLowerCase().trim();
  const questionWords = ["what", "where", "when", "why", "how", "who", "which", "is", "are", "do", "does", "can", "could", "will", "would", "should"];
  const commandWords = ["stop", "start", "play", "pause", "go", "open", "close", "turn", "set", "show", "tell", "find", "search"];
  const ackPhrases = ["okay", "ok", "got it", "sure", "yes", "yeah", "yep", "right", "alright", "mm-hm", "uh-huh", "thanks", "thank you"];
  const greetings = ["hello", "hi", "hey", "howdy", "greetings", "good morning", "good afternoon", "good evening"];
  const farewells = ["bye", "goodbye", "see you", "later", "good night", "farewell"];

  let intent = "statement";
  const topics: string[] = [];

  if (confidence < confidenceFloor) {
    intent = "clarification_needed";
  } else if (greetings.some((g) => lower.startsWith(g))) {
    intent = "greeting";
  } else if (farewells.some((f) => lower.includes(f))) {
    intent = "farewell";
  } else if (lower.endsWith("?") || questionWords.some((w) => lower.startsWith(w + " "))) {
    intent = "question";
  } else if (commandWords.some((w) => lower.startsWith(w + " ") || lower === w)) {
    intent = "command";
  } else if (ackPhrases.some((p) => lower === p || lower.startsWith(p))) {
    intent = "acknowledgement";
  }

  return {
    intent,
    confidence,
    topics,
    needsClarification: intent === "clarification_needed",
    usedLLM: false,
    rawOutput: JSON.stringify({ intent, confidence, topics, needsClarification: intent === "clarification_needed" }),
  };
}

/** Generate a canned response based on classified intent. */
function respondRuleBased(classification: Classification): { response: string; tokens: number } {
  const { intent } = classification;
  const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

  let response: string;
  switch (intent) {
    case "clarification_needed":
      response = pick(["Say again?", "What do you mean?", "Can you clarify?", "I didn't catch that."]);
      break;
    case "acknowledgement":
      response = pick(["Got it.", "Okay.", "Mm-hm.", "Right."]);
      break;
    case "greeting":
      response = pick(["Hi there.", "Hello.", "Hey."]);
      break;
    case "farewell":
      response = pick(["Bye.", "See you.", "Later."]);
      break;
    case "question":
      response = pick(["Interesting question.", "Hmm, let me think.", "Good question."]);
      break;
    case "command":
      response = pick(["On it.", "Will do.", "Doing that now."]);
      break;
    default:
      response = pick(["I hear you.", "Noted.", "Okay."]);
  }

  return { response, tokens: response.split(/\s+/).length };
}

export class LoopController {
  private state: LoopState = { ...DEFAULT_LOOP_STATE };
  private snapshot: LoopState = this.state;
  private listener: AudioListener;
  private speaker: TTSSpeaker;
  private llmEngine: LLMEngine;
  readonly trace: DecisionTrace;
  readonly biasStore: BiasStore;
  readonly speechLog: SpeechEventLog;
  private stateListeners: Set<() => void> = new Set();
  private sentenceBuffer = "";
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private speechStartTime = 0;
  private lastAudioLevel = 0;
  private silenceStartTime = 0;
  private feedbackTimer: ReturnType<typeof setTimeout> | null = null;
  private iterationStartTime = 0;
  private searchProvider: SearchProvider = new MockSearchProvider();
  private pendingTurns: Array<{ finalText: string; confidence: number; receivedAt: number }> = [];
  private static readonly MAX_PENDING_TURNS = 3;
  private lastInterimTextAt = 0;

  constructor() {
    this.trace = new DecisionTrace();
    this.biasStore = new BiasStore();
    this.speechLog = new SpeechEventLog();

    // Integration point: Browser-Text-to-Speech-TTS-Realtime — listener init
    // See: https://github.com/davidbmar/Browser-Text-to-Speech-TTS-Realtime
    this.listener = new AudioListener({
      onInterimTranscript: (text) => {
        this.dispatch({ type: "AUDIO_FRAME", audioLevel: this.lastAudioLevel, interimText: text });
      },
      onFinalTranscript: (text, confidence) => {
        this.dispatch({ type: "TURN_END", finalText: text, confidence });
      },
      onAudioLevel: (level) => {
        this.lastAudioLevel = level;
        this.updateVADFromLevel(level);
      },
      onError: (err) => {
        this.state.error = this.friendlyError(err);
        this.notifyListeners();
      },
      onStateChange: (s) => {
        this.state.listenerPaused = (s === "paused");
        this.notifyListeners();
      },
    });

    // Integration point: Browser-Text-to-Speech-TTS-Realtime — TTS speaker init
    // See: https://github.com/davidbmar/Browser-Text-to-Speech-TTS-Realtime
    this.speaker = new TTSSpeaker({
      onSpeakStart: () => {
        this.trace.add(this.state.stage, "tts_start", "TTS playback started");
      },
      onSpeakEnd: () => {
        this.dispatch({ type: "SPEAK_DONE" });
      },
      onError: (err) => {
        this.state.error = this.friendlyError(err);
        this.dispatch({ type: "SPEAK_DONE" });
      },
    });

    // Integration point: browser-llm-local-ai-chat — LLM engine init
    // See: https://github.com/davidbmar/browser-llm-local-ai-chat
    this.llmEngine = new LLMEngine({
      onLoadProgress: (p) => {
        this.state.modelConfig.loadProgress = p.progress;
        this.notifyListeners();
      },
      onLoadComplete: () => {
        this.state.modelConfig.isLoaded = true;
        this.state.modelConfig.loadProgress = 1;
        this.notifyListeners();
      },
      onError: (err) => {
        this.state.error = this.friendlyError(err);
        this.notifyListeners();
      },
    });
  }

  getState(): LoopState {
    return this.snapshot;
  }

  subscribe(listener: () => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  private notifyListeners() {
    this.state.bias = this.biasStore.get();
    this.state.audioDiagnostics = this.listener.getDiagnostics();
    this.state.listenerPaused = this.listener.isPaused();
    this.state.audioMuted = this.speaker.isMuted();
    this.snapshot = { ...this.state };
    for (const l of this.stateListeners) l();
  }

  private setStage(newStage: Stage) {
    const now = Date.now();
    const prevStage = this.state.stage;
    if (prevStage !== "IDLE") {
      const elapsed = now - this.state.stageEnteredAt;
      this.state.currentStageTimings[prevStage] = elapsed;
    }
    this.state.stage = newStage;
    this.state.stageEnteredAt = now;
    if (newStage === "LISTENING") this.state.error = null;
    this.trace.add(newStage, "stage_enter", `Entered ${newStage}`);
    this.notifyListeners();
  }

  dispatch(event: LoopEvent) {
    const { stage } = this.state;

    switch (event.type) {
      case "RESET":
        this.reset();
        return;

      case "MIC_START":
        if (stage === "IDLE") {
          // Unlock iOS audio — must happen synchronously in user gesture context
          this.speaker.unlockAudio();
          this.state.isRunning = true;
          this.state.error = null;
          this.iterationStartTime = Date.now();
          this.setStage("LISTENING");
          this.listener.start();
        }
        return;

      case "MIC_STOP":
        this.listener.stop();
        this.clearSilenceTimer();
        this.state.isRunning = false;
        this.setStage("IDLE");
        return;

      case "AUDIO_FRAME":
        // Always update VAD metrics (parallel listener pipeline)
        this.state.vad.audioLevel = event.audioLevel;
        if (event.interimText) {
          this.lastInterimTextAt = Date.now();
          this.speechLog.add("interim", event.interimText, 0, stage);
        }

        if (stage === "LISTENING") {
          this.state.interimTranscript = event.interimText;
          if (event.interimText) {
            // Reset silence counter so stale silence from between utterances
            // doesn't immediately trigger turn-end detection in SIGNAL_DETECT
            this.silenceStartTime = 0;
            this.state.vad.silenceDurationMs = 0;
            this.state.vad.isSpeaking = true;
            this.speechStartTime = Date.now();
            this.setStage("SIGNAL_DETECT");
          }
          this.notifyListeners();
        } else if (stage === "SIGNAL_DETECT") {
          this.state.interimTranscript = event.interimText;
          this.notifyListeners();
        } else if (stage === "FEEDBACK_OBSERVE") {
          if (event.interimText) {
            this.trace.add(stage, "speech_during_feedback", `User speaking: "${event.interimText.slice(0, 40)}"`);
          }
          this.notifyListeners();
        } else {
          // CLASSIFY, MICRO_RESPONSE, SPEAK, UPDATE_BIAS — VAD updated above, notify UI
          this.notifyListeners();
        }
        return;

      case "TURN_END":
        this.speechLog.add("final", event.finalText, event.confidence, stage);
        if (stage === "SIGNAL_DETECT" || stage === "LISTENING") {
          // Normal path: process immediately
          this.clearSilenceTimer();
          this.state.finalTranscript = event.finalText;
          this.state.transcriptConfidence = event.confidence;
          this.trace.add(stage, "turn_end", `Final: "${event.finalText}" conf=${event.confidence.toFixed(2)}`);
          this.setStage("CLASSIFY");
          this.runClassify();
        } else if (stage === "FEEDBACK_OBSERVE") {
          // User spoke during feedback — treat as active reaction + queue turn
          this.clearFeedbackTimer();
          this.trace.add(stage, "speech_reaction", `User spoke during feedback: "${event.finalText.slice(0, 40)}"`);
          this.dispatch({ type: "REACTION_DETECTED", reactionType: "follow_up" });
          this.queueTurn(event.finalText, event.confidence, "feedback_speech");
        } else if (stage === "CLASSIFY" || stage === "MICRO_RESPONSE" || stage === "UPDATE_BIAS" || stage === "SPEAK") {
          // FSM is busy — queue for later
          this.queueTurn(event.finalText, event.confidence, `busy_${stage.toLowerCase()}`);
        }
        // IDLE: drop (mic not started)
        return;

      case "SIMULATE_INPUT":
        if (stage === "IDLE" || stage === "LISTENING" || stage === "SIGNAL_DETECT") {
          this.speaker.unlockAudio();
          this.state.isRunning = true;
          this.state.error = null;
          this.iterationStartTime = Date.now();
          this.state.finalTranscript = event.text;
          this.state.transcriptConfidence = 1.0;
          this.state.interimTranscript = "";
          this.trace.add(stage, "simulate_input", `Simulated: "${event.text}"`);
          this.setStage("CLASSIFY");
          this.runClassify();
        }
        return;

      case "CLASSIFY_DONE":
        if (stage === "CLASSIFY") {
          this.state.classification = event.classification;
          this.trace.add(stage, "classify_done", `Intent: ${event.classification.intent}, conf=${event.classification.confidence.toFixed(2)}, llm=${event.classification.usedLLM}`);
          this.setStage("MICRO_RESPONSE");
          this.runMicroResponse();
        }
        return;

      case "MICRO_RESPONSE_DONE":
        if (stage === "MICRO_RESPONSE") {
          // Parse <think>...</think> tags from LLM output (non-streaming path only)
          const { thinking, response: cleanResponse } = parseThinkTags(event.response);
          this.state.lastThinking = thinking;
          this.state.lastResponse = cleanResponse || event.response;
          this.state.lastResponseTokens = event.tokenCount;
          if (thinking) {
            this.trace.add(stage, "monologue_parsed", `Internal monologue: "${thinking.slice(0, 80)}..."`);
          }
          this.trace.add(stage, "response_done", `"${this.state.lastResponse}" (${event.tokenCount} tokens)`);
          this.setStage("SPEAK");
          this.runSpeak();
        }
        return;

      case "SPEAK_DONE":
        if (stage === "SPEAK") {
          // Echo cancellation: resume listening
          this.listener.resume();
          this.setStage("FEEDBACK_OBSERVE");
          this.startFeedbackObservation();
        }
        return;

      case "REACTION_DETECTED":
        if (stage === "FEEDBACK_OBSERVE") {
          this.clearFeedbackTimer();
          this.trace.add(stage, "reaction", `Reaction: ${event.reactionType}`);
          this.setStage("UPDATE_BIAS");
          this.runUpdateBias(event.reactionType);
        }
        return;

      case "HANDOFF_COMPLETE":
        if (stage === "HANDOFF_REASON") {
          this.setStage("LISTENING");
          this.drainPendingTurn();
        }
        return;
    }
  }

  private reset() {
    this.listener.stop();
    this.speaker.stop();
    this.clearSilenceTimer();
    this.clearFeedbackTimer();
    this.pendingTurns = [];
    this.lastInterimTextAt = 0;
    this.state = {
      ...DEFAULT_LOOP_STATE,
      modelConfig: { ...this.state.modelConfig },
      bias: this.biasStore.get(),
    };
    this.trace.clear();
    this.speechLog.clear();
    this.notifyListeners();
  }

  private updateVADFromLevel(level: number) {
    const now = Date.now();
    const bias = this.biasStore.get();
    const SPEECH_THRESHOLD = 8;

    if (level > SPEECH_THRESHOLD) {
      if (!this.state.vad.isSpeaking) {
        this.state.vad.isSpeaking = true;
        this.speechStartTime = now;
        this.state.vad.silenceDurationMs = 0;
        this.clearSilenceTimer();
      }
      this.state.vad.speechDurationMs = now - this.speechStartTime;
    } else {
      if (this.state.vad.isSpeaking) {
        this.state.vad.isSpeaking = false;
        this.silenceStartTime = now;
      }
      if (this.silenceStartTime > 0) {
        this.state.vad.silenceDurationMs = now - this.silenceStartTime;
      }

      // Silence-based turn end detection
      // Require silence from BOTH audio level AND SpeechRecognition.
      // SR can detect speech even when audio level is below our threshold,
      // so don't fire turn-end while SR is still producing interim text.
      const srSilenceMs = now - this.lastInterimTextAt;
      if (
        this.state.stage === "SIGNAL_DETECT" &&
        this.state.interimTranscript &&
        this.state.vad.silenceDurationMs >= bias.silenceThresholdMs &&
        srSilenceMs >= bias.silenceThresholdMs
      ) {
        this.trace.add(
          this.state.stage,
          "silence_turn_end",
          `audio_silence=${this.state.vad.silenceDurationMs}ms, sr_silence=${srSilenceMs}ms >= ${bias.silenceThresholdMs} => turn_end`
        );
        this.dispatch({
          type: "TURN_END",
          finalText: this.state.interimTranscript,
          confidence: 0.7,
        });
      }
    }
    this.state.vad.audioLevel = level;
  }

  private clearSilenceTimer() {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  private async runClassify() {
    const { finalTranscript, transcriptConfidence } = this.state;
    const bias = this.biasStore.get();

    if (this.state.modelConfig.classifyWithLLM && this.llmEngine.isLoaded()) {
      // LLM classify
      const prompt = buildClassifyPrompt(finalTranscript, transcriptConfidence);
      this.state.filledClassifyPrompt = prompt;
      this.notifyListeners();

      try {
        const raw = await this.llmEngine.generate({
          messages: [
            { role: "system", content: "You are a classification engine. Output ONLY valid JSON." },
            { role: "user", content: prompt },
          ],
          maxTokens: 256,
          temperature: 0.1,
        });

        this.state.classifyRawOutput = raw;
        let parsed: Partial<Classification> = {};
        try {
          // Strip <think> tags before parsing JSON
          const cleanRaw = parseThinkTags(raw).response || raw;
          const jsonMatch = cleanRaw.match(/\{[\s\S]*\}/);
          if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
        } catch (_e) {
          // fallback to rule-based if parse fails
        }

        const classification: Classification = {
          intent: parsed.intent || "statement",
          confidence: parsed.confidence || transcriptConfidence,
          topics: parsed.topics || [],
          needsClarification: parsed.needsClarification || false,
          usedLLM: true,
          rawOutput: raw,
        };
        this.dispatch({ type: "CLASSIFY_DONE", classification });
      } catch (_err) {
        // Fallback to rule-based
        this.trace.add("CLASSIFY", "llm_fallback", "LLM classify failed, using rule-based");
        const classification = classifyRuleBased(finalTranscript, transcriptConfidence, bias.confidenceFloor);
        this.state.classifyRawOutput = classification.rawOutput;
        this.dispatch({ type: "CLASSIFY_DONE", classification });
      }
    } else {
      // Rule-based classify
      const classification = classifyRuleBased(finalTranscript, transcriptConfidence, bias.confidenceFloor);
      this.state.filledClassifyPrompt = `[Rule-based] transcript="${finalTranscript}", confidence=${transcriptConfidence}`;
      this.state.classifyRawOutput = classification.rawOutput;
      this.notifyListeners();
      this.dispatch({ type: "CLASSIFY_DONE", classification });
    }
  }

  private async runMicroResponse() {
    const { finalTranscript, classification } = this.state;
    if (!classification) return;

    const bias = this.biasStore.get();
    const maxWords = Math.max(20, 60 + Math.round(bias.verbosity * 30));

    if (this.state.modelConfig.responseWithLLM && this.llmEngine.isLoaded()) {
      // --- Search augmentation (opt-in) ---
      let searchResultsBlock = "";
      if (this.state.modelConfig.searchEnabled) {
        const searchNeed = detectSearchNeed(
          finalTranscript,
          classification.intent,
          classification.confidence,
        );

        if (searchNeed.needsSearch) {
          this.trace.add("MICRO_RESPONSE", "search_start",
            `Query: "${searchNeed.searchQuery}" (${searchNeed.reason})`);
          this.notifyListeners();

          // Speak a filler phrase so the user hears something while search runs
          const fillerPhrases = [
            "Let me research this.",
            "Hold on... give me a moment.",
            "On it... searching.",
            "Mosey on... hold on.",
            "Let me look that up.",
            "One moment while I search.",
            "Searching for that now.",
            "Give me a sec...",
          ];
          const filler = fillerPhrases[Math.floor(Math.random() * fillerPhrases.length)];
          this.listener.pause();
          this.trace.add("MICRO_RESPONSE", "search_filler", `Speaking filler: "${filler}"`);

          try {
            // Speak filler and search in parallel
            const [, searchResponse] = await Promise.all([
              this.speaker.speak(filler),
              this.searchProvider.search(searchNeed.searchQuery, 3),
            ]);

            this.state.lastSearchQuery = searchNeed.searchQuery;
            this.state.lastSearchResults = searchResponse.results.map(r => ({
              title: r.title, snippet: r.snippet,
            }));
            this.state.lastSearchDurationMs = searchResponse.durationMs;
            this.state.lastSearchProvider = searchResponse.provider;
            // Pull quota from ProxySearchProvider if available
            if ("getLastQuota" in this.searchProvider) {
              const quota = (this.searchProvider as { getLastQuota: () => unknown }).getLastQuota();
              if (quota) this.state.searchQuota = quota as import("./proxy-search-provider.ts").SearchQuota;
            }
            this.notifyListeners();

            searchResultsBlock = formatSearchResults(searchResponse.results);

            this.trace.add("MICRO_RESPONSE", "search_done",
              `${searchResponse.results.length} results in ${searchResponse.durationMs}ms (${searchResponse.provider})`);
          } catch (err) {
            this.trace.add("MICRO_RESPONSE", "search_error",
              `Search failed: ${err instanceof Error ? err.message : "unknown"}`);
          }
        } else {
          this.trace.add("MICRO_RESPONSE", "search_skip", searchNeed.reason);
        }
      }

      // Build prompt — use search-augmented template if we have results
      const prompt = searchResultsBlock
        ? buildSearchAugmentedResponsePrompt(
            finalTranscript, classification.intent, classification.confidence,
            maxWords, classification.needsClarification, searchResultsBlock,
          )
        : buildMicroResponsePrompt(
            finalTranscript, classification.intent, classification.confidence,
            maxWords, classification.needsClarification,
          );
      this.state.filledResponsePrompt = prompt;
      this.state.responseRawOutput = "";
      this.notifyListeners();

      try {
        let tokenCount = 0;
        this.sentenceBuffer = "";
        this.sentencesAlreadyPushed = 0;
        let thinkBuffer = "";
        let inThinkTag = false;
        let thinkTagDone = false;
        let streamStarted = false;

        // Echo cancellation: pause listening during TTS
        this.listener.pause();
        this.trace.add("MICRO_RESPONSE", "echo_cancel", "Paused listener for streaming TTS");

        const response = await this.llmEngine.generate({
          messages: [
            { role: "system", content: "You are a helpful, conversational voice assistant. Give clear and complete answers. Do not cut off mid-sentence." },
            { role: "user", content: prompt },
          ],
          maxTokens: 512,
          temperature: 0.7,
          onToken: (_token, full) => {
            this.state.responseRawOutput = full;
            tokenCount++;
            this.notifyListeners();

            // Track <think> tags in streaming output
            if (!thinkTagDone) {
              // Check if we're entering a think block
              if (full.includes("<think>") && !inThinkTag) {
                inThinkTag = true;
              }
              // Check if think block ended
              if (inThinkTag && full.includes("</think>")) {
                inThinkTag = false;
                thinkTagDone = true;
                const { thinking, response: cleanSoFar } = parseThinkTags(full);
                thinkBuffer = thinking;
                this.state.lastThinking = thinking;

                // Start streaming TTS — speak monologue only if toggle is on
                if (thinkBuffer && this.state.modelConfig.speakMonologue) {
                  this.speaker.beginStreamWithMonologue(thinkBuffer);
                  this.trace.add("MICRO_RESPONSE", "stream_monologue", `Internal monologue queued: "${thinkBuffer.slice(0, 60)}..."`);
                } else {
                  this.speaker.beginStream();
                }
                streamStarted = true;

                // Process any response text that came after </think>
                this.sentenceBuffer = cleanSoFar;
                this.flushCompleteSentences();
                return;
              }
              // Still inside think tag or waiting for it — don't process yet
              if (inThinkTag) return;
            }

            // No think tags at all — start stream on first token
            if (!streamStarted && !inThinkTag) {
              this.speaker.beginStream();
              streamStarted = true;
            }

            // Normal streaming: extract response text after any think tags
            if (thinkTagDone) {
              const { response: cleanText } = parseThinkTags(full);
              this.sentenceBuffer = cleanText;
            } else {
              this.sentenceBuffer = full;
            }
            this.flushCompleteSentences();
          },
        });

        // Ensure stream was started (in case no tokens came)
        if (!streamStarted) {
          this.speaker.beginStream();
          streamStarted = true;
        }

        // Push any remaining text (after last complete sentence) as final chunk
        const { thinking: finalThinking, response: finalClean } = parseThinkTags(response.trim());
        if (!thinkTagDone && finalThinking) {
          this.state.lastThinking = finalThinking;
        }
        // Find where the last complete sentence ends
        const trailRegex = /[^.!?]*[.!?]+["']?\s*/g;
        let lastSentenceEnd = 0;
        while (trailRegex.exec(this.sentenceBuffer) !== null) {
          lastSentenceEnd = trailRegex.lastIndex;
        }
        const remainingText = this.sentenceBuffer.slice(lastSentenceEnd).trim();
        if (remainingText) {
          this.speaker.pushResponseSentence(remainingText);
          this.trace.add("MICRO_RESPONSE", "stream_final", `Final chunk: "${remainingText.slice(0, 60)}"`);
        }

        this.state.lastResponse = finalClean || response.trim();
        this.state.lastResponseTokens = tokenCount;

        // Signal end of stream and transition to SPEAK
        this.setStage("SPEAK");
        this.trace.add("SPEAK", "stream_end", "Ending TTS stream, waiting for playback");
        await this.speaker.endStream();
        this.sentenceBuffer = "";
        // SPEAK_DONE will be dispatched by the speaker's onSpeakEnd callback
      } catch (_err) {
        this.sentenceBuffer = "";
        this.trace.add("MICRO_RESPONSE", "llm_fallback", "LLM response failed, using rule-based");
        const { response, tokens } = respondRuleBased(classification);
        this.state.filledResponsePrompt = `[Rule-based fallback]`;
        this.state.responseRawOutput = response;
        this.dispatch({ type: "MICRO_RESPONSE_DONE", response, tokenCount: tokens });
      }
    } else {
      // Rule-based response — no streaming needed
      const { response, tokens } = respondRuleBased(classification);
      this.state.filledResponsePrompt = `[Rule-based] intent=${classification.intent}`;
      this.state.responseRawOutput = response;
      this.notifyListeners();
      this.dispatch({ type: "MICRO_RESPONSE_DONE", response, tokenCount: tokens });
    }
  }

  /** Flush completed sentences from the buffer into the TTS stream */
  private sentencesAlreadyPushed = 0;
  private flushCompleteSentences() {
    // Backpressure: don't flood the TTS queue on mobile
    if (this.speaker.getQueueDepth() >= 3) return;

    // Match sentence-ending punctuation followed by a space or end
    const sentenceRegex = /[^.!?]*[.!?]+["']?\s*/g;
    let match;
    let sentenceCount = 0;

    while ((match = sentenceRegex.exec(this.sentenceBuffer)) !== null) {
      sentenceCount++;
      if (sentenceCount > this.sentencesAlreadyPushed) {
        // Re-check backpressure before each push
        if (this.speaker.getQueueDepth() >= 3) break;

        const sentence = match[0].trim();
        if (sentence) {
          this.speaker.pushResponseSentence(sentence);
          this.trace.add("MICRO_RESPONSE", "stream_sentence", `Pushed sentence #${sentenceCount}: "${sentence.slice(0, 50)}"`);
        }
        this.sentencesAlreadyPushed = sentenceCount;
      }
    }
  }

  private async runSpeak() {
    const { lastResponse, lastThinking } = this.state;

    // Echo cancellation: pause listening during TTS
    // Integration point: Browser-Text-to-Speech-TTS-Realtime — echo cancellation via pause/resume
    // See: https://github.com/davidbmar/Browser-Text-to-Speech-TTS-Realtime
    this.listener.pause();
    this.trace.add("SPEAK", "echo_cancel", "Paused listener for TTS playback");

    // Integration point: Browser-Text-to-Speech-TTS-Realtime — TTS speak
    // See: https://github.com/davidbmar/Browser-Text-to-Speech-TTS-Realtime
    if (lastThinking && this.state.modelConfig.speakMonologue) {
      this.trace.add("SPEAK", "dual_voice", `Internal monologue (soft female) then response (British voice)`);
      await this.speaker.speakWithMonologue(lastThinking, lastResponse);
    } else {
      await this.speaker.speak(lastResponse);
    }
  }

  private startFeedbackObservation() {
    // Auto-detect "silence" reaction after 2 seconds
    this.feedbackTimer = setTimeout(() => {
      if (this.state.stage === "FEEDBACK_OBSERVE") {
        this.dispatch({ type: "REACTION_DETECTED", reactionType: "silence" });
      }
    }, 2000);
  }

  private clearFeedbackTimer() {
    if (this.feedbackTimer) {
      clearTimeout(this.feedbackTimer);
      this.feedbackTimer = null;
    }
  }

  private queueTurn(finalText: string, confidence: number, reason: string) {
    if (this.pendingTurns.length >= LoopController.MAX_PENDING_TURNS) {
      const dropped = this.pendingTurns.shift()!;
      this.trace.add(this.state.stage, "turn_dropped",
        `Queue full, dropped oldest: "${dropped.finalText.slice(0, 30)}"`);
    }
    const receivedAt = Date.now();
    this.pendingTurns.push({ finalText, confidence, receivedAt });
    this.state.pendingTurnCount = this.pendingTurns.length;
    this.speechLog.add("queued", finalText, confidence, this.state.stage);
    this.trace.add(this.state.stage, "turn_queued",
      `Queued: "${finalText.slice(0, 40)}" (reason=${reason}, queue=${this.pendingTurns.length})`);
    this.notifyListeners();
  }

  private drainPendingTurn() {
    if (this.pendingTurns.length === 0) return;

    const next = this.pendingTurns.shift()!;
    this.state.pendingTurnCount = this.pendingTurns.length;
    const staleness = Date.now() - next.receivedAt;
    this.trace.add("LISTENING", "turn_dequeued",
      `Processing queued turn: "${next.finalText.slice(0, 40)}" (stale=${staleness}ms, remaining=${this.pendingTurns.length})`);

    // Discard stale turns (>10s old)
    if (staleness > 10000) {
      this.speechLog.add("stale_discarded", next.finalText, next.confidence, "LISTENING");
      this.trace.add("LISTENING", "turn_stale",
        `Discarded stale turn: "${next.finalText.slice(0, 40)}" (${staleness}ms old)`);
      this.drainPendingTurn();
      return;
    }

    const processedAt = Date.now();
    this.speechLog.add("dequeued", next.finalText, next.confidence, "LISTENING", {
      processedAt,
      queueDurationMs: processedAt - next.receivedAt,
    });

    // Process as a normal turn
    this.state.finalTranscript = next.finalText;
    this.state.transcriptConfidence = next.confidence;
    this.state.interimTranscript = "";
    this.iterationStartTime = Date.now();
    this.trace.add("LISTENING", "turn_end",
      `Final (from queue): "${next.finalText}" conf=${next.confidence.toFixed(2)}`);
    this.setStage("CLASSIFY");
    this.runClassify();
  }

  private runUpdateBias(reactionType: string) {
    this.biasStore.updateFromReaction(reactionType);
    this.trace.add("UPDATE_BIAS", "bias_updated", `Reaction: ${reactionType}, new bias: ${JSON.stringify(this.biasStore.get())}`);
    this.commitHistoryEntry();
    this.state.loopCount++;

    // Clear all current-turn fields after committing to history
    this.state.interimTranscript = "";
    this.state.finalTranscript = "";
    this.state.classification = null;
    this.state.lastResponse = "";
    this.state.lastThinking = "";
    this.state.lastResponseTokens = 0;
    this.state.filledClassifyPrompt = "";
    this.state.filledResponsePrompt = "";
    this.state.classifyRawOutput = "";
    this.state.responseRawOutput = "";
    this.state.currentStageTimings = {};
    this.state.lastSearchQuery = "";
    this.state.lastSearchResults = [];
    this.state.lastSearchDurationMs = 0;
    this.state.lastSearchProvider = "";
    this.iterationStartTime = Date.now();

    // Loop back to LISTENING if mic is active, otherwise IDLE
    if (this.listener.isActive()) {
      this.setStage("LISTENING");
      this.drainPendingTurn();
    } else {
      this.state.isRunning = false;
      this.pendingTurns = [];
      this.state.pendingTurnCount = 0;
      this.setStage("IDLE");
    }
  }

  private commitHistoryEntry() {
    const entry: LoopHistoryEntry = {
      id: this.state.loopCount + 1,
      transcript: this.state.finalTranscript,
      classification: this.state.classification,
      response: this.state.lastResponse,
      responseTokenCount: this.state.lastResponseTokens,
      totalDurationMs: Date.now() - this.iterationStartTime,
      stageTimings: { ...this.state.currentStageTimings },
      biasSnapshot: this.biasStore.get(),
      modelUsed: this.llmEngine.getModelId(),
      timestamp: Date.now(),
      searchQuery: this.state.lastSearchQuery || null,
      searchResultCount: this.state.lastSearchResults?.length || 0,
    };
    this.state.history = [...this.state.history, entry];
    this.trace.add("UPDATE_BIAS", "history_commit", `Loop #${entry.id} committed (${entry.totalDurationMs}ms)`);
  }

  // Public API for model management
  async loadModel(modelId: string): Promise<void> {
    this.state.modelConfig.modelId = modelId;
    this.state.modelConfig.isLoaded = false;
    this.state.modelConfig.loadProgress = 0;
    this.notifyListeners();
    try {
      await this.llmEngine.loadModel(modelId);
    } catch (err) {
      this.state.modelConfig.modelId = null;
      this.state.modelConfig.isLoaded = false;
      this.state.modelConfig.loadProgress = 0;
      this.notifyListeners();
      throw err;
    }
  }

  async unloadModel(): Promise<void> {
    await this.llmEngine.unloadModel();
    this.state.modelConfig.isLoaded = false;
    this.state.modelConfig.modelId = null;
    this.state.modelConfig.loadProgress = 0;
    this.notifyListeners();
  }

  setClassifyWithLLM(on: boolean) {
    this.state.modelConfig.classifyWithLLM = on;
    this.notifyListeners();
  }

  setResponseWithLLM(on: boolean) {
    this.state.modelConfig.responseWithLLM = on;
    this.notifyListeners();
  }

  setBias(partial: Partial<BiasValues>) {
    this.biasStore.set(partial);
    this.notifyListeners();
  }

  getSpeaker(): TTSSpeaker {
    return this.speaker;
  }

  getLLMEngine(): LLMEngine {
    return this.llmEngine;
  }

  setSearchEnabled(on: boolean) {
    this.state.modelConfig.searchEnabled = on;
    this.notifyListeners();
  }

  setSpeakMonologue(on: boolean) {
    this.state.modelConfig.speakMonologue = on;
    this.notifyListeners();
  }

  setAudioMuted(muted: boolean) {
    this.speaker.setMuted(muted);
    this.state.audioMuted = muted;
    this.notifyListeners();
  }

  setSearchProvider(provider: SearchProvider) {
    this.searchProvider = provider;
    this.trace.add(this.state.stage, "search_provider_set", `Provider: ${provider.name}`);
  }

  clearError() {
    this.state.error = null;
    this.notifyListeners();
  }

  private friendlyError(raw: string): string {
    if (/quota/i.test(raw)) return "Storage full \u2014 try a smaller model or clear site data in browser settings.";
    if (/cache/i.test(raw)) return "Browser cache error \u2014 clearing cache and retrying...";
    if (/tokenizer|deleted object/i.test(raw)) return "Model crashed \u2014 unloaded automatically. Please reload the model.";
    if (/network|fetch/i.test(raw)) return "Network error \u2014 check your connection and try again.";
    return raw;
  }
}
