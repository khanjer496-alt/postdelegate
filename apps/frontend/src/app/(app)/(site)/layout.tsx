import { LayoutComponent } from '@gitroom/frontend/components/new-layout/layout.component';
import { LayoutComponentV2 } from '@gitroom/frontend/components/new-layout/v2/layout.v2.component';
import { isUiV2Request } from '@gitroom/frontend/components/new-layout/v2/ui.flag.server';
import {
  normalizeUiFlagMode,
  UI_FLAG_ENV,
} from '@gitroom/frontend/components/new-layout/v2/ui.flag';
import { readFeatureFlags } from '@gitroom/frontend/components/features/feature.flags.server';
import { FeatureFlagsProvider } from '@gitroom/frontend/components/features/feature.flags.client';

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  // the classic layout stays the default; see v2/ui.flag.ts for the modes.
  // A ?pd_ui=v1/v2 link already set the cookie in proxy.ts.
  if (await isUiV2Request()) {
    // the parity features (features/feature.flags.ts) are v2-only
    const flags = await readFeatureFlags();
    return (
      <FeatureFlagsProvider flags={flags}>
        <LayoutComponentV2>{children}</LayoutComponentV2>
      </FeatureFlagsProvider>
    );
  }

  // only a boolean goes to the client: offer the new layout when the
  // server would honour the cookie (optin or on)
  const canTryNewLayout =
    normalizeUiFlagMode(process.env[UI_FLAG_ENV]) !== 'off';

  // the parity features are v2-only: the classic layout gets no flags
  // (useFeature reads false without a provider)
  return (
    <LayoutComponent canTryNewLayout={canTryNewLayout}>
      {children}
    </LayoutComponent>
  );
}
