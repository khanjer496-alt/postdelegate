'use client';

import { FC, ReactNode } from 'react';
import clsx from 'clsx';

// small presentational pieces shared by the v2 calendar, list and channels

export const NetworkBadge: FC<{ identifier: string; size?: number; className?: string }> = ({
  identifier,
  size = 18,
  className,
}) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img
    src={
      identifier === 'youtube'
        ? '/icons/platforms/youtube.svg'
        : `/icons/platforms/${identifier}.png`
    }
    alt=""
    aria-hidden="true"
    width={size}
    height={size}
    className={clsx('rounded-full shrink-0 object-cover ring-2 ring-pdSurface bg-pdSurface', className)}
    style={{ width: size, height: size }}
  />
);

export const ChannelAvatarV2: FC<{
  picture?: string | null;
  identifier: string;
  name: string;
  size?: number;
}> = ({ picture, identifier, name, size = 32 }) => {
  const initials =
    name
      .replace(/[@#]/g, '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('') || '?';
  const badge = Math.max(12, Math.round(size * 0.45));
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      {picture ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={picture}
          alt=""
          className="rounded-full object-cover"
          style={{ width: size, height: size }}
          onError={(e) => ((e.currentTarget as HTMLImageElement).style.visibility = 'hidden')}
        />
      ) : (
        <span
          className="rounded-full flex items-center justify-center font-[700] text-white bg-gradient-to-br from-[#7357ff] to-[#3b2bb8]"
          style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
        >
          {initials}
        </span>
      )}
      <span className="absolute -bottom-[3px] -end-[3px]">
        <NetworkBadge identifier={identifier} size={badge} />
      </span>
    </span>
  );
};

export type PdStatus = 'scheduled' | 'draft' | 'published' | 'failed' | 'review';

export const statusPill: Record<PdStatus, string> = {
  scheduled: 'bg-[#7357ff26] text-[#b39aff]',
  draft: 'bg-pdSurface2 text-textItemBlur',
  published: 'bg-[#3ddc9726] text-[#3ddc97]',
  failed: 'bg-[#ff5a5f26] text-[#ff5a5f]',
  review: 'bg-[#ffb54726] text-[#ffb547]',
};

export const Pill: FC<{ className?: string; children: ReactNode }> = ({ className, children }) => (
  <span
    className={clsx(
      'inline-flex items-center gap-[5px] text-[11px] font-[600] px-[8px] py-[2px] rounded-full whitespace-nowrap',
      className
    )}
  >
    {children}
  </span>
);

export const IconButton: FC<{
  label: string;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
}> = ({ label, onClick, children, className }) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    onClick={onClick}
    className={clsx(
      'w-[28px] h-[28px] mobile:w-[44px] mobile:h-[44px] grid place-items-center rounded-[7px] text-textItemBlur hover:text-newTextColor hover:bg-boxHover outline-none focus-visible:ring-2 focus-visible:ring-btnPrimary',
      className
    )}
  >
    {children}
  </button>
);

export const ghostButton =
  'inline-flex items-center justify-center gap-[7px] h-[32px] mobile:h-[44px] mobile:min-w-[44px] px-[12px] rounded-[9px] text-[13px] font-[600] whitespace-nowrap bg-pdSurface2 border border-pdLine2 text-newTextColor hover:border-textItemBlur/40 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-btnPrimary';
