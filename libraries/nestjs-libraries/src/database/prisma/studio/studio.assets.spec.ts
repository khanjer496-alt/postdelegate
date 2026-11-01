// Music uploads, the music a project keeps, picture inputs of a render and
// the daily cleanup. The service builds its storage at construction and
// pulls in the media and AI stacks at import time
const storage = {
  signDownloadUrl: jest.fn().mockResolvedValue('https://r2.example/signed'),
  removeFile: jest.fn().mockResolvedValue(undefined),
  uploadStream: jest.fn(),
};
jest.mock('@gitroom/nestjs-libraries/upload/upload.factory', () => ({
  UploadFactory: { createStorage: () => storage },
}));
jest.mock('@gitroom/nestjs-libraries/redis/redis.service', () => ({
  ioRedis: {
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn(),
    get: jest.fn(),
  },
}));
jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/media/media.service',
  () => ({ MediaService: class {} })
);
jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/ai-credentials/ai.credential.service',
  () => ({ AiCredentialService: class {}, MISSING_AI_KEY: '' })
);
jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/organizations/organization.service',
  () => ({ OrganizationService: class {} })
);
jest.mock('nestjs-temporal-core', () => ({ TemporalService: class {} }));

import 'reflect-metadata';
import { HttpException } from '@nestjs/common';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { StudioService } from '@gitroom/nestjs-libraries/database/prisma/studio/studio.service';
import { StudioTemplateManager } from '@gitroom/nestjs-libraries/studio/studio.manager';
import { HookOverClipTemplate } from '@gitroom/nestjs-libraries/studio/templates/hook.over.clip.template';
import { ImageSlideshowTemplate } from '@gitroom/nestjs-libraries/studio/templates/image.slideshow.template';

const mediaId = '3f1c2a9e-8b4d-4f6a-9c2e-1a2b3c4d5e6f';
const assetId = '9b2f4c1d-3e5a-4b6c-8d7e-0f1a2b3c4d5e';

const status = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (err) {
    return err instanceof HttpException ? err.getStatus() : err;
  }
  return 'resolved';
};

const slideshow = (music = false) => ({
  slides: [
    { mediaId, seconds: 2 },
    { mediaId, seconds: 2 },
  ],
  ...(music ? { music: { assetId } } : {}),
});

