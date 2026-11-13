'use client';

// Channel list state and actions for the v2 calendar and Channels page.
// Copied from the classic launches.component.tsx (same requests, same
// handlers) so the classic file stays untouched. Keep both in sync.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { groupBy, orderBy } from 'lodash';
import { useRouter, useSearchParams } from 'next/navigation';
import { Integration } from '@prisma/client';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useFireEvents } from '@gitroom/helpers/utils/use.fire.events';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useIntegrationList } from '@gitroom/frontend/components/launches/helpers/use.integration.list';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { CustomVariables } from '@gitroom/frontend/components/launches/add.provider.component';
import { errorMessage } from '@gitroom/frontend/components/launches/import/import.posts.modal';

export const useChannelsV2 = (options: { handleConnectResult?: boolean } = {}) => {
  const fetch = useFetch();
  const router = useRouter();
  const search = useSearchParams();
  const toast = useToaster();
  const fireEvents = useFireEvents();
  const t = useT();
  const modal = useModals();
  const [reload, setReload] = useState(false);
  const { isLoading, data: integrations, mutate } = useIntegrationList();

  const totalNonDisabledChannels = useMemo(() => {
    return (
      integrations?.filter((integration: any) => !integration.disabled)
        ?.length || 0
    );
  }, [integrations]);
  const changeItemGroup = useCallback(
    async (id: string, group: string) => {
      mutate(
        integrations.map((integration: any) => {
          if (integration.id === id) {
            return {
              ...integration,
              customer: {
                id: group,
              },
            };
          }
          return integration;
        }),
        false
      );
      const response = await fetch(`/integrations/${id}/group`, {
        method: 'PUT',
        body: JSON.stringify({
          group,
        }),
      });
      if (!response.ok) {
        toast.show(
          await errorMessage(
            response,
            t('could_not_save_group', 'Could not save the group.')
          ),
          'warning'
        );
      }
      // also puts the channel back in its group when the move failed
      mutate();
    },
    [integrations]
  );
  const sortedIntegrations = useMemo(() => {
    return orderBy(
      integrations,
      ['type', 'disabled', 'identifier'],
      ['desc', 'asc', 'asc']
    );
  }, [integrations]);
  const menuIntegrations = useMemo(() => {
    return orderBy(
      Object.values(
        groupBy(sortedIntegrations, (o) => o?.customer?.id || '')
      ).map((p) => ({
        name: (p[0].customer?.name || '') as string,
        id: (p[0].customer?.id || '') as string,
        isEmpty: p.length === 0,
        values: orderBy(
          p,
          ['type', 'disabled', 'identifier'],
          ['desc', 'asc', 'asc']
        ),
      })),
      ['isEmpty', 'name'],
      ['desc', 'asc']
    );
  }, [sortedIntegrations]);
  const update = useCallback(async (shouldReload: boolean) => {
    if (shouldReload) {
      setReload(true);
    }
    try {
      await mutate();
    } finally {
      if (shouldReload) {
        setReload(false);
      }
    }
  }, []);
  const continueIntegration = useCallback(
    (integration: any) => async () => {
      router.push(
        `/launches?added=${integration.identifier}&continue=${integration.id}`
      );
    },
    []
  );
  const refreshChannel = useCallback(
    (
        integration: Integration & {
          identifier: string;
          isCustomFields?: boolean;
          customFields?: any[];
        }
      ) =>
      async () => {
        // Custom-fields providers (Bluesky, etc.) have no OAuth URL to redirect
        // to: reconnect by re-entering the credentials, like the menu does.
        if (integration.isCustomFields) {
          modal.openModal({
            title: t('custom_url', 'Custom URL'),
            withCloseButton: false,
            classNames: {
              modal: 'md',
            },
            children: (
              <CustomVariables
                identifier={integration.identifier}
                refresh={integration.internalId}
                gotoUrl={(url: string) => router.push(url)}
                variables={integration.customFields || []}
              />
            ),
          });
          return;
        }

        const response = await fetch(
          `/integrations/social/${
            integration.identifier
          }?refresh=${encodeURIComponent(integration.internalId)}`,
          {
            method: 'GET',
          }
        );
        const { url } = response.ok
          ? await response.json().catch(() => ({} as any))
          : ({} as any);
        if (!url) {
          toast.show(
            t(
              'could_not_connect_to_platform',
              'Could not connect to the platform'
            ),
            'warning'
          );
          return;
        }
        window.location.href = url;
      },
    []
  );
  // A channel connect lands here with ?msg (and ?added on success). The
  // producer says whether msg is a success or an error, and the params are
  // removed once read so a reload does not show them or count them again.
  useEffect(() => {
    if (!options.handleConnectResult || typeof window === 'undefined') {
      return;
    }
    const msg = search.get('msg');
    const isError = !!msg && search.get('msgType') !== 'success';
    // ?added together with ?continue is the page picker, which reads both
    const added = search.get('continue') ? null : search.get('added');
    if (msg) {
      toast.show(msg, isError ? 'warning' : 'success');
      // only an opener on this app's own origin receives the result
      window.opener?.postMessage(
        {
          msg,
          success: !isError,
        },
        window.location.origin
      );
    }
    if (added) {
      fireEvents('channel_added');
      window.opener?.postMessage(
        {
          msg: t('channel_added', 'Channel added'),
          success: true,
        },
        window.location.origin
      );
    }
    if (msg || added) {
      const url = new URL(window.location.href);
      url.searchParams.delete('msg');
      url.searchParams.delete('msgType');
      if (added) {
        url.searchParams.delete('added');
      }
      router.replace(url.pathname + url.search);
    }
    // an error stays on screen, the person has to read it
    if (window.opener && !isError) {
      window.close();
    }
  }, []);

  return {
    isLoading,
    reload,
    integrations: (integrations || []) as any[],
    mutate,
    totalNonDisabledChannels,
    changeItemGroup,
    sortedIntegrations,
    menuIntegrations,
    update,
    continueIntegration,
    refreshChannel,
  };
};
