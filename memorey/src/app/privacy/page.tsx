import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Memorey",
  description:
    "How Memorey.ai collects, uses, and safeguards your personal data and Knowledge Infrastructure.",
};

const sections = [
  {
    heading: "1. Information We Collect",
    intro:
      "We collect information that you provide directly to us and information generated through your use of the service.",
    items: [
      [
        "Account Information",
        "Name, email address, and authentication credentials.",
      ],
      [
        "User-Generated Content",
        'Text, notes, documents, and files you upload to your "Vaults" or "Nodes."',
      ],
      [
        "Usage Data",
        "Log files, device information, and IP addresses to ensure sync stability across your devices.",
      ],
      [
        "Billing Information",
        "For premium tiers, we collect payment details via third-party processors (we do not store full credit card numbers on our servers).",
      ],
    ],
  },
  {
    heading: "2. How We Use Your Data",
    intro:
      "We use your data strictly to provide the Memorey.ai service, including:",
    items: [
      [
        "Syncing",
        "Ensuring your knowledge graph is available on any device.",
      ],
      [
        "AI Processing",
        "Routing your data to LLMs to generate insights, structure nodes, and build your knowledge graph.",
      ],
      [
        "Support",
        "Resolving technical issues raised via hey@memorey.co.",
      ],
      [
        "Communication",
        "Sending system updates or responding to your inquiries.",
      ],
    ],
  },
  {
    heading: "3. Data Storage, Security, and Access",
    items: [
      [
        "Cloud Storage",
        "Your data is stored on secure cloud servers to allow multi-device access.",
      ],
      [
        "Encryption",
        "Data is encrypted in transit (using TLS/SSL) and at rest (using industry-standard AES-256 encryption).",
      ],
      [
        "Internal Access",
        "While we have technical access to unencrypted data, this is strictly governed by internal security protocols. Access is granted only for essential customer support and resolution and is audited to prevent misuse.",
      ],
      [
        "No AI Training",
        "We do not use your personal data or uploaded content to train our AI models or any third-party models.",
      ],
    ],
  },
  {
    heading: "4. Third-Party AI Sub-processors",
    intro:
      "To provide AI-powered features, Memorey.ai routes your data to third-party providers, including but not limited to:",
    bullets: [
      "OpenAI (GPT models)",
      "Anthropic (Claude models)",
      "Google (Gemini models)",
    ],
    footer:
      "Your Privacy with AI: We utilize API-based integrations which, under our agreements with these providers, generally prohibit them from using your data to train their global foundational models.",
  },
  {
    heading: "5. User Rights: Erasure and Export",
    intro: "We believe you own your mind and your data.",
    items: [
      [
        "Data Export",
        "You may export your nodes, vaults, and graphs at any time.",
      ],
      [
        "Right to Erasure",
        "You may request the permanent deletion of your account and all associated data by contacting us. Once deleted, this data cannot be recovered.",
      ],
      [
        "Grievance Redressal",
        "For any privacy concerns, you can reach our grievance officer at hey@memorey.co.",
      ],
    ],
  },
  {
    heading: "6. Retention Policy",
    items: [
      [
        "Active Accounts",
        "We retain your data as long as your account is active.",
      ],
      [
        "Downgraded/Inactive Accounts",
        "If you downgrade to a free plan, your existing data remains stored and accessible for export, but creation of new nodes/vaults may be restricted.",
      ],
      [
        "Deleted Accounts",
        "Upon a valid deletion request, data is purged from our active databases within 30 days.",
      ],
    ],
  },
  {
    heading: "7. Global Compliance",
    paragraphs: [
      "As a global service, we acknowledge the data protection laws of various jurisdictions. By using Memorey.ai, you consent to the transfer and processing of your data in the regions where our cloud servers operate.",
    ],
  },
  {
    heading: "8. Changes to This Policy",
    paragraphs: [
      'We may update this policy from time to time. We will notify you of any significant changes by posting the new policy on this page and updating the "Effective Date."',
    ],
  },
] as const;

