'use client';

import React, { useCallback, useState } from 'react';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { Button } from '@gitroom/react/form/button';
import { useT } from '@gitroom/react/translation/get.transation.service.client';

type Credential = {
  id: string;
  name: string;
  role: string;
  channelIds: string[] | null;
  expiresAt: string | null;
  revokedAt: string | null;
};
type AgentSaveAdmission = null | {
  owner: string;
  host: string;
  processId: number;
  instanceId: string;
  createdAt: string;
  writtenPostIds: string[];
};

const useAgentCredentials = () => {
  const fetch = useFetch();
  const load = useCallback(async () => {
    const res = await fetch('/settings/agent-credentials');
    if (!res.ok) throw new Error('Could not read agent access.');
    return res.json();
  }, []);
  return useSWR<Credential[]>('agent-credentials', load);
};

const useAgentCredentialChannels = () => {
  const fetch = useFetch();
  const load = useCallback(async () => {
    const res = await fetch('/integrations/list');
    if (!res.ok) throw new Error('Could not read the channels.');
    return (await res.json()).integrations;
  }, []);
  return useSWR<Array<{ id: string; name: string }>>(
    'agent-credential-channels',
    load
  );
};

const useAgentSaveAdmission = () => {
  const fetch = useFetch();
  const load = useCallback(async () => {
    const res = await fetch('/settings/agent-admission');
    if (!res.ok) throw new Error('Could not read the active agent save.');
    return res.json();
  }, []);
  return useSWR<AgentSaveAdmission>('agent-save-admission', load);
};

