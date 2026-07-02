"use client";

import { useCallback, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AvatarCropModalProps = {
  imageSrc: string;
  open: boolean;
  onClose: () => void;
  onConfirm: (file: File) => Promise<void>;
};

export default function AvatarCropModal({ imageSrc, open, onClose, onConfirm }: AvatarCropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!croppedAreaPixels) return;
    setBusy(true);
    try {
      const { getCroppedImgFile } = await import("./cropImage");
      const file = await getCroppedImgFile(imageSrc, croppedAreaPixels);
      await onConfirm(file);
      // Parent clears `imageToCropSrc` on success and unmounts this modal.
    } catch {
      // Parent shows error; keep dialog open so the user can retry or cancel.
    } finally {
      setBusy(false);
    }
  }, [croppedAreaPixels, imageSrc, onConfirm]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4" role="presentation">
      <div className="absolute inset-0 bg-black/60" aria-hidden onClick={() => !busy && onClose()} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="avatar-crop-title"
        className="relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 id="avatar-crop-title" className="text-base font-semibold text-foreground">
            Adjust photo
          </h2>
          <button
            type="button"
            className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
            onClick={() => !busy && onClose()}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="px-4 pt-3 text-sm text-muted-foreground">Drag to reposition. Use the slider to zoom.</p>

        <div className="relative mx-4 mt-3 aspect-square w-auto max-h-[min(55vh,420px)] overflow-hidden rounded-lg bg-muted">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        <div className="px-4 py-3">
          <label htmlFor="avatar-crop-zoom" className="mb-1 block text-xs font-medium text-muted-foreground">
            Zoom
          </label>
          <input
            id="avatar-crop-zoom"
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full accent-primary"
            disabled={busy}
          />
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-border p-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => !busy && onClose()} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleConfirm()} disabled={busy || !croppedAreaPixels}>
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Saving…
              </>
            ) : (
              "Use photo"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
