'use client';

import { FC, FormEvent, useCallback, useEffect, useId, useMemo, useState } from 'react';
import useSWR from 'swr';
import clsx from 'clsx';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { showMediaBox } from '@gitroom/frontend/components/media/media.component';
import {
  buttonV2,
  CardV2,
  EmptyV2,
  inputV2,
  KpiCardV2,
  PageV2,
} from '@gitroom/frontend/components/features/ui/kit.v2';
import {
  accentOf,
  DEFAULT_ACCENT,
  hostOf,
  slugify,
  SmartLinkItem,
  SmartLinksResponse,
  SmartLinkStats,
  textOnAccent,
} from '@gitroom/frontend/components/features/smartlinks/smartlinks.types';

type Days = 7 | 30 | 90;

const fmt = (value: number) => new Intl.NumberFormat().format(value);

// daily clicks and views as small bars
const DailyBars: FC<{ stats: SmartLinkStats }> = ({ stats }) => {
  const t = useT();
  const max = Math.max(1, ...stats.days.map((d) => Math.max(d.views, d.clicks)));
  return (
    <div>
      <div
        role="img"
        aria-label={t('smartlinks_chart_label', 'Views and clicks per day')}
        className="h-[120px] flex items-end gap-[2px]"
      >
        {stats.days.map((day) => (
          <div
            key={day.date}
            title={`${day.date}: ${day.views} views, ${day.clicks} clicks`}
            className="flex-1 h-full flex items-end gap-[1px] min-w-0"
          >
            <div
              className="flex-1 rounded-t-[3px] bg-[#7357ff66]"
              style={{ height: `${(day.views / max) * 100}%` }}
            />
            <div
              className="flex-1 rounded-t-[3px] bg-[#c8ff4d]"
              style={{ height: `${(day.clicks / max) * 100}%` }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-[14px] text-[11.5px] text-pdInk3 mt-[8px]">
        <span className="inline-flex items-center gap-[6px]">
          <span className="w-[8px] h-[8px] rounded-[2px] bg-[#7357ff66]" />
          {t('smartlinks_views', 'Page views')}
        </span>
        <span className="inline-flex items-center gap-[6px]">
          <span className="w-[8px] h-[8px] rounded-[2px] bg-[#c8ff4d]" />
          {t('smartlinks_clicks', 'Link clicks')}
        </span>
      </div>
    </div>
  );
};

// a phone-sized preview of the public page
const PhonePreview: FC<{
  title: string;
  bio: string;
  avatarUrl: string;
  accent: string;
  items: SmartLinkItem[];
}> = ({ title, bio, avatarUrl, accent, items }) => {
  const color = accentOf(accent);
  const onColor = textOnAccent(color);
  return (
    <div
      aria-hidden
      className="w-[260px] mx-auto rounded-[28px] border-[6px] border-pdLine2 bg-[#0b0b10] px-[14px] py-[22px] flex flex-col items-center gap-[10px] min-h-[420px]"
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt="" className="w-[56px] h-[56px] rounded-full object-cover" />
      ) : (
        <div
          className="w-[56px] h-[56px] rounded-full flex items-center justify-center text-[22px] font-[800]"
          style={{ background: color, color: onColor }}
        >
          {(title || '?').slice(0, 1).toUpperCase()}
        </div>
      )}
      <div className="text-[14px] font-[800] text-white text-center">{title || '…'}</div>
      {!!bio && (
        <div className="text-[11px] text-[#b9b9c6] text-center line-clamp-3">{bio}</div>
      )}
      <div className="w-full flex flex-col gap-[8px] mt-[4px]">
        {items
          .filter((item) => item.active)
          .slice(0, 8)
          .map((item) => (
            <div
              key={item.id}
              className="w-full rounded-[10px] px-[10px] py-[9px] text-[12px] font-[700] text-center truncate"
              style={{ background: color, color: onColor }}
            >
              {item.title}
            </div>
          ))}
      </div>
    </div>
  );
};

export const SmartLinksV2: FC = () => {
  const t = useT();
  const fetch = useFetch();
  const toaster = useToaster();
  const { frontEndUrl } = useVariables();
  const [days, setDays] = useState<Days>(30);
  const ids = {
    slug: useId(),
    title: useId(),
    bio: useId(),
    avatar: useId(),
    accent: useId(),
    linkTitle: useId(),
    linkUrl: useId(),
  };

  const load = useCallback(async (path: string) => {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error('smartlinks');
    }
    return (await response.json()) as SmartLinksResponse;
  }, []);
  const { data, error, isLoading, mutate } = useSWR(`/smartlinks?days=${days}`, load, {
    revalidateOnFocus: false,
  });

  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [accent, setAccent] = useState('');
  const [published, setPublished] = useState(false);
  const [saving, setSaving] = useState(false);
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!data?.page) return;
    setSlug(data.page.slug);
    setTitle(data.page.title);
    setBio(data.page.bio || '');
    setAvatarUrl(data.page.avatarUrl || '');
    setAccent(data.page.accentColor || '');
    setPublished(data.page.published);
  }, [data?.page]);

  // every change returns the whole page, items and stats
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
            response.status === 403
              ? t('smartlinks_admin_only', 'Only workspace admins can change the page.')
              : message || t('smartlinks_failed', 'That did not work. Try again.'),
            'warning'
          );
          return false;
        }
        await mutate(await response.json(), { revalidate: path !== '/smartlinks' });
        return true;
      } finally {
        setBusy(null);
      }
    },
    [mutate]
  );

  const savePage = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const ok = await call('page', '/smartlinks', 'PUT', {
      slug: slugify(slug),
      title: title.trim(),
      bio: bio.trim() || null,
      avatarUrl: avatarUrl.trim() || null,
      accentColor: /^#[0-9a-f]{6}$/i.test(accent) ? accent : null,
      published,
    });
    setSaving(false);
    if (ok) {
      toaster.show(t('smartlinks_saved', 'Page saved'), 'success');
    }
  };

  const addLink = async (e: FormEvent) => {
    e.preventDefault();
    if (await call('add', '/smartlinks/items', 'POST', { title: linkTitle, url: linkUrl })) {
      setLinkTitle('');
      setLinkUrl('');
    }
  };

  const items = data?.items || [];
  const move = (index: number, by: number) => {
    const order = items.map((item) => item.id);
    const [id] = order.splice(index, 1);
    order.splice(index + by, 0, id);
    call(`move-${id}`, '/smartlinks/items/order', 'PUT', { ids: order });
  };

  const publicUrl = `${(frontEndUrl || '').replace(/\/$/, '')}/bio/${data?.page?.slug || slugify(slug) || 'your-name'}`;
  const stats = data?.stats;
  const topLinks = useMemo(
    () =>
      stats
        ? [...items]
            .map((item) => ({ item, clicks: stats.byItem[item.id] || 0 }))
            .sort((a, b) => b.clicks - a.clicks)
        : [],
    [items, stats]
  );

  return (
    <PageV2
      title={t('smartlinks_title', 'SmartLinks')}
      subtitle={t(
        'smartlinks_subtitle',
        'One link for your bio: your posts, shop and site on a page you control, with click stats.'
      )}
      actions={
        <>
          <div role="group" aria-label={t('smartlinks_range', 'Range')} className="flex gap-[4px]">
            {([7, 30, 90] as Days[]).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={days === value}
                onClick={() => setDays(value)}
                className={clsx(buttonV2.ghost, days === value && '!border-[#7357ff] !text-[#b39aff]')}
              >
                {t('smartlinks_days', '{{days}} days', { days: value })}
              </button>
            ))}
          </div>
          {data?.page?.published && (
            <a href={publicUrl} target="_blank" rel="noopener" className={buttonV2.primary}>
              {t('smartlinks_open', 'Open page')}
            </a>
          )}
        </>
      }
    >
      {error ? (
        <EmptyV2 title={t('smartlinks_error', 'SmartLinks could not be loaded')}>
          {t('smartlinks_error_hint', 'Reload the page to try again.')}
        </EmptyV2>
      ) : (
        <>
          <div className="grid grid-cols-4 tablet:grid-cols-2 gap-[12px]">
            <KpiCardV2 label={t('smartlinks_views', 'Page views')} value={fmt(stats?.views || 0)} loading={isLoading} />
            <KpiCardV2 label={t('smartlinks_clicks', 'Link clicks')} value={fmt(stats?.clicks || 0)} loading={isLoading} tone="lime" />
            <KpiCardV2
              label={t('smartlinks_ctr', 'Click rate')}
              value={stats?.ctr === null || stats?.ctr === undefined ? '–' : `${stats.ctr}%`}
              loading={isLoading}
              hint={t('smartlinks_ctr_hint', 'clicks per page view')}
            />
            <KpiCardV2
              label={t('smartlinks_links', 'Live links')}
              value={fmt(items.filter((item) => item.active).length)}
              loading={isLoading}
              hint={data?.page?.published ? t('smartlinks_live', 'page is live') : t('smartlinks_draft', 'page is not published')}
            />
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_300px] tablet:grid-cols-1 gap-[16px] items-start">
            <div className="flex flex-col gap-[16px] min-w-0">
              <CardV2
                title={t('smartlinks_page', 'Your page')}
                subtitle={
                  <span className="break-all">
                    {t('smartlinks_address_hint', 'Public address:')} <span className="text-[#b39aff]">{publicUrl}</span>
                  </span>
                }
              >
                <form onSubmit={savePage} className="flex flex-col gap-[12px]">
                  <div className="grid grid-cols-2 mobile:grid-cols-1 gap-[12px]">
                    <label htmlFor={ids.slug} className="flex flex-col gap-[6px] text-[12px] text-pdInk3">
                      {t('smartlinks_slug', 'Page address')}
                      <input
                        id={ids.slug}
                        className={inputV2}
                        value={slug}
                        maxLength={40}
                        required
                        placeholder="your-name"
                        onChange={(e) => setSlug(e.target.value.toLowerCase())}
                        onBlur={() => setSlug(slugify(slug))}
                      />
                    </label>
                    <label htmlFor={ids.title} className="flex flex-col gap-[6px] text-[12px] text-pdInk3">
                      {t('smartlinks_page_title', 'Title')}
                      <input
                        id={ids.title}
                        className={inputV2}
                        value={title}
                        maxLength={80}
                        required
                        onChange={(e) => setTitle(e.target.value)}
                      />
                    </label>
                  </div>
                  <label htmlFor={ids.bio} className="flex flex-col gap-[6px] text-[12px] text-pdInk3">
                    {t('smartlinks_bio', 'Short bio')}
                    <textarea
                      id={ids.bio}
                      className={clsx(inputV2, '!h-[72px] py-[8px] resize-none')}
                      value={bio}
                      maxLength={300}
                      onChange={(e) => setBio(e.target.value)}
                    />
                  </label>
                  <div className="grid grid-cols-2 mobile:grid-cols-1 gap-[12px]">
                    <div className="flex flex-col gap-[6px] text-[12px] text-pdInk3">
                      <label htmlFor={ids.avatar}>{t('smartlinks_avatar', 'Picture')}</label>
                      <div className="flex gap-[8px]">
                        <input
                          id={ids.avatar}
                          className={inputV2}
                          value={avatarUrl}
                          placeholder="https://"
                          onChange={(e) => setAvatarUrl(e.target.value)}
                        />
                        <button
                          type="button"
                          className={clsx(buttonV2.ghost, '!h-[36px]')}
                          onClick={() => showMediaBox((media: { path: string }) => setAvatarUrl(media.path))}
                        >
                          {t('smartlinks_choose', 'Choose')}
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-col gap-[6px] text-[12px] text-pdInk3">
                      <label htmlFor={ids.accent}>{t('smartlinks_accent', 'Button color')}</label>
                      <div className="flex gap-[8px]">
                        <input
                          type="color"
                          aria-label={t('smartlinks_accent', 'Button color')}
                          value={accentOf(accent)}
                          onChange={(e) => setAccent(e.target.value)}
                          className="h-[36px] w-[44px] shrink-0 rounded-[9px] bg-pdSurface2 border border-pdLine2 p-[3px] cursor-pointer"
                        />
                        <input
                          id={ids.accent}
                          className={inputV2}
                          value={accent}
                          placeholder={DEFAULT_ACCENT}
                          maxLength={7}
                          onChange={(e) => setAccent(e.target.value.trim())}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-[12px] flex-wrap">
                    <label className="inline-flex items-center gap-[8px] text-[13px] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={published}
                        onChange={(e) => setPublished(e.target.checked)}
                        className="w-[16px] h-[16px] accent-[#c8ff4d]"
                      />
                      {t('smartlinks_publish', 'Published (anyone with the address can see it)')}
                    </label>
                    <div className="flex-1" />
                    <button type="submit" disabled={saving || !slug || !title.trim()} className={buttonV2.primary}>
                      {saving ? t('smartlinks_saving', 'Saving…') : t('smartlinks_save', 'Save page')}
                    </button>
                  </div>
                </form>
              </CardV2>

              <CardV2
                title={t('smartlinks_links_title', 'Links')}
                subtitle={t('smartlinks_links_hint', 'Shown in this order. Clicks are for the selected range.')}
              >
                {!data?.page ? (
                  <EmptyV2 title={t('smartlinks_first', 'Save your page first')}>
                    {t('smartlinks_first_hint', 'Pick an address and a title above, then add your links here.')}
                  </EmptyV2>
                ) : (
                  <>
                    <form onSubmit={addLink} className="grid grid-cols-[1fr_1.4fr_auto] mobile:grid-cols-1 gap-[8px] items-end">
                      <label htmlFor={ids.linkTitle} className="flex flex-col gap-[6px] text-[12px] text-pdInk3">
                        {t('smartlinks_link_title', 'Button text')}
                        <input
                          id={ids.linkTitle}
                          className={inputV2}
                          value={linkTitle}
                          maxLength={100}
                          required
                          placeholder={t('smartlinks_link_title_ph', 'Shop the drop')}
                          onChange={(e) => setLinkTitle(e.target.value)}
                        />
                      </label>
                      <label htmlFor={ids.linkUrl} className="flex flex-col gap-[6px] text-[12px] text-pdInk3">
                        {t('smartlinks_link_url', 'Link')}
                        <input
                          id={ids.linkUrl}
                          className={inputV2}
                          value={linkUrl}
                          required
                          placeholder="https://"
                          onChange={(e) => setLinkUrl(e.target.value)}
                        />
                      </label>
                      <button type="submit" disabled={busy === 'add'} className={clsx(buttonV2.primary, '!h-[36px]')}>
                        {t('smartlinks_add', 'Add link')}
                      </button>
                    </form>
                    {!items.length ? (
                      <p className="text-[12.5px] text-pdInk3">{t('smartlinks_no_links', 'No links yet.')}</p>
                    ) : (
                      <ul className="flex flex-col divide-y divide-pdLine">
                        {items.map((item, index) => (
                          <li key={item.id} className="flex items-center gap-[10px] py-[10px] min-w-0">
                            <div className="flex flex-col gap-[2px]">
                              <button
                                type="button"
                                aria-label={t('smartlinks_up', 'Move up')}
                                disabled={index === 0 || !!busy}
                                onClick={() => move(index, -1)}
                                className="w-[22px] h-[16px] text-[10px] rounded-[4px] bg-pdSurface2 disabled:opacity-30"
                              >
                                ▲
                              </button>
                              <button
                                type="button"
                                aria-label={t('smartlinks_down', 'Move down')}
                                disabled={index === items.length - 1 || !!busy}
                                onClick={() => move(index, 1)}
                                className="w-[22px] h-[16px] text-[10px] rounded-[4px] bg-pdSurface2 disabled:opacity-30"
                              >
                                ▼
                              </button>
                            </div>
                            <div className={clsx('flex-1 min-w-0', !item.active && 'opacity-50')}>
                              <div className="text-[13.5px] font-[600] truncate">{item.title}</div>
                              <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-[12px] text-pdInk3 hover:text-[#b39aff] truncate block">
                                {hostOf(item.url)}
                              </a>
                            </div>
                            <span className="text-[12.5px] tabular-nums text-pdInk3 whitespace-nowrap">
                              {t('smartlinks_item_clicks', '{{n}} clicks', {
                                n: fmt(stats?.byItem[item.id] || 0),
                              })}
                            </span>
                            <button
                              type="button"
                              disabled={!!busy}
                              onClick={() => call(`toggle-${item.id}`, `/smartlinks/items/${item.id}`, 'PUT', { active: !item.active })}
                              className={buttonV2.ghost}
                            >
                              {item.active ? t('smartlinks_hide', 'Hide') : t('smartlinks_show', 'Show')}
                            </button>
                            <button
                              type="button"
                              disabled={!!busy}
                              onClick={() => {
                                if (window.confirm(t('smartlinks_delete_confirm', 'Remove this link?'))) {
                                  call(`delete-${item.id}`, `/smartlinks/items/${item.id}`, 'DELETE');
                                }
                              }}
                              className={clsx(buttonV2.ghost, 'hover:!border-[#ff5a5f88] hover:!text-[#ff5a5f]')}
                            >
                              {t('smartlinks_delete', 'Remove')}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </CardV2>

              {!!stats && (
                <CardV2 title={t('smartlinks_stats', 'Views and clicks')}>
                  <DailyBars stats={stats} />
                  {topLinks.some((row) => row.clicks > 0) && (
                    <ol className="flex flex-col gap-[6px]">
                      {topLinks
                        .filter((row) => row.clicks > 0)
                        .slice(0, 5)
                        .map(({ item, clicks }) => (
                          <li key={item.id} className="flex items-center gap-[10px] text-[12.5px]">
                            <span className="flex-1 truncate">{item.title}</span>
                            <div className="w-[40%] h-[6px] rounded-full bg-pdSurface2 overflow-hidden">
                              <div
                                className="h-full bg-[#c8ff4d]"
                                style={{ width: `${(clicks / Math.max(1, topLinks[0].clicks)) * 100}%` }}
                              />
                            </div>
                            <span className="tabular-nums w-[48px] text-end">{fmt(clicks)}</span>
                          </li>
                        ))}
                    </ol>
                  )}
                </CardV2>
              )}
            </div>

            <CardV2 title={t('smartlinks_preview', 'Preview')} className="sticky top-0">
              <PhonePreview title={title} bio={bio} avatarUrl={avatarUrl} accent={accent} items={items} />
            </CardV2>
          </div>
        </>
      )}
    </PageV2>
  );
};
