import { Card } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import type { Block, Cell } from '@/data/portal.types';
import { Figure } from '@/components/figure';

function Chip({ label, tone }: { label: string; tone?: string }) {
  return <span className={`st st-${tone ?? 'idle'}`}>{label}</span>;
}

/*
 * Every string rendered through this file is a literal written in the data module
 * beside it, and a few carry <b> to lift one figure inside a sentence. Nothing here
 * ever sees user input, so the markup is trusted the same way the rest of the file is.
 */
function Rich({ html, className }: { html: string; className?: string }) {
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

function Note({ html }: { html: string }) {
  return (
    <div className="panel-note border-t px-4 py-3 text-[12.5px] leading-relaxed bg-[var(--surface-2)] text-[var(--muted-ink)]">
      <Rich html={html} />
    </div>
  );
}

function Panel({
  heading, tag, tagTone, flag, children, note,
}: {
  heading: string; tag?: string; tagTone?: string; flag?: boolean;
  children: React.ReactNode; note?: string;
}) {
  return (
    <Card
      className={`desk gap-0 overflow-hidden rounded-[3px] p-0 ${flag ? 'border-[var(--brand-line)]' : ''}`}
    >
      <div className="flex items-center justify-between gap-3 border-b px-4 py-[11px]">
        <span className={`eyebrow ${flag ? 'text-[var(--brand)]' : ''}`}>{heading}</span>
        {tag ? <Chip label={tag} tone={tagTone} /> : null}
      </div>
      {children}
      {note ? <Note html={note} /> : null}
    </Card>
  );
}

function cell(c: Cell, i: number) {
  if (typeof c === 'object' && 'chip' in c) {
    return (
      <TableCell key={i} className="px-4 py-[11px]">
        <Chip label={c.chip} tone={c.tone} />
      </TableCell>
    );
  }
  const value = typeof c === 'object' ? c.v : c;
  const cls = typeof c === 'object' ? c.cls ?? '' : '';
  return (
    <TableCell
      key={i}
      className={`px-4 py-[11px] whitespace-nowrap tabular-nums ${
        cls.includes('id') ? 'font-mono text-[12px] text-[var(--ink)]' : ''
      } ${cls.includes('strong') ? 'font-medium text-[var(--ink)]' : ''} ${
        cls.includes('ok') ? 'text-[var(--pos)]' : ''
      } ${cls.includes('bad') ? 'text-[var(--neg)]' : ''} ${
        cls.includes('dim') ? 'text-[var(--muted-ink)]' : ''
      }`}
    >
      {value}
    </TableCell>
  );
}

export function BlockView({ block }: { block: Block }) {
  if (block.t === 'tiles') {
    return (
      <Card className="desk grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-0 overflow-hidden rounded-[3px] p-0">
        {block.items.map(([label, value, tone, note]) => (
          <div key={label} className="border-r px-[18px] py-4 last:border-r-0">
            <span className="eyebrow mb-[7px] block">{label}</span>
            <Figure value={value} tone={tone} />
            {note ? (
              <span className="mt-[5px] block text-[11.5px] leading-snug text-[var(--muted-ink)]">
                {note}
              </span>
            ) : null}
          </div>
        ))}
      </Card>
    );
  }

  if (block.t === 'table') {
    return (
      <Panel heading={block.h} tag={block.tag} tagTone={block.tagTone} flag={block.flag} note={block.note}>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {block.head.map((h) => (
                  <TableHead key={h} className="eyebrow h-auto px-4 py-[9px] whitespace-nowrap">
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {block.rows.map((row, i) => (
                <TableRow key={i} className="hover:bg-transparent">
                  {row.map(cell)}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Panel>
    );
  }

  if (block.t === 'kv') {
    return (
      <Panel heading={block.h} flag={block.flag} note={block.note}>
        <div className="flex flex-col">
          {block.rows.map(([label, value, tone]) => (
            <div
              key={label}
              className="flex items-center justify-between gap-4 border-b px-4 py-[10px] text-[13.5px] last:border-b-0"
            >
              <span className="text-[var(--muted-ink)]">{label}</span>
              <span className={`text-right tabular-nums text-[var(--ink)] tone-${tone ?? ''}`}>
                {value}
              </span>
            </div>
          ))}
        </div>
      </Panel>
    );
  }

  if (block.t === 'feed') {
    return (
      <Panel heading={block.h}>
        <div className="flex flex-col">
          {block.items.map(([when, text, tone], i) => (
            <div key={i} className={`feed-row ${tone ?? ''}`}>
              <span className="feed-when">{when}</span>
              <span className="feed-dot" />
              <Rich className="feed-text" html={text} />
            </div>
          ))}
        </div>
      </Panel>
    );
  }

  return (
    <Panel heading={block.h}>
      <div className="px-4 py-[34px] text-center text-[13.5px] leading-relaxed text-[var(--muted-ink)]">
        <b className="mb-[3px] block text-[14.5px] font-medium text-[var(--ink-2)]">{block.title}</b>
        {block.text}
      </div>
    </Panel>
  );
}
