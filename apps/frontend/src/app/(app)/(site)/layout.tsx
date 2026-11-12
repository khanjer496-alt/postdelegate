import { Suspense } from 'react';
import { LayoutComponent } from '@gitroom/frontend/components/new-layout/layout.component';
import { LayoutComponentV2 } from '@gitroom/frontend/components/new-layout/v2/layout.v2.component';
import { UiFlagQuerySync } from '@gitroom/frontend/components/new-layout/v2/ui.flag.client';
import {
  normalizeUiFlagMode,
  UI_FLAG_ENV,
} from '@gitroom/frontend/components/new-layout/v2/ui.flag';
import { isUiV2Request } from '@gitroom/frontend/components/new-layout/v2/ui.flag.server';

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  // the classic layout stays the default; see v2/ui.flag.ts for the modes
  const mode = normalizeUiFlagMode(process.env[UI_FLAG_ENV]);
  const Shell = (await isUiV2Request()) ? LayoutComponentV2 : LayoutComponent;

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
