/** Colour only — a tone never changes what a value means, just how it reads. */
export type Tone = 'ok' | 'bad' | 'hot' | 'idle' | 'pos' | 'neg' | 'dim' | 'm' | '';

export type TileItem = [label: string, value: string, tone?: string, note?: string];
export type KvRow = [label: string, value: string, tone?: string];
export type FeedItem = [when: string, text: string, tone?: string];

/**
 * One table cell: plain text, text carrying a tone, or a status chip.
 */
export type Cell = string | { v: string; cls?: string } | { chip: string; tone?: string };

export interface TilesBlock {
  t: 'tiles';
  items: TileItem[];
}

export interface TableBlock {
  t: 'table';
  h: string;
  flag?: boolean;
  tag?: string;
  tagTone?: string;
  head: string[];
  rows: Cell[][];
  note?: string;
}

export interface KvBlock {
  t: 'kv';
  h: string;
  flag?: boolean;
  rows: KvRow[];
  note?: string;
}

export interface FeedBlock {
  t: 'feed';
  h: string;
  items: FeedItem[];
}

export interface EmptyBlock {
  t: 'empty';
  h: string;
  title: string;
  text: string;
}

export type Block = TilesBlock | TableBlock | KvBlock | FeedBlock | EmptyBlock;

/** One entry in the portal sidebar. `id` keys into every stage's `sections`. */
export interface NavItem {
  id: string;
  label: string;
  sub: string;
}

/**
 * One moment in the life of the deal, holding what every section shows at that
 * moment. The demo timeline moves between these; nothing else changes them.
 */
export interface Stage {
  day: string;
  label: string;
  counts?: Record<string, number>;
  sections: Record<string, Block[]>;
}
