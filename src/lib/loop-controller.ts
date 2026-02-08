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
  private stateListeners: Set<() => void> = new Set();
  private sentenceBuffer = "";
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private speechStartTime = 0;
  private lastAudioLevel = 0;
  private silenceStartTime = 0;
  private feedbackTimer: ReturnType<typeof setTimeout> | null = null;
  private iterationStartTime = 0;
  private searchProvider: SearchProvider = new MockSearchProvider();

  constructor() {
    this.trace = new DecisionTrace();
    this.biasStore = new BiasStore();

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
        this.state.error = err;
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
        this.state.error = err;
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
        this.state.error = err;
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
        if (stage === "LISTENING") {
          this.state.interimTranscript = event.interimText;
          this.state.vad.audioLevel = event.audioLevel;
          if (event.interimText) {
            this.setStage("SIGNAL_DETECT");
          }
          this.notifyListeners();
        } else if (stage === "SIGNAL_DETECT") {
          this.state.interimTranscript = event.interimText;
          this.state.vad.audioLevel = event.audioLevel;
          this.notifyListeners();
        }
        return;

      case "TURN_END":
        if (stage === "SIGNAL_DETECT" || stage === "LISTENING") {
          this.clearSilenceTimer();
          this.state.finalTranscript = event.finalText;
          this.state.transcriptConfidence = event.confidence;
          this.trace.add(stage, "turn_end", `Final: "${event.finalText}" conf=${event.confidence.toFixed(2)}`);
          this.setStage("CLASSIFY");
          this.runClassify();
        }
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
        }
        return;
    }
  }

  private reset() {
    this.listener.stop();
    this.speaker.stop();
    this.clearSilenceTimer();
    this.clearFeedbackTimer();
    this.state = {
      ...DEFAULT_LOOP_STATE,
      modelConfig: { ...this.state.modelConfig },
      bias: this.biasStore.get(),
    };
    this.trace.clear();
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
      if (
        this.state.stage === "SIGNAL_DETECT" &&
        this.state.interimTranscript &&
        this.state.vad.silenceDurationMs >= bias.silenceThresholdMs
      ) {
        this.trace.add(
          this.state.stage,
          "silence_turn_end",
          `silence_ms=${this.state.vad.silenceDurationMs} >= ${bias.silenceThresholdMs} => turn_end`
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

          try {
            const searchResponse = await this.searchProvider.search(searchNeed.searchQuery, 3);

            this.state.lastSearchQuery = searchNeed.searchQuery;
            this.state.lastSearchResults = searchResponse.results.map(r => ({
              title: r.title, snippet: r.snippet,
            }));
            this.state.lastSearchDurationMs = searchResponse.durationMs;
            this.state.lastSearchProvider = searchResponse.provider;
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

                // Start streaming TTS with monologue spoken first
                if (thinkBuffer) {
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
    if (lastThinking) {
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
    } else {
      this.state.isRunning = false;
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
    await this.llmEngine.loadModel(modelId);
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

  setSearchProvider(provider: SearchProvider) {
    this.searchProvider = provider;
    this.trace.add(this.state.stage, "search_provider_set", `Provider: ${provider.name}`);
  }
}
