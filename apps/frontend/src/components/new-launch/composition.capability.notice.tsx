'use client';

import { useT } from '@gitroom/react/translation/get.transation.service.client';

export const CompositionCapabilityNotice = ({ commentsUnavailable, analyticsUnavailable }: {
  commentsUnavailable: boolean;
  analyticsUnavailable: boolean;
}) => {
  const t = useT();
  if (!commentsUnavailable && !analyticsUnavailable) return null;
  return (
    <div role="status" className="rounded-[8px] bg-newSettings p-[12px] text-[13px] text-textColor">
      {analyticsUnavailable && <p>{t('composition_analytics_unavailable', 'Analytics are off for this selection.')}</p>}
      {commentsUnavailable && <p>{t('composition_replies_unavailable', 'New replies are off; saved entries remain editable.')}</p>}
    </div>
  );
};
