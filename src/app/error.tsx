"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <section className="empty-state"><h1>This page could not be loaded.</h1><p>Please try again in a moment.</p><button onClick={reset}>Try again</button></section>;
}
