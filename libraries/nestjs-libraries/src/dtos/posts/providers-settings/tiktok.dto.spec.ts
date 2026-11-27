import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import {
  TikTokDto,
  TIKTOK_AUTO_ADD_MUSIC_MESSAGE,
  TIKTOK_CONSENT_MESSAGE,
  TIKTOK_POSTING_METHOD_MESSAGE,
  TIKTOK_PRIVACY_LEVEL_MESSAGE,
} from '@gitroom/nestjs-libraries/dtos/posts/providers-settings/tiktok.dto';

const RAW_VALUES = [
  'PUBLIC_TO_EVERYONE',
  'MUTUAL_FOLLOW_FRIENDS',
  'FOLLOWER_OF_CREATOR',
  'SELF_ONLY',
  'DIRECT_POST',
  'UPLOAD',
  'must be one of',
];

// a complete legacy TikTok direct post, as the composer sends it
const ready = {
  __type: 'tiktok',
  content_posting_method: 'DIRECT_POST',
  privacy_level: 'SELF_ONLY',
  duet: false,
  stitch: false,
  comment: false,
  autoAddMusic: 'no',
  brand_content_toggle: false,
  brand_organic_toggle: false,
  disclose: false,
  music_usage_consent: true,
  creator_info_verified: true,
};

const check = async (settings: Record<string, any>) =>
  validate(plainToInstance(TikTokDto, settings) as object, {
    skipMissingProperties: false,
  });

const field = (errors: ValidationError[], name: string) =>
  errors.find((e) => e.property === name);

// what PostsService.firstValidationError shows in the composer banner
const bannerFor = (errors: ValidationError[], name: string) =>
  Object.values(field(errors, name)?.constraints || {})[0];

const allMessages = (errors: ValidationError[]): string[] =>
  errors.flatMap((e) => [
    ...Object.values(e.constraints || {}),
    ...allMessages(e.children || []),
  ]);

describe('TikTokDto validation messages', () => {
  it('accepts a complete direct post', async () => {
    expect(await check(ready)).toEqual([]);
  });

  it('asks who can see the post when no privacy level is chosen', async () => {
    for (const privacy_level of [undefined, '', null]) {
      const errors = await check({ ...ready, privacy_level });
      expect(errors.map((e) => e.property)).toEqual(['privacy_level']);
      expect(bannerFor(errors, 'privacy_level')).toBe(
        TIKTOK_PRIVACY_LEVEL_MESSAGE
      );
      expect(
        Object.values(field(errors, 'privacy_level')!.constraints!)
      ).toEqual(
        expect.arrayContaining([TIKTOK_PRIVACY_LEVEL_MESSAGE])
      );
    }
    expect(TIKTOK_PRIVACY_LEVEL_MESSAGE).toBe('Choose who can see this post.');
  });

  it('still rejects an unknown privacy level, with the same message', async () => {
    const errors = await check({ ...ready, privacy_level: 'EVERYONE' });
    expect(bannerFor(errors, 'privacy_level')).toBe(
      TIKTOK_PRIVACY_LEVEL_MESSAGE
    );
  });

  it('keeps accepting every TikTok privacy level', async () => {
    for (const privacy_level of [
      'PUBLIC_TO_EVERYONE',
      'MUTUAL_FOLLOW_FRIENDS',
      'FOLLOWER_OF_CREATOR',
      'SELF_ONLY',
    ]) {
      expect(await check({ ...ready, privacy_level })).toEqual([]);
    }
  });

  it('keeps the branded content rule ahead of the privacy message', async () => {
    const errors = await check({
      ...ready,
      disclose: true,
      brand_content_toggle: true,
    });
    expect(bannerFor(errors, 'privacy_level')).toBe(
      'Branded content visibility cannot be set to private.'
    );
  });

  it('gives friendly messages for the posting method and auto music', async () => {
    const errors = await check({
      ...ready,
      content_posting_method: 'SOMETHING',
      autoAddMusic: 'maybe',
    });
    expect(bannerFor(errors, 'content_posting_method')).toBe(
      TIKTOK_POSTING_METHOD_MESSAGE
    );
    expect(bannerFor(errors, 'autoAddMusic')).toBe(
      TIKTOK_AUTO_ADD_MUSIC_MESSAGE
    );
  });

  it('asks for the authorization checkbox in the words the checkbox uses', async () => {
    const errors = await check({ ...ready, music_usage_consent: false });
    expect(bannerFor(errors, 'music_usage_consent')).toBe(TIKTOK_CONSENT_MESSAGE);
    expect(TIKTOK_CONSENT_MESSAGE).toBe(
      'Confirm that PostDelegate can upload and publish this content to TikTok.'
    );
    expect(TIKTOK_CONSENT_MESSAGE).not.toContain('Music Usage Confirmation');
  });

  it('never lists raw enum values in any message', async () => {
    const errors = await check({ __type: 'tiktok' });
    const messages = allMessages(errors);
    expect(messages.length).toBeGreaterThan(0);
    for (const message of messages) {
      for (const raw of RAW_VALUES) {
        expect(message).not.toContain(raw);
      }
    }
  });
});
