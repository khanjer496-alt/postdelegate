'use client';

import { FC, useEffect } from 'react';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import {
  accentOf,
  PublicSmartLinkPage,
  textOnAccent,
} from '@gitroom/frontend/components/features/smartlinks/smartlinks.types';

// counters only: no cookies or credentials go with them
const ping = (url: string) => {
  try {
    fetch(url, { method: 'POST', keepalive: true, credentials: 'omit', mode: 'cors' }).catch(
      () => undefined
    );
  } catch {
    // counting never blocks the visitor
  }
};

// The public link-in-bio page (PD_FF_SMARTLINKS). Links are plain anchors,
// so they work without JavaScript; a click is counted on the way out.
export const SmartLinkPublic: FC<{ page: PublicSmartLinkPage }> = ({ page }) => {
  const { backendUrl } = useVariables();
  const accent = accentOf(page.accentColor);
  const onAccent = textOnAccent(accent);
  const base = `${backendUrl}/public/smartlinks/${encodeURIComponent(page.slug)}`;

  useEffect(() => {
    // one view per visit of the tab
    const key = `pd_bio_view_${page.slug}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch {
      // private mode: count it anyway
    }
    ping(`${base}/view`);
  }, [base, page.slug]);

  return (
    <main className="min-h-screen bg-[#0b0b10] text-white flex justify-center px-[16px] py-[48px]">
      <div className="w-full max-w-[480px] flex flex-col items-center gap-[20px]">
        {page.avatarUrl ? (
          <img
            src={page.avatarUrl}
            alt=""
            className="w-[88px] h-[88px] rounded-full object-cover border-[3px]"
            style={{ borderColor: accent }}
          />
        ) : (
          <div
            aria-hidden
            className="w-[88px] h-[88px] rounded-full flex items-center justify-center text-[34px] font-[800]"
            style={{ background: accent, color: onAccent }}
          >
            {page.title.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="text-center flex flex-col gap-[6px]">
          <h1 className="text-[22px] font-[800] leading-tight">{page.title}</h1>
          {!!page.bio && (
            <p className="text-[14px] text-[#b9b9c6] whitespace-pre-line">{page.bio}</p>
          )}
        </div>
        <ul className="w-full flex flex-col gap-[12px]">
          {page.items.map((item) => (
            <li key={item.id}>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                onClick={() => ping(`${base}/click/${encodeURIComponent(item.id)}`)}
                className="w-full min-h-[56px] rounded-[14px] px-[16px] py-[10px] flex items-center gap-[12px] font-[700] text-[15px] transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                style={{ background: accent, color: onAccent }}
              >
                {!!item.imageUrl && (
                  <img src={item.imageUrl} alt="" className="w-[36px] h-[36px] rounded-[8px] object-cover" />
                )}
                <span className="flex-1 text-center">{item.title}</span>
                {!!item.imageUrl && <span className="w-[36px]" aria-hidden />}
              </a>
            </li>
          ))}
        </ul>
        {!page.items.length && (
          <p className="text-[13px] text-[#8b8b98]">No links here yet.</p>
        )}
        <a
          href="https://postdelegate.com"
          className="mt-[24px] text-[12px] text-[#8b8b98] hover:text-white"
        >
          Made with PostDelegate
        </a>
      </div>
    </main>
  );
};
