import { PortfolioTabs } from '@/components/portfolio-tabs';

export default function PortfolioLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PortfolioTabs />
      {children}
    </>
  );
}
