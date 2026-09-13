'use client';

import { ExternalLink, FileText } from 'lucide-react';
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceDot,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { recordRows } from '@rf/contracts-ens';
import type { InvoiceView } from '@/components/submit-wizard';

/** The repayment record a price was worked out from. */
export interface RecordView {
  financed: number;
  ontime: number;
  late: number;
  defaulted: number;
  score: number | null;
}

/** What the invoice sells for, and everything that decided it. */
export interface QuoteView {
  record: RecordView;
  faceValueUsd: number;
  maturityDays: number;
  dailyRatePct: number;
  feePct: number;
  discountUsd: number;
  proceedsUsd: number;
}

/** One holder of the receivable, and what day 60 owes it. */
export interface HolderView {
  name: string;
  wallet: string;
  sharePct: number;
  owedUsd: number;
  paidUsd: number;
  hash?: string;
}

const HASHSCAN = 'https://hashscan.io/testnet/transaction';

const money = (usd: number) => `$${usd.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

/**
 * The published curve, drawn as what this invoice's own term costs at every score.
 *
 * A rate a year meant nothing to a business holding a sixty-day invoice. What it wants to see
 * is the fee it would pay — three per cent with a spotless record, nine with none at all — and
 * where its own record puts it between the two.
 */
function curve(days: number): { score: number; fee: number }[] {
  return Array.from({ length: 11 }, (_, i) => {
    const score = i * 10;
    const daily = 500 + Math.round((1_000 * (100 - score)) / 100);
    return { score, fee: Math.round((daily * days) / 100) / 100 };
  });
}

/** Days between an ISO instant and now, never past the term and never below nought. */
function elapsed(since: string | undefined, term: number): number {
  if (!since) return 0;
  const days = Math.floor((Date.now() - Date.parse(since)) / 86_400_000);
  return Math.max(0, Math.min(term, days));
}

/**
 * What happened to the invoice, in the order a person asks about it.
 *
 * Three tiers, because a flat stack of panels made every number look equally important and none
 * of them look like the answer. The headline is the three amounts that matter and how far the
 * term has run. Under it, the same two facts drawn rather than listed: where the face value
 * went, and where this business sits on the published rate curve. Everything else — the score's
 * own inputs, who holds the receivable, day 60 — is folded away until asked for.
 */
export function Financed({
  invoice,
  quote,
  holders,
  hash,
  at,
  repay,
}: {
  invoice: InvoiceView;
  quote: QuoteView;
  holders: HolderView[];
  hash?: string;
  /** When the financing was requested, which is what the term is counted from. */
  at?: string;
  /** The day-60 panel, which reads and moves real money and so is rendered upstream. */
  repay: React.ReactNode;
}) {
  const days = elapsed(at, quote.maturityDays);
  const score = quote.record.score;

  const split = [
    { name: 'proceeds', value: quote.proceedsUsd, fill: 'var(--accent)' },
    { name: 'cost', value: quote.discountUsd, fill: '#D6D1CB' },
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* ── Who this is ────────────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <CardTitle className="flex items-center gap-2 text-[18px]">
              {invoice.id}
              <Badge variant="default">Tokenized</Badge>
            </CardTitle>
            <CardDescription>
              {invoice.customer} · {invoice.terms} · trades as {invoice.note}
            </CardDescription>
          </div>

          <div className="flex shrink-0 items-center gap-4 text-[14px] font-medium">
            <a
              href={invoice.document}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-[var(--accent)] hover:underline"
            >
              <FileText className="size-4" />
              Invoice
            </a>
            {hash && (
              <a
                href={`${HASHSCAN}/${hash}`}
                target="_blank"
                rel="noreferrer"
                data-testid="financed-transaction"
                className="flex items-center gap-1.5 text-[var(--accent)] hover:underline"
              >
                <ExternalLink className="size-4" />
                On Hedera
              </a>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* ── What it came to ────────────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Figure label="Face value" value={money(quote.faceValueUsd)} note={`due in ${quote.maturityDays} days`} />
        <Figure
          label="Factoring fee"
          value={money(quote.discountUsd)}
          note={`${quote.feePct.toFixed(2)}% · ${quote.dailyRatePct.toFixed(3)}% a day`}
        />
        <Figure
          label="You received"
          value={money(quote.proceedsUsd)}
          note="on issue"
          lead
        />
      </div>

      {/*
        * Hand-rolled rather than the Progress component: its track takes the theme's muted
        * colour, which in this palette is a dark slate, and it renders that track itself with
        * nothing to style it through. A bar that reads as nearly full when five days of sixty
        * have run is worse than no bar.
        */}
      <Card>
        <CardContent data-testid="financed-term" className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[14px] text-[var(--muted)]">
              Day {days} of {quote.maturityDays}
            </span>
            <span className="text-[14px] font-medium text-[var(--ink)]">
              {quote.maturityDays - days} days until {invoice.customer} pays
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-alt)]">
            {/*
              * The fill, with no test id on it. It was the handle this screen was waited on, and
              * on day 0 it is nought pixels wide — which Playwright correctly calls hidden, so
              * every test that opened this tab timed out on a page that had rendered perfectly.
              */}
            <div
              className="h-full rounded-full bg-[var(--accent)] transition-all"
              style={{ width: `${(days / quote.maturityDays) * 100}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Why it came to that ────────────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-[16px]">Where the {money(quote.faceValueUsd)} goes</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-6">
            {/*
              * A donut, with the share in the hole. A bar that was 96% one colour read as a
              * loading indicator; a ring with "96%" in the middle reads as a share of something.
              */}
            <ChartContainer
              className="aspect-square h-[132px] shrink-0"
              config={{
                proceeds: { label: 'To Ironline', color: 'var(--accent)' },
                cost: { label: 'Factoring fee', color: '#D6D1CB' },
              }}
            >
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                <Pie
                  data={split}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={44}
                  outerRadius={62}
                  strokeWidth={0}
                  startAngle={90}
                  endAngle={-270}
                >
                  {split.map((slice) => (
                    <Cell key={slice.name} fill={slice.fill} />
                  ))}
                </Pie>
                <text
                  x="50%"
                  y="50%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-[var(--ink)] text-[20px] font-semibold"
                >
                  {((quote.proceedsUsd / quote.faceValueUsd) * 100).toFixed(0)}%
                </text>
              </PieChart>
            </ChartContainer>

            <div className="flex flex-col gap-2">
              <Key colour="var(--accent)" label="To Ironline" value={money(quote.proceedsUsd)} />
              <Key colour="#D6D1CB" label="Factoring fee" value={money(quote.discountUsd)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-[16px]">What factoring costs at your credit score</CardTitle>
            <CardDescription>
              {score === null
                ? 'No record yet — priced at the top of the range.'
                : `${score} of 100 → ${quote.feePct.toFixed(2)}% fee · score from your ENS repayment record`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              className="h-[120px] w-full"
              config={{
                fee: { label: `Fee over ${quote.maturityDays} days`, color: 'var(--accent)' },
              }}
            >
              <LineChart
                data={curve(quote.maturityDays)}
                margin={{ left: 4, right: 12, top: 8, bottom: 0 }}
              >
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="score"
                  type="number"
                  domain={[0, 100]}
                  tickLine={false}
                  axisLine={false}
                  ticks={[0, 50, 100]}
                  tickFormatter={(value: number) => `${value}`}
                  fontSize={11}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={38}
                  tickFormatter={(value: number) => `${value}%`}
                  fontSize={11}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  dataKey="fee"
                  type="linear"
                  stroke="var(--color-fee)"
                  strokeWidth={2}
                  dot={false}
                />
                {score !== null && (
                  <ReferenceDot
                    x={score}
                    y={quote.feePct}
                    r={5}
                    fill="var(--color-fee)"
                    stroke="white"
                    strokeWidth={2}
                  />
                )}
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* ── Everything else, folded away ───────────────────────────────────────────── */}
      <Accordion className="rounded-xl border bg-[var(--surface)] px-4">
        <AccordionItem value="priced">
          <AccordionTrigger>
            <span className="flex w-full items-center justify-between gap-3 pr-2">
              How this was priced
              <span className="text-[13px] font-normal text-[var(--muted)]">
                {score === null ? 'no record yet' : `${score} of 100`}
              </span>
            </span>
          </AccordionTrigger>
          <AccordionContent className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 sm:grid-cols-5">
              {recordRows(quote.record).map((row) => (
                <Count key={row.label} label={row.label} value={row.value} />
              ))}
            </div>
            <Separator />
            <p className="text-[13px] text-[var(--muted)]">
              (on time × 100 + late × 50) ÷ matured = {score ?? '—'} · read from your ENS record
            </p>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="holders">
          <AccordionTrigger>
            <span className="flex w-full items-center justify-between gap-3 pr-2">
              Who holds it
              <span className="text-[13px] font-normal text-[var(--muted)]">
                {holders.length === 1 ? '1 holder' : `${holders.length} holders`}
              </span>
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <Table data-testid="financed-holders">
              <TableHeader>
                <TableRow>
                  <TableHead>Holder</TableHead>
                  <TableHead>Wallet</TableHead>
                  <TableHead className="text-right">Share</TableHead>
                  <TableHead className="text-right">Owed at maturity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {holders.map((holder) => (
                  <TableRow key={holder.wallet}>
                    <TableCell className="font-medium">{holder.name}</TableCell>
                    <TableCell className="text-[13px] text-[var(--muted)] tabular-nums">
                      {holder.wallet.slice(0, 6)}…{holder.wallet.slice(-4)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {holder.sharePct.toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {money(holder.owedUsd)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="day60" className="border-b-0">
          <AccordionTrigger>
            <span className="flex w-full items-center justify-between gap-3 pr-2">
              Day {quote.maturityDays} repayment
              <span className="text-[13px] font-normal text-[var(--muted)]">
                {days >= quote.maturityDays ? 'due now' : `${quote.maturityDays - days} days to go`}
              </span>
            </span>
          </AccordionTrigger>
          <AccordionContent>{repay}</AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

/** One headline amount. The one a business actually came for is the one that leads. */
function Figure({
  label,
  value,
  note,
  lead,
}: {
  label: string;
  value: string;
  note: string;
  lead?: boolean;
}) {
  return (
    <Card className={lead ? 'bg-[var(--accent-subtle)]' : undefined}>
      <CardContent className="flex flex-col gap-1">
        <span className="eyebrow text-[11px]">{label}</span>
        <span
          className={`text-[26px] leading-none font-semibold tabular-nums ${
            lead ? 'text-[var(--accent)]' : 'text-[var(--ink)]'
          }`}
        >
          {value}
        </span>
        <span className="text-[13px] text-[var(--muted)]">{note}</span>
      </CardContent>
    </Card>
  );
}

/** One colour, and what it stands for. */
function Key({ colour, label, value }: { colour: string; label: string; value: string }) {
  return (
    <span className="flex items-center gap-2 text-[13px] text-[var(--muted)]">
      <span aria-hidden className="size-2.5 rounded-[3px]" style={{ background: colour }} />
      {label}
      <span className="font-medium tabular-nums text-[var(--ink)]">{value}</span>
    </span>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[13px] text-[var(--muted)]">{label}</span>
      <span className="text-[19px] font-semibold tabular-nums text-[var(--ink)]">{value}</span>
    </div>
  );
}
