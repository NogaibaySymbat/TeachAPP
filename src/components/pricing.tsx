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
    period: "to start",
    summary: "Try the method on a real topic before you decide.",
    features: [
      "3 full teach-and-exam cycles",
      "A notebook built from your own words",
      "Your student's practice exam with a debrief",
      "Your browser's voice for the student",
    ],
  },
  {
    id: "exam-pass",
    name: "Exam Pass",
    price: "$59",
    period: "for 90 days",
    summary: "One payment that lasts through a typical PMP preparation.",
    featured: true,
    badge: "Best for exam prep",
    features: [
      "Every topic, unlimited retakes",
      "A natural cloud voice for your student",
      "Attempt comparison and session export",
      "One payment, no automatic renewal",
    ],
  },
  {
    id: "monthly",
    name: "Monthly",
    price: "$19",
    period: "per month",
    summary: "The same access, month to month. Cancel anytime.",
    features: [
      "Everything in Exam Pass",
      "Pay only for the months you study",
      "Switch to Exam Pass at any time",
    ],
  },
];

const comparison = [
  { label: "PMP prep courses", value: "$250–4,000", note: "self-paced to bootcamp" },
  { label: "Study apps", value: "$9–30", note: "per month" },
  { label: "TeachAPP Exam Pass", value: "$59", note: "once, for 90 days", highlight: true },
];

const questions = [
  {
    q: "Can I pay now?",
    a: "Not yet. Payments are not connected while TeachAPP is in preview, so every feature is free for now. Nothing on this page charges you.",
  },
  {
    q: "Is this the official PMP exam?",
    a: "No. The practice questions are original, and your student's score shows how well you taught a topic. It is not a prediction of your real exam result.",
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
        <h1>Pay for your exam,<br /><span>not another subscription.</span></h1>
        <p>Preparing for the PMP takes a few months. Start free, then choose a pass that lasts until exam day.</p>
        <p className="notice pricing-notice" id="payments-status" role="note">Payments are not live yet. Every feature is free while TeachAPP is in preview.</p>
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
          <h2 id="compare-title">How it compares</h2>
          <p>Typical 2026 prices for PMP preparation.</p>
          <dl>
            {comparison.map((row) => (
              <div key={row.label} className={row.highlight ? "is-highlight" : undefined}>
                <dt>{row.label}</dt>
                <dd><strong>{row.value}</strong> <span>{row.note}</span></dd>
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
