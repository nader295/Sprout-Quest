import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — RomX",
  description: "Learn how RomX collects, uses, and protects your personal information. Our privacy policy covers cookies, advertising, and your data rights.",
  robots: { index: true, follow: true },
};
import { Shield, ChevronRight } from "lucide-react";

export default function PrivacyPolicyPage() {
  const lastUpdated = "March 2026";

  return (
    <div className="min-h-screen px-4 py-10 max-w-3xl mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-xs text-[var(--text-muted)] mb-8">
        <Link href="/" className="hover:text-[var(--primary)] transition-colors">Home</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-[var(--text-primary)]">Privacy Policy</span>
      </nav>

      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-[var(--primary-dim)] flex items-center justify-center">
          <Shield className="w-5 h-5 text-[var(--primary)]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Privacy Policy</h1>
          <p className="text-sm text-[var(--text-muted)]">Last updated: {lastUpdated}</p>
        </div>
      </div>

      <div className="prose prose-invert max-w-none space-y-8 text-[var(--text-secondary)] text-sm leading-relaxed">

        <section>
          <p>
            Welcome to <strong className="text-[var(--text-primary)]">RomX</strong> ("we," "our," or "us").
            We operate the website <strong className="text-[var(--text-primary)]">rom-x.vercel.app</strong> (the "Service").
            This Privacy Policy explains how we collect, use, disclose, and safeguard your information
            when you visit our platform. Please read it carefully.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">1. Information We Collect</h2>
          <p className="mb-3">We may collect the following types of information:</p>
          <ul className="list-disc list-inside space-y-2 ms-2">
            <li><strong className="text-[var(--text-primary)]">Account information:</strong> When you register, we collect your email address, display name, and profile picture.</li>
            <li><strong className="text-[var(--text-primary)]">Usage data:</strong> Pages visited, features used, device type, browser type, IP address, and referring URLs.</li>
            <li><strong className="text-[var(--text-primary)]">User-generated content:</strong> ROMs, comments, reviews, and other content you submit to the platform.</li>
            <li><strong className="text-[var(--text-primary)]">Communications:</strong> Messages you send us via contact forms or support channels.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">2. How We Use Your Information</h2>
          <ul className="list-disc list-inside space-y-2 ms-2">
            <li>To provide, operate, and maintain our Service</li>
            <li>To improve and personalize your experience</li>
            <li>To send you notifications about activity relevant to your account</li>
            <li>To detect and prevent fraudulent or abusive activity</li>
            <li>To comply with legal obligations</li>
            <li>To display relevant advertisements through third-party ad networks</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">3. Cookies &amp; Tracking Technologies</h2>
          <p className="mb-3">
            We use cookies and similar tracking technologies to track activity on our Service and hold certain information.
            Cookies are small data files stored on your device.
          </p>
          <p className="mb-3">We use the following types of cookies:</p>
          <ul className="list-disc list-inside space-y-2 ms-2">
            <li><strong className="text-[var(--text-primary)]">Essential cookies:</strong> Required for the Service to function properly (authentication, preferences).</li>
            <li><strong className="text-[var(--text-primary)]">Analytics cookies:</strong> Help us understand how visitors interact with our Service (e.g., Google Analytics).</li>
            <li><strong className="text-[var(--text-primary)]">Advertising cookies:</strong> Used to deliver relevant advertisements and track ad performance.</li>
          </ul>
          <p className="mt-3">
            You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent.
            However, if you do not accept cookies, some portions of our Service may not function properly.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">4. Google AdSense &amp; Third-Party Advertising</h2>
          <p className="mb-3">
            We use <strong className="text-[var(--text-primary)]">Google AdSense</strong> to display advertisements on our Service.
            Google AdSense uses cookies to serve ads based on your prior visits to our website or other websites.
          </p>
          <p className="mb-3">
            Google's use of advertising cookies enables it and its partners to serve ads based on your visits
            to our site and/or other sites on the Internet. You may opt out of personalized advertising by
            visiting <a href="https://www.google.com/settings/ads" target="_blank" rel="noopener noreferrer"
              className="text-[var(--primary)] hover:underline">Google Ads Settings</a>.
          </p>
          <p>
            For more information about how Google uses data from sites that use Google products, visit:{" "}
            <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener noreferrer"
              className="text-[var(--primary)] hover:underline">
              https://policies.google.com/technologies/partner-sites
            </a>
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">5. Sharing Your Information</h2>
          <p className="mb-3">We do not sell your personal information. We may share your data with:</p>
          <ul className="list-disc list-inside space-y-2 ms-2">
            <li><strong className="text-[var(--text-primary)]">Service providers:</strong> Third-party vendors who assist in operating our platform (e.g., Firebase, Supabase, Cloudinary).</li>
            <li><strong className="text-[var(--text-primary)]">Advertising partners:</strong> Google AdSense and other networks as described in Section 4.</li>
            <li><strong className="text-[var(--text-primary)]">Legal compliance:</strong> When required by law or to protect our rights and users' safety.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">6. Data Retention</h2>
          <p>
            We retain your personal information for as long as your account is active or as needed to provide
            you with our services. You may request deletion of your account and associated data at any time
            by contacting us.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">7. Security</h2>
          <p>
            We implement reasonable technical and organizational measures to protect your information.
            However, no method of transmission over the Internet or electronic storage is 100% secure,
            and we cannot guarantee absolute security.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">8. Children's Privacy</h2>
          <p>
            Our Service is not directed to children under the age of 13. We do not knowingly collect
            personally identifiable information from children under 13. If you believe we have inadvertently
            collected such information, please contact us immediately so we can delete it.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">9. Your Rights</h2>
          <p className="mb-3">Depending on your location, you may have the right to:</p>
          <ul className="list-disc list-inside space-y-2 ms-2">
            <li>Access the personal information we hold about you</li>
            <li>Request correction or deletion of your personal information</li>
            <li>Object to or restrict processing of your data</li>
            <li>Data portability</li>
            <li>Withdraw consent at any time (where processing is based on consent)</li>
          </ul>
          <p className="mt-3">To exercise these rights, please contact us at the details below.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">10. Third-Party Links</h2>
          <p>
            Our Service may contain links to third-party websites (such as ROM download sources or developer
            profiles on external platforms). We are not responsible for the privacy practices of those sites
            and encourage you to review their privacy policies.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">11. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify you of any changes by posting
            the new policy on this page and updating the "Last updated" date. We encourage you to review
            this page periodically.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">12. Contact Us</h2>
          <p className="mb-3">If you have any questions about this Privacy Policy, please contact us:</p>
          <ul className="list-disc list-inside space-y-2 ms-2">
            <li>Via our <Link href="/contact" className="text-[var(--primary)] hover:underline">Contact Page</Link></li>
            <li>By visiting <strong className="text-[var(--text-primary)]">rom-x.vercel.app/contact</strong></li>
          </ul>
        </section>

      </div>
    </div>
  );
}
