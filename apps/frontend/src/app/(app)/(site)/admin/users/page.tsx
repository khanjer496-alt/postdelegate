export const dynamic = 'force-dynamic';
import { AdminUsersComponent } from '@gitroom/frontend/components/admin/admin-users.component';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: `PostDelegate Admin Users`,
};

export default async function Page() {
  return (
    <div className="bg-newBgColorInner flex-1 min-w-0 flex-col flex p-[20px] mobile:p-[12px] gap-[12px]">
      <AdminUsersComponent />
    </div>
  );
}
