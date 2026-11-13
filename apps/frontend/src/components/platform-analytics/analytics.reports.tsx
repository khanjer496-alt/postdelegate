'use client';

import React, { FC, useCallback, useEffect, useId, useState } from 'react';
import useSWR from 'swr';
import clsx from 'clsx';
import dayjs from 'dayjs';
import Link from 'next/link';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { Button } from '@gitroom/react/form/button';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { showMediaBox } from '@gitroom/frontend/components/media/media.component';
import {
  Card,
  Range,
  Skeleton,
  useCsvDownload,
} from '@gitroom/frontend/components/platform-analytics/analytics.ui';
import { useFeature } from '@gitroom/frontend/components/features/feature.flags.client';
import {
  REPORT_TEMPLATE_OPTIONS,
  ReportTemplateId,
} from '@gitroom/frontend/components/features/report-templates/report.templates';

type Frequency = 'OFF' | 'WEEKLY' | 'MONTHLY';

interface ReportSettings {
  frequency: Frequency;
  recipients: string[];
  brandName: string | null;
  logoUrl: string | null;
  brandColor?: string | null;
  accentColor?: string | null;
  template?: ReportTemplateId | null;
  lastSentAt: string | null;
  workspaceName: string;
  emailAvailable: boolean;
  members: Array<{ id: string; email: string; name: string; role: string }>;
}

const inputClass =
  'h-[40px] w-full rounded-[8px] bg-newBgColorInner border border-newTableBorder px-[12px] text-[14px] text-newTextColor outline-none focus-visible:ring-2 focus-visible:ring-btnPrimary';

const secondaryButton =
  'h-[36px] px-[14px] rounded-[8px] bg-btnSimple text-btnText text-[13px] font-[500] inline-flex items-center justify-center gap-[6px] outline-none focus-visible:ring-2 focus-visible:ring-btnPrimary disabled:opacity-50';

const useReportSettings = (enabled: boolean) => {
  const fetch = useFetch();
  const load = useCallback(async (path: string) => {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error('report settings');
    }
    return (await response.json()) as ReportSettings;
  }, []);
  return useSWR(enabled ? '/analytics/reports/settings' : null, load, {
    revalidateOnFocus: false,
  });
};

// Whether this workspace's plan has the white-label report and the emails
export const useReportsAllowed = () => {
  const user = useUser();
  const { billingEnabled } = useVariables();
  return !billingEnabled || !!user?.tier?.analytics_reports;
};

const UpgradeNote: FC = () => {
  const t = useT();
  return (
    <div className="flex items-center gap-[12px] flex-wrap rounded-[10px] border border-newTableBorder bg-newBgColorInner px-[14px] py-[12px]">
      <p className="flex-1 min-w-[200px] text-[13px] text-newTableText">
        {t(
          'analytics_reports_upgrade',
          'White-label PDF reports and scheduled emails are part of the Pro and Ultimate plans.'
        )}
      </p>
      <Link href="/billing" className={secondaryButton}>
        {t('analytics_reports_see_plans', 'See plans')}
      </Link>
    </div>
  );
};

const ExportCard: FC<{ days: Range }> = ({ days }) => {
  const t = useT();
  const download = useCsvDownload();
  const [busy, setBusy] = useState<string | null>(null);
  const run = useCallback(
    async (key: string, path: string, filename: string) => {
      setBusy(key);
      await download(path, filename);
      setBusy(null);
    },
    [download]
  );
  return (
    <Card
      title={t('analytics_reports_export', 'Export data')}
      subtitle={t(
        'analytics_reports_export_hint',
        'Spreadsheet files of the last {{days}} days, for every channel',
        { days }
      )}
    >
      <div className="flex gap-[8px] flex-wrap">
        <button
          type="button"
          disabled={busy === 'top'}
          onClick={() =>
            run(
              'top',
              `/analytics/export/top-posts?days=${days}&sort=engagement&order=desc`,
              `top-posts-${days}d.csv`
            )
          }
          className={secondaryButton}
        >
          {t('analytics_reports_export_top', 'Top posts (CSV)')}
        </button>
        <button
          type="button"
          disabled={busy === 'daily'}
          onClick={() =>
            run(
              'daily',
              `/analytics/export/daily?days=${days}`,
              `daily-metrics-${days}d.csv`
            )
          }
          className={secondaryButton}
        >
          {t('analytics_reports_export_daily', 'Daily metrics (CSV)')}
        </button>
      </div>
      <p className="text-[12px] text-newTableText">
        {t(
          'analytics_reports_export_note',
          'Daily metrics have one row per channel and day: followers, total posts and the summed metrics of the posts tracked that day.'
        )}
      </p>
    </Card>
  );
};

