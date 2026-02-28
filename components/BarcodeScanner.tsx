"use client";

import { BrowserMultiFormatReader } from "@zxing/browser";
import { useRef, useState } from "react";

function stopVideo(video: HTMLVideoElement | null) {
  try {
    const stream = video?.srcObject as MediaStream | null;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }
    if (video) video.srcObject = null;
  } catch {}
}

export default function BarcodeScanner({ onResult }: { onResult: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function start() {
    setErr(null);
    setRunning(true);

    const reader = new BrowserMultiFormatReader();

    try {
      const devices = await BrowserMultiFormatReader.listVideoInputDevices();
      const backCam = devices.find((d) => /back|rear|environment/i.test(d.label)) ?? devices[0];

      if (!videoRef.current) throw new Error("Video element not ready");

      const result = await reader.decodeOnceFromVideoDevice(backCam?.deviceId, videoRef.current);

      onResult(result.getText());
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      // vždy zastav kameru
      stopVideo(videoRef.current);


      setRunning(false);
    }
  }

  return (
    <div style={{ padding: 10, background: "#f3f4f6", borderRadius: 8 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={start} disabled={running} style={{ padding: "10px 12px" }}>
          {running ? "Skenujem…" : "Skenovať EAN"}
        </button>
        <span style={{ opacity: 0.75 }}>Povoľ kameru a namier na čiarový kód.</span>
      </div>

      <div style={{ marginTop: 10 }}>
        <video ref={videoRef} style={{ width: "100%", maxWidth: 520, borderRadius: 8 }} />
      </div>

      {err && <div style={{ marginTop: 10, padding: 10, background: "#fee2e2" }}>{err}</div>}
    </div>
  );
}