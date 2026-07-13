"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import Image from "next/image";
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

export type CarPhotoGalleryFieldHandle = {
  uploadPending: () => Promise<string[]>;
  hasPending: () => boolean;
  totalCount: () => number;
};

type SortablePhotoProps = {
  id: string;
  url: string;
  idx: number;
  onRemove: (idx: number) => void;
  uploading?: boolean;
  isLocal?: boolean;
};

function SortablePhoto({ id, url, idx, onRemove, uploading, isLocal }: SortablePhotoProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 30 : 1,
    opacity: isDragging ? 0.92 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative h-32 w-32 flex-shrink-0 overflow-hidden rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-surface)] shadow-md group"
    >
      <Image src={url} alt="" fill className="object-cover pointer-events-none" unoptimized />
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
      {idx === 0 && !uploading ? (
        <span className="pointer-events-none absolute bottom-0 left-0 w-full bg-sky-500 py-1 text-center text-[9px] font-black uppercase tracking-widest text-white">
          Główne
        </span>
      ) : null}
      {isLocal ? (
        <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-amber-500/90 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-white">
          Lokalnie
        </span>
      ) : null}
      {uploading ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-[10px] font-bold text-white">
          Wgrywanie…
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
    const fileInputRef = useRef<HTMLInputElement>(null);
    const pendingFilesRef = useRef<Map<string, File>>(new Map());
    const [uploadingCount, setUploadingCount] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

    const uploading = uploadingCount > 0;

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

    const isLocalUrl = (url: string) => url.startsWith("blob:") || pendingFilesRef.current.has(url);

    const uploadSingleFile = async (file: File): Promise<string> => {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/upload/cars", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || typeof data?.url !== "string" || !data.url) {
        throw new Error(typeof data?.error === "string" ? data.error : "Upload zdjęcia nie powiódł się.");
      }
      return data.url;
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
        setUploadingCount((count) => count + pendingEntries.length);
        const resolved = [...images];
        try {
          for (const { url, file } of pendingEntries) {
            const idx = resolved.indexOf(url);
            if (idx < 0) continue;
            const serverUrl = await uploadSingleFile(file);
            resolved[idx] = serverUrl;
            pendingFilesRef.current.delete(url);
            if (url.startsWith("blob:")) URL.revokeObjectURL(url);
          }
          onChange(resolved);
          return resolved;
        } catch (uploadError) {
          throw uploadError instanceof Error ? uploadError : new Error("Upload zdjęcia nie powiódł się.");
        } finally {
          setUploadingCount((count) => Math.max(0, count - pendingEntries.length));
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
      onChange(images.filter((_, index) => index !== idx));
    };

    const addLocalFiles = (files: File[]) => {
      const localUrls: string[] = [];
      for (const file of files) {
        const blobUrl = URL.createObjectURL(file);
        pendingFilesRef.current.set(blobUrl, file);
        localUrls.push(blobUrl);
      }
      onChange([...images, ...localUrls]);
    };

    const uploadFiles = async (files: File[]) => {
      if (!files.length) return;
      setError(null);

      if (!loggedIn) {
        addLocalFiles(files);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      setUploadingCount((count) => count + files.length);
      const uploaded: string[] = [];
      try {
        for (const file of files) {
          uploaded.push(await uploadSingleFile(file));
        }
        onChange([...images, ...uploaded]);
      } catch (uploadError) {
        setError(uploadError instanceof Error ? uploadError.message : "Upload zdjęcia nie powiódł się.");
      } finally {
        setUploadingCount((count) => Math.max(0, count - files.length));
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };

    const totalSizeLabel = useMemo(() => `${images.length} zdjęć`, [images.length]);
    const hasLocalPending = images.some((url) => isLocalUrl(url));

    return (
      <div
        className={`grid gap-3 rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-surface)] p-4 ${
          highlighted ? "ring-2 ring-amber-400/70 border-amber-400/60" : ""
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold">Galeria zdjęć</p>
          <span className="rounded-full bg-[var(--eos-bg)] px-3 py-1 text-[10px] font-bold text-[var(--eos-muted)]">
            {totalSizeLabel}
          </span>
        </div>

        {!loggedIn && hasLocalPending ? (
          <p className="rounded-xl border border-sky-400/25 bg-sky-500/10 px-3 py-2 text-[11px] text-sky-200">
            Zdjęcia zapisane lokalnie. Po kliknięciu „Opublikuj” założysz konto — wtedy wgramy je automatycznie na
            serwer.
          </p>
        ) : null}

        <div className="flex min-h-[148px] flex-wrap gap-4 rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-bg)]/40 p-4">
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
            <span className="px-2 text-center text-[10px] font-black uppercase tracking-widest">
              Dodaj
              <br />
              zdjęcia
            </span>
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
                  uploading={uploading}
                  isLocal={isLocalUrl(url)}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>

        <p className="text-center text-[10px] text-[var(--eos-muted)]">
          Przeciągnij miniatury, aby zmienić kolejność. Pierwsze zdjęcie jest główne na liście ogłoszeń.
        </p>
        {images.length === 0 ? (
          <p className="text-center text-[11px] font-semibold text-amber-400">Dodaj co najmniej jedno zdjęcie auta.</p>
        ) : null}
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
      </div>
    );
  },
);

export default CarPhotoGalleryField;