export default function PrivacyPolicyPage() {
  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: "var(--bg)", color: "var(--text)" }}
    >
      <header
        className="sticky top-0 z-30 flex items-center justify-between border-b px-6 py-4"
        style={{
          backgroundColor: "var(--bg)",
          borderColor: "var(--border)",
        }}
      >
        <Link
          href="/"
          className="flex items-center gap-2 no-underline"
          style={{ color: "var(--text)" }}
        >
          <div
            className="h-2 w-2 rounded-full"
            style={{ background: "var(--orange)" }}
          />
          <span
            className="text-lg font-bold"
            style={{ fontFamily: "var(--font-syne)" }}
          >
            memorey
          </span>
        </Link>

        <Link
          href="/"
          className="text-xs no-underline transition-opacity hover:opacity-80"
          style={{ color: "var(--muted)" }}
        >
          Back to home
        </Link>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-16 pb-24">
        <p
          className="text-xs font-semibold uppercase tracking-[0.12em]"
          style={{ color: "var(--orange)" }}
        >
          Legal
        </p>

        <h1
          className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl"
          style={{ fontFamily: "var(--font-syne)" }}
        >
          Privacy Policy
        </h1>

        <p className="mt-4 text-sm" style={{ color: "var(--muted)" }}>
          Effective Date: April 11, 2026 &middot; Last Updated: April 11,
          2026
        </p>

        <p
          className="mt-8 leading-relaxed"
          style={{ color: "var(--text2, var(--text))", fontSize: 15 }}
        >
          Welcome to Memorey.ai. We are committed to protecting your personal
          data and your &ldquo;Knowledge Infrastructure.&rdquo; This Privacy
          Policy explains how we collect, use, and safeguard your information
          when you use our platform.
        </p>

        <div className="mt-12 space-y-12">
          {sections.map((s) => (
            <section key={s.heading}>
              <h2
                className="text-lg font-semibold tracking-tight"
                style={{ fontFamily: "var(--font-syne)" }}
              >
                {s.heading}
              </h2>

              {"intro" in s && s.intro && (
                <p
                  className="mt-3 text-sm leading-relaxed"
                  style={{ color: "var(--text2, var(--text))" }}
                >
                  {s.intro}
                </p>
              )}

              {"items" in s &&
                s.items && (
                  <dl className="mt-4 space-y-4">
                    {(s.items as readonly (readonly [string, string])[]).map(
                      ([term, desc]) => (
                        <div key={term}>
                          <dt
                            className="text-sm font-medium"
                            style={{ color: "var(--text)" }}
                          >
                            {term}
                          </dt>
                          <dd
                            className="mt-1 text-sm leading-relaxed"
                            style={{ color: "var(--text2, var(--text))" }}
                          >
                            {desc}
                          </dd>
                        </div>
                      ),
                    )}
                  </dl>
                )}

              {"bullets" in s &&
                s.bullets && (
                  <ul
                    className="mt-4 list-disc space-y-1 pl-5 text-sm"
                    style={{ color: "var(--text2, var(--text))" }}
                  >
                    {(s.bullets as readonly string[]).map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                )}

              {"footer" in s && s.footer && (
                <p
                  className="mt-4 text-sm leading-relaxed"
                  style={{ color: "var(--text2, var(--text))" }}
                >
                  {s.footer}
                </p>
              )}

              {"paragraphs" in s &&
                s.paragraphs &&
                (s.paragraphs as readonly string[]).map((p) => (
                  <p
                    key={p}
                    className="mt-3 text-sm leading-relaxed"
                    style={{ color: "var(--text2, var(--text))" }}
                  >
                    {p}
                  </p>
                ))}
            </section>
          ))}
        </div>

        <section
          className="mt-16 rounded-lg border p-6"
          style={{
            borderColor: "var(--border2)",
            background: "var(--bg2)",
          }}
        >
          <h2
            className="text-lg font-semibold tracking-tight"
            style={{ fontFamily: "var(--font-syne)" }}
          >
            Contact Us
          </h2>
          <p
            className="mt-2 text-sm leading-relaxed"
            style={{ color: "var(--text2, var(--text))" }}
          >
            If you have questions about this Privacy Policy, please contact:
          </p>
          <a
            href="mailto:hey@memorey.co"
            className="mt-3 inline-block text-sm font-medium no-underline transition-opacity hover:opacity-80"
            style={{ color: "var(--orange)" }}
          >
            hey@memorey.co
          </a>
        </section>
      </main>
    </div>
  );
}
