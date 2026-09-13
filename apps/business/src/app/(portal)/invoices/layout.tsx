import { InvoiceTabs } from '@/components/invoice-tabs';

export default function InvoicesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <InvoiceTabs />
      {children}
    </>
  );
}
