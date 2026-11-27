'use client';

import React, { FC } from 'react';
import useSWR from 'swr';
import { useSearchParams } from 'next/navigation';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';

type TrialStep =
  | 'signed_up'
  | 'trial_started'
  | 'channel_connected'
  | 'post_created'
  | 'post_scheduled'
  | 'published';

interface TrialRow {
  organizationId: string;
  name: string;
  internal: boolean;
  ownerEmail: string | null;
  signUpMethod: string;
  signedUpAt: string;
  plan: string | null;
  trialEndsAt: string | null;
  cancelling: boolean;
  lastStep: TrialStep;
  stuckSince: string;
  hoursStuck: number;
  channels: number;
  postsScheduled: number;
  postsPublished: number;
  connectFailures: number;
  connectFailureProviders: string[];
  publishErrors: number;
  publishErrorProviders: string[];
  useCase: string | null;
  stoppedReason: string | null;
}

interface SurveyAnswer {
  id: string;
  organizationId: string;
  workspace: string | null;
  kind: string;
  choice: string;
  text: string;
  createdAt: string;
}

interface TrialsResponse {
  generatedAt: string;
  signedUpDays: number;
  failureDays: number;
  rows: TrialRow[];
  answers: SurveyAnswer[];
}

const STEPS: Record<TrialStep, string> = {
  signed_up: 'Signed up',
  trial_started: 'Trial started',
  channel_connected: 'Channel connected',
  post_created: 'First post created',
  post_scheduled: 'First post scheduled',
  published: 'Published',
};

const QUESTIONS: Record<string, string> = {
  use_case: 'Wants to use it for',
  stopped: 'What stopped them',
};

const useAdminTrials = (workspace: string) => {
  const fetch = useFetch();
  const key = workspace
    ? `/admin/stats/trials?${new URLSearchParams({ workspace }).toString()}`
    : '/admin/stats/trials';
  return useSWR<TrialsResponse>(
    key,
    async (url: string) => {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error('Failed to load trials');
      }
      return res.json();
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );
};

const duration = (hours: number) =>
  hours < 48 ? `${hours}h` : `${Math.floor(hours / 24)}d`;

const answerLabel = (value: string) => value.replace(/_/g, ' ');

const failures = (count: number, providers: string[]) =>
  count ? (
    <span className="text-red-400" title={providers.join(', ')}>
      {count} <span className="opacity-70">({providers.join(', ')})</span>
    </span>
  ) : (
    <span className="opacity-70">0</span>
  );

const COLUMNS =
  'grid-cols-[minmax(180px,1.6fr)_110px_120px_minmax(140px,1fr)_70px_90px_minmax(110px,1fr)_minmax(110px,1fr)_minmax(160px,1.4fr)]';

const TrialLine: FC<{ row: TrialRow }> = ({ row }) => (
  <div
    className={`grid ${COLUMNS} gap-[12px] px-[12px] py-[10px] text-[13px] border-b border-newTableBorder last:border-b-0`}
  >
    <div className="min-w-0">
      <div className="truncate font-[600]" title={row.name}>
        {row.name}
        {row.internal && (
          <span className="ms-[6px] text-[11px] font-[400] px-[6px] py-[1px] rounded-[4px] border border-newTableBorder opacity-70">
            Internal/test
          </span>
        )}
      </div>
      <div className="truncate opacity-70" title={row.ownerEmail || ''}>
        {row.ownerEmail || 'No owner'}
      </div>
    </div>
    <div>
      <div>{new Date(row.signedUpAt).toLocaleDateString()}</div>
      <div className="opacity-70">{row.signUpMethod}</div>
    </div>
    <div>
      <div>{row.plan || 'No plan'}</div>
      {row.trialEndsAt && (
        <div className="opacity-70">
          Ends {new Date(row.trialEndsAt).toLocaleDateString()}
          {row.cancelling ? ', cancelling' : ''}
        </div>
      )}
    </div>
    <div>
      <div>{STEPS[row.lastStep] || row.lastStep}</div>
      <div
        className={row.hoursStuck >= 24 ? 'text-red-400' : 'opacity-70'}
        title={new Date(row.stuckSince).toLocaleString()}
      >
        for {duration(row.hoursStuck)}
      </div>
    </div>
    <div>{row.channels}</div>
    <div>
      {row.postsScheduled} / {row.postsPublished}
    </div>
    <div>{failures(row.connectFailures, row.connectFailureProviders)}</div>
    <div>{failures(row.publishErrors, row.publishErrorProviders)}</div>
    <div className="min-w-0 flex flex-col">
      {row.useCase && (
        <div className="truncate" title={row.useCase}>
          <span className="opacity-70">For: </span>
          {row.useCase}
        </div>
      )}
      {row.stoppedReason && (
        <div className="truncate" title={row.stoppedReason}>
          <span className="opacity-70">Stopped: </span>
          {row.stoppedReason}
        </div>
      )}
      {!row.useCase && !row.stoppedReason && (
        <span className="opacity-70">–</span>
      )}
    </div>
  </div>
);

