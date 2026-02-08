import type { LoopState } from "@/lib/loop-types.ts";

interface StateSummaryProps {
  state: LoopState;
}

function Field({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}

export function StateSummary({ state }: StateSummaryProps) {
  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="space-y-1">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Stage</h4>
        <div className="font-mono text-primary font-bold">{state.stage}</div>
        <Field label="Loop count" value={state.loopCount} />
        <Field label="Running" value={state.isRunning ? "yes" : "no"} />
        <Field label="Listener" value={state.listenerPaused ? "paused (echo cancel)" : state.isRunning ? "active" : "off"} />
        <Field label="Audio" value={state.audioMuted ? "muted" : "on"} />
      </div>

      <div className="space-y-1">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">VAD</h4>
        <Field label="Audio level" value={state.vad.audioLevel.toFixed(1)} />
        <Field label="Speaking" value={state.vad.isSpeaking ? "yes" : "no"} />
        <Field label="Silence (ms)" value={state.vad.silenceDurationMs} />
        <Field label="Speech (ms)" value={state.vad.speechDurationMs} />
      </div>

      <div className="space-y-1">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Transcript</h4>
        <div className="text-xs font-mono break-all bg-muted/50 rounded p-1.5 max-h-16 overflow-auto">
          {state.finalTranscript || state.interimTranscript || "(none)"}
        </div>
        <Field label="Confidence" value={state.transcriptConfidence.toFixed(2)} />
      </div>

      {state.classification && (
        <div className="space-y-1">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Classification</h4>
          <Field label="Intent" value={state.classification.intent} />
          <Field label="Confidence" value={state.classification.confidence.toFixed(2)} />
          <Field label="Needs clarification" value={state.classification.needsClarification ? "yes" : "no"} />
          <Field label="Used LLM" value={state.classification.usedLLM ? "yes" : "no"} />
        </div>
      )}

      {state.lastThinking && (
        <div className="space-y-1">
          <h4 className="text-xs font-semibold text-blue-400 uppercase tracking-wide">Internal Monologue (soft female voice)</h4>
          <div className="text-xs font-mono break-all bg-blue-500/10 border border-blue-500/20 rounded p-1.5 max-h-20 overflow-auto italic">
            {state.lastThinking}
          </div>
        </div>
      )}

      <div className="space-y-1">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Last Response {state.lastThinking ? "(British voice)" : ""}
        </h4>
        <div className="text-xs font-mono break-all bg-muted/50 rounded p-1.5">
          {state.lastResponse || "(none)"}
        </div>
        <Field label="Tokens" value={state.lastResponseTokens} />
      </div>

      <div className="space-y-1">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Bias</h4>
        <Field label="Verbosity" value={state.bias.verbosity.toFixed(2)} />
        <Field label="Clarification threshold" value={state.bias.clarificationThreshold.toFixed(2)} />
        <Field label="Interruption sensitivity" value={state.bias.interruptionSensitivity.toFixed(2)} />
        <Field label="Silence threshold (ms)" value={state.bias.silenceThresholdMs} />
        <Field label="Confidence floor" value={state.bias.confidenceFloor.toFixed(2)} />
      </div>
    </div>
  );
}
