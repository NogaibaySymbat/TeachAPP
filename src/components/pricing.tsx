import Link from "next/link";

// Pricing preview. Payments are not connected: paid actions stay disabled and
// say so, and nothing on this page is locked behind a plan.

interface Plan {
  id: string;
  name: string;
  price: string;
  period: string;
  summary: string;
  features: string[];
  featured?: boolean;
  badge?: string;
}

const plans: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "forever",
    summary: "Try the method on your weakest topic.",
    features: [
      "3 teach-and-exam cycles a week",
      "A notebook built from your own words",
      "Your student's practice exam with a debrief",
      "Your browser's voice for the student",
    ],
  },
  {
    id: "exam-pass",
    name: "Exam Pass",
    price: "$29",
    period: "for 90 days",
    summary: "One payment that covers a typical PMP preparation.",
    featured: true,
    badge: "Best value",
    features: [
      "Unlimited explanations and retakes",
      "Every topic added during your 90 days",
      "A natural cloud voice for your student",
      "Attempt comparison and session export",
      "One payment, no automatic renewal",
    ],
  },
  {
    id: "monthly",
    name: "Monthly",
    price: "$12",
    period: "per month",
    summary: "The same access, month to month. Cancel anytime.",
    features: [
      "Everything in Exam Pass",
      "Good for a final month before the exam",
      "Three months cost more than the Exam Pass",
    ],
  },
];

const fit = [
  { label: "Your course", value: "Teaches you the material" },
  { label: "Your question bank", value: "Shows which questions you miss" },
  { label: "TeachAPP", value: "Shows which idea you can't explain yet", highlight: true },
];

const questions = [
  {
    q: "Can I pay now?",
    a: "Not yet. Payments are not connected while TeachAPP is in preview, so every feature is free for now and nothing on this page charges you. The plans apply after launch.",
  },
  {
    q: "Does this replace my prep course or question bank?",
    a: "No. Use it alongside them: when a practice block goes badly, explain that topic to your student and see which idea is missing from your explanation.",
  },
  {
    q: "How many topics are there?",
    a: "Four PMP topics today, each with original practice questions. More are being written, and the Exam Pass includes every topic added during your 90 days. This is not an official PMP exam.",
  },
  {
    q: "Why is the natural voice in the paid plans?",
    a: "The cloud voice is the most expensive part of a session to run. The free plan uses the voice your browser provides.",
  },
  {
    q: "What happens after 90 days?",
    a: "The Exam Pass simply ends. There is no automatic renewal; your saved sessions stay in this browser.",
  },
];

function CheckIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>;
}

export function Pricing() {
  return (
    <div className="pricing">
      <section className="intro pricing-intro">
        <span className="pricing-chip">Pricing preview</span>
        <h1>Pay once for exam prep,<br /><span>not another subscription.</span></h1>
        <p>TeachAPP works alongside your course and question bank. Start free, then get a pass that lasts until exam day.</p>
        <p className="notice pricing-notice" id="payments-status" role="note">Payments are not live yet. Every feature is free while TeachAPP is in preview; the plans below apply after launch.</p>
      </section>

      <section className="pricing-plans" aria-labelledby="plans-title">
        <h2 id="plans-title" className="sr-only">Plans</h2>
        <ul className="pricing-grid">
          {plans.map((plan) => (
            <li key={plan.id} className={`plan-card${plan.featured ? " is-featured" : ""}`} aria-labelledby={`plan-${plan.id}`}>
              <div className="plan-heading">
                <h3 id={`plan-${plan.id}`}>{plan.name}</h3>
                {plan.badge && <span className="plan-badge">{plan.badge}</span>}
              </div>
              <p className="plan-price"><strong>{plan.price}</strong> <span>{plan.period}</span></p>
              <p className="plan-summary">{plan.summary}</p>
              <ul className="plan-features">
                {plan.features.map((feature) => <li key={feature}><CheckIcon />{feature}</li>)}
              </ul>
              {plan.id === "free"
                ? <Link className="plan-action" href="/">Start teaching<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg></Link>
                : <button className="plan-action" disabled aria-describedby="payments-status">Payments coming soon</button>}
            </li>
          ))}
        </ul>
      </section>

      <div className="pricing-details">
        <section className="pricing-compare" aria-labelledby="compare-title">
          <h2 id="compare-title">How it fits your prep</h2>
          <p>Keep what already works. TeachAPP covers the part they don&apos;t.</p>
          <dl>
            {fit.map((row) => (
              <div key={row.label} className={row.highlight ? "is-highlight" : undefined}>
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="pricing-faq" aria-labelledby="faq-title">
          <h2 id="faq-title">Questions</h2>
          {questions.map((item) => (
            <details key={item.q}>
              <summary>{item.q}<svg className="faq-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></summary>
              <p>{item.a}</p>
            </details>
          ))}
        </section>
      </div>
    </div>
  );
}