// Trials & blockers: where every trial, and every recent sign-up without a
// plan, is stuck. The same rows as the daily digest email.
export const TrialsSection: FC = () => {
  const searchParams = useSearchParams();
  const workspace = searchParams?.get('workspace') || '';
  const { data, isLoading, error } = useAdminTrials(workspace);

  return (
    <div id="trials" className="flex flex-col gap-[12px]">
      <div className="flex flex-wrap items-center justify-between gap-[8px]">
        <div className="text-[16px] font-[600]">Trials &amp; blockers</div>
        {data && (
          <div className="text-[13px] opacity-70">
            In a trial, or signed up in the last {data.signedUpDays} days
            without a plan. Failures of the last {data.failureDays} days.
          </div>
        )}
      </div>

      {workspace && (
        <div className="text-[13px] flex gap-[8px]">
          <span className="opacity-70">Showing one workspace.</span>
          <a href="/admin/stats#trials" className="underline">
            Show all
          </a>
        </div>
      )}

      {isLoading ? (
        <LoadingComponent />
      ) : error || !data ? (
        <div className="text-red-400">Failed to load trials.</div>
      ) : (
        <>
          <div className="border border-newTableBorder rounded-[8px] overflow-x-auto scrollbar scrollbar-thumb-fifth scrollbar-track-newBgColor">
            <div className="min-w-[1200px]">
              <div
                className={`grid ${COLUMNS} gap-[12px] px-[12px] py-[10px] bg-newBgColorInner text-[12px] uppercase opacity-70 border-b border-newTableBorder`}
              >
                <div>Workspace</div>
                <div>Signed up</div>
                <div>Plan</div>
                <div>Last step</div>
                <div>Channels</div>
                <div>Sched. / pub.</div>
                <div>Connect failures</div>
                <div>Publish errors</div>
                <div>Answers</div>
              </div>
              {data.rows.length === 0 ? (
                <div className="px-[12px] py-[10px] text-[13px] opacity-70">
                  {workspace
                    ? 'This workspace is not in a trial or a recent sign-up without a plan.'
                    : 'No trials right now.'}
                </div>
              ) : (
                data.rows.map((row) => (
                  <TrialLine key={row.organizationId} row={row} />
                ))
              )}
            </div>
          </div>

          <div className="border border-newTableBorder rounded-[8px] overflow-hidden">
            <div className="grid grid-cols-[110px_minmax(0,1fr)_160px_minmax(0,1fr)_minmax(0,1.5fr)] gap-[12px] px-[12px] py-[10px] bg-newBgColorInner text-[12px] uppercase opacity-70 border-b border-newTableBorder mobile:hidden">
              <div>Date</div>
              <div>Workspace</div>
              <div>Question</div>
              <div>Answer</div>
              <div>Note</div>
            </div>
            {data.answers.length === 0 ? (
              <div className="px-[12px] py-[10px] text-[13px] opacity-70">
                No survey answers yet.
              </div>
            ) : (
              data.answers.map((answer) => (
                <div
                  key={answer.id}
                  className="grid grid-cols-[110px_minmax(0,1fr)_160px_minmax(0,1fr)_minmax(0,1.5fr)] gap-[12px] px-[12px] py-[10px] text-[13px] border-b border-newTableBorder last:border-b-0 mobile:grid-cols-1"
                >
                  <div>{new Date(answer.createdAt).toLocaleDateString()}</div>
                  <div className="truncate">
                    {answer.workspace || (
                      <span className="opacity-70">Deleted workspace</span>
                    )}
                  </div>
                  <div className="opacity-70">
                    {QUESTIONS[answer.kind] || answer.kind}
                  </div>
                  <div className="capitalize">{answerLabel(answer.choice)}</div>
                  <div className="break-words">
                    {answer.text || <span className="opacity-70">–</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
};
