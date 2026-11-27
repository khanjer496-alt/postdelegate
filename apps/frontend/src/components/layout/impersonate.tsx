import { Input } from '@gitroom/react/form/input';
import {
  ChangeEventHandler,
  FC,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import useSWR, { useSWRConfig } from 'swr';
import { useDebounce } from 'use-debounce';
import { useClickOutside } from '@mantine/hooks';
import { Icon } from '@gitroom/frontend/components/new-layout/v2/icons.v2';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { Select } from '@gitroom/react/form/select';
import { pricing } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/pricing';
import { deleteDialog } from '@gitroom/react/helpers/delete.dialog';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { setCookie } from '@gitroom/frontend/components/layout/layout.context';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { Button } from '@gitroom/react/form/button';
import { ImportDebugPostModal } from '@gitroom/frontend/components/launches/import-debug-post.modal';
import { useForm, FormProvider } from 'react-hook-form';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { AdminAddTeamMemberDto } from '@gitroom/nestjs-libraries/dtos/settings/admin.add.team.member.dto';

interface Charge {
  id: string;
  amount: number;
  currency: string;
  created: number;
  status: string;
  refunded: boolean;
  amount_refunded: number;
  description: string | null;
  receipt_url: string | null;
  invoice_pdf: string | null;
}

const useCharges = () => {
  const fetch = useFetch();
  return useSWR<Charge[]>('/billing/charges', async () => {
    return (await fetch('/billing/charges')).json();
  }, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
  });
};

interface CouponInfo {
  tier: string | null;
  period: string | null;
  isLifetime: boolean;
  monthlyPrice: number;
  planPrice: number;
  nextPayment: number | null;
  coupons: {
    type: string;
    value: number;
    duration: string;
    durationInMonths: number | null;
    remainingMonths: number | null;
  }[];
  supported: boolean;
}

const useCouponInfo = () => {
  const fetch = useFetch();
  return useSWR<CouponInfo>('/billing/coupon-info', async () => {
    return (await fetch('/billing/coupon-info')).json();
  }, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
  });
};

