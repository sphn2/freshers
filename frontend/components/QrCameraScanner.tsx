"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Camera, CameraOff } from "lucide-react";
import type { Html5Qrcode } from "html5-qrcode";

export function QrCameraScanner({
  onScan,
  scanEnabled = true,
}: {
  onScan: (decodedText: string) => void;
  scanEnabled?: boolean;
}) {
  const reactId = useId();
  const scannerId = `qr-camera-${reactId.replace(/:/g, "")}`;
  const onScanRef = useRef(onScan);
  const scanEnabledRef = useRef(scanEnabled);
  const scanLockedRef = useRef(false);
  const lastDecodedRef = useRef<string | null>(null);
  const rearmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    scanEnabledRef.current = scanEnabled;
  }, [scanEnabled]);

  useEffect(() => {
    if (!active) return;
    let mounted = true;
    let started = false;

    async function startCamera() {
      setStarting(true);
      setError(null);
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setError("Camera access requires HTTPS on this device. Open this site over HTTPS or enter the six-digit ticket code manually.");
        setActive(false);
        setStarting(false);
        return;
      }

      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
        if (!mounted) return;
        const scanner = new Html5Qrcode(scannerId, {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false,
        });
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decodedText) => {
            if (!mounted) return;
            if (rearmTimeoutRef.current) {
              clearTimeout(rearmTimeoutRef.current);
              rearmTimeoutRef.current = null;
            }
            if (decodedText === lastDecodedRef.current) return;
            if (!scanEnabledRef.current) return;
            lastDecodedRef.current = decodedText;
            scanLockedRef.current = true;
            onScanRef.current(decodedText);
          },
          () => {
            if (!lastDecodedRef.current || rearmTimeoutRef.current) return;
            rearmTimeoutRef.current = setTimeout(() => {
              if (scanEnabledRef.current) {
                lastDecodedRef.current = null;
                scanLockedRef.current = false;
              }
              rearmTimeoutRef.current = null;
            }, 700);
          },
        );
        started = true;
        if (!mounted) {
          await scanner.stop();
          scanner.clear();
        }
      } catch (reason: unknown) {
        if (mounted) {
          setError(reason instanceof Error ? reason.message : "Could not start the camera. Check browser permissions and try again.");
          setActive(false);
        }
        scannerRef.current = null;
      } finally {
        if (mounted) setStarting(false);
      }
    }

    void startCamera();
    return () => {
      mounted = false;
      if (rearmTimeoutRef.current) clearTimeout(rearmTimeoutRef.current);
      const scanner = scannerRef.current;
      if (started && scanner?.isScanning) {
        void scanner.stop().then(() => {
          scanner.clear();
          scannerRef.current = null;
        }).catch((reason: unknown) => {
          console.error("Could not stop the QR camera cleanly.", reason);
        });
      }
    };
  }, [active, scannerId]);

  return (
    <div className="space-y-3 border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Camera verification</p>
          <p className="mt-1 text-[11px] text-slate-500">Point the rear camera at the QR code on the ticket.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setActive((current) => !current);
          }}
          disabled={starting}
          className="button-primary !min-h-10 !px-3 !text-[10px] disabled:opacity-60"
        >
          {active ? <CameraOff className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
          {starting ? "Starting camera…" : active ? "Stop camera" : "Scan with camera"}
        </button>
      </div>
      {error && <p role="alert" className="border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">{error}</p>}
      {active && <div id={scannerId} className="mx-auto max-w-md overflow-hidden" />}
    </div>
  );
}
