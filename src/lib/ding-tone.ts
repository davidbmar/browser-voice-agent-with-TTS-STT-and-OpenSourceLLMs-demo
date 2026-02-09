/**
 * ding-tone.ts — Generates a short "ding" notification tone as a WAV Blob
 * using OfflineAudioContext. Played after search filler to fill silence
 * while the system works on search + LLM generation.
 */

/**
 * Generate a short sine-wave ding tone as a playable WAV Blob.
 * Uses OfflineAudioContext so it works without user gesture.
 */
export async function generateDingBlob(
  frequency = 880,
  duration = 0.25,
  sampleRate = 22050,
): Promise<Blob> {
  const ctx = new OfflineAudioContext(1, Math.ceil(sampleRate * duration), sampleRate);

  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.value = frequency;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.5, 0);
  gain.gain.exponentialRampToValueAtTime(0.001, duration);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(0);
  osc.stop(duration);

  const buffer = await ctx.startRendering();
  return audioBufferToWav(buffer);
}

/** Encode an AudioBuffer as a 16-bit PCM WAV Blob. */
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = 1;
  const sampleRate = buffer.sampleRate;
  const bitsPerSample = 16;
  const samples = buffer.getChannelData(0);
  const dataLength = samples.length * (bitsPerSample / 8);
  const totalLength = 44 + dataLength;

  const ab = new ArrayBuffer(totalLength);
  const view = new DataView(ab);

  // RIFF header
  writeStr(view, 0, "RIFF");
  view.setUint32(4, totalLength - 8, true);
  writeStr(view, 8, "WAVE");

  // fmt chunk
  writeStr(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true);
  view.setUint16(32, numChannels * (bitsPerSample / 8), true);
  view.setUint16(34, bitsPerSample, true);

  // data chunk
  writeStr(view, 36, "data");
  view.setUint32(40, dataLength, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Blob([ab], { type: "audio/wav" });
}

/**
 * Generate a happy, celebratory jingle as a playable WAV Blob.
 * Plays an ascending arpeggio (C5-E5-G5-C6) with shimmer harmonics.
 * Uses OfflineAudioContext so it works without user gesture.
 */
export async function generateHappyJingleBlob(
  sampleRate = 22050,
): Promise<Blob> {
  const totalDuration = 0.8;
  const ctx = new OfflineAudioContext(1, Math.ceil(sampleRate * totalDuration), sampleRate);

  const notes = [
    { frequency: 523.25, startTime: 0.0 },   // C5
    { frequency: 659.25, startTime: 0.15 },  // E5
    { frequency: 783.99, startTime: 0.3 },   // G5
    { frequency: 1046.5, startTime: 0.45 },  // C6
  ];

  const noteDuration = 0.25;
  const shimmerGainVal = 0.15;
  const mainGainVal = 0.35;

  for (const note of notes) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = note.frequency;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, note.startTime);
    gain.gain.linearRampToValueAtTime(mainGainVal, note.startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, note.startTime + noteDuration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(note.startTime);
    osc.stop(note.startTime + noteDuration);

    // Shimmer harmonic (octave up, quieter)
    const shimmerOsc = ctx.createOscillator();
    shimmerOsc.type = "sine";
    shimmerOsc.frequency.value = note.frequency * 2;

    const shimmerGain = ctx.createGain();
    shimmerGain.gain.setValueAtTime(0.001, note.startTime);
    shimmerGain.gain.linearRampToValueAtTime(shimmerGainVal, note.startTime + 0.02);
    shimmerGain.gain.exponentialRampToValueAtTime(0.001, note.startTime + noteDuration);

    shimmerOsc.connect(shimmerGain);
    shimmerGain.connect(ctx.destination);
    shimmerOsc.start(note.startTime);
    shimmerOsc.stop(note.startTime + noteDuration);
  }

  const buffer = await ctx.startRendering();
  return audioBufferToWav(buffer);
}

function writeStr(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}
