import type { Metadata } from "next";
import Link from "next/link";
import { Cookie, ChevronRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Cookie Policy — RomX",
  description: "Learn how RomX uses cookies and similar tracking technologies.",
  robots: { index: true, follow: true },
};

export default function CookiePolicyPage() {
  const lastUpdated = "March 2026";

  return (
    <div className="min-h-screen px-4 py-10 max-w-3xl mx-auto">
      <nav className="flex items-center gap-1 text-xs text-[var(--text-muted)] mb-8">
        <Link href="/" className="hover:text-[var(--primary)] transition-colors">Home</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-[var(--text-primary)]">Cookie Policy</span>
      </nav>

      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-[var(--primary-dim)] flex items-center justify-center">
          <Cookie className="w-5 h-5 text-[var(--primary)]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Cookie Policy</h1>
          <p className="text-sm text-[var(--text-muted)]">Last updated: {lastUpdated}</p>
        </div>
      </div>

      <div className="prose prose-invert max-w-none space-y-8 text-[var(--text-secondary)] text-sm leading-relaxed">

        <section>
          <p>
            This Cookie Policy explains how <strong className="text-[var(--text-primary)]">RomX</strong> uses cookies and
            similar technologies to recognize you when you visit our platform.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">1. What Are Cookies?</h2>
          <p>Cookies are small text files placed on your device when you visit a website. They are widely used to make websites work efficiently and to provide reporting information to the site owners.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">2. Types of Cookies We Use</h2>

          <h3 className="text-base font-semibold text-[var(--text-primary)] mt-4 mb-2">Essential Cookies</h3>
          <p>Required for the platform to function. These include authentication tokens (Firebase Auth) and session management. You cannot opt out of these cookies.</p>

          <h3 className="text-base font-semibold text-[var(--text-primary)] mt-4 mb-2">Preferences Cookies</h3>
          <p>Store your settings such as theme (dark/light mode), language preference, and background style. These improve your experience but are not strictly necessary.</p>

          <h3 className="text-base font-semibold text-[var(--text-primary)] mt-4 mb-2">Analytics Cookies</h3>
          <p>Help us understand how visitors interact with the platform. We may use services like Google Analytics to collect anonymized usage data including pages visited, time spent, and referral sources.</p>

          <h3 className="text-base font-semibold text-[var(--text-primary)] mt-4 mb-2">Advertising Cookies</h3>
          <p>Used by <strong className="text-[var(--text-primary)]">Google AdSense</strong> and its partners to deliver relevant advertisements based on your browsing history. These cookies track your activity across websites to serve personalized ads.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">3. Third-Party Cookies</h2>
          <p className="mb-3">The following third-party services may set cookies on your device:</p>
          <ul className="list-disc list-inside space-y-2 ms-2">
            <li><strong className="text-[var(--text-primary)]">Google AdSense:</strong> Advertising cookies for personalized ads.</li>
            <li><strong className="text-[var(--text-primary)]">Google Analytics:</strong> Analytics cookies for usage data.</li>
            <li><strong className="text-[var(--text-primary)]">Firebase:</strong> Authentication and session management.</li>
            <li><strong className="text-[var(--text-primary)]">Cloudinary:</strong> Image delivery optimization.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">4. Managing Cookies</h2>
          <p className="mb-3">You can manage cookies through your browser settings:</p>
          <ul className="list-disc list-inside space-y-2 ms-2">
            <li><strong className="text-[var(--text-primary)]">Chrome:</strong> Settings → Privacy and Security → Cookies</li>
            <li><strong className="text-[var(--text-primary)]">Firefox:</strong> Preferences → Privacy & Security → Cookies</li>
            <li><strong className="text-[var(--text-primary)]">Safari:</strong> Preferences → Privacy → Cookies</li>
            <li><strong className="text-[var(--text-primary)]">Edge:</strong> Settings → Cookies and Site Permissions</li>
          </ul>
          <p className="mt-3">You can also opt out of personalized advertising by visiting <a href="https://www.google.com/settings/ads" target="_blank" rel="noopener noreferrer" className="text-[var(--primary)] hover:underline">Google Ads Settings</a>.</p>
          <p className="mt-2">Please note that disabling certain cookies may affect the functionality of the platform.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">5. Updates</h2>
          <p>We may update this Cookie Policy from time to time. Changes will be posted on this page with a revised date.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">6. Contact</h2>
          <p>Questions about our use of cookies? <Link href="/contact" className="text-[var(--primary)] hover:underline">Contact us</Link>.</p>
        </section>

      </div>
    </div>
  );
}
