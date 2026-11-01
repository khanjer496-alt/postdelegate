import { Request } from 'express';
import { StorageEngine } from 'multer';
import { Readable } from 'stream';
import { IUploadProvider } from './upload.interface';
import { UploadFactory } from './upload.factory';
import {
  STUDIO_AUDIO_MIME,
  UploadRules,
  getMaxSize,
  uploadStreamToStorage,
} from './custom.upload.validation';
import { STUDIO_MUSIC_MAX_BYTES } from '@gitroom/nestjs-libraries/dtos/studio/studio.music.dto';

// Multer storage engine that streams each incoming file straight into
// storage instead of multer's default of buffering it whole in memory.
// `file.filename` / `file.path` end up as the stored key and public URL,
// `file.originalname` keeps the sender's name with the detected extension
export class MulterStreamEngine implements StorageEngine {
  constructor(private storage: IUploadProvider, private rules?: UploadRules) {}

  _handleFile(
    req: Request,
    file: Express.Multer.File,
    cb: (error?: any, info?: Partial<Express.Multer.File>) => void
  ) {
    uploadStreamToStorage(
      this.storage,
      Readable.toWeb(file.stream) as any,
      0,
      this.rules
    ).then(
      (uploaded) => {
        const safeBase =
          (file.originalname || 'upload')
            .replace(/\.[^./\\]*$/, '')
            .replace(/[\\/]/g, '_')
            .slice(0, 100) || 'upload';
        cb(null, {
          filename: uploaded.filename,
          path: uploaded.path,
          mimetype: uploaded.mimetype,
          originalname: `${safeBase}.${uploaded.ext}`,
        });
      },
      (err) => cb(err)
    );
  }

  // Multer calls this when the request fails after the file was already
  // stored (e.g. another part hit a limit), so the orphan is dropped
  _removeFile(
    req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null) => void
  ) {
    this.storage.removeFile(file.path).then(
      () => cb(null),
      (err) => cb(err)
    );
  }
}

let engine: MulterStreamEngine;

// Options for FileInterceptor on the multipart upload routes. Multer's own
// limit sits one byte above the largest allowed type so the in-stream cap is
// what rejects (a uniform 400 that aborts the upload) rather than multer
// truncating the file, storing it whole and only then failing with a 413
export function streamUploadOptions() {
  engine = engine || new MulterStreamEngine(UploadFactory.createStorage());
  return {
    storage: engine,
    limits: { fileSize: getMaxSize('video/mp4') + 1 },
  };
}

let studioAudioEngine: MulterStreamEngine;

// The same for Studio music (POST /studio/assets): audio only, 30 MB at most
export function studioAudioUploadOptions() {
  studioAudioEngine =
    studioAudioEngine ||
    new MulterStreamEngine(UploadFactory.createStorage(), {
      allowed: STUDIO_AUDIO_MIME,
      maxSize: () => STUDIO_MUSIC_MAX_BYTES,
    });
  return {
    storage: studioAudioEngine,
    limits: { fileSize: STUDIO_MUSIC_MAX_BYTES + 1, files: 1 },
  };
}
