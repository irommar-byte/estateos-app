"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Trash2, Upload } from "lucide-react";
import { CarFormSection, carAlertErrorClass, carAlertInfoClass } from "@/components/cars/carFormStyles";
import { useLocale } from "@/contexts/LocaleContext";
import { fmtCars } from "@/i18n/carsDictionary";

export type CarPhotoGalleryFieldHandle = {
  uploadPending: () => Promise<string[]>;
  hasPending: () => boolean;
  totalCount: () => number;
};

type UploadStat = {
  progress: number;
  error: boolean;
};

type SortablePhotoProps = {
  id: string;
  url: string;
  idx: number;
  onRemove: (idx: number) => void;
  progressObj?: UploadStat;
  mainBadge: string;
  errorBadge: string;
};

function uploadFileWithProgress(file: File, onProgress: (pct: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("file", file);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
      }
    };

    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText || "{}") as { url?: string; error?: string };
        if (xhr.status >= 200 && xhr.status < 300 && typeof data.url === "string" && data.url) {
          onProgress(100);
          resolve(data.url);
          return;
        }
        reject(new Error(typeof data.error === "string" ? data.error : "Upload zdjęcia nie powiódł się."));
      } catch {
        reject(new Error("Upload zdjęcia nie powiódł się."));
      }
    };

    xhr.onerror = () => reject(new Error("Błąd sieci podczas wgrywania zdjęcia."));
    xhr.open("POST", "/api/upload/cars");
    xhr.withCredentials = true;
    xhr.send(formData);
  });
}

