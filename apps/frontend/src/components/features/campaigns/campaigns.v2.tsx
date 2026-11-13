'use client';

// Campaign dashboards (PD_FF_CAMPAIGNS): campaigns are the workspace's post
// tags of kind Campaign (optionally plain tags and pillars too), with their
// posts, channels and engagement over the chosen window, past and scheduled.
import { FC, useCallback, useState } from 'react';
import useSWR from 'swr';
import clsx from 'clsx';
import dayjs from 'dayjs';
import Link from 'next/link';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { ChannelAvatarV2, Pill, statusPill } from '@gitroom/frontend/components/launches/v2/ui.v2';
import {
  buttonV2,
  CardV2,
  EmptyV2,
  KpiCardV2,
  PageV2,
} from '@gitroom/frontend/components/features/ui/kit.v2';

type Kind = 'TAG' | 'CAMPAIGN' | 'PILLAR';
interface Totals {
  posts: number;
  scheduled: number;
  published: number;
  drafts: number;
  failed: number;
  channels: number;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  clicks: number | null;
  engagement: number | null;
}
interface Campaign {
  id: string;
  name: string;
  color: string;
  kind: Kind;
  description: string | null;
  firstPost: string | null;
  lastPost: string | null;
  totals: Totals;
}
interface Detail {
  campaign: { id: string; name: string; color: string; kind: Kind; description: string | null };
  totals: Totals;
  channels: Array<{ id: string; name: string; picture: string | null; identifier: string; totals: Totals }>;
  posts: Array<{
    id: string;
    publishDate: string;
    state: string;
    url: string | null;
    excerpt: string;
    channel: { id: string; name: string; picture: string | null; identifier: string };
    views: number | null;
    engagement: number | null;
  }>;
}