describe('StudioService music, pictures and cleanup', () => {
  let repository: Record<string, jest.Mock>;
  let mediaService: { getOrgMediaById: jest.Mock };
  let organizationService: { getOrgByIdWithSubscription: jest.Mock };
  let service: StudioService;
  let dir: string;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test';
    dir = mkdtempSync(join(tmpdir(), 'studio-assets-'));
    process.env.STUDIO_TMP_DIR = dir;
    organizationService = {
      getOrgByIdWithSubscription: jest.fn().mockResolvedValue({
        id: 'org-1',
        isTrailing: false,
        subscription: { subscriptionTier: 'STANDARD' },
      }),
    };
    repository = {
      getProject: jest.fn().mockResolvedValue({
        id: 'project-1',
        name: 'Slides',
        template: 'image-slideshow',
        spec: JSON.stringify(slideshow()),
        renders: [],
      }),
      updateProject: jest.fn().mockResolvedValue(undefined),
      deleteProject: jest.fn().mockResolvedValue(undefined),
      getActiveRenders: jest.fn().mockResolvedValue([]),
      countAssets: jest.fn().mockResolvedValue(0),
      createAsset: jest.fn().mockResolvedValue({
        id: assetId,
        originalName: 'song.mp3',
        path: 'https://media.example/abc.mp3',
      }),
      getAsset: jest.fn().mockResolvedValue({
        id: assetId,
        name: 'abc.mp3',
        path: 'https://media.example/abc.mp3',
      }),
      attachAsset: jest.fn().mockResolvedValue(true),
      detachAssets: jest.fn().mockResolvedValue({ count: 0 }),
      getProjectAssets: jest.fn().mockResolvedValue([]),
      deleteAsset: jest.fn().mockResolvedValue({ count: 1 }),
      getAssetsToRemove: jest.fn().mockResolvedValue([]),
      pruneRenders: jest.fn().mockResolvedValue({ count: 0 }),
      getRenderById: jest.fn(),
      updateRender: jest.fn().mockResolvedValue(undefined),
    };
    mediaService = {
      getOrgMediaById: jest.fn().mockResolvedValue({
        id: mediaId,
        name: 'abc.png',
        path: 'https://media.example/abc.png',
        status: 'ready',
        deletedAt: null,
      }),
    };
    const templates = new Map<any, any>([
      [HookOverClipTemplate, new HookOverClipTemplate()],
      [ImageSlideshowTemplate, new ImageSlideshowTemplate()],
    ]);
    service = new StudioService(
      repository as any,
      new StudioTemplateManager({
        get: (target: any) => templates.get(target),
      } as any),
      mediaService as any,
      {} as any,
      {
        client: {
          getRawClient: () => ({ workflow: { start: jest.fn() } }),
        },
      } as any,
      organizationService as any
    );
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    delete process.env.STRIPE_PUBLISHABLE_KEY;
    delete process.env.STUDIO_TMP_DIR;
  });

  describe('uploads', () => {
    const file = {
      filename: 'abc.mp3',
      path: 'https://media.example/abc.mp3',
      originalname: 'song.mp3',
    };

    it('keeps an upload as a Studio asset, not a media', async () => {
      expect(await service.saveAsset('org-1', file)).toEqual({
        id: assetId,
        name: 'song.mp3',
        path: 'https://media.example/abc.mp3',
      });
      expect(repository.createAsset).toHaveBeenCalledWith('org-1', {
        kind: 'music',
        name: 'abc.mp3',
        path: 'https://media.example/abc.mp3',
        originalName: 'song.mp3',
      });
      expect(storage.removeFile).not.toHaveBeenCalled();
    });

    it('needs an active plan and removes the stored file when refused', async () => {
      organizationService.getOrgByIdWithSubscription.mockResolvedValue({
        id: 'org-1',
      });
      expect(await status(service.saveAsset('org-1', file))).toBe(406);
      expect(storage.removeFile).toHaveBeenCalledWith(file.path);
      expect(repository.createAsset).not.toHaveBeenCalled();
    });

    it('caps the music a workspace keeps', async () => {
      repository.countAssets.mockResolvedValue(50);
      expect(await status(service.saveAsset('org-1', file))).toBe(400);
      expect(storage.removeFile).toHaveBeenCalledWith(file.path);
    });
  });

  describe('the music of a project', () => {
    it('takes the picked music and lets go of the rest', async () => {
      await service.updateProject('org-1', 'project-1', {
        spec: slideshow(true),
      });
      expect(repository.attachAsset).toHaveBeenCalledWith(
        'org-1',
        assetId,
        'project-1'
      );
      expect(repository.detachAssets).toHaveBeenCalledWith(
        'org-1',
        'project-1',
        assetId
      );
    });

    it('refuses music of another workspace or project', async () => {
      repository.getAsset.mockResolvedValueOnce(null);
      expect(
        await status(
          service.updateProject('org-1', 'project-1', { spec: slideshow(true) })
        )
      ).toBe(400);
      repository.getAsset.mockResolvedValueOnce({
        id: assetId,
        name: 'abc.mp3',
        path: 'https://media.example/abc.mp3',
        projectId: 'project-2',
      });
      expect(
        await status(
          service.updateProject('org-1', 'project-1', { spec: slideshow(true) })
        )
      ).toBe(400);
      expect(repository.updateProject).not.toHaveBeenCalled();
      expect(repository.attachAsset).not.toHaveBeenCalled();
    });

    it('takes the music only once the settings are saved', async () => {
      repository.updateProject.mockRejectedValueOnce(new Error('db down'));
      await expect(
        service.updateProject('org-1', 'project-1', { spec: slideshow(true) })
      ).rejects.toThrow('db down');
      expect(repository.attachAsset).not.toHaveBeenCalled();
    });

    it('lets go of the music when it is taken out', async () => {
      repository.getProject.mockResolvedValue({
        id: 'project-1',
        template: 'image-slideshow',
        spec: JSON.stringify(slideshow(true)),
      });
      await service.updateProject('org-1', 'project-1', { spec: slideshow() });
      expect(repository.attachAsset).not.toHaveBeenCalled();
      expect(repository.detachAssets).toHaveBeenCalledWith(
        'org-1',
        'project-1',
        undefined
      );
    });

    it('does no music bookkeeping on a save that keeps it', async () => {
      repository.getProject.mockResolvedValue({
        id: 'project-1',
        template: 'image-slideshow',
        spec: JSON.stringify(slideshow(true)),
      });
      await service.updateProject('org-1', 'project-1', {
        spec: { ...slideshow(true), transition: 'none' },
      });
      expect(repository.attachAsset).not.toHaveBeenCalled();
      expect(repository.detachAssets).not.toHaveBeenCalled();
    });

    it('removes the stored music with the project', async () => {
      repository.getProjectAssets.mockResolvedValue([
        { id: assetId, path: 'https://media.example/abc.mp3' },
      ]);
      await service.deleteProject('org-1', 'project-1');
      expect(storage.removeFile).toHaveBeenCalledWith(
        'https://media.example/abc.mp3'
      );
      expect(repository.deleteAsset).toHaveBeenCalledWith(assetId);
    });

    it('keeps the asset row for the cleanup when its file cannot be removed', async () => {
      repository.getProjectAssets.mockResolvedValue([
        { id: assetId, path: 'https://media.example/abc.mp3' },
      ]);
      storage.removeFile.mockRejectedValueOnce(new Error('R2 down'));
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
      await expect(
        service.deleteProject('org-1', 'project-1')
      ).resolves.toEqual({ success: true });
      expect(repository.deleteAsset).not.toHaveBeenCalled();
    });
  });

  describe('starting a render', () => {
    it('checks the spec with its own template', async () => {
      repository.getProject.mockResolvedValue({
        id: 'project-1',
        template: 'image-slideshow',
        spec: JSON.stringify({ slides: [{ mediaId, seconds: 2 }] }),
      });
      // one slide passes as a draft but not for a render
      expect(await status(service.startRender({ id: 'org-1' } as any, 'project-1'))).toBe(400);
    });

    it('refuses music that is gone', async () => {
      repository.getProject.mockResolvedValue({
        id: 'project-1',
        template: 'image-slideshow',
        spec: JSON.stringify(slideshow(true)),
      });
      repository.getAsset.mockResolvedValue(null);
      expect(await status(service.startRender({ id: 'org-1' } as any, 'project-1'))).toBe(400);
      expect(repository.getAsset).toHaveBeenCalledWith('org-1', assetId);
    });
  });

  describe('render inputs', () => {
    const renderOf = (template: string, spec: unknown) =>
      repository.getRenderById.mockResolvedValue({
        id: 'render-1',
        organizationId: 'org-1',
        status: 'queued',
        mediaId: null,
        specSnapshot: JSON.stringify(spec),
        project: { name: 'P', template },
      });
    let download: jest.SpyInstance;
    let probeImage: jest.SpyInstance;
    let plan: jest.SpyInstance;

    beforeEach(() => {
      // the free space of the machine running the tests is not the point
      jest
        .spyOn(service as any, 'checkFreeDisk')
        .mockResolvedValue(undefined);
      download = jest
        .spyOn(service as any, 'download')
        .mockResolvedValue(undefined);
      probeImage = jest
        .spyOn(service, 'probeImage')
        .mockResolvedValue(undefined);
      jest.spyOn(service, 'probeAudio').mockResolvedValue(undefined);
      jest
        .spyOn(service as any, 'probe')
        .mockResolvedValue({ duration: 10, hasAudio: true });
      // stop right after planning: what reaches ffmpeg is all this checks
      plan = jest
        .spyOn(ImageSlideshowTemplate.prototype, 'plan')
        .mockImplementation(() => {
          throw new Error('planned');
        });
    });

    afterEach(() => {
      plan.mockRestore();
    });

    it('reads pictures with the picture cap and probe, and the music with its own', async () => {
      renderOf('image-slideshow', slideshow(true));
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
      await expect(service.render('render-1')).rejects.toThrow('planned');

      expect(download).toHaveBeenCalledTimes(3);
      expect(download.mock.calls[0][1]).toMatch(/source-0\.png$/);
      expect(download.mock.calls[0][3]).toEqual({
        bytes: 20 * 1024 * 1024,
        message: 'This picture is larger than 20 MB.',
      });
      expect(download.mock.calls[2][1]).toMatch(/music\.mp3$/);
      expect(download.mock.calls[2][3].bytes).toBe(30 * 1024 * 1024);
      expect(probeImage).toHaveBeenCalledTimes(2);
      expect(plan.mock.calls[0][1]).toMatchObject({
        inputs: [
          { file: 'source-0.png', image: true, hasAudio: false },
          { file: 'source-1.png', image: true, hasAudio: false },
        ],
        music: { file: 'music.mp3' },
      });
    });

    it('refuses a picture where the template needs a video', async () => {
      renderOf('hook-over-clip', {
        input: { mediaId },
        trim: { start: 0, end: 5 },
        hook: { text: 'x' },
      });
      await expect(service.render('render-1')).rejects.toMatchObject({
        type: 'studio_stop',
        message: 'This template needs a video, not a picture.',
      });
      expect(download).not.toHaveBeenCalled();
    });

    it('refuses a video in a slideshow before downloading it', async () => {
      mediaService.getOrgMediaById.mockResolvedValue({
        id: mediaId,
        name: 'abc.mp4',
        path: 'https://media.example/abc.mp4',
        status: 'ready',
        deletedAt: null,
      });
      renderOf('image-slideshow', slideshow());
      await expect(service.render('render-1')).rejects.toMatchObject({
        type: 'studio_stop',
        message: 'This template takes pictures, not videos.',
      });
      expect(download).not.toHaveBeenCalled();
    });

    it('refuses music of another workspace', async () => {
      repository.getAsset.mockResolvedValue(null);
      renderOf('image-slideshow', slideshow(true));
      await expect(service.render('render-1')).rejects.toMatchObject({
        type: 'studio_stop',
      });
      expect(repository.getAsset).toHaveBeenCalledWith('org-1', assetId);
    });
  });

  describe('daily cleanup', () => {
    it('removes unused and orphaned music page by page, then old renders', async () => {
      const page = Array.from({ length: 100 }, (_, i) => ({
        id: `a-${i}`,
        path: `https://media.example/${i}.mp3`,
      }));
      repository.getAssetsToRemove
        .mockResolvedValueOnce(page)
        .mockResolvedValueOnce([{ id: 'a-100', path: 'https://media.example/100.mp3' }]);
      repository.pruneRenders.mockResolvedValue({ count: 7 });
      const heartbeat = jest.fn();

      expect(await service.cleanup(heartbeat)).toEqual({
        assets: 101,
        renders: 7,
      });
      expect(storage.removeFile).toHaveBeenCalledTimes(101);
      expect(repository.deleteAsset).toHaveBeenCalledTimes(101);
      expect(heartbeat).toHaveBeenCalled();

      // unused for 7 days, and renders older than 90 days
      const unusedSince: Date = repository.getAssetsToRemove.mock.calls[0][0];
      const days = (Date.now() - unusedSince.getTime()) / 86400000;
      expect(Math.round(days)).toBe(7);
      const before: Date = repository.pruneRenders.mock.calls[0][0];
      expect(Math.round((Date.now() - before.getTime()) / 86400000)).toBe(90);
    });

    it('skips a file it could not remove instead of looping on it', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
      storage.removeFile.mockRejectedValueOnce(new Error('R2 down'));
      repository.getAssetsToRemove.mockResolvedValueOnce([
        { id: 'a-1', path: 'https://media.example/1.mp3' },
        { id: 'a-2', path: 'https://media.example/2.mp3' },
      ]);
      expect(await service.cleanup()).toEqual({ assets: 1, renders: 0 });
      expect(repository.deleteAsset).toHaveBeenCalledWith('a-2');
      expect(repository.deleteAsset).not.toHaveBeenCalledWith('a-1');
    });
  });
});
