import type { PresignedUpload } from '../out/media-ports';

export interface MediaView {
  readonly id: string;
  readonly filename: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly width: number | null;
  readonly height: number | null;
  readonly altText: string | null;
  readonly caption: string | null;
  readonly url: string;
  readonly variants: Partial<Record<'thumbnail' | 'medium', { url: string; width: number; height: number }>>;
  readonly uploadedBy: string;
  readonly createdAt: Date;
}

export interface PresignUploadCommand {
  readonly filename: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
}
export interface PresignUploadResult {
  readonly storageKey: string;
  readonly upload: PresignedUpload;
}

export interface FinalizeMediaCommand {
  readonly storageKey: string;
  readonly filename: string;
  readonly mimeType: string;
  readonly altText?: string | null;
  readonly caption?: string | null;
}
