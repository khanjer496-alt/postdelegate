'use client';

import { FC, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import Link from 'next/link';

// One row of the v2 sidebar: icon + label, a count on the right, an accent
// bar on the active row. Same links and click handlers as the classic menu.
export const NavItemV2: FC<{
  label: string;
  title?: string;
  icon: ReactNode;
  path: string;
  collapsed?: boolean;
  onClick?: () => void;
  badge?: number;
  // a neutral count, e.g. connected channels
  count?: number;
}> = ({ label, title, icon, path, collapsed, onClick, badge, count }) => {
  const currentPath = usePathname();
  const isActive = path.startsWith('/') && currentPath.indexOf(path) === 0;

  const className = clsx(
    'group relative flex items-center w-full h-[34px] rounded-[9px] text-[13.5px] font-[500] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-btnPrimary',
    collapsed
      ? 'justify-center px-0 mobile:justify-start mobile:gap-[10px] mobile:px-[10px]'
      : 'gap-[10px] px-[10px]',
    isActive
      ? 'bg-pdNavActive text-pdNavActiveText'
      : 'text-textItemBlur hover:bg-boxHover hover:text-newTextColor'
  );

  const inner = (
    <>
      {isActive && (
        <span
          aria-hidden="true"
          className="absolute start-0 top-0 bottom-0 w-[2px] rounded-s-[9px] bg-pdNavAccent"
        />
      )}
      <span
        aria-hidden="true"
        className={clsx(
          'relative flex items-center justify-center w-[16px] h-[16px] shrink-0 [&_svg]:max-w-[16px] [&_svg]:max-h-[16px]',
          isActive && 'text-pdBrand2'
        )}
      >
        {icon}
        {collapsed && !!badge && (
          <span className="absolute -top-[5px] -end-[7px] w-[8px] h-[8px] rounded-full bg-btnCta mobile:hidden" />
        )}
      </span>
      <span
        className={clsx('flex-1 min-w-0 truncate text-start', collapsed && 'hidden mobile:block')}
      >
        {label}
      </span>
      {!badge && !!count && (
        <span
          className={clsx(
            'min-w-[20px] h-[18px] px-[6px] rounded-[6px] bg-[#242428] text-textItemBlur text-[11px] leading-[18px] font-[600] text-center',
            collapsed && 'hidden mobile:block'
          )}
        >
          {count}
        </span>
      )}
      {!!badge && (
        <span
          className={clsx(
            'min-w-[20px] h-[18px] px-[6px] rounded-[6px] bg-[#ffb5472a] text-[#ffb547] text-[11px] leading-[18px] font-[700] text-center',
            collapsed && 'hidden mobile:block'
          )}
        >
          {badge > 99 ? '99+' : badge}
          <span className="sr-only"> ({badge})</span>
        </span>
      )}
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} title={title || label} className={className}>
        {inner}
      </button>
    );
  }

  if (path.startsWith('mailto:')) {
    return (
      <a href={path} title={collapsed ? label : title} className={className}>
        {inner}
      </a>
    );
  }

  return (
    <Link
      prefetch={true}
      href={path}
      title={collapsed ? label : title}
      aria-current={isActive ? 'page' : undefined}
      {...(path.indexOf('http') === 0 && { target: '_blank' })}
      className={className}
    >
      {inner}
    </Link>
  );
};
