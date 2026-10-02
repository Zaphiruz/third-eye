import type { ReactElement, ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getHexagram, getRune, getTarotCard, type IChingData, type RuneData, type TarotData } from '@third-eye/divination';
import type { FortuneDto } from '@third-eye/shared';
import { FortuneView } from '@third-eye/ui';
import { SHARE_CSS } from './generated/share-css.js';
import type { PublicShare } from './service.js';

const noon = (date: string) => new Date(`${date}T12:00:00Z`);
const longDate = (date: string) =>
  noon(date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
const shortDate = (date: string) =>
  noon(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

/** "The Tower (reversed), Ace of Cups, Knight of Swords · Ansuz · Hexagram 23: Splitting Apart" */
export function shareDescription(fortune: FortuneDto): string {
  const parts: string[] = [];
  for (const r of fortune.results) {
    if (r.method === 'TAROT') {
      parts.push((r.data as TarotData).cards
        .map((c) => `${getTarotCard(c.id).name}${c.reversed ? ' (reversed)' : ''}`).join(', '));
    } else if (r.method === 'RUNE') {
      const d = r.data as RuneData;
      parts.push(`${getRune(d.id).name}${d.reversed ? ' (reversed)' : ''}`);
    } else if (r.method === 'ICHING') {
      const n = (r.data as IChingData).primary;
      parts.push(`Hexagram ${n}: ${getHexagram(n).name}`);
    }
  }
  return parts.join(' · ');
}

export function Page({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex" />
        <meta name="theme-color" content="#0a0918" />
        <title>{title}</title>
        {description && <meta name="description" content={description} />}
        <meta property="og:title" content={title} />
        {description && <meta property="og:description" content={description} />}
        <meta property="og:site_name" content="Third Eye" />
        <meta property="og:type" content="article" />
        <meta name="twitter:card" content="summary" />
        <style dangerouslySetInnerHTML={{ __html: SHARE_CSS }} />
      </head>
      <body>
        <main className="mx-auto max-w-lg px-4 py-8">
          <p className="text-center font-display text-2xl text-gold-soft">Third Eye</p>
          {children}
          <footer className="mt-10 text-center text-xs text-mist/40">Third Eye — for reflection and entertainment.</footer>
        </main>
      </body>
    </html>
  );
}

export const doc = (el: ReactElement) => `<!doctype html>${renderToStaticMarkup(el)}`;

export function renderSharePage(share: PublicShare): string {
  const { fortune, sharedByName } = share;
  return doc(
    <Page title={`${sharedByName}'s fortune — ${shortDate(fortune.date)}`} description={shareDescription(fortune)}>
      <header className="mb-6 mt-4 text-center">
        <p className="text-sm uppercase tracking-[0.3em] text-mist/50">{longDate(fortune.date)}</p>
        <h1 className="mt-1 text-3xl">Shared by {sharedByName}</h1>
      </header>
      <FortuneView fortune={fortune} />
    </Page>,
  );
}

export function renderNotFoundPage(): string {
  return doc(
    <Page title="Third Eye">
      <section className="card mt-10 text-center">
        <h1 className="text-3xl">This link is no longer active</h1>
        <p className="mt-3 text-mist/70">The person who shared it may have stopped sharing.</p>
      </section>
    </Page>,
  );
}

export function renderErrorPage(): string {
  return doc(
    <Page title="Third Eye">
      <section className="card mt-10 text-center">
        <h1 className="text-3xl">The oracle is resting</h1>
        <p className="mt-3 text-mist/70">Something went wrong on our side — please try again later.</p>
      </section>
    </Page>,
  );
}
