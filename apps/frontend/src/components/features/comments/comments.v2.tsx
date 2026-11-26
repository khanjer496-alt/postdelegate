'use client';

import { FC, FormEvent, useCallback, useState } from 'react';
import useSWR from 'swr';
import clsx from 'clsx';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { deleteDialog } from '@gitroom/react/helpers/delete.dialog';
import {
  buttonV2,
  CardV2,
  EmptyV2,
  inputV2,
  PageV2,
} from '@gitroom/frontend/components/features/ui/kit.v2';

interface CommentChannel {
  id: string;
  name: string;
  picture: string | null;
  identifier: string;
}

interface CommentPost {
  id: string;
  caption: string;
  permalink?: string;
  thumbnail?: string;
  createdAt: string;
  comments: number;
}

interface PostComment {
  id: string;
  text: string;
  username: string;
  createdAt: string;
  hidden: boolean;
  own: boolean;
  replies: PostComment[];
}

interface CommentRule {
  id: string;
  keyword: string;
  reply: string;
  active: boolean;
}

interface PostCommentsResponse {
  comments: PostComment[];
  rules: CommentRule[];
  autoReplies: Record<string, 'pending' | 'replied' | 'failed'>;
}

// the open post is read again this often, which also runs its auto-replies
const REFRESH_MS = 10000;

const when = (date: string) =>
  new Date(date).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const useJson = <T,>() => {
  const fetch = useFetch();
  return useCallback(
    async (path: string) => {
      const response = await fetch(path);
      if (!response.ok) {
        throw new Error(String(response.status));
      }
      return (await response.json()) as T;
    },
    [fetch]
  );
};

const useCommentChannels = () =>
  useSWR('/comments/channels', useJson<CommentChannel[]>(), {
    revalidateOnFocus: false,
  });

const useCommentPosts = (channel?: string) =>
  useSWR(channel ? `/comments/${channel}/posts` : null, useJson<CommentPost[]>(), {
    revalidateOnFocus: false,
  });

const usePostComments = (channel?: string, post?: string) =>
  useSWR(
    channel && post ? `/comments/${channel}/posts/${post}` : null,
    useJson<PostCommentsResponse>(),
    { refreshInterval: REFRESH_MS }
  );