const PdfCard: FC<{ allowed: boolean }> = ({ allowed }) => {
  const t = useT();
  const templates = useFeature('report_templates');
  const download = useCsvDownload();
  const [downloading, setDownloading] = useState(false);
  const fromId = useId();
  const toId = useId();
  const today = dayjs().format('YYYY-MM-DD');
  const [from, setFrom] = useState(
    dayjs().subtract(29, 'day').format('YYYY-MM-DD')
  );
  const [to, setTo] = useState(today);
  const valid = !!from && !!to && from <= to && to <= today;

  return (
    <Card
      title={t('analytics_reports_pdf', 'Client-ready PDF report')}
      subtitle={t(
        'analytics_reports_pdf_hint',
        'A printable report with your logo and name: trends, top posts, best times and insights'
      )}
    >
      {!allowed ? (
        <UpgradeNote />
      ) : (
        <>
          <div className="grid grid-cols-2 mobile:grid-cols-1 gap-[12px]">
            <div className="flex flex-col gap-[6px]">
              <label htmlFor={fromId} className="text-[12px] text-newTableText">
                {t('analytics_reports_from', 'From')}
              </label>
              <input
                id={fromId}
                type="date"
                value={from}
                max={to || today}
                onChange={(e) => setFrom(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-[6px]">
              <label htmlFor={toId} className="text-[12px] text-newTableText">
                {t('analytics_reports_to', 'To')}
              </label>
              <input
                id={toId}
                type="date"
                value={to}
                min={from}
                max={today}
                onChange={(e) => setTo(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
          <div className="flex items-center gap-[12px] flex-wrap">
            <a
              href={
                valid ? `/analytics-report?from=${from}&to=${to}` : undefined
              }
              aria-disabled={!valid}
              target="_blank"
              rel="noopener"
              className={clsx(
                'h-[40px] px-[18px] rounded-[8px] bg-btnCta shadow-cta text-btnCtaText font-[600] text-[14px] inline-flex items-center gap-[8px] outline-none focus-visible:ring-2 focus-visible:ring-btnPrimary',
                !valid && 'opacity-50 pointer-events-none'
              )}
            >
              {t('analytics_reports_open', 'Open printable report')}
            </a>
            {templates && (
              <button
                type="button"
                disabled={!valid || downloading}
                onClick={async () => {
                  setDownloading(true);
                  await download(
                    `/analytics/reports/pptx?from=${from}&to=${to}&timezone=${encodeURIComponent(
                      Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
                    )}`,
                    `report-${from}-${to}.pptx`
                  );
                  setDownloading(false);
                }}
                className={clsx(secondaryButton, 'h-[40px]')}
              >
                {downloading
                  ? t('analytics_reports_pptx_loading', 'Preparing…')
                  : t('analytics_reports_pptx', 'Download PowerPoint')}
              </button>
            )}
            <p className="text-[12px] text-newTableText flex-1 min-w-[200px]">
              {t(
                'analytics_reports_pdf_note',
                'Opens in a new tab. Choose “Save as PDF” in the print dialog. Branding comes from the settings below.'
              )}
            </p>
          </div>
        </>
      )}
    </Card>
  );
};

const ColorField: FC<{
  label: string;
  value: string;
  fallback: string;
  onChange: (value: string) => void;
}> = ({ label, value, fallback, onChange }) => {
  const t = useT();
  const id = useId();
  return (
    <div className="flex flex-col gap-[6px]">
      <label htmlFor={id} className="text-[12px] text-newTableText">
        {label}
      </label>
      <div className="flex gap-[8px] items-center">
        <input
          type="color"
          aria-label={label}
          value={value || fallback}
          onChange={(e) => onChange(e.target.value)}
          className="h-[40px] w-[48px] shrink-0 rounded-[8px] border border-newTableBorder bg-newBgColorInner p-[4px] cursor-pointer"
        />
        <input
          id={id}
          value={value}
          placeholder={fallback}
          maxLength={7}
          onChange={(e) => {
            const next = e.target.value.trim();
            onChange(next && !next.startsWith('#') ? `#${next}` : next);
          }}
          className={inputClass}
        />
        {!!value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className={clsx(secondaryButton, 'shrink-0 h-[40px]')}
          >
            {t('analytics_reports_color_reset', 'Default')}
          </button>
        )}
      </div>
    </div>
  );
};

// Template and brand colors of the PDF and PowerPoint report
// (PD_FF_REPORT_TEMPLATES)
const ReportTemplatePicker: FC<{
  template: ReportTemplateId;
  brandColor: string;
  accentColor: string;
  brandName: string;
  onTemplate: (value: ReportTemplateId) => void;
  onBrandColor: (value: string) => void;
  onAccentColor: (value: string) => void;
}> = (props) => {
  const t = useT();
  const color = /^#[0-9a-f]{6}$/i.test(props.brandColor)
    ? props.brandColor
    : '#7357ff';
  const accent = /^#[0-9a-f]{6}$/i.test(props.accentColor)
    ? props.accentColor
    : '#c8ff4d';
  return (
    <fieldset className="flex flex-col gap-[10px]">
      <legend className="text-[12px] text-newTableText mb-[6px]">
        {t('analytics_reports_template', 'Report template')}
      </legend>
      <div
        role="radiogroup"
        className="grid grid-cols-3 mobile:grid-cols-1 gap-[10px]"
      >
        {REPORT_TEMPLATE_OPTIONS.map((option) => {
          const selected = option.id === props.template;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => props.onTemplate(option.id)}
              className={clsx(
                'text-start rounded-[10px] border p-[8px] flex flex-col gap-[8px] outline-none focus-visible:ring-2 focus-visible:ring-btnPrimary',
                selected
                  ? 'border-btnPrimary bg-newBgColorInner'
                  : 'border-newTableBorder'
              )}
            >
              {/* a small cover slide in this template */}
              <div
                aria-hidden
                className="aspect-[16/9] w-full rounded-[6px] overflow-hidden relative border border-newTableBorder"
                style={{
                  background: option.id === 'minimal' ? '#ffffff' : color,
                }}
              >
                {option.id === 'minimal' && (
                  <div
                    className="absolute start-[8%] top-[22%] h-[44%] w-[2%]"
                    style={{ background: color }}
                  />
                )}
                <div
                  className="absolute start-[14%] top-[30%] text-[11px] font-[700] truncate max-w-[80%]"
                  style={{
                    color: option.id === 'minimal' ? '#111118' : '#ffffff',
                  }}
                >
                  {props.brandName}
                </div>
                {option.id !== 'minimal' && (
                  <div
                    className="absolute start-[8%] bottom-[22%] h-[4px] w-[18%]"
                    style={{ background: accent }}
                  />
                )}
              </div>
              <div>
                <div className="text-[13px] font-[600] text-newTextColor">
                  {t(`analytics_reports_template_${option.id}`, option.label)}
                </div>
                <div className="text-[11px] text-newTableText">
                  {t(
                    `analytics_reports_template_${option.id}_hint`,
                    option.hint
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-2 tablet:grid-cols-1 gap-[12px]">
        <ColorField
          label={t('analytics_reports_brand_color', 'Brand color')}
          value={props.brandColor}
          fallback="#7357ff"
          onChange={props.onBrandColor}
        />
        <ColorField
          label={t('analytics_reports_accent_color', 'Accent color')}
          value={props.accentColor}
          fallback="#c8ff4d"
          onChange={props.onAccentColor}
        />
      </div>
      <p className="text-[12px] text-newTableText">
        {t(
          'analytics_reports_template_note',
          'Used by the printable PDF report and the PowerPoint download.'
        )}
      </p>
    </fieldset>
  );
};

const ScheduleCard: FC<{ allowed: boolean }> = ({ allowed }) => {
  const t = useT();
  const fetch = useFetch();
  const toaster = useToaster();
  const brandId = useId();
  const logoId = useId();
  const { data, isLoading, error, mutate } = useReportSettings(true);
  const [frequency, setFrequency] = useState<Frequency>('OFF');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [brandName, setBrandName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const templates = useFeature('report_templates');
  const [template, setTemplate] = useState<ReportTemplateId>('classic');
  const [brandColor, setBrandColor] = useState('');
  const [accentColor, setAccentColor] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (!data) {
      return;
    }
    setFrequency(data.frequency);
    setRecipients(data.recipients);
    setBrandName(data.brandName || '');
    setLogoUrl(data.logoUrl || '');
    setTemplate(data.template || 'classic');
    setBrandColor(data.brandColor || '');
    setAccentColor(data.accentColor || '');
  }, [data]);

  const save = useCallback(async () => {
    if (frequency !== 'OFF' && !recipients.length) {
      toaster.show(
        t('analytics_reports_need_recipient', 'Choose at least one recipient.'),
        'warning'
      );
      return;
    }
    setSaving(true);
    try {
      const response = await fetch('/analytics/reports/settings', {
        method: 'PUT',
        body: JSON.stringify({
          frequency,
          recipients,
          brandName: brandName.trim() || null,
          logoUrl: logoUrl.trim() || null,
          // only with the template flag, so the older form keeps saved colors
          ...(templates
            ? {
                template,
                brandColor: brandColor || null,
                accentColor: accentColor || null,
              }
            : {}),
        }),
      });
      if (!response.ok) {
        throw new Error('save');
      }
      await mutate(await response.json(), { revalidate: false });
      toaster.show(
        t('analytics_reports_saved', 'Report settings saved'),
        'success'
      );
    } catch (err) {
      toaster.show(
        t(
          'analytics_reports_save_failed',
          'The settings could not be saved. Check the logo link and try again.'
        ),
        'warning'
      );
    }
    setSaving(false);
  }, [
    frequency,
    recipients,
    brandName,
    logoUrl,
    templates,
    template,
    brandColor,
    accentColor,
  ]);

  const sendTest = useCallback(async () => {
    setTesting(true);
    try {
      const response = await fetch('/analytics/reports/test', {
        method: 'POST',
      });
      const result = response.ok ? await response.json() : null;
      toaster.show(
        result?.sent
          ? t(
              'analytics_reports_test_sent',
              'A sample report is on its way to your inbox'
            )
          : result?.reason === 'too_soon'
          ? t(
              'analytics_reports_test_wait',
              'A sample was sent a moment ago. Try again in a few minutes.'
            )
          : t(
              'analytics_reports_test_failed',
              'The sample report could not be sent.'
            ),
        result?.sent ? 'success' : 'warning'
      );
    } catch (err) {
      toaster.show(
        t(
          'analytics_reports_test_failed',
          'The sample report could not be sent.'
        ),
        'warning'
      );
    }
    setTesting(false);
  }, []);

  const frequencies: Array<{ value: Frequency; label: string }> = [
    { value: 'OFF', label: t('analytics_reports_off', 'Off') },
    {
      value: 'WEEKLY',
      label: t('analytics_reports_weekly', 'Weekly, on Mondays'),
    },
    {
      value: 'MONTHLY',
      label: t('analytics_reports_monthly', 'Monthly, on the 1st'),
    },
  ];

  return (
    <Card
      title={t('analytics_reports_schedule', 'Scheduled email and branding')}
      subtitle={t(
        'analytics_reports_schedule_hint',
        'A summary of the previous week or month, sent to the members you choose. Admins only.'
      )}
    >
      {!allowed ? (
        <UpgradeNote />
      ) : isLoading && !data ? (
        <Skeleton className="h-[220px]" />
      ) : error || !data ? (
        <p role="alert" className="text-[13px] text-red-500">
          {t(
            'analytics_reports_settings_error',
            'The report settings could not be loaded.'
          )}
        </p>
      ) : (
        <form
          className="flex flex-col gap-[18px]"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <fieldset className="flex flex-col gap-[8px]">
            <legend className="text-[12px] text-newTableText mb-[6px]">
              {t('analytics_reports_frequency', 'Send the email')}
            </legend>
            <div className="flex gap-[8px] flex-wrap">
              {frequencies.map((option) => (
                <label
                  key={option.value}
                  className={clsx(
                    'flex items-center gap-[8px] h-[36px] px-[12px] rounded-[8px] border text-[13px] cursor-pointer has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-btnPrimary',
                    frequency === option.value
                      ? 'border-btnPrimary bg-btnSimple text-newTextColor'
                      : 'border-newTableBorder text-textItemBlur hover:text-newTextColor'
                  )}
                >
                  <input
                    type="radio"
                    name="analytics-report-frequency"
                    value={option.value}
                    checked={frequency === option.value}
                    onChange={() => setFrequency(option.value)}
                    className="accent-[var(--new-btn-primary)]"
                  />
                  {option.label}
                </label>
              ))}
            </div>
            {!data.emailAvailable && (
              <p className="text-[12px] text-red-500">
                {t(
                  'analytics_reports_no_email',
                  'Email sending is not configured on this server, so scheduled reports cannot go out.'
                )}
              </p>
            )}
          </fieldset>

          {frequency !== 'OFF' && (
            <fieldset className="flex flex-col gap-[8px]">
              <legend className="text-[12px] text-newTableText mb-[6px]">
                {t('analytics_reports_recipients', 'Recipients')}
              </legend>
              <ul className="flex flex-col gap-[6px] max-h-[220px] overflow-y-auto pe-[4px]">
                {data.members.map((member) => (
                  <li key={member.id}>
                    <label className="flex items-center gap-[10px] text-[14px] text-newTextColor cursor-pointer">
                      <input
                        type="checkbox"
                        checked={recipients.includes(member.id)}
                        onChange={(e) =>
                          setRecipients((current) =>
                            e.target.checked
                              ? [...current, member.id]
                              : current.filter((id) => id !== member.id)
                          )
                        }
                        className="w-[16px] h-[16px] accent-[var(--new-btn-primary)]"
                      />
                      <span className="truncate">
                        {member.name ? `${member.name} · ` : ''}
                        <span className="text-newTableText">
                          {member.email}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
          )}

          <div className="grid grid-cols-2 tablet:grid-cols-1 gap-[12px]">
            <div className="flex flex-col gap-[6px]">
              <label
                htmlFor={brandId}
                className="text-[12px] text-newTableText"
              >
                {t('analytics_reports_brand_name', 'Name on the report')}
              </label>
              <input
                id={brandId}
                value={brandName}
                maxLength={80}
                placeholder={data.workspaceName}
                onChange={(e) => setBrandName(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-[6px]">
              <label htmlFor={logoId} className="text-[12px] text-newTableText">
                {t('analytics_reports_logo', 'Logo')}
              </label>
              <div className="flex gap-[8px] items-center">
                {!!logoUrl && (
                  <img
                    src={logoUrl}
                    alt=""
                    className="h-[40px] w-[40px] object-contain rounded-[8px] border border-newTableBorder bg-white"
                  />
                )}
                <input
                  id={logoId}
                  type="url"
                  value={logoUrl}
                  placeholder="https://"
                  onChange={(e) => setLogoUrl(e.target.value)}
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={() =>
                    showMediaBox((media) => setLogoUrl(media.path))
                  }
                  className={clsx(secondaryButton, 'shrink-0 h-[40px]')}
                >
                  {t('analytics_reports_choose_logo', 'Choose')}
                </button>
              </div>
            </div>
          </div>

          {templates && (
            <ReportTemplatePicker
              template={template}
              brandColor={brandColor}
              accentColor={accentColor}
              brandName={brandName || data.workspaceName}
              onTemplate={setTemplate}
              onBrandColor={setBrandColor}
              onAccentColor={setAccentColor}
            />
          )}

          <div className="flex items-center gap-[10px] flex-wrap">
            <Button type="submit" loading={saving} className="rounded-[8px]">
              {t('analytics_reports_save', 'Save settings')}
            </Button>
            <button
              type="button"
              onClick={sendTest}
              disabled={testing || !data.emailAvailable}
              className={secondaryButton}
            >
              {t('analytics_reports_test', 'Email me a sample')}
            </button>
            {!!data.lastSentAt && data.frequency !== 'OFF' && (
              <span className="text-[12px] text-newTableText">
                {t(
                  'analytics_reports_last_sent',
                  'Schedule updated or last sent {{date}}',
                  {
                    date: dayjs(data.lastSentAt).format('MMM D, YYYY'),
                  }
                )}
              </span>
            )}
          </div>
        </form>
      )}
    </Card>
  );
};

export const ReportsSection: FC<{ days: Range }> = ({ days }) => {
  const user = useUser();
  const allowed = useReportsAllowed();
  const isAdmin = !!user?.role && user.role !== 'USER';
  return (
    <div className="flex flex-col gap-[12px]">
      <div className="grid grid-cols-2 tablet:grid-cols-1 gap-[12px]">
        <ExportCard days={days} />
        <PdfCard allowed={allowed} />
      </div>
      {isAdmin && <ScheduleCard allowed={allowed} />}
    </div>
  );
};
