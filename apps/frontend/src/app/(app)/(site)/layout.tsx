import { LayoutComponent } from '@gitroom/frontend/components/new-layout/layout.component';
import { LayoutComponentV2 } from '@gitroom/frontend/components/new-layout/v2/layout.v2.component';
import { isUiV2Request } from '@gitroom/frontend/components/new-layout/v2/ui.flag.server';
import { readFeatureFlags } from '@gitroom/frontend/components/features/feature.flags.server';
import { FeatureFlagsProvider } from '@gitroom/frontend/components/features/feature.flags.client';

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  // the classic layout stays the default; see v2/ui.flag.ts for the modes.
  // A ?pd_ui=v1/v2 link already set the cookie in proxy.ts.
  const uiV2 = await isUiV2Request();
  const Shell = uiV2 ? LayoutComponentV2 : LayoutComponent;
  // the parity features (features/feature.flags.ts) are v2-only
  const flags = uiV2 ? await readFeatureFlags() : {};

  return (
    <FeatureFlagsProvider flags={flags}>
      <Shell>{children}</Shell>
    </FeatureFlagsProvider>
  );
}
