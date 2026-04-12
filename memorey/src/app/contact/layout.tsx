import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact — Memorey",
  description:
    "Get in touch with the Memorey team. Questions, feedback, bug reports, or partnership inquiries — we'd love to hear from you.",
  openGraph: {
    title: "Contact — Memorey",
    description: "Get in touch with the Memorey team.",
    url: "https://memorey.co/contact",
  },
};

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