export default function AgentCredentials() {
  const user = useUser();
  return user?.role === 'ADMIN' || user?.role === 'SUPERADMIN' ? (
    <AdminCredentials />
  ) : null;
}
function AdminCredentials() {
  const fetch = useFetch();
  const t = useT();
  const [name, setName] = useState('');
  const [role, setRole] = useState('DRAFT_ONLY');
  const [expiry, setExpiry] = useState('DEFAULT');
  const [expiresAt, setExpiresAt] = useState('');
  const [allChannels, setAllChannels] = useState(true);
  const [channelIds, setChannelIds] = useState<string[]>([]);
  const [secret, setSecret] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const request = async (url: string, init?: RequestInit) => {
    const res = await fetch(url, init);
    if (!res.ok)
      throw new Error(
        t(
          'agent_credential_failed',
          'Could not update agent access. Check your settings and try again.'
        )
      );
    return res.json();
  };
  const { data = [], mutate } = useAgentCredentials();
  const { data: channels = [] } = useAgentCredentialChannels();
  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      await mutate();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section
      className="my-[16px] bg-sixth border-fifth border rounded-[4px] p-[24px] flex flex-col gap-[16px]"
      aria-label={t('agent_access', 'Agent access')}
    >
      <h4>{t('agent_access', 'Agent access')}</h4>
      <AgentSaveRecovery />
      <p className="text-sm">
        {t(
          'agent_access_description',
          'Create a separate MCP key for each assistant. Workspace approval and posting limits still apply.'
        )}
      </p>
      {secret && (
        <div role="status" className="border p-4 break-all">
          <p>
            {t(
              'agent_secret_once',
              'Copy this key now. It will not be shown again. Use it as the Authorization header on /api/mcp.'
            )}
          </p>
          <code>{secret}</code>
          <Button secondary onClick={() => setSecret('')}>
            {t('dismiss', 'Dismiss')}
          </Button>
        </div>
      )}
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void act(async () => {
            const result = await request('/settings/agent-credentials', {
              method: 'POST',
              body: JSON.stringify({
                name,
                role,
                expiry,
                ...(expiry === 'CUSTOM'
                  ? { expiresAt: new Date(expiresAt).toISOString() }
                  : {}),
                ...(!allChannels ? { channelIds } : {}),
              }),
            });
            setSecret(result.secret);
            setName('');
            setRole('DRAFT_ONLY');
            setExpiry('DEFAULT');
            setExpiresAt('');
            setAllChannels(true);
            setChannelIds([]);
          });
        }}
      >
        <label>
          {t('name', 'Name')}
          <input
            className="block bg-transparent border p-2"
            required
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          {t('role', 'Role')}
          <select
            className="block bg-sixth border p-2"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="ANALYST">
              {t('agent_analyst', 'Analyst — read results')}
            </option>
            <option value="DRAFT_ONLY">
              {t('agent_draft_only', 'Draft-only — prepare and submit drafts')}
            </option>
            <option value="PUBLISHER">
              {t(
                'agent_publisher',
                'Publisher — manage posts within workspace policy'
              )}
            </option>
          </select>
        </label>
        <label>
          {t('expiry', 'Expiry')}
          <select
            className="block bg-sixth border p-2"
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
          >
            <option value="DEFAULT">
              {t('agent_expiry_default', '30 days')}
            </option>
            <option value="CUSTOM">
              {t('agent_expiry_custom', 'Choose date')}
            </option>
            <option value="NEVER">
              {t('agent_expiry_never', 'No expiry')}
            </option>
          </select>
        </label>
        {expiry === 'CUSTOM' && (
          <label>
            {t('expiry_date', 'Expiry date')}
            <input
              required
              type="datetime-local"
              className="block bg-transparent border p-2"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </label>
        )}
        <label>
          <input
            type="checkbox"
            checked={allChannels}
            onChange={(e) => setAllChannels(e.target.checked)}
          />{' '}
          {t('all_channels', 'All channels')}
        </label>
        {!allChannels && (
          <fieldset>
            <legend>
              {t(
                'allowed_channels',
                'Allowed channels (none selected means no access)'
              )}
            </legend>
            {channels.map((channel) => (
              <label className="block" key={channel.id}>
                <input
                  type="checkbox"
                  checked={channelIds.includes(channel.id)}
                  onChange={(e) =>
                    setChannelIds(
                      e.target.checked
                        ? [...channelIds, channel.id]
                        : channelIds.filter((id) => id !== channel.id)
                    )
                  }
                />{' '}
                {channel.name}
              </label>
            ))}
          </fieldset>
        )}
        <Button type="submit" disabled={busy || !!secret}>
          {t('create_agent_key', 'Create agent key')}
        </Button>
      </form>
      {error && <p role="alert">{error}</p>}
      <ul className="flex flex-col gap-3">
        {data.map((key) => (
          <li key={key.id} className="flex flex-wrap gap-3 items-center">
            <span>
              {key.name} · {key.role} ·{' '}
              {key.expiresAt
                ? new Date(key.expiresAt).toLocaleString()
                : t('no_expiry', 'No expiry')}{' '}
              ·{' '}
              {key.channelIds === null
                ? t('all_channels', 'All channels')
                : `${key.channelIds.length} ${t('channels', 'channels')}`}
            </span>
            {key.revokedAt ? (
              <span>{t('revoked', 'Revoked')}</span>
            ) : (
              <Button
                secondary
                disabled={busy}
                onClick={() =>
                  void act(async () => {
                    await request(`/settings/agent-credentials/${key.id}`, {
                      method: 'DELETE',
                    });
                  })
                }
              >
                {t('revoke', 'Revoke')}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function AgentSaveRecovery() {
  const fetch = useFetch();
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const { data, mutate } = useAgentSaveAdmission();
  if (!data) return message ? <p role="status">{message}</p> : null;
  return <div className="border border-fifth rounded p-3 flex flex-col gap-2">
    <h5>{t('agent_save_active', 'Agent save in progress')}</h5>
    <p className="text-sm">{new Date(data.createdAt).toLocaleString()} · {data.host} · {data.processId}</p>
    <p className="text-sm">{t('agent_save_recovery_description', 'Stop remaining post saves from this request. Saved or scheduled posts stay active; link preparation already in progress may finish.')}</p>
    <p className="text-sm">{t('agent_saved_posts', 'Saved post IDs')}: {data.writtenPostIds.join(', ') || t('none', 'None')}</p>
    <Button secondary disabled={busy} onClick={async () => {
      setBusy(true); setMessage('');
      try {
        const response = await fetch(`/settings/agent-admission/${encodeURIComponent(data.owner)}/recover`, { method: 'POST' });
        if (!response.ok) throw new Error(t('agent_recovery_changed', 'The active save changed. Refresh and try again.'));
        const result = await response.json();
        setMessage(`${t('agent_save_recovered', 'Remaining post saves stopped. Saved post IDs')}: ${result.persistedPosts.map((p: { id: string }) => p.id).join(', ') || t('none', 'None')}`);
        await mutate();
      } catch (error) { setMessage((error as Error).message); } finally { setBusy(false); }
    }}>{t('agent_recover_save', 'Stop remaining post saves and recover')}</Button>
    {message && <p role="status">{message}</p>}
  </div>;
}
