import { HandLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

const PINCH_THRESHOLD = 0.07;
const SMOOTHING_FACTOR = 0.35;

const MEDIAPIPE_WASM_CDN =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm";
const HAND_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

// Fixed pointer ID so Excalidraw tracks it as one continuous pointer
const HAND_POINTER_ID = 90;

export type HandTrackingStatus = "idle" | "loading" | "active" | "error";

export class HandTracker {
  private handLandmarker: HandLandmarker | null = null;
  private video: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private animationId: number | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private wasPinching = false;
  private smoothX = -1;
  private smoothY = -1;
  private onStatusChange: (status: HandTrackingStatus) => void;

  constructor(onStatusChange: (status: HandTrackingStatus) => void) {
    this.onStatusChange = onStatusChange;
  }

  async start(): Promise<void> {
    this.canvas = document.querySelector(
      "canvas.excalidraw__canvas.interactive",
    );
    if (!this.canvas) {
      this.onStatusChange("error");
      throw new Error("Could not find Excalidraw canvas");
    }

    this.onStatusChange("loading");

    const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_CDN);

    this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: HAND_MODEL_URL,
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numHands: 1,
    });

    this.video = document.createElement("video");
    this.video.setAttribute("autoplay", "");
    this.video.setAttribute("playsinline", "");

    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: "user" },
    });
    this.video.srcObject = this.stream;
    await this.video.play();

    this.onStatusChange("active");
    this.detect();
  }

  private detect = (): void => {
    if (!this.handLandmarker || !this.video || !this.canvas) {
      return;
    }

    const results = this.handLandmarker.detectForVideo(
      this.video,
      performance.now(),
    );

    if (results.landmarks && results.landmarks.length > 0) {
      const landmarks = results.landmarks[0];
      const indexTip = landmarks[8]; // index fingertip
      const thumbTip = landmarks[4]; // thumb tip

      const rect = this.canvas.getBoundingClientRect();
      // Mirror X because webcam is flipped
      const rawX = rect.left + (1 - indexTip.x) * rect.width;
      const rawY = rect.top + indexTip.y * rect.height;

      // First frame: snap instead of lerping from 0,0
      if (this.smoothX < 0) {
        this.smoothX = rawX;
        this.smoothY = rawY;
      } else {
        this.smoothX += SMOOTHING_FACTOR * (rawX - this.smoothX);
        this.smoothY += SMOOTHING_FACTOR * (rawY - this.smoothY);
      }

      const distance = Math.hypot(
        indexTip.x - thumbTip.x,
        indexTip.y - thumbTip.y,
      );
      const isPinching = distance < PINCH_THRESHOLD;

      if (isPinching && !this.wasPinching) {
        this.dispatchPointerEvent("pointerdown", this.smoothX, this.smoothY, {
          button: 0,
          buttons: 1,
          pressure: 0.5,
        });
      } else if (!isPinching && this.wasPinching) {
        this.dispatchPointerEvent("pointerup", this.smoothX, this.smoothY, {
          button: 0,
          buttons: 0,
          pressure: 0,
        });
      } else {
        this.dispatchPointerEvent("pointermove", this.smoothX, this.smoothY, {
          button: -1,
          buttons: isPinching ? 1 : 0,
          pressure: isPinching ? 0.5 : 0,
        });
      }

      this.wasPinching = isPinching;
    }

    this.animationId = requestAnimationFrame(this.detect);
  };

  private dispatchPointerEvent(
    type: string,
    x: number,
    y: number,
    opts: { button: number; buttons: number; pressure: number },
  ): void {
    if (!this.canvas) {
      return;
    }

    this.canvas.dispatchEvent(
      new PointerEvent(type, {
        clientX: x,
        clientY: y,
        pressure: opts.pressure,
        pointerId: HAND_POINTER_ID,
        pointerType: "touch",
        isPrimary: true,
        bubbles: true,
        cancelable: true,
        button: opts.button,
        buttons: opts.buttons,
      }),
    );
  }

  stop(): void {
    if (this.animationId != null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.video) {
      this.video.pause();
      this.video.srcObject = null;
      this.video = null;
    }
    if (this.handLandmarker) {
      this.handLandmarker.close();
      this.handLandmarker = null;
    }
    this.canvas = null;
    this.wasPinching = false;
    this.smoothX = -1;
    this.smoothY = -1;
    this.onStatusChange("idle");
  }

  getVideoElement(): HTMLVideoElement | null {
    return this.video;
  }
}
