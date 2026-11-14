import type { Metadata } from "next";
import { Pricing } from "@/components/pricing";

export const metadata: Metadata = {
  title: "Pricing · TeachAPP",
  description: "Start free, then get an Exam Pass that lasts until exam day. Payments are not live yet.",
};

export default function PricingPage() {
  return <Pricing />;
}
