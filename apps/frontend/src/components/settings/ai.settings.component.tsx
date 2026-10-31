'use client';

import React, { FC, useCallback, useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { Button } from '@gitroom/react/form/button';
import { Input } from '@gitroom/react/form/input';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { deleteDialog } from '@gitroom/react/helpers/delete.dialog';
import { useT } from '@gitroom/react/translation/get.transation.service.client';

interface AiCredential {
  provider: 'openai';
  maskedKey: string;
}

export const useAiCredential = () => {
  const fetch = useFetch();

  const load = useCallback(async (): Promise<AiCredential | null> => {
    // No saved key comes back as an empty body, not as JSON
    const body = await (await fetch('/ai-credentials')).text();
    return body ? JSON.parse(body) : null;
  }, []);

  return useSWR<AiCredential | null>('ai-credentials', load);
};

export const AiSettings: FC = () => {
  const t = useT();
  const fetch = useFetch();
  const toaster = useToaster();
  const { mutate: globalMutate } = useSWRConfig();
  const { data, isLoading, mutate } = useAiCredential();
  const [apiKey, setApiKey] = useState('');
  const [replacing, setReplacing] = useState(false);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    await mutate();
    await globalMutate('/user/self');
  }, [mutate, globalMutate]);

  const save = useCallback(async () => {
    if (!apiKey.trim()) {
      return;
    }
    setSaving(true);
    let response: Response;
    try {
      response = await fetch('/ai-credentials', {
        method: 'POST',
        body: JSON.stringify({ provider: 'openai', apiKey: apiKey.trim() }),
      });
    } finally {
      setSaving(false);
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const message = Array.isArray(error?.message)
        ? error.message[0]
        : error?.message;
      toaster.show(
        message ||
          t('ai_key_save_failed', 'Could not save this key, please try again'),
        'warning'
      );
      return;
    }

    setApiKey('');
    setReplacing(false);
    await refresh();
    toaster.show(t('ai_key_saved', 'AI key saved'), 'success');
  }, [apiKey, fetch, refresh, toaster, t]);

  const remove = useCallback(async () => {
    if (
      !(await deleteDialog(
        t(
          'ai_key_remove_confirm',
          'Remove this AI key? AI features will turn off for this workspace.'
        ),
        t('remove', 'Remove')
      ))
    ) {
      return;
    }
    await fetch('/ai-credentials', {
      method: 'DELETE',
    });
    setReplacing(false);
    await refresh();
    toaster.show(t('ai_key_removed', 'AI key removed'), 'success');
  }, [fetch, refresh, toaster, t]);

  const showInput = !data || replacing;

  return (
    <div className="flex flex-col">
      <h3 className="text-[20px]">{t('ai_settings', 'AI')}</h3>
      <div className="text-textItemBlur mt-[4px]">
        {t(
          'ai_settings_description',
          "PostDelegate's AI writing, Agent and images run on your own OpenAI account. You pay OpenAI directly for what you use. A ChatGPT Plus subscription doesn't include API usage."
        )}
      </div>
      <div className="my-[16px] mt-[16px] bg-sixth border-fifth border rounded-[4px] p-[24px] flex flex-col gap-[16px]">
        {isLoading ? (
          <div className="animate-pulse">{t('loading', 'Loading...')}</div>
        ) : (
          <>
            {!!data && (
              <div className="flex items-center justify-between gap-[16px] mobile:flex-col mobile:items-start">
                <div className="text-[14px] break-all">
                  {t('ai_openai_key', 'OpenAI key: {{maskedKey}}', {
                    maskedKey: data.maskedKey,
                  })}
                </div>
                <div className="flex gap-[8px]">
                  {!replacing && (
                    <Button
                      secondary
                      onClick={() => setReplacing(true)}
                      className="rounded-[8px]"
                    >
                      {t('replace', 'Replace')}
                    </Button>
                  )}
                  <Button secondary onClick={remove} className="rounded-[8px]">
                    {t('remove', 'Remove')}
                  </Button>
                </div>
              </div>
            )}
            {showInput && (
              <div className="flex flex-col gap-[8px]">
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[14px] underline underline-offset-4 hover:text-textItemFocused w-fit"
                >
                  {t('get_an_api_key', 'Get an API key')}
                </a>
                <div className="flex items-start gap-[8px] mobile:flex-col mobile:items-stretch">
                  <div className="flex-1">
                    <Input
                      label=""
                      name="openaiApiKey"
                      type="password"
                      autoComplete="off"
                      disableForm={true}
                      removeError={true}
                      placeholder="sk-..."
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      onKeyDown={(e) => {
                        // The settings panel sits inside the profile form
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          save();
                        }
                      }}
                    />
                  </div>
                  <Button
                    onClick={save}
                    loading={saving}
                    disabled={!apiKey.trim()}
                    className="rounded-[8px] h-[42px]"
                  >
                    {t('save', 'Save')}
                  </Button>
                  {replacing && (
                    <Button
                      secondary
                      onClick={() => {
                        setApiKey('');
                        setReplacing(false);
                      }}
                      className="rounded-[8px] h-[42px]"
                    >
                      {t('cancel', 'Cancel')}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
