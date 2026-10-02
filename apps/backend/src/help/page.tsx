import { METHOD_INFO, METHOD_LABELS, METHODS } from '@third-eye/divination';
import { doc, Page } from '../shares/page.js';
import { METHOD_GUIDES } from './content.js';

const link = 'text-gold underline-offset-2 hover:underline';

export function renderHowItWorksPage(): string {
  return doc(
    <Page title="How readings work — Third Eye"
      description="How Third Eye draws, calculates and interprets each daily reading, and what each tradition means.">
      <header className="mb-6 mt-4 text-center">
        <h1 className="text-3xl">How readings work</h1>
        <p className="mt-2 text-sm"><a className={link} href="/">Open Third Eye</a></p>
      </header>
      <div className="grid gap-5 leading-relaxed">
        <section id="how" className="card grid gap-3">
          <h2 className="text-2xl">How a reading is made</h2>
          <p>Once a day, Third Eye draws your tarot cards, rune and I Ching hexagram on the server with cryptographic randomness. The sky, your signs and your numbers are calculated rather than drawn.</p>
          <p>Then the oracle — Claude, an AI by Anthropic — writes your reading in the voice you chose. It sees only those results and must interpret them as they are: it can't change a card, add a rune or move a planet.</p>
          <p>You get one reading per day, dated in your own time zone. Come back tomorrow for the next.</p>
        </section>
        <section id="privacy" className="card grid gap-3">
          <h2 className="text-2xl">What's shared with the AI, and what's stored</h2>
          <p>The oracle receives your results and your first name — nothing else. Your birth date, full name, time zone and email are never sent to it.</p>
          <p>Your readings are stored so History works. A reading is only visible to someone else if you create a share link, and you can stop sharing at any time.</p>
        </section>
        <h2 className="mt-4 text-center text-2xl">The methods</h2>
        {METHODS.map((m) => (
          <section key={m} id={m.toLowerCase()} className="card grid gap-3">
            <h3 className="text-2xl">{METHOD_LABELS[m]}</h3>
            {METHOD_GUIDES[m]}
            <p><a className={link} href={METHOD_INFO[m].learnMoreUrl} target="_blank" rel="noopener noreferrer">{METHOD_INFO[m].learnMoreLabel} on Wikipedia ↗</a></p>
          </section>
        ))}
        <p className="text-center text-mist/70">For reflection and entertainment — not advice.</p>
      </div>
    </Page>,
  );
}
