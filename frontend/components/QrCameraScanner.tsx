"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Camera, CameraOff, RefreshCw } from "lucide-react";
import type { Html5Qrcode, CameraDevice } from "html5-qrcode";

export function QrCameraScanner({
  onScan,
  scanEnabled = true,
  resetTrigger,
}: {
  onScan: (decodedText: string) => void;
  scanEnabled?: boolean;
  resetTrigger?: unknown;
}) {
  const reactId = useId();
  const scannerId = `qr-camera-${reactId.replace(/:/g, "")}`;
  const onScanRef = useRef(onScan);
  const scanEnabledRef = useRef(scanEnabled);
  const lastDecodedRef = useRef<string | null>(null);
  const lastDecodedTimeRef = useRef<number>(0);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [availableCameras, setAvailableCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraIndex, setSelectedCameraIndex] = useState<number>(0);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    scanEnabledRef.current = scanEnabled;
  }, [scanEnabled]);

  useEffect(() => {
    lastDecodedRef.current = null;
    lastDecodedTimeRef.current = 0;
  }, [resetTrigger]);

  // Main camera start/stop effect
  useEffect(() => {
    if (!active) return;
    let mounted = true;
    let started = false;

    async function startCamera() {
      setStarting(true);
      setError(null);

      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setError(
          "Camera access requires HTTPS or localhost. Open this site over HTTPS or enter the six-digit ticket code manually.",
        );
        setActive(false);
        setStarting(false);
        return;
      }

      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
        if (!mounted) return;

        // Ensure container is in the DOM
        const container = document.getElementById(scannerId);
        if (!container) {
          await new Promise((r) => setTimeout(r, 80));
        }

        const scanner = new Html5Qrcode(scannerId, {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false,
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true,
          },
        });
        scannerRef.current = scanner;

        // Discover cameras for resilient selection across laptops, desktops & phones
        let chosenCamera: string | { facingMode: "environment" | "user" } = {
          facingMode: "environment",
        };

        try {
          const devices = await Html5Qrcode.getCameras();
          if (mounted && devices && devices.length > 0) {
            setAvailableCameras(devices);
            if (devices[selectedCameraIndex]) {
              chosenCamera = devices[selectedCameraIndex].id;
            } else {
              const rear = devices.find((d) => /back|rear|environment/i.test(d.label));
              if (rear) {
                chosenCamera = rear.id;
              } else {
                chosenCamera = devices[0].id;
              }
            }
          }
        } catch {
          // If camera enumeration is blocked before permission, use standard environment facingMode
          chosenCamera = { facingMode: "environment" };
        }

        const scanConfig = {
          fps: 15,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const qrboxSize = Math.max(260, Math.floor(minEdge * 0.92));
            return { width: qrboxSize, height: qrboxSize };
          },
          aspectRatio: 1.0,
        };

        const handleSuccess = (decodedText: string) => {
          if (!mounted) return;
          if (!scanEnabledRef.current) return;
          const now = Date.now();
          // Debounce identical tokens within 1.8s; allow new tokens instantly
          if (decodedText === lastDecodedRef.current && now - lastDecodedTimeRef.current < 1800) {
            return;
          }
          lastDecodedRef.current = decodedText;
          lastDecodedTimeRef.current = now;
          onScanRef.current(decodedText);
        };

        try {
          await scanner.start(chosenCamera, scanConfig, handleSuccess, () => {});
          started = true;
        } catch (initialErr: unknown) {
          // Fallback: if initial camera mode failed (e.g. laptop with only front camera), fallback to user camera
          console.warn("Primary camera start failed, attempting user camera fallback:", initialErr);
          await scanner.start({ facingMode: "user" }, scanConfig, handleSuccess, () => {});
          started = true;
        }

        if (!mounted && started) {
          await scanner.stop();
          scanner.clear();
        }
      } catch (reason: unknown) {
        if (mounted) {
          let errorMsg =
            "Could not start the camera. Check browser permissions and try again.";
          if (reason instanceof Error) {
            errorMsg = reason.message;
          } else if (typeof reason === "string") {
            errorMsg = reason;
          }

          if (errorMsg.includes("NotAllowedError") || errorMsg.includes("Permission denied")) {
            errorMsg =
              "Camera permission was denied. Please allow camera access in your browser settings (address bar lock icon) and click 'Scan with camera' again.";
          } else if (
            errorMsg.includes("NotFoundError") ||
            errorMsg.includes("DevicesNotFoundError")
          ) {
            errorMsg =
              "No camera was found on this device. You can verify passes using the 6-digit code keypad.";
          } else if (
            errorMsg.includes("NotReadableError") ||
            errorMsg.includes("TrackStartError")
          ) {
            errorMsg =
              "The camera is being used by another app or browser tab. Please close other camera tabs and try again.";
          }

          setError(errorMsg);
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
      const scanner = scannerRef.current;
      if (started && scanner?.isScanning) {
        void scanner
          .stop()
          .then(() => {
            scanner.clear();
            scannerRef.current = null;
          })
          .catch((reason: unknown) => {
            console.error("Could not stop the QR camera cleanly.", reason);
          });
      }
    };
  }, [active, scannerId, selectedCameraIndex]);

  const handleSwitchCamera = () => {
    if (availableCameras.length <= 1 || starting) return;
    setError(null);
    setSelectedCameraIndex((prev) => (prev + 1) % availableCameras.length);
  };

  return (
    <div className="space-y-3 border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Camera verification</p>
          <p className="mt-1 text-[11px] text-slate-500">
            Point camera at the QR code on the attendee ticket.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {availableCameras.length > 1 && active && (
            <button
              type="button"
              onClick={handleSwitchCamera}
              disabled={starting}
              className="button-secondary !min-h-10 !px-3 !text-[10px]"
              title="Switch to next camera"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Flip camera
            </button>
          )}

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
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 leading-relaxed shadow-xs"
        >
          {error}
        </div>
      )}

      {/* Keep scanner container permanently mounted to prevent DOM element lookup race conditions */}
      <div
        id={scannerId}
        className={`mx-auto max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-black ${
          active ? "block" : "hidden"
        }`}
      />
    </div>
  );
}