const DAYS = [7, 30, 90, 365] as const;
const fmt = (value: number | null | undefined) =>
  value === null || value === undefined
    ? '–'
    : new Intl.NumberFormat(undefined, { notation: value >= 100000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(value);

const useJson = <T,>(key: string | null) => {
  const fetch = useFetch();
  const load = useCallback(async (path: string) => {
    const response = await fetch(path);
    if (!response.ok) throw new Error(path);
    return (await response.json()) as T;
  }, []);
  return useSWR<T>(key, load, { revalidateOnFocus: false });
};

const stateKey = (state: string) =>
  state === 'ERROR' ? 'failed' : state === 'PUBLISHED' ? 'published' : state === 'DRAFT' ? 'draft' : 'scheduled';

const CampaignDetail: FC<{ id: string; days: number; onBack: () => void }> = ({ id, days, onBack }) => {
  const t = useT();
  const { data, isLoading, error } = useJson<Detail>(`/campaigns/${encodeURIComponent(id)}?days=${days}`);
  if (error) {
    return <EmptyV2 title={t('campaign_not_found', 'This campaign could not be loaded')} action={<button className={buttonV2.ghost} onClick={onBack}>{t('back', 'Back')}</button>} />;
  }
  const loading = isLoading && !data;
  const totals = data?.totals;
  return (
    <div className="flex flex-col gap-[16px]" data-pd-campaign-detail="">
      <div className="flex items-center gap-[10px]">
        <button type="button" className={buttonV2.ghost} onClick={onBack}>
          <span aria-hidden="true" className="rtl:-scale-x-100">←</span> {t('campaigns', 'Campaigns')}
        </button>
        {data && (
          <>
            <span aria-hidden="true" className="w-[12px] h-[12px] rounded-full" style={{ background: data.campaign.color }} />
            <h2 className="text-[16px] font-[700]">{data.campaign.name}</h2>
            {data.campaign.description && <span className="text-[12.5px] text-pdInk3 truncate">{data.campaign.description}</span>}
          </>
        )}
      </div>
      <div className="grid grid-cols-6 desktop:grid-cols-3 tablet:grid-cols-2 mobile:grid-cols-1 gap-[12px]">
        <KpiCardV2 label={t('posts', 'Posts')} value={fmt(totals?.posts)} hint={t('campaign_channels_count', '{{count}} channels', { count: totals?.channels || 0 })} loading={loading} />
        <KpiCardV2 label={t('status_published', 'Published')} value={fmt(totals?.published)} loading={loading} />
        <KpiCardV2 label={t('status_scheduled', 'Scheduled')} value={fmt(totals?.scheduled)} hint={totals?.drafts ? t('campaign_drafts_count', '+{{count}} drafts', { count: totals.drafts }) : undefined} loading={loading} />
        <KpiCardV2 label={t('views', 'Views')} value={fmt(totals?.views)} loading={loading} />
        <KpiCardV2 label={t('analytics_compare_engagement', 'Engagement')} value={fmt(totals?.engagement)} tone="lime" hint={t('campaign_engagement_hint', 'Likes, comments and shares')} loading={loading} />
        <KpiCardV2 label={t('status_failed', 'Failed')} value={fmt(totals?.failed)} tone={totals?.failed ? 'danger' : 'default'} loading={loading} />
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] tablet:grid-cols-1 gap-[12px]">
        <CardV2 title={t('campaign_by_channel', 'By channel')}>
          {!data?.channels.length ? (
            <p className="text-[12.5px] text-pdInk3">{loading ? '…' : t('campaign_no_posts', 'No posts in this window yet.')}</p>
          ) : (
            <ul className="flex flex-col gap-[10px]">
              {data.channels.map((channel) => {
                const share = data.totals.posts ? (channel.totals.posts / data.totals.posts) * 100 : 0;
                return (
                  <li key={channel.id} className="flex items-center gap-[10px]">
                    <ChannelAvatarV2 picture={channel.picture} identifier={channel.identifier} name={channel.name} size={26} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-[6px] text-[12.5px]">
                        <span className="font-[600] truncate flex-1">{channel.name}</span>
                        <span className="text-pdInk3 tabular-nums">{channel.totals.posts}</span>
                      </div>
                      <div className="h-[5px] rounded-full bg-pdSurface2 mt-[4px] overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${share}%`, background: data.campaign.color }} />
                      </div>
                    </div>
                    <span className="w-[56px] text-end text-[12px] font-[700] tabular-nums">{fmt(channel.totals.engagement)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardV2>
        <CardV2 title={t('campaign_posts', 'Posts in this campaign')}>
          {!data?.posts.length ? (
            <p className="text-[12.5px] text-pdInk3">{loading ? '…' : t('campaign_no_posts', 'No posts in this window yet.')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="text-pdInk3 text-start">
                    <th className="text-start font-[600] py-[6px]">{t('post', 'Post')}</th>
                    <th className="text-start font-[600] py-[6px]">{t('date', 'Date')}</th>
                    <th className="text-start font-[600] py-[6px]">{t('status', 'Status')}</th>
                    <th className="text-end font-[600] py-[6px]">{t('views', 'Views')}</th>
                    <th className="text-end font-[600] py-[6px]">{t('analytics_compare_engagement', 'Engagement')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.posts.map((post) => (
                    <tr key={post.id} className="border-t border-pdLine">
                      <td className="py-[8px] pe-[10px]">
                        <div className="flex items-center gap-[8px] min-w-[220px]">
                          <ChannelAvatarV2 picture={post.channel.picture} identifier={post.channel.identifier} name={post.channel.name} size={22} />
                          {post.url ? (
                            <a href={post.url} target="_blank" rel="noopener noreferrer" className="truncate hover:underline">{post.excerpt || post.channel.name}</a>
                          ) : (
                            <span className="truncate">{post.excerpt || post.channel.name}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-[8px] pe-[10px] whitespace-nowrap text-textItemBlur">{dayjs(post.publishDate).format('D MMM, HH:mm')}</td>
                      <td className="py-[8px] pe-[10px]">
                        <Pill className={statusPill[stateKey(post.state)]}>{t(`status_${stateKey(post.state)}`, stateKey(post.state))}</Pill>
                      </td>
                      <td className="py-[8px] text-end tabular-nums">{fmt(post.views)}</td>
                      <td className="py-[8px] text-end tabular-nums font-[700]">{fmt(post.engagement)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardV2>
      </div>
    </div>
  );
};

export const CampaignsV2: FC = () => {
  const t = useT();
  const [days, setDays] = useState<number>(30);
  const [includeTags, setIncludeTags] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const { data, isLoading } = useJson<{ campaigns: Campaign[] }>(`/campaigns?days=${days}${includeTags ? '&tags=true' : ''}`);
  const kindLabel: Record<Kind, string> = {
    CAMPAIGN: t('tag_kind_campaign', 'Campaign'),
    PILLAR: t('tag_kind_pillar', 'Pillar'),
    TAG: t('tag_kind_tag', 'Tag'),
  };

  return (
    <PageV2
      title={t('campaigns', 'Campaigns')}
      subtitle={t('campaigns_subtitle', 'Every post tagged with a campaign, {{days}} days back and ahead', { days })}
      actions={
        <>
          <label className="flex items-center gap-[6px] text-[12.5px] text-textItemBlur">
            <input type="checkbox" checked={includeTags} onChange={(e) => setIncludeTags(e.target.checked)} />
            {t('campaigns_include_tags', 'Include tags and pillars')}
          </label>
          <div role="group" aria-label={t('analytics_range', 'Date range')} className="flex p-[3px] rounded-[10px] bg-pdSurface border border-pdLine">
            {DAYS.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={days === value}
                onClick={() => setDays(value)}
                className={clsx('px-[10px] h-[26px] rounded-[7px] text-[12.5px] font-[600]', days === value ? 'bg-pdSurface2 text-newTextColor ring-1 ring-pdLine2' : 'text-textItemBlur hover:text-newTextColor')}
              >
                {t('analytics_range_days', '{{days}} days', { days: value })}
              </button>
            ))}
          </div>
        </>
      }
    >
      {open ? (
        <CampaignDetail id={open} days={days} onBack={() => setOpen(null)} />
      ) : isLoading && !data ? (
        <div className="grid grid-cols-3 tablet:grid-cols-2 mobile:grid-cols-1 gap-[12px]">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[170px] rounded-[14px] bg-pdSurface animate-pulse" />
          ))}
        </div>
      ) : !data?.campaigns.length ? (
        <EmptyV2
          title={t('campaigns_empty', 'No campaigns yet')}
          action={
            <Link href="/ideas" className={buttonV2.primary}>
              {t('campaigns_create', 'Create a campaign in Ideas')}
            </Link>
          }
        >
          {t('campaigns_empty_hint', 'Create a campaign in Ideas, then pick it as a tag in the composer. Every post with that tag shows up here, with its channels and results.')}
        </EmptyV2>
      ) : (
        <ul className="grid grid-cols-3 tablet:grid-cols-2 mobile:grid-cols-1 gap-[12px]" data-pd-campaigns="">
          {data.campaigns.map((campaign) => (
            <li key={campaign.id}>
              <button
                type="button"
                onClick={() => setOpen(campaign.id)}
                className="w-full text-start rounded-[14px] bg-pdSurface border border-pdLine hover:border-[#7357ff88] p-[16px] flex flex-col gap-[12px]"
              >
                <div className="flex items-center gap-[8px]">
                  <span aria-hidden="true" className="w-[10px] h-[10px] rounded-full shrink-0" style={{ background: campaign.color }} />
                  <span className="text-[14px] font-[700] truncate flex-1">{campaign.name}</span>
                  <Pill className="bg-pdSurface2 text-textItemBlur">{kindLabel[campaign.kind]}</Pill>
                </div>
                <span className="text-[12px] text-pdInk3 min-h-[16px]">
                  {campaign.firstPost
                    ? `${dayjs(campaign.firstPost).format('D MMM')} – ${dayjs(campaign.lastPost).format('D MMM YYYY')}`
                    : t('campaign_no_posts', 'No posts in this window yet.')}
                </span>
                <dl className="grid grid-cols-4 gap-[6px]">
                  {[
                    [t('posts', 'Posts'), campaign.totals.posts],
                    [t('status_scheduled', 'Scheduled'), campaign.totals.scheduled],
                    [t('views', 'Views'), campaign.totals.views],
                    [t('analytics_compare_engagement', 'Engagement'), campaign.totals.engagement],
                  ].map(([label, value]) => (
                    <div key={label as string} className="min-w-0">
                      <dt className="text-[11px] text-pdInk3 truncate">{label}</dt>
                      <dd className="text-[16px] font-[700] tabular-nums">{fmt(value as number | null)}</dd>
                    </div>
                  ))}
                </dl>
                {campaign.totals.posts > 0 && (
                  <div className="flex h-[5px] rounded-full overflow-hidden bg-pdSurface2" aria-hidden="true">
                    <span className="bg-[#3ddc97]" style={{ width: `${(campaign.totals.published / campaign.totals.posts) * 100}%` }} />
                    <span className="bg-[#b39aff]" style={{ width: `${(campaign.totals.scheduled / campaign.totals.posts) * 100}%` }} />
                    <span className="bg-[#ff5a5f]" style={{ width: `${(campaign.totals.failed / campaign.totals.posts) * 100}%` }} />
                  </div>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </PageV2>
  );
};
