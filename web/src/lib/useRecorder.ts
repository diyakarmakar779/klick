import { useEffect, useRef, useState } from "react";

// Voice notes with the browser's MediaRecorder. webm on Chrome/Android, mp4 on Safari.
export function useRecorder() {
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const started = useRef(0);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [clip, setClip] = useState<{ blob: Blob; type: string; seconds: number } | null>(null);
  const [error, setError] = useState("");
  const supported = typeof window !== "undefined" && "MediaRecorder" in window && !!navigator.mediaDevices;

  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => setSeconds(Math.round((Date.now() - started.current) / 1000)), 500);
    return () => clearInterval(id);
  }, [recording]);

  async function start() {
    setError("");
    setClip(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = ["audio/webm", "audio/mp4"].find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
      const r = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      chunks.current = [];
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const mime = (r.mimeType || type || "audio/webm").split(";")[0];
        setClip({ blob: new Blob(chunks.current, { type: mime }), type: mime, seconds: Math.round((Date.now() - started.current) / 1000) });
        setRecording(false);
      };
      rec.current = r;
      started.current = Date.now();
      setSeconds(0);
      r.start();
      setRecording(true);
    } catch (e) {
      setError(e instanceof DOMException && e.name === "NotAllowedError" ? "Microphone access was blocked. Allow it in your browser settings, or type a note instead." : "Klick couldn't start recording. Type a note instead.");
    }
  }

  const stop = () => rec.current?.state === "recording" && rec.current.stop();
  const clear = () => setClip(null);
  return { supported, recording, seconds, clip, error, start, stop, clear };
}

export const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
