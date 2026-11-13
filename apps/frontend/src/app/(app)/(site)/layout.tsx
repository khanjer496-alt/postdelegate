import { LayoutComponent } from '@gitroom/frontend/components/new-layout/layout.component';
import { LayoutComponentV2 } from '@gitroom/frontend/components/new-layout/v2/layout.v2.component';
import { isUiV2Request } from '@gitroom/frontend/components/new-layout/v2/ui.flag.server';

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  // the classic layout stays the default; see v2/ui.flag.ts for the modes.
  // A ?pd_ui=v1/v2 link already set the cookie in proxy.ts.
  const Shell = (await isUiV2Request()) ? LayoutComponentV2 : LayoutComponent;

  return <Shell>{children}</Shell>;
}