const ApplyCouponModal: FC<{ close: () => void }> = ({ close }) => {
  const fetch = useFetch();
  const t = useT();
  const toast = useToaster();
  const { data: info, mutate } = useCouponInfo();
  const [type, setType] = useState('percentage');
  const [value, setValue] = useState('');
  const [months, setMonths] = useState('1');
  const [error, setError] = useState('');
  const [applying, setApplying] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const handleCancelCoupon = useCallback(async () => {
    if (
      !(await deleteDialog(
        t(
          'cancel_coupon_confirm',
          'Are you sure you want to cancel this coupon? The user will pay the full price from the next billing cycle.'
        ),
        t('yes_cancel_coupon', 'Yes, cancel coupon'),
        t('cancel_coupon_title', 'Cancel Coupon?'),
        t('no_go_back', 'No, go back')
      ))
    ) {
      return;
    }
    setCancelling(true);
    try {
      const response = await fetch('/billing/cancel-coupon', {
        method: 'POST',
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json.cancelled) {
        toast.show(
          json.reason ||
            t('cancel_coupon_failed', 'Could not cancel the coupon'),
          'warning'
        );
        return;
      }
      toast.show(t('cancel_coupon_success', 'Coupon cancelled'));
      await mutate();
    } finally {
      setCancelling(false);
    }
  }, []);

  const handleApply = useCallback(async () => {
    if (!info) {
      return;
    }
    const numberValue = Number(value);
    const numberMonths = Number(months);
    if (
      type === 'percentage' &&
      (!numberValue || numberValue < 1 || numberValue > 100)
    ) {
      setError(
        t(
          'apply_coupon_invalid_percentage',
          'Invalid percentage: enter a value between 1 and 100'
        )
      );
      return;
    }
    if (
      type === 'amount' &&
      (!numberValue || numberValue < 1 || numberValue > info.monthlyPrice)
    ) {
      setError(
        `${t(
          'apply_coupon_invalid_amount',
          "Invalid amount: enter a value between 1 and the plan's monthly payment:"
        )} ${info.monthlyPrice}`
      );
      return;
    }
    if (
      !numberMonths ||
      !Number.isInteger(numberMonths) ||
      numberMonths < 1 ||
      numberMonths > 12
    ) {
      setError(
        t(
          'apply_coupon_invalid_months',
          'Invalid months: enter a whole number between 1 and 12'
        )
      );
      return;
    }
    setError('');
    setApplying(true);
    try {
      const response = await fetch('/billing/apply-coupon', {
        method: 'POST',
        body: JSON.stringify({
          type,
          value: numberValue,
          months: numberMonths,
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json.applied) {
        toast.show(
          json.reason ||
            t('apply_coupon_failed', 'Could not apply the coupon'),
          'warning'
        );
        return;
      }
      toast.show(t('apply_coupon_success', 'Coupon applied'));
      setValue('');
      setMonths('1');
      await mutate();
    } finally {
      setApplying(false);
    }
  }, [info, type, value, months]);

  return (
    <div className="flex flex-col gap-[16px]">
      <div className="text-newTextColor/60 text-[13px]">
        {t(
          'apply_coupon_subtitle',
          "The coupon applied here is simply a deduction from the user's next billing cycle(s) — one or more, depending on how many months you choose to apply it for. It is NOT a refund; we use Stripe's built-in coupon mechanism and that's how it works."
        )}
      </div>
      {!info ? (
        <div className="text-center py-[20px] text-newTextColor/60">
          {t('loading', 'Loading...')}
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-[4px] text-[14px]">
            <div>
              {t('apply_coupon_plan', 'Plan:')} {info.tier || 'FREE'}
              {!!info.tier && ` - $${info.planPrice}`}
            </div>
            <div>
              {t('apply_coupon_period', 'Period:')}{' '}
              {info.period === 'MONTHLY'
                ? t('monthly', 'Monthly')
                : info.period === 'YEARLY'
                ? t('annual', 'Annual')
                : '-'}
            </div>
            <div>
              {t('apply_coupon_lifetime', 'Lifetime deal:')}{' '}
              {info.isLifetime ? t('yes', 'Yes') : t('no', 'No')}
            </div>
            <div>
              {t('apply_coupon_applied', 'Applied coupons:')}{' '}
              {!info.coupons.length && t('none', 'None')}
            </div>
            {info.coupons.map((coupon, index) => (
              <div key={index} className="ps-[10px] flex items-center gap-[10px]">
                <div>
                  -{' '}
                  {coupon.type === 'percentage'
                    ? `${coupon.value}%`
                    : `$${coupon.value}`}{' '}
                  {t('apply_coupon_off', 'off,')}{' '}
                  {coupon.duration === 'repeating'
                    ? `${coupon.durationInMonths} ${t(
                        'apply_coupon_months_total',
                        'month(s) total,'
                      )} ${coupon.remainingMonths} ${t(
                        'apply_coupon_months_left',
                        'month(s) left'
                      )}`
                    : coupon.duration === 'forever'
                    ? t('apply_coupon_forever', 'forever')
                    : t('apply_coupon_once', 'next billing cycle only')}
                </div>
                <Button
                  onClick={handleCancelCoupon}
                  loading={cancelling}
                  className="!bg-red-700 text-white rounded-[4px] !h-[24px] !px-[10px] text-[12px]"
                >
                  {t('cancel', 'Cancel')}
                </Button>
              </div>
            ))}
            <div>
              {t('apply_coupon_next_payment', 'Next Payment:')}{' '}
              {info.nextPayment !== null ? `$${info.nextPayment}` : '-'}
            </div>
          </div>
          {info.supported ? (
            <div className="grid grid-cols-3 gap-[12px]">
              <Select
                label={t('apply_coupon_type', 'Coupon type')}
                name="couponType"
                disableForm={true}
                hideErrors={true}
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="percentage">
                  {t('apply_coupon_percentage', 'Percentage')}
                </option>
                <option value="amount">
                  {t('apply_coupon_fixed_amount', 'Fixed dollar amount')}
                </option>
              </Select>
              <Input
                label={t('apply_coupon_value', 'Value')}
                name="couponValue"
                type="number"
                disableForm={true}
                removeError={true}
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
              <Input
                label={t('apply_coupon_months', 'Months')}
                name="couponMonths"
                type="number"
                disableForm={true}
                removeError={true}
                value={months}
                onChange={(e) => setMonths(e.target.value)}
              />
            </div>
          ) : (
            <div className="text-newTextColor/60 text-[13px]">
              {t(
                'apply_coupon_not_supported',
                "We currently don't support applying a coupon for users either under an annual plan, with a lifetime deal or with another active coupon."
              )}
            </div>
          )}
          {!!error && <div className="text-red-400 text-[12px]">{error}</div>}
          <div className="flex gap-[12px] justify-end">
            <Button onClick={close} className="rounded-[4px]">
              {t('close', 'Close')}
            </Button>
            {info.supported && (
              <Button
                onClick={handleApply}
                loading={applying}
                className="!bg-blue-700 text-white rounded-[4px]"
              >
                {t('apply', 'Apply')}
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
};

const ChargesModal: FC<{ close: () => void }> = ({ close }) => {
  const fetch = useFetch();
  const t = useT();
  const { openModal } = useModals();
  const { data: charges, mutate } = useCharges();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [refunding, setRefunding] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const toggleCharge = useCallback((chargeId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(chargeId)) {
        next.delete(chargeId);
      } else {
        next.add(chargeId);
      }
      return next;
    });
  }, []);

  const handleApplyCoupon = useCallback(() => {
    close();
    openModal({
      title: t('apply_coupon', 'Apply Coupon'),
      maxSize: 600,
      children: (closeCoupon) => <ApplyCouponModal close={closeCoupon} />,
    });
  }, []);

  const handleRefund = useCallback(async () => {
    if (!selected.size) return;
    if (
      !(await deleteDialog(
        t(
          'refund_selected_confirm',
          `Are you sure you want to refund ${selected.size} charge(s)? This cannot be undone.`
        ),
        t('yes_refund', 'Yes, refund'),
        t('confirm_refund', 'Confirm Refund'),
        t('no_cancel', 'No, cancel')
      ))
    ) {
      return;
    }
    setRefunding(true);
    try {
      await fetch('/billing/refund-charges', {
        method: 'POST',
        body: JSON.stringify({ chargeIds: Array.from(selected) }),
      });
      setSelected(new Set());
      await mutate();
    } finally {
      setRefunding(false);
    }
  }, [selected]);

  const handleCancel = useCallback(async () => {
    if (
      !(await deleteDialog(
        t(
          'cancel_subscription_confirm',
          'This will immediately cancel the subscription. The user will be downgraded to the FREE plan. This cannot be undone.'
        ),
        t('yes_cancel_subscription', 'Yes, cancel subscription'),
        t('cancel_subscription_title', 'Cancel Subscription?'),
        t('no_go_back', 'No, go back')
      ))
    ) {
      return;
    }
    setCancelling(true);
    try {
      await fetch('/billing/cancel-subscription', {
        method: 'POST',
      });
      close();
      window.location.reload();
    } catch {
      setCancelling(false);
    }
  }, []);

  return (
    <div className="flex flex-col gap-[16px] min-w-[500px]">
      <div className="max-h-[400px] overflow-y-auto">
        {!charges?.length ? (
          <div className="text-center py-[20px] text-newTextColor/60">
            {t('no_charges', 'No charges found')}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-left border-b border-newTableBorder">
                <th className="p-[8px] w-[40px]" />
                <th className="p-[8px]">{t('date', 'Date')}</th>
                <th className="p-[8px]">{t('amount', 'Amount')}</th>
                <th className="p-[8px]">{t('status', 'Status')}</th>
                <th className="p-[8px] w-[50px]" />
              </tr>
            </thead>
            <tbody>
              {charges.map((charge) => (
                <tr
                  key={charge.id}
                  className="border-b border-newTableBorder hover:bg-tableBorder cursor-pointer"
                  onClick={() => !charge.refunded && toggleCharge(charge.id)}
                >
                  <td className="p-[8px]">
                    <div
                      className={`w-[20px] h-[20px] rounded-[4px] border-2 flex items-center justify-center ${
                        charge.refunded
                          ? 'border-newTextColor/20 opacity-40'
                          : selected.has(charge.id)
                          ? 'bg-forth border-forth'
                          : 'border-newTextColor/40'
                      }`}
                    >
                      {(selected.has(charge.id) || charge.refunded) && (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          width="14"
                          height="14"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                  </td>
                  <td className="p-[8px]">
                    {new Date(charge.created * 1000).toLocaleDateString()}
                  </td>
                  <td className="p-[8px]">
                    ${(charge.amount / 100).toFixed(2)}{' '}
                    {charge.currency.toUpperCase()}
                  </td>
                  <td className="p-[8px]">
                    {charge.refunded ? (
                      <span className="text-red-400">
                        {t('refunded', 'Refunded')}
                      </span>
                    ) : (
                      <span className="text-green-400">
                        {t('paid', 'Paid')}
                      </span>
                    )}
                  </td>
                  <td className="p-[8px]">
                    {(charge.invoice_pdf || charge.receipt_url) && (
                      <a
                        href={charge.invoice_pdf || charge.receipt_url!}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center justify-center w-[28px] h-[28px] rounded-[4px] hover:bg-tableBorder transition-colors"
                        title={charge.invoice_pdf ? t('download_invoice', 'Download Invoice') : t('view_receipt', 'View Receipt')}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          width="16"
                          height="16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="flex gap-[12px] justify-end">
        <Button
          onClick={handleApplyCoupon}
          className="!bg-blue-700 text-white rounded-[4px]"
        >
          {t('apply_coupon', 'Apply Coupon')}
        </Button>
        <Button
          onClick={handleRefund}
          loading={refunding}
          disabled={!selected.size}
          className="rounded-[4px]"
        >
          {t('refund_selected', 'Refund Selected')}
          {selected.size > 0 && ` (${selected.size})`}
        </Button>
        <Button
          onClick={handleCancel}
          loading={cancelling}
          className="!bg-red-700 text-white rounded-[4px]"
        >
          {t('cancel_subscription', 'Cancel Subscription')}
        </Button>
      </div>
    </div>
  );
};

export const Subscription = () => {
  const fetch = useFetch();
  const t = useT();

  const addSubscription: ChangeEventHandler<HTMLSelectElement> = useCallback(
    async (e) => {
      const value = e.target.value;
      if (
        await deleteDialog(
          'Are you sure you want to add a user subscription?',
          'Add'
        )
      ) {
        await fetch('/billing/add-subscription', {
          method: 'POST',
          body: JSON.stringify({
            subscription: value,
          }),
        });
        window.location.reload();
      }
    },
    []
  );
  return (
    <Select
      onChange={addSubscription}
      hideErrors={true}
      disableForm={true}
      name="sub"
      label=""
      value=""
    >
      <option>
        {t('add_free_subscription', '-- ADD FREE SUBSCRIPTION --')}
      </option>
      {Object.keys(pricing)
        .filter((f) => !f.includes('FREE'))
        .map((key) => (
          <option key={key} value={key}>
            {key}
          </option>
        ))}
    </Select>
  );
};
const colorOptions = [
  { value: 'INFO', label: 'Info (Blue)', className: 'bg-blue-600' },
  { value: 'WARNING', label: 'Warning (Amber)', className: 'bg-amber-600' },
  { value: 'ERROR', label: 'Error (Red)', className: 'bg-red-600' },
];

const AddAnnouncementModal: FC<{ close: () => void }> = ({ close }) => {
  const fetch = useFetch();
  const { mutate } = useSWRConfig();
  const t = useT();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('INFO');
  const [saving, setSaving] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!title.trim() || !description.trim()) return;
    setSaving(true);
    try {
      await fetch('/announcements', {
        method: 'POST',
        body: JSON.stringify({ title, description, color }),
      });
      await mutate('/announcements');
      close();
    } finally {
      setSaving(false);
    }
  }, [title, description, color]);

  return (
    <div className="flex flex-col gap-[16px] min-w-[500px]">
      <Input
        label={t('announcement_title', 'Title')}
        name="title"
        disableForm={true}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t('announcement_title_placeholder', 'Announcement title')}
      />
      <div className="flex flex-col gap-[6px]">
        <label className="text-[14px]">
          {t('announcement_description', 'Description')}
        </label>
        <textarea
          className="bg-input border border-tableBorder rounded-[8px] p-[10px] text-newTextColor min-h-[120px] outline-none resize-y"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t(
            'announcement_description_placeholder',
            'Announcement description'
          )}
        />
      </div>
      <div className="flex flex-col gap-[6px]">
        <label className="text-[14px]">
          {t('announcement_color', 'Color')}
        </label>
        <div className="flex gap-[8px]">
          {colorOptions.map((opt) => (
            <div
              key={opt.value}
              onClick={() => setColor(opt.value)}
              className={`flex-1 text-center py-[8px] rounded-[8px] text-white text-[13px] cursor-pointer transition-opacity ${opt.className} ${
                color === opt.value ? 'opacity-100 ring-2 ring-white' : 'opacity-40'
              }`}
            >
              {opt.label}
            </div>
          ))}
        </div>
      </div>
      <div className="flex justify-end">
        <Button
          onClick={handleSubmit}
          loading={saving}
          disabled={!title.trim() || !description.trim()}
          className="rounded-[4px]"
        >
          {t('create_announcement', 'Create Announcement')}
        </Button>
      </div>
    </div>
  );
};

const AddTeamMemberModal: FC<{ close: () => void }> = ({ close }) => {
  const fetch = useFetch();
  const toast = useToaster();
  const t = useT();
  const [saving, setSaving] = useState(false);
  const resolver = useMemo(() => {
    return classValidatorResolver(AdminAddTeamMemberDto);
  }, []);
  const form = useForm({
    values: {
      email: '',
      role: '',
    },
    resolver,
    mode: 'onChange',
  });

  const submit = useCallback(
    async (values: { email: string; role: string }) => {
      setSaving(true);
      try {
        const response = await fetch('/settings/team/add', {
          method: 'POST',
          body: JSON.stringify(values),
        });
        if (!response.ok) {
          toast.show(
            (await response.json()).message ||
              t('could_not_add_member', 'Could not add the member'),
            'warning'
          );
          return;
        }
        toast.show(t('member_added', 'Member added'));
        close();
      } finally {
        setSaving(false);
      }
    },
    []
  );

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(submit)}>
        <div className="flex flex-col gap-[10px] min-w-[400px]">
          <Input
            label="Email"
            placeholder={t('enter_email', 'Enter email')}
            name="email"
          />
          <Select label="Role" name="role">
            <option value="">{t('select_role', 'Select Role')}</option>
            <option value="USER">{t('user', 'User')}</option>
            <option value="ADMIN">{t('admin', 'Admin')}</option>
          </Select>
          <Button type="submit" loading={saving} className="rounded-[4px]">
            {t('add_team_member', 'Add Team Member')}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
};

interface SearchRow {
  id: string;
  userId: string;
  name: string | null;
  email: string;
  orgName: string;
  role: string;
  plan: string;
  removed: boolean;
}

// one row per user-organization of GET /user/impersonate: the id, email,
// org and role of a row all come from the same membership
const toSearchRow = (curr: any): SearchRow => {
  const subscription = curr?.organization?.subscription;
  const tier = subscription?.subscriptionTier;
  return {
    id: curr?.id,
    userId: curr?.user?.id,
    name: curr?.user?.name || null,
    email: curr?.user?.email,
    orgName: curr?.organization?.name,
    role: curr?.role,
    plan: !tier
      ? 'No plan'
      : subscription.isLifetime
      ? `Lifetime ${tier}`
      : subscription.status === 'trialing'
      ? `Trial ${tier}`
      : [tier, subscription.period?.toLowerCase()].filter(Boolean).join(' '),
    removed:
      !!curr?.disabled ||
      !!curr?.user?.deletedAt ||
      !!curr?.organization?.deletedAt,
  };
};

const SearchResult: FC<{ item: SearchRow; onClick: () => void }> = ({
  item,
  onClick,
}) => (
  <button
    type="button"
    onClick={onClick}
    className="flex flex-col w-full px-[10px] py-[8px] rounded-[8px] text-start hover:bg-boxHover"
  >
    <span className="flex items-center gap-[6px] w-full min-w-0">
      <span className="text-[13px] font-[600] truncate">{item.email}</span>
      {item.removed && (
        <span className="text-[11px] text-red-400 shrink-0">removed</span>
      )}
    </span>
    <span className="text-[12px] text-textItemBlur truncate w-full">
      {[item.orgName, item.plan, item.role?.toLowerCase()]
        .filter(Boolean)
        .join(' · ')}
    </span>
  </button>
);

const useUserSearch = (key: string, name: string) => {
  const fetch = useFetch();
  return useSWR<any[]>(
    `/${key}-${name}`,
    async () => {
      if (!name) {
        return [];
      }
      const res = await fetch(
        `/user/impersonate?name=${encodeURIComponent(name)}`
      );
      return res.ok ? res.json() : [];
    },
    {
      refreshWhenHidden: false,
      revalidateOnMount: true,
      revalidateOnReconnect: false,
      revalidateOnFocus: false,
      refreshWhenOffline: false,
      revalidateIfStale: false,
      refreshInterval: 0,
    }
  );
};

// "view as": the admin keeps their own login and sees the app as that
// membership's user. Swap logins is the other, destructive, action
export const useViewAs = () => {
  const fetch = useFetch();
  const toaster = useToaster();
  const t = useT();
  return useCallback(async (membershipId: string, goHome = false) => {
    const res = await fetch(`/user/impersonate`, {
      method: 'POST',
      body: JSON.stringify({
        id: membershipId,
      }),
    });
    if (!res.ok) {
      toaster.show(
        t('view_as_failed', 'Could not open this account'),
        'warning'
      );
      return false;
    }
    if (goHome) {
      window.location.href = '/';
    } else {
      window.location.reload();
    }
    return true;
  }, []);
};

const FindUser = () => {
  const t = useT();
  const viewAs = useViewAs();
  const pathname = usePathname();
  const [name, setName] = useState('');
  const [opening, setOpening] = useState(false);
  const [query] = useDebounce(name.trim(), 300);
  const { data, isLoading } = useUserSearch('impersonate', query);
  const rows = useMemo(() => (data || []).map(toSearchRow), [data]);

  return (
    <div className="flex flex-col gap-[6px]">
      <input
        type="search"
        autoComplete="off"
        value={name}
        onChange={(e) => setName(e.target.value)}
        aria-label={t('find_a_user', 'Find a user')}
        placeholder={t(
          'find_a_user_placeholder',
          'Email, name, workspace or post id'
        )}
        className="bg-newBgColorInner h-[38px] border border-newTableBorder rounded-[8px] px-[10px] text-[14px] mobile:text-[16px] text-textColor w-full outline-none focus-visible:ring-2 focus-visible:ring-btnPrimary"
      />
      {!!query && !isLoading && !rows.length && (
        <div className="px-[10px] text-[12px] text-textItemBlur">
          {t('no_users_found', 'No users found')}
        </div>
      )}
      {!!rows.length && (
        <div className="flex flex-col max-h-[240px] overflow-y-auto">
          {rows.map((item) => (
            <SearchResult
              key={item.id}
              item={item}
              onClick={async () => {
                if (opening) {
                  return;
                }
                setOpening(true);
                // an admin page would show the admin list again, so open the
                // app itself; anywhere else stay on the same page
                if (!(await viewAs(item.id, pathname.startsWith('/admin')))) {
                  setOpening(false);
                }
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const SwitchUser = () => {
  const fetch = useFetch();
  const t = useT();
  const toaster = useToaster();
  const currentUser = useUser();
  const [name, setName] = useState('');
  const [query] = useDebounce(name.trim(), 300);
  const [selected, setSelected] = useState<SearchRow | null>(null);
  const [switching, setSwitching] = useState(false);

  const { data } = useUserSearch('switch-search', query);

  const mapData = useMemo(() => {
    // the switch uses the membership's user. The impersonated user is left out
    return (data || [])
      .filter((curr: any) => curr?.user?.id !== currentUser?.id)
      .map(toSearchRow);
  }, [data, currentUser?.id]);

  const doSwitch = useCallback(async () => {
    if (!selected) {
      return;
    }
    // this trades the two accounts' logins, it is not "view as" (that is the
    // impersonation box), so the dialog says exactly what changes
    if (
      !(await deleteDialog(
        t(
          'swap_logins_confirm',
          '{{current}} will sign in to {{target}}\'s account, and {{target}} will sign in to {{current}}\'s account. Their email addresses and passwords trade places, and the billing customer emails update to match. This is not "view as": use the impersonation box for that. You can undo it by swapping again.',
          {
            current: currentUser?.email,
            target: selected.email,
            interpolation: { escapeValue: false },
          }
        ),
        t('swap_logins', 'Swap logins'),
        t('swap_logins_title', 'Swap logins?'),
        t('no_cancel', 'No, cancel'),
        true
      ))
    ) {
      return;
    }
    setSwitching(true);
    try {
      const res = await fetch('/user/switch', {
        method: 'POST',
        body: JSON.stringify({ id: selected.userId }),
      });
      // customFetch does not throw on HTTP errors
      if (!res.ok) {
        throw new Error(await res.text().catch(() => ''));
      }
      window.location.reload();
    } catch {
      setSwitching(false);
      toaster.show(
        t(
          'switch_user_failed',
          'The user switch failed and nothing was changed'
        ),
        'warning'
      );
    }
  }, [selected, currentUser?.email]);

  return (
    <div className="flex flex-col gap-[6px]">
      <div className="text-[12px] text-textItemBlur">
        {t(
          'swap_logins_help',
          'Trades the email and password of {{current}} with another account. Not "view as".',
          {
            current: currentUser?.email,
            interpolation: { escapeValue: false },
          }
        )}
      </div>
      <div className="flex items-center gap-[8px]">
        <input
          type="search"
          autoComplete="off"
          aria-label={t(
            'select_user_to_swap_logins_with',
            'Select user to swap logins with'
          )}
          placeholder={t(
            'select_user_to_swap_logins_with',
            'Select user to swap logins with'
          )}
          value={selected ? selected.email : name}
          onChange={(e) => {
            setSelected(null);
            setName(e.target.value);
          }}
          className="flex-1 min-w-0 bg-newBgColorInner h-[38px] border border-newTableBorder rounded-[8px] px-[10px] text-[14px] mobile:text-[16px] text-textColor outline-none focus-visible:ring-2 focus-visible:ring-btnPrimary"
        />
        <Button
          onClick={doSwitch}
          loading={switching}
          disabled={!selected}
          className="rounded-[8px] h-[38px] px-[12px] text-[13px] whitespace-nowrap !bg-red-700 !text-white"
        >
          {t('swap_logins', 'Swap logins')}
        </Button>
      </div>
      {!!mapData.length && !selected && (
        <div className="flex flex-col max-h-[200px] overflow-y-auto">
          {mapData.map((item) => (
            <SearchResult
              key={item.id}
              item={item}
              onClick={() => {
                setSelected(item);
                setName('');
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const menuItem =
  'flex items-center gap-[10px] w-full h-[36px] px-[10px] rounded-[8px] text-[13px] text-start hover:bg-boxHover';

const MenuSection: FC<{ title: string; children: ReactNode }> = ({
  title,
  children,
}) => (
  <div className="flex flex-col gap-[2px] py-[6px] border-t border-newTableBorder first:border-t-0">
    <div className="px-[10px] pb-[4px] text-[11px] font-[600] uppercase tracking-[0.04em] text-textItemBlur">
      {title}
    </div>
    {children}
  </div>
);

// The super admin tools, one button in the top bar: a dropdown on desktop, a
// sheet from the bottom on phones
export const AdminMenu = () => {
  const t = useT();
  const user = useUser();
  const pathname = usePathname();
  const { billingEnabled } = useVariables();
  const { openModal } = useModals();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false));

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const openTool = useCallback(
    (params: Parameters<typeof openModal>[0]) => () => {
      setOpen(false);
      openModal(params);
    },
    [openModal]
  );

  const pages = [
    { href: '/admin/users', label: t('admin_menu_users', 'Users') },
    { href: '/admin/stats', label: t('admin_menu_stats', 'Stats') },
    { href: '/admin/errors', label: t('admin_menu_errors', 'Errors') },
    {
      href: '/admin/affiliates',
      label: t('admin_menu_affiliates', 'Affiliates'),
    },
    { href: '/admin/reviews', label: t('admin_menu_reviews', 'Reviews') },
  ];

  return (
    <div
      ref={ref}
      className="relative"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          setOpen(false);
          buttonRef.current?.focus();
        }
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="flex items-center gap-[6px] h-[32px] px-[10px] rounded-[8px] bg-forth text-white text-[12px] font-[600] whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-btnPrimary"
      >
        {t('admin', 'Admin')}
        <Icon name="chevron-down" size={14} />
      </button>
      {open && (
        <>
          <div
            className="hidden mobile:block fixed inset-0 bg-newBackdrop opacity-60 z-[490]"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-label={t('admin_tools', 'Admin tools')}
            className={clsx(
              'absolute top-[calc(100%+6px)] end-0 z-[400] w-[340px] max-h-[80vh] overflow-y-auto p-[6px] rounded-[12px] bg-newBgColorInner ring-1 ring-newBorder shadow-menu text-newTextColor',
              'mobile:fixed mobile:top-auto mobile:bottom-0 mobile:inset-x-0 mobile:w-auto mobile:z-[491] mobile:max-h-[85vh] mobile:rounded-b-none mobile:pb-[16px]'
            )}
          >
            <MenuSection title={t('admin_menu_pages', 'Pages')}>
              {pages.map((page) => (
                <Link
                  key={page.href}
                  href={page.href}
                  onClick={() => setOpen(false)}
                  className={clsx(
                    menuItem,
                    pathname === page.href && 'font-[600] bg-boxFocused'
                  )}
                >
                  {page.label}
                </Link>
              ))}
            </MenuSection>
            <MenuSection title={t('find_a_user', 'Find a user')}>
              <div className="px-[4px]">
                <FindUser />
              </div>
            </MenuSection>
            <MenuSection title={t('admin_menu_tools', 'Tools')}>
              <button
                type="button"
                className={menuItem}
                onClick={openTool({
                  title: t('add_announcement', 'Add Announcement'),
                  children: (close) => <AddAnnouncementModal close={close} />,
                })}
              >
                {t('add_announcement', 'Add Announcement')}
              </button>
              <button
                type="button"
                className={menuItem}
                onClick={openTool({
                  title: t('import_debug_post', 'Import Debug Post'),
                  maxSize: 800,
                  children: (close) => <ImportDebugPostModal close={close} />,
                })}
              >
                {t('import_debug_post', 'Import Debug Post')}
              </button>
            </MenuSection>
            {!!user?.impersonate && (
              <MenuSection
                title={t('this_account', 'This account: {{email}}', {
                  email: user?.email,
                  interpolation: { escapeValue: false },
                })}
              >
                {user?.tier?.current === 'FREE' && (
                  <div className="px-[4px]">
                    <Subscription />
                  </div>
                )}
                {!!user?.tier?.team_members && (
                  <button
                    type="button"
                    className={menuItem}
                    onClick={openTool({
                      title: t('add_team_member', 'Add Team Member'),
                      children: (close) => <AddTeamMemberModal close={close} />,
                    })}
                  >
                    {t('add_team_member', 'Add Team Member')}
                  </button>
                )}
                {billingEnabled && (
                  <button
                    type="button"
                    className={menuItem}
                    onClick={openTool({
                      title: t('manage_billing', 'Manage Billing'),
                      children: (close) => <ChargesModal close={close} />,
                    })}
                  >
                    {t('manage_billing', 'Manage Billing')}
                  </button>
                )}
                <div className="px-[4px] pt-[6px]">
                  <SwitchUser />
                </div>
              </MenuSection>
            )}
          </div>
        </>
      )}
    </div>
  );
};

// Shown above every page while a super admin views the app as someone
// else, with the way back. The admin tools stay in reach on every screen,
// the first billing screen included (it has no top bar)
export const Impersonate = () => {
  const fetch = useFetch();
  const t = useT();
  const user = useUser();
  const { isSecured, billingEnabled, isGeneral } = useVariables();
  const [leaving, setLeaving] = useState(false);

  const stopImpersonating = useCallback(async () => {
    setLeaving(true);
    if (!isSecured) {
      setCookie('impersonate', '', -10);
    } else {
      await fetch(`/user/impersonate`, {
        method: 'POST',
        body: JSON.stringify({
          id: '',
        }),
      });
    }
    window.location.reload();
  }, []);

  if (!user?.impersonate) {
    // the layout shows the first billing screen, without the top bar and its
    // Admin button, to a workspace without a plan
    const firstBilling =
      user?.tier?.current === 'FREE' &&
      !user?.freePlan &&
      isGeneral &&
      billingEnabled;
    return firstBilling ? (
      <div className="flex justify-end px-[16px] py-[8px]">
        <AdminMenu />
      </div>
    ) : null;
  }

  return (
    <div
      role="status"
      className="flex items-center gap-[10px] px-[16px] mobile:px-[12px] h-[44px] bg-amber-500/15 border-b border-amber-500/40 text-newTextColor text-[13px]"
    >
      <span className="text-amber-500 shrink-0">
        <Icon name="eye" size={16} />
      </span>
      <span className="flex-1 min-w-0 truncate">
        {t('viewing_as', 'Viewing as')}{' '}
        <span className="font-[600]">{user?.email}</span>
      </span>
      <button
        type="button"
        onClick={stopImpersonating}
        disabled={leaving}
        className="shrink-0 h-[32px] px-[10px] rounded-[8px] bg-amber-500 text-black text-[12px] font-[600] whitespace-nowrap disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-btnPrimary"
      >
        <span className="mobile:hidden">
          {t('return_to_my_account', 'Return to my account')}
        </span>
        <span className="hidden mobile:inline">
          {t('return_short', 'Return')}
        </span>
      </button>
      <AdminMenu />
    </div>
  );
};
