'use client';

import React, { FC, useCallback, useMemo, useState } from 'react';
import clsx from 'clsx';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { Button } from '@gitroom/react/form/button';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { useFeedbackQuestion } from '@gitroom/frontend/components/feedback/feedback.hooks';

const TEXT_MAX = 500;

// A one-question survey in the corner, like the review card: never a blocker,
// asked once. The server decides which question (after sign-up, or after a
// trial or plan ended) and the close button is a skip, so it is not asked again.
export const FeedbackQuestion: FC = () => {
  const t = useT();
  const fetch = useFetch();
  const user = useUser();
  const toaster = useToaster();
  const { data, mutate } = useFeedbackQuestion();
  const [hidden, setHidden] = useState(false);
  const [choice, setChoice] = useState('');
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  const question = data?.question;

  const content = useMemo(() => {
    if (question === 'stopped') {
      return {
        title: t('feedback_stopped_title', 'What stopped you?'),
        text: t(
          'feedback_stopped_text',
          'Your trial or plan has ended. One answer helps us fix what got in the way.'
        ),
        choices: [
          {
            value: 'missing_network',
            label: t(
              'feedback_stopped_missing_network',
              'Missing a network I need'
            ),
          },
          {
            value: 'too_expensive',
            label: t('feedback_stopped_too_expensive', 'Too expensive'),
          },
          {
            value: 'could_not_connect',
            label: t(
              'feedback_stopped_could_not_connect',
              "Couldn't connect my account"
            ),
          },
          {
            value: 'no_time',
            label: t('feedback_stopped_no_time', "Didn't have time to set up"),
          },
          {
            value: 'other_tool',
            label: t('feedback_stopped_other_tool', 'Went with another tool'),
          },
          { value: 'other', label: t('feedback_other', 'Other') },
        ],
      };
    }
    return {
      title: t(
        'feedback_use_case_title',
        'What do you want to use PostDelegate for?'
      ),
      text: t(
        'feedback_use_case_text',
        'Optional, one tap. It helps us show you the right things first.'
      ),
      choices: [
        {
          value: 'own_brand',
          label: t(
            'feedback_use_case_own_brand',
            'Schedule posts for my own brand'
          ),
        },
        {
          value: 'clients',
          label: t(
            'feedback_use_case_clients',
            'Manage social media for clients'
          ),
        },
        {
          value: 'ai_assistant',
          label: t(
            'feedback_use_case_ai_assistant',
            'Let Claude or ChatGPT draft and schedule posts'
          ),
        },
        {
          value: 'team',
          label: t('feedback_use_case_team', 'Plan content with my team'),
        },
        {
          value: 'analytics',
          label: t(
            'feedback_use_case_analytics',
            'See how my posts perform'
          ),
        },
        { value: 'other', label: t('feedback_other', 'Other') },
      ],
    };
  }, [question, t]);

  const send = useCallback(
    async (answer: string) => {
      if (!question) {
        return;
      }
      setSaving(true);
      const response = await fetch('/feedback', {
        method: 'POST',
        body: JSON.stringify({
          kind: question,
          choice: answer,
          ...(answer !== 'skipped' && text.trim()
            ? { text: text.trim() }
            : {}),
        }),
      }).catch((): undefined => undefined);
      setSaving(false);
      setHidden(true);
      if (answer !== 'skipped' && response?.ok) {
        toaster.show(t('feedback_thanks', 'Thanks, that helps.'), 'success');
      }
      mutate();
    },
    [question, text, fetch, toaster, t, mutate]
  );

  // an admin looking at a customer's workspace must not answer for them
  if (!question || hidden || user?.impersonate) {
    return null;
  }

  return (
    <div
      role="complementary"
      aria-label={content.title}
      className="fixed bottom-[20px] start-[108px] mobile:start-[12px] mobile:end-[12px] mobile:bottom-[84px] z-[400] w-[360px] mobile:w-auto rounded-[12px] border border-newTableBorder bg-newBgColorInner shadow-previewShadow p-[16px] flex flex-col gap-[12px] text-newTextColor"
    >
      <div className="flex items-start gap-[8px]">
        <div className="flex-1 flex flex-col gap-[4px]">
          <div className="text-[15px] font-[600]">{content.title}</div>
          <div className="text-[13px] text-textItemBlur">{content.text}</div>
        </div>
        <button
          onClick={() => send('skipped')}
          aria-label={t('feedback_skip', 'Skip')}
          className="text-textItemBlur hover:text-newTextColor"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
          >
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
      <div role="radiogroup" className="flex flex-col gap-[6px]">
        {content.choices.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={choice === option.value}
            onClick={() => setChoice(option.value)}
            className={clsx(
              'text-start text-[13px] px-[12px] py-[8px] rounded-[8px] border',
              choice === option.value
                ? 'border-btnCta bg-boxFocused'
                : 'border-newTableBorder hover:bg-boxHover'
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
      {!!choice && (
        <textarea
          value={text}
          maxLength={TEXT_MAX}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('feedback_text_placeholder', 'Anything to add? (optional)')}
          className="min-h-[64px] p-[10px] rounded-[8px] bg-newBgColorInner border border-newTableBorder outline-none text-[13px] text-textColor resize-y"
        />
      )}
      <div className="flex gap-[8px]">
        <Button
          onClick={() => send(choice)}
          disabled={!choice}
          loading={saving}
          className="rounded-[8px] h-[36px] text-[13px]"
        >
          {t('feedback_send', 'Send')}
        </Button>
        <Button
          secondary={true}
          onClick={() => send('skipped')}
          disabled={saving}
          className="rounded-[8px] h-[36px] text-[13px]"
        >
          {t('feedback_skip', 'Skip')}
        </Button>
      </div>
    </div>
  );
};
