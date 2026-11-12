import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { LayoutComponent } from '@gitroom/frontend/components/new-layout/layout.component';
import { LayoutComponentV2 } from '@gitroom/frontend/components/new-layout/v2/layout.v2.component';
import { UiFlagQuerySync } from '@gitroom/frontend/components/new-layout/v2/ui.flag.client';
import {
  normalizeUiFlagMode,
  resolveUiV2,
  UI_FLAG_COOKIE,
  UI_FLAG_ENV,
} from '@gitroom/frontend/components/new-layout/v2/ui.flag';

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  // the classic layout stays the default; see v2/ui.flag.ts for the modes
  const mode = normalizeUiFlagMode(process.env[UI_FLAG_ENV]);
  const useV2 =
    mode !== 'off' &&
    resolveUiV2(mode, (await cookies()).get(UI_FLAG_COOKIE)?.value);
  const Shell = useV2 ? LayoutComponentV2 : LayoutComponent;

  return (
    <>
      {mode !== 'off' && (
        <Suspense fallback={null}>
          <UiFlagQuerySync />
        </Suspense>
      )}
      <Shell>{children}</Shell>
    </>
  );
}
