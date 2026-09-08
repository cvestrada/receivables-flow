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
    <div className="panel-note border-t bg-[var(--surface-alt)] px-5 py-3.5 text-[14px] leading-relaxed text-[var(--muted)]">
      <Rich html={html} />
    </div>
  );
}

/*
 * The panel heading is sentence case at 16px/600, not an uppercase eyebrow. Uppercase
 * is rationed to the sidebar's section label, a stat's caption, and a table column
 * header — spending it on every panel would flatten that distinction and make the
 * page read as one long run of labels.
 */
function Panel({
  heading, tag, tagTone, flag, children, note,
}: {
  heading: string; tag?: string; tagTone?: string; flag?: boolean;
  children: React.ReactNode; note?: string;
}) {
  return (
    <section className={`desk overflow-hidden ${flag ? 'border-[var(--accent)]' : ''}`}>
      <div className="flex items-center justify-between gap-3 border-b px-5 py-3.5">
        <h3 className="text-[16px] font-semibold text-[var(--ink)]">{heading}</h3>
        {tag ? <Chip label={tag} tone={tagTone} /> : null}
      </div>
      {children}
      {note ? <Note html={note} /> : null}
    </section>
  );
}

function cell(c: Cell, i: number) {
  if (typeof c === 'object' && 'chip' in c) {
    return (
      <TableCell key={i} className="px-5 py-3">
        <Chip label={c.chip} tone={c.tone} />
      </TableCell>
    );
  }
  const value = typeof c === 'object' ? c.v : c;
  const cls = typeof c === 'object' ? c.cls ?? '' : '';
  return (
    <TableCell
      key={i}
      className={`px-5 py-3 text-[15px] whitespace-nowrap tabular-nums text-[var(--body)] ${
        cls.includes('id') ? 'text-[14px] text-[var(--body)]' : ''
      } ${cls.includes('strong') ? 'font-medium text-[var(--ink)]' : ''} ${
        cls.includes('ok') ? 'text-[var(--pos-ink)]' : ''
      } ${cls.includes('bad') ? 'text-[var(--neg-ink)]' : ''} ${
        cls.includes('dim') ? 'text-[var(--muted)]' : ''
      }`}
    >
      {value}
    </TableCell>
  );
}

export function BlockView({ block }: { block: Block }) {
  /*
   * Stat cards are separate surfaces on a grid, not one panel subdivided by rules.
   */
  if (block.t === 'tiles') {
    return (
      <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-4">
        {block.items.map(([label, value, tone, note]) => (
          <div key={label} className="desk px-[18px] py-4">
            <span className="eyebrow block">{label}</span>
            <Figure value={value} tone={tone} />
            {note ? (
              <span className="mt-1 block text-[15px] leading-snug text-[var(--body)]">{note}</span>
            ) : null}
          </div>
        ))}
      </div>
    );
  }

  if (block.t === 'table') {
    return (
      <Panel heading={block.h} tag={block.tag} tagTone={block.tagTone} flag={block.flag} note={block.note}>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-[var(--surface-alt)] hover:bg-[var(--surface-alt)]">
                {block.head.map((h) => (
                  <TableHead
                    key={h}
                    className="h-auto px-5 py-2.5 text-[13px] font-medium tracking-[.08em] whitespace-nowrap uppercase text-[var(--muted)]"
                  >
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {block.rows.map((row, i) => (
                <TableRow key={i} className="hover:bg-[var(--surface-alt)]">
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
              className="flex items-center justify-between gap-4 border-b px-5 py-3 text-[15px] last:border-b-0"
            >
              <span className="text-[var(--muted)]">{label}</span>
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
      <div className="px-5 py-10 text-center text-[15px] leading-relaxed text-[var(--muted)]">
        <b className="mb-1 block text-[16px] font-semibold text-[var(--ink)]">{block.title}</b>
        {block.text}
      </div>
    </Panel>
  );
}
