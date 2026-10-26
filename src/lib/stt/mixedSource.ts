import type { AudioSource, AudioSourceHandlers } from "@soniox/client";

/**
 * Mixes the local microphone with a shared browser tab's audio (e.g. the guest
 * on Riverside/Zoom/Meet) into one Opus stream for transcription.
 */
export class MixedSource implements AudioSource {
  private ctx: AudioContext | null = null;
  private recorder: MediaRecorder | null = null;
  private streams: MediaStream[] = [];
  private chain: Promise<void> = Promise.resolve();
  private dest: MediaStreamAudioDestinationNode | null = null;
  private handlers: AudioSourceHandlers | null = null;

  async start(handlers: AudioSourceHandlers): Promise<void> {
    const mic = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
    });
    this.streams.push(mic);

    // Chrome only shares tab audio alongside video; the video track is dropped immediately.
    const display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    this.streams.push(display);
    display.getVideoTracks().forEach((t) => t.stop());
    if (display.getAudioTracks().length === 0) {
      this.stop();
      throw new Error('No tab audio shared. Pick the call tab and tick "Share tab audio".');
    }

    this.ctx = new AudioContext();
    const dest = this.ctx.createMediaStreamDestination();
    this.ctx.createMediaStreamSource(mic).connect(dest);
    this.ctx.createMediaStreamSource(new MediaStream(display.getAudioTracks())).connect(dest);

    this.dest = dest;
    this.handlers = handlers;
    display.getAudioTracks()[0].onended = () => handlers.onError(new Error("Tab audio sharing stopped"));
    this.startRecorder();
  }

  /** WebM chunks are not independently decodable, so every new server session needs a fresh recorder. */
  private startRecorder(): void {
    const dest = this.dest;
    const handlers = this.handlers;
    if (!dest || !handlers) return;
    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : undefined;
    const recorder = new MediaRecorder(dest.stream, mimeType ? { mimeType } : undefined);
    recorder.ondataavailable = (e) => {
      if (e.data.size === 0 || recorder !== this.recorder) return;
      // Keep chunk order even though arrayBuffer() is async.
      this.chain = this.chain.then(async () => handlers.onData(await e.data.arrayBuffer())).catch((err: Error) => handlers.onError(err));
    };
    recorder.onerror = () => handlers.onError(new Error("Audio recorder failed"));
    this.recorder = recorder;
    recorder.start(60);
  }

  /** Called by the SDK on reconnect so the new session gets a stream with container headers. */
  restart(): void {
    const old = this.recorder;
    this.recorder = null;
    if (old && old.state !== "inactive") old.stop();
    this.startRecorder();
  }

  stop(): void {
    const recorder = this.recorder;
    this.recorder = null;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    this.dest = null;
    this.handlers = null;
    this.streams.forEach((s) => s.getTracks().forEach((t) => t.stop()));
    this.streams = [];
    void this.ctx?.close();
    this.ctx = null;
  }

  // Pause the encoder itself; dropping chunks would corrupt the WebM stream.
  pause(): void {
    if (this.recorder?.state === "recording") this.recorder.pause();
  }

  resume(): void {
    if (this.recorder?.state === "paused") this.recorder.resume();
  }
}