const CommentRow: FC<{
  comment: PostComment;
  autoReply?: string;
  busy: string | null;
  onReply?: (comment: PostComment, message: string) => Promise<boolean>;
  onHide: (comment: PostComment) => void;
  onDelete: (comment: PostComment) => void;
}> = ({ comment, autoReply, busy, onReply, onHide, onDelete }) => {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (onReply && (await onReply(comment, message))) {
      setMessage('');
      setOpen(false);
    }
  };
  return (
    <div className={clsx('flex flex-col gap-[6px]', comment.hidden && 'opacity-60')}>
      <div className="flex items-start gap-[8px]">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-[6px] text-[12px]">
            <span className="font-[700]">@{comment.username || '…'}</span>
            <span className="text-pdInk3">{when(comment.createdAt)}</span>
            {comment.own && (
              <span className="px-[6px] rounded-full bg-pdSurface2 text-pdInk3">
                {t('comments_you', 'you')}
              </span>
            )}
            {comment.hidden && (
              <span className="px-[6px] rounded-full bg-pdSurface2 text-pdInk3">
                {t('comments_hidden', 'hidden')}
              </span>
            )}
            {autoReply === 'replied' && (
              <span className="px-[6px] rounded-full bg-[#3ddc9726] text-[#3ddc97]">
                {t('comments_auto_replied', 'auto-replied')}
              </span>
            )}
            {autoReply === 'failed' && (
              <span className="px-[6px] rounded-full bg-[#ff5a5f26] text-[#ff5a5f]">
                {t('comments_auto_failed', 'auto-reply failed')}
              </span>
            )}
          </div>
          <p className="text-[13px] whitespace-pre-wrap break-words mt-[2px]">
            {comment.text}
          </p>
        </div>
        <div className="flex gap-[6px] shrink-0">
          {onReply && (
            <button type="button" className={buttonV2.ghost} onClick={() => setOpen(!open)}>
              {t('comments_reply', 'Reply')}
            </button>
          )}
          {!comment.own && (
            <button
              type="button"
              className={buttonV2.ghost}
              disabled={busy === `hide-${comment.id}`}
              onClick={() => onHide(comment)}
            >
              {comment.hidden ? t('comments_unhide', 'Unhide') : t('comments_hide', 'Hide')}
            </button>
          )}
          <button
            type="button"
            className={buttonV2.ghost}
            disabled={busy === `delete-${comment.id}`}
            onClick={() => onDelete(comment)}
          >
            {t('comments_delete', 'Delete')}
          </button>
        </div>
      </div>
      {open && (
        <form onSubmit={send} className="flex gap-[8px]">
          <input
            className={inputV2}
            value={message}
            maxLength={2200}
            required
            autoFocus
            aria-label={t('comments_reply_label', 'Reply to @{{username}}', {
              username: comment.username,
            })}
            placeholder={t('comments_reply_placeholder', 'Write a reply')}
            onChange={(e) => setMessage(e.target.value)}
          />
          <button
            type="submit"
            className={buttonV2.primary}
            disabled={busy === `reply-${comment.id}` || !message.trim()}
          >
            {t('comments_send', 'Send')}
          </button>
        </form>
      )}
      {comment.replies.length > 0 && (
        <div className="ms-[18px] ps-[12px] border-s border-pdLine flex flex-col gap-[8px]">
          {comment.replies.map((reply) => (
            <CommentRow
              key={reply.id}
              comment={reply}
              busy={busy}
              onHide={onHide}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const CommentsV2: FC = () => {
  const t = useT();
  const fetch = useFetch();
  const toaster = useToaster();
  const [picked, setPicked] = useState<string>();
  const [post, setPost] = useState<string>();
  const [busy, setBusy] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  const [ruleReply, setRuleReply] = useState('');

  const { data: channels, error: channelsError } = useCommentChannels();
  // the first channel until another one is picked
  const channel = picked || channels?.[0]?.id;
  const { data: posts, error: postsError, isLoading: postsLoading } =
    useCommentPosts(channel);
  const { data, error, mutate } = usePostComments(channel, post);

  const call = useCallback(
    async (key: string, path: string, method: string, body?: unknown) => {
      setBusy(key);
      try {
        const response = await fetch(path, {
          method,
          ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        });
        if (!response.ok) {
          const message = await response
            .json()
            .then((json: { message?: string | string[] }) =>
              Array.isArray(json.message) ? json.message[0] : json.message
            )
            .catch(() => undefined);
          toaster.show(
            message || t('comments_failed', 'That did not work. Try again.'),
            'warning'
          );
          return false;
        }
        await mutate();
        return true;
      } finally {
        setBusy(null);
      }
    },
    [mutate]
  );

  const reply = (comment: PostComment, message: string) =>
    call(`reply-${comment.id}`, `/comments/${channel}/comments/${comment.id}/reply`, 'POST', {
      message,
    });
  const hide = (comment: PostComment) =>
    call(`hide-${comment.id}`, `/comments/${channel}/comments/${comment.id}/hide`, 'PUT', {
      hidden: !comment.hidden,
    });
  const remove = async (comment: PostComment) => {
    if (
      await deleteDialog(
        t('comments_delete_confirm', 'Delete this comment from the post?')
      )
    ) {
      call(`delete-${comment.id}`, `/comments/${channel}/comments/${comment.id}`, 'DELETE');
    }
  };
  const addRule = async (e: FormEvent) => {
    e.preventDefault();
    if (
      await call('rule', `/comments/${channel}/posts/${post}/rules`, 'POST', {
        keyword,
        reply: ruleReply,
      })
    ) {
      setKeyword('');
      setRuleReply('');
      toaster.show(t('comments_rule_saved', 'Auto-reply is on'), 'success');
    }
  };

  const selected = posts?.find((item) => item.id === post);

  return (
    <PageV2
      title={t('comments_title', 'Comments')}
      subtitle={t(
        'comments_subtitle',
        'Read and answer comments on your posts, and reply automatically when a comment contains a keyword.'
      )}
      actions={
        !!channels?.length && (
          <select
            aria-label={t('comments_channel', 'Channel')}
            className={clsx(inputV2, '!w-auto')}
            value={channel || ''}
            onChange={(e) => {
              setPicked(e.target.value);
              setPost(undefined);
            }}
          >
            {channels.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        )
      }
    >
      {channelsError ? (
        <EmptyV2 title={t('comments_error', 'Comments could not be loaded')}>
          {t('comments_error_hint', 'Reload the page to try again.')}
        </EmptyV2>
      ) : channels && !channels.length ? (
        <EmptyV2 title={t('comments_no_channels', 'No channel with comments yet')}>
          {t(
            'comments_no_channels_hint',
            'Connect an Instagram professional account with Instagram Login to manage its comments here.'
          )}
        </EmptyV2>
      ) : (
        <div className="grid grid-cols-[320px_minmax(0,1fr)] tablet:grid-cols-1 gap-[16px] items-start">
          <CardV2 title={t('comments_posts', 'Recent posts')}>
            {postsError ? (
              <span className="text-[12.5px] text-pdInk3">
                {t('comments_posts_error', 'The posts could not be read. Reconnect the channel if this keeps happening.')}
              </span>
            ) : postsLoading ? (
              <span className="text-[12.5px] text-pdInk3">{t('comments_loading', 'Loading…')}</span>
            ) : !posts?.length ? (
              <span className="text-[12.5px] text-pdInk3">{t('comments_no_posts', 'No posts yet.')}</span>
            ) : (
              <div className="flex flex-col gap-[6px]">
                {posts.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={item.id === post}
                    onClick={() => setPost(item.id)}
                    className={clsx(
                      'flex items-center gap-[10px] p-[8px] rounded-[10px] border text-start',
                      item.id === post ? 'border-[#7357ff] bg-pdSurface2' : 'border-pdLine hover:border-pdLine2'
                    )}
                  >
                    {item.thumbnail ? (
                      <img src={item.thumbnail} alt="" className="w-[44px] h-[44px] rounded-[8px] object-cover shrink-0" />
                    ) : (
                      <span className="w-[44px] h-[44px] rounded-[8px] bg-pdSurface2 shrink-0" />
                    )}
                    <span className="flex-1 min-w-0">
                      <span className="block text-[12.5px] truncate">
                        {item.caption || t('comments_no_caption', 'No caption')}
                      </span>
                      <span className="block text-[11.5px] text-pdInk3">
                        {when(item.createdAt)} · {t('comments_count', '{{count}} comments', { count: item.comments })}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </CardV2>

          {!selected ? (
            <EmptyV2 title={t('comments_pick_post', 'Pick a post')}>
              {t('comments_pick_post_hint', 'Its comments and auto-replies show here.')}
            </EmptyV2>
          ) : (
            <div className="flex flex-col gap-[16px] min-w-0">
              <CardV2
                title={t('comments_rules', 'Keyword auto-replies')}
                subtitle={t(
                  'comments_rules_hint',
                  'A new comment on this post that contains the keyword gets the reply, once, within about 30 seconds.'
                )}
              >
                {!!data?.rules.length && (
                  <div className="flex flex-col gap-[8px]">
                    {data.rules.map((rule) => (
                      <div key={rule.id} className="flex items-center gap-[8px] text-[12.5px]">
                        <span className="flex-1 min-w-0">
                          <span className="font-[700]">“{rule.keyword}”</span>
                          <span className="text-pdInk3"> → </span>
                          <span className="break-words">{rule.reply}</span>
                        </span>
                        <button
                          type="button"
                          className={buttonV2.ghost}
                          aria-pressed={rule.active}
                          disabled={busy === `rule-${rule.id}`}
                          onClick={() =>
                            call(`rule-${rule.id}`, `/comments/rules/${rule.id}`, 'PUT', {
                              active: !rule.active,
                            })
                          }
                        >
                          {rule.active ? t('comments_rule_on', 'On') : t('comments_rule_off', 'Off')}
                        </button>
                        <button
                          type="button"
                          className={buttonV2.ghost}
                          disabled={busy === `rule-${rule.id}`}
                          onClick={() => call(`rule-${rule.id}`, `/comments/rules/${rule.id}`, 'DELETE')}
                        >
                          {t('comments_delete', 'Delete')}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <form onSubmit={addRule} className="grid grid-cols-[160px_minmax(0,1fr)_auto] mobile:grid-cols-1 gap-[8px]">
                  <input
                    className={inputV2}
                    value={keyword}
                    maxLength={100}
                    required
                    aria-label={t('comments_keyword', 'Keyword')}
                    placeholder={t('comments_keyword', 'Keyword')}
                    onChange={(e) => setKeyword(e.target.value)}
                  />
                  <input
                    className={inputV2}
                    value={ruleReply}
                    maxLength={2200}
                    required
                    aria-label={t('comments_rule_reply', 'Reply')}
                    placeholder={t('comments_rule_reply_placeholder', 'Reply to send')}
                    onChange={(e) => setRuleReply(e.target.value)}
                  />
                  <button type="submit" className={buttonV2.primary} disabled={busy === 'rule'}>
                    {t('comments_add_rule', 'Add auto-reply')}
                  </button>
                </form>
              </CardV2>

              <CardV2
                title={t('comments_on_post', 'Comments')}
                subtitle={t('comments_live', 'Updates every 10 seconds.')}
                actions={
                  selected.permalink && (
                    <a href={selected.permalink} target="_blank" rel="noopener" className={buttonV2.ghost}>
                      {t('comments_open_post', 'Open post')}
                    </a>
                  )
                }
              >
                {error ? (
                  <span className="text-[12.5px] text-pdInk3">
                    {t('comments_read_error', 'The comments could not be read. Trying again shortly.')}
                  </span>
                ) : !data ? (
                  <span className="text-[12.5px] text-pdInk3">{t('comments_loading', 'Loading…')}</span>
                ) : !data.comments.length ? (
                  <span className="text-[12.5px] text-pdInk3">{t('comments_none', 'No comments yet.')}</span>
                ) : (
                  <div className="flex flex-col gap-[14px]">
                    {data.comments.map((comment) => (
                      <CommentRow
                        key={comment.id}
                        comment={comment}
                        autoReply={data.autoReplies[comment.id]}
                        busy={busy}
                        onReply={reply}
                        onHide={hide}
                        onDelete={remove}
                      />
                    ))}
                  </div>
                )}
              </CardV2>
            </div>
          )}
        </div>
      )}
    </PageV2>
  );
};
