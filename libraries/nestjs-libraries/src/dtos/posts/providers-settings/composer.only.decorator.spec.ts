import 'reflect-metadata';
import { createHash } from 'crypto';
import { IsDefined, IsString } from 'class-validator';
import { targetConstructorToSchema } from 'class-validator-jsonschema';
import {
  ComposerOnly,
  composerOnlySettings,
} from '@gitroom/nestjs-libraries/dtos/posts/providers-settings/composer.only.decorator';
import { TikTokDto } from '@gitroom/nestjs-libraries/dtos/posts/providers-settings/tiktok.dto';
import { DiscordDto } from '@gitroom/nestjs-libraries/dtos/posts/providers-settings/discord.dto';
import { YoutubeSettingsDto } from '@gitroom/nestjs-libraries/dtos/posts/providers-settings/youtube.settings.dto';
import { getValidationSchemas } from '@gitroom/nestjs-libraries/chat/validation.schemas.helper';

class Plain {
  @IsDefined()
  @IsString()
  channel: string;
}

class Marked {
  @IsDefined()
  @IsString()
  @ComposerOnly()
  channel: string;
}

class MarkedChild extends Marked {
  @IsString()
  @ComposerOnly()
  board: string;
}

const keys = (value: any): string[] =>
  value && typeof value === 'object'
    ? Object.entries(value).flatMap(([key, item]) => [key, ...keys(item)])
    : [];

describe('ComposerOnly', () => {
  it('lists the composer-only settings of a DTO, inherited ones too', () => {
    expect(composerOnlySettings(Marked)).toEqual(['channel']);
    expect(composerOnlySettings(MarkedChild)).toEqual(['channel', 'board']);
    expect(composerOnlySettings(Plain)).toEqual([]);
    expect(composerOnlySettings(undefined)).toEqual([]);
  });

  it('marks the settings the composer loads or checks itself', () => {
    expect(composerOnlySettings(DiscordDto)).toEqual(['channel']);
    expect(composerOnlySettings(TikTokDto)).toEqual([
      'music_usage_consent',
      'creator_info_verified',
    ]);
    expect(composerOnlySettings(YoutubeSettingsDto)).toEqual(['publishAt']);
  });

  it('leaves the JSON schema alone', () => {
    expect(JSON.stringify(targetConstructorToSchema(Marked))).toBe(
      JSON.stringify(targetConstructorToSchema(Plain))
    );
  });

  it('keeps the public TikTok settings schema the same as before', () => {
    const schema = (getValidationSchemas() as any).TikTokDto;
    expect(keys(schema).filter((key) => key.startsWith('x-'))).toEqual([]);
    // sha256 of JSON.stringify(TikTokDto schema) on main before ComposerOnly;
    // a change to the TikTok DTO itself updates it on purpose: last for the
    // content_posting_method description (Direct Post only in the composer)
    expect(createHash('sha256').update(JSON.stringify(schema)).digest('hex')).toBe(
      '1e5b47576bd3cf89b6fb3085ebe26c716a525db1b1c813647e42dc93d6d00888'
    );
  });
});