function SortablePhoto({ id, url, idx, onRemove, progressObj, mainBadge, errorBadge }: SortablePhotoProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 30 : 1,
    opacity: isDragging ? 0.92 : 1,
  };

  const isUploading = Boolean(progressObj && progressObj.progress < 100 && !progressObj.error);
  const isError = Boolean(progressObj?.error);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative h-32 w-32 flex-shrink-0 overflow-hidden rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-surface)] shadow-md"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        className={`h-full w-full object-cover pointer-events-none transition-all ${
          isUploading ? "opacity-40 blur-[2px]" : ""
        }`}
      />
      <div
        {...attributes}
        {...listeners}
        className="absolute inset-0 flex cursor-grab items-center justify-center opacity-0 transition-opacity active:cursor-grabbing group-hover:opacity-100"
      >
        <div className="flex gap-1 rounded-full border border-white/20 bg-black/55 px-3 py-2 backdrop-blur-md">
          <span className="h-1.5 w-1.5 rounded-full bg-white/80" />
          <span className="h-1.5 w-1.5 rounded-full bg-white/80" />
          <span className="h-1.5 w-1.5 rounded-full bg-white/80" />
        </div>
      </div>
      <button
        type="button"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => onRemove(idx)}
        className="absolute right-2 top-2 rounded-full bg-red-500/90 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
      >
        <Trash2 size={14} />
      </button>
      {idx === 0 && !isUploading && !isError ? (
        <span className="pointer-events-none absolute bottom-0 left-0 w-full bg-sky-500 py-1 text-center text-[9px] font-black uppercase tracking-widest text-white shadow-[0_-5px_15px_rgba(14,165,233,0.35)]">
          {mainBadge}
        </span>
      ) : null}
      {isUploading ? (
        <div className="absolute bottom-0 left-0 z-30 h-1.5 w-full overflow-hidden bg-black/50">
          <div
            className="h-full bg-gradient-to-r from-sky-500 to-cyan-400 transition-all duration-200 ease-out"
            style={{ width: `${progressObj?.progress ?? 0}%` }}
          />
        </div>
      ) : null}
      {isError ? (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-red-500/20 backdrop-blur-sm pointer-events-none">
          <span className="rounded-md bg-red-500 px-2 py-1 text-[9px] font-black uppercase text-white">{errorBadge}</span>
        </div>
      ) : null}
    </div>
  );
}

type CarPhotoGalleryFieldProps = {
  images: string[];
  onChange: (images: string[]) => void;
  highlighted?: boolean;
  onUploadingChange?: (uploading: boolean) => void;
  loggedIn?: boolean;
};

const CarPhotoGalleryField = forwardRef<CarPhotoGalleryFieldHandle, CarPhotoGalleryFieldProps>(
  function CarPhotoGalleryField(
    { images, onChange, highlighted = false, onUploadingChange, loggedIn = true },
    ref,
  ) {
    const { dict } = useLocale();
    const p = dict.cars.photos;
    const fileInputRef = useRef<HTMLInputElement>(null);
    const pendingFilesRef = useRef<Map<string, File>>(new Map());
    const imagesRef = useRef(images);
    const [uploadStats, setUploadStats] = useState<Record<string, UploadStat>>({});
    const [error, setError] = useState<string | null>(null);
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

    const uploading = useMemo(
      () => Object.values(uploadStats).some((stat) => stat.progress < 100 && !stat.error),
      [uploadStats],
    );

    useEffect(() => {
      imagesRef.current = images;
    }, [images]);

    useEffect(() => {
      onUploadingChange?.(uploading);
    }, [uploading, onUploadingChange]);

    useEffect(() => {
      return () => {
        for (const url of pendingFilesRef.current.keys()) {
          if (url.startsWith("blob:")) URL.revokeObjectURL(url);
        }
        pendingFilesRef.current.clear();
      };
    }, []);

    const setStat = (url: string, patch: Partial<UploadStat>) => {
      setUploadStats((prev) => ({
        ...prev,
        [url]: { progress: prev[url]?.progress ?? 0, error: prev[url]?.error ?? false, ...patch },
      }));
    };

    const replaceImageUrl = (fromUrl: string, toUrl: string) => {
      onChange(imagesRef.current.map((item) => (item === fromUrl ? toUrl : item)));
      setUploadStats((prev) => {
        const next = { ...prev };
        if (next[fromUrl]) {
          next[toUrl] = next[fromUrl];
          delete next[fromUrl];
        }
        return next;
      });
    };

    const uploadSingleFile = async (blobUrl: string, file: File) => {
      setStat(blobUrl, { progress: 8, error: false });
      try {
        const serverUrl = await uploadFileWithProgress(file, (progress) => {
          setStat(blobUrl, { progress, error: false });
        });
        pendingFilesRef.current.delete(blobUrl);
        if (blobUrl.startsWith("blob:")) URL.revokeObjectURL(blobUrl);
        replaceImageUrl(blobUrl, serverUrl);
      } catch (uploadError) {
        setStat(blobUrl, { progress: 0, error: true });
        throw uploadError;
      }
    };

    useImperativeHandle(ref, () => ({
      hasPending: () => pendingFilesRef.current.size > 0,
      totalCount: () => images.length,
      uploadPending: async () => {
        const pendingEntries = images
          .map((url) => ({ url, file: pendingFilesRef.current.get(url) }))
          .filter((entry): entry is { url: string; file: File } => Boolean(entry.file));

        if (!pendingEntries.length) return images.filter((url) => !url.startsWith("blob:"));

        setError(null);
        const resolved = [...images];
        try {
          await Promise.all(
            pendingEntries.map(async ({ url, file }) => {
              const serverUrl = await uploadFileWithProgress(file, (progress) => {
                setStat(url, { progress, error: false });
              });
              const idx = resolved.indexOf(url);
              if (idx >= 0) resolved[idx] = serverUrl;
              pendingFilesRef.current.delete(url);
              if (url.startsWith("blob:")) URL.revokeObjectURL(url);
              setStat(url, { progress: 100, error: false });
            }),
          );
          onChange(resolved);
          return resolved;
        } catch (uploadError) {
          throw uploadError instanceof Error ? uploadError : new Error(p.uploadError);
        }
      },
    }));

    const handleDragEnd = (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = images.indexOf(String(active.id));
      const newIndex = images.indexOf(String(over.id));
      if (oldIndex < 0 || newIndex < 0) return;
      onChange(arrayMove(images, oldIndex, newIndex));
    };

    const handleRemove = (idx: number) => {
      const url = images[idx];
      if (url && pendingFilesRef.current.has(url)) {
        pendingFilesRef.current.delete(url);
        if (url.startsWith("blob:")) URL.revokeObjectURL(url);
      }
      setUploadStats((prev) => {
        const next = { ...prev };
        if (url) delete next[url];
        return next;
      });
      onChange(images.filter((_, index) => index !== idx));
    };

    const queueFiles = (files: File[]) => {
      const blobUrls: string[] = [];
      for (const file of files) {
        const blobUrl = URL.createObjectURL(file);
        pendingFilesRef.current.set(blobUrl, file);
        blobUrls.push(blobUrl);
        setStat(blobUrl, { progress: loggedIn ? 8 : 100, error: false });
      }
      onChange([...images, ...blobUrls]);
      return blobUrls;
    };

    const uploadFiles = async (files: File[]) => {
      if (!files.length) return;
      setError(null);
      const blobUrls = queueFiles(files);

      if (!loggedIn) {
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      try {
        await Promise.all(
          blobUrls.map((blobUrl) => {
            const file = pendingFilesRef.current.get(blobUrl);
            if (!file) return Promise.resolve();
            return uploadSingleFile(blobUrl, file);
          }),
        );
      } catch (uploadError) {
        setError(uploadError instanceof Error ? uploadError.message : p.uploadError);
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };

    const totalSizeLabel = useMemo(() => fmtCars(p.photosCount, { n: images.length }), [images.length, p.photosCount]);
    const hasLocalPending = !loggedIn && images.some((url) => url.startsWith("blob:"));

    return (
      <CarFormSection eyebrow={p.eyebrow} title={p.title} description={p.description}>
        <div className="flex items-center justify-end">
          <span className="rounded-full bg-[var(--eos-bg)] px-3 py-1 text-[10px] font-bold text-[var(--eos-muted)]">
            {totalSizeLabel}
          </span>
        </div>

        {!loggedIn && hasLocalPending ? (
          <p className={carAlertInfoClass}>{p.guestHint}</p>
        ) : null}

        <div
          className={`flex min-h-[148px] flex-wrap gap-4 rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-bg)]/40 p-4 ${
            highlighted ? "ring-2 ring-amber-400/70 border-amber-400/60" : ""
          }`}
        >
          <label className="group flex h-32 w-32 flex-shrink-0 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[var(--eos-border)] bg-[var(--eos-surface)] text-[var(--eos-muted)] transition hover:border-sky-400/50 hover:text-sky-300">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/*"
              multiple
              className="hidden"
              disabled={uploading}
              onChange={(event) => {
                const files = Array.from(event.target.files || []);
                if (files.length) void uploadFiles(files);
              }}
            />
            <Upload size={26} className="mb-2 transition-transform group-hover:-translate-y-0.5" />
            <span className="px-2 text-center text-[10px] font-black uppercase tracking-widest">{p.addPhotos}</span>
          </label>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={images} strategy={rectSortingStrategy}>
              {images.map((url, idx) => (
                <SortablePhoto
                  key={url}
                  id={url}
                  url={url}
                  idx={idx}
                  onRemove={handleRemove}
                  progressObj={uploadStats[url]}
                  mainBadge={p.mainBadge}
                  errorBadge={p.errorBadge}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>

        {images.length === 0 ? (
          <p className="text-center text-[11px] font-semibold text-amber-600 dark:text-amber-400">{p.requiredHint}</p>
        ) : null}
        {error ? <p className={carAlertErrorClass}>{error}</p> : null}
      </CarFormSection>
    );
  },
);

export default CarPhotoGalleryField;
