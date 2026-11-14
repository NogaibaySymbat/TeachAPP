import Link from "next/link";

export default function NotFound() {
  return <section className="empty-state"><h1>This page is not here.</h1><p>Return to your study space to choose a topic.</p><Link href="/">Back to topics</Link></section>;
}
