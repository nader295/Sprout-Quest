import type { Metadata } from "next";
import Link from "next/link";
import { FileText, ChevronRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Terms of Service — RomX",
  description: "Read the terms and conditions governing your use of the RomX platform.",
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  const lastUpdated = "March 2026";

  return (
    <div className="min-h-screen px-4 py-10 max-w-3xl mx-auto">
      <nav className="flex items-center gap-1 text-xs text-[var(--text-muted)] mb-8">
        <Link href="/" className="hover:text-[var(--primary)] transition-colors">Home</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-[var(--text-primary)]">Terms of Service</span>
      </nav>

      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-[var(--primary-dim)] flex items-center justify-center">
          <FileText className="w-5 h-5 text-[var(--primary)]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Terms of Service</h1>
          <p className="text-sm text-[var(--text-muted)]">Last updated: {lastUpdated}</p>
        </div>
      </div>

      <div className="prose prose-invert max-w-none space-y-8 text-[var(--text-secondary)] text-sm leading-relaxed">

        <section>
          <p>
            Welcome to <strong className="text-[var(--text-primary)]">RomX</strong> (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;).
            By accessing or using our platform at <strong className="text-[var(--text-primary)]">rom-x.vercel.app</strong> (the &quot;Service&quot;),
            you agree to comply with and be bound by these Terms of Service. If you do not agree, please do not use the Service.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">1. Eligibility</h2>
          <p>You must be at least 13 years old to use RomX. By creating an account, you represent that you meet this requirement. Users under 18 should obtain parental consent before using the Service.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">2. Account Responsibilities</h2>
          <ul className="list-disc list-inside space-y-2 ms-2">
            <li>You are responsible for maintaining the security of your account credentials.</li>
            <li>You agree to provide accurate and complete registration information.</li>
            <li>You may not create multiple accounts or impersonate others.</li>
            <li>We reserve the right to suspend or terminate accounts that violate these Terms.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">3. User-Generated Content</h2>
          <p className="mb-3">By uploading ROMs, kernels, modules, or other content to RomX, you represent and warrant that:</p>
          <ul className="list-disc list-inside space-y-2 ms-2">
            <li>You have the right to distribute the content or it is released under an open-source license.</li>
            <li>Your content does not infringe on any third-party intellectual property rights.</li>
            <li>Your content does not contain malware, spyware, or any malicious code.</li>
            <li>Your content complies with all applicable laws and our <Link href="/rules" className="text-[var(--primary)] hover:underline">Community Rules</Link>.</li>
          </ul>
          <p className="mt-3">We reserve the right to remove any content that violates these Terms without prior notice.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">4. Prohibited Conduct</h2>
          <ul className="list-disc list-inside space-y-2 ms-2">
            <li>Uploading proprietary or copyrighted content without authorization.</li>
            <li>Attempting to manipulate download counts, views, or support actions.</li>
            <li>Using automated tools to scrape, crawl, or spam the platform.</li>
            <li>Harassing, threatening, or abusing other users.</li>
            <li>Circumventing security measures or exploiting vulnerabilities.</li>
            <li>Distributing any form of harmful or illegal content.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">5. Developer Earnings &amp; Ad Support</h2>
          <p className="mb-3">RomX offers a Developer Earnings program for verified developers:</p>
          <ul className="list-disc list-inside space-y-2 ms-2">
            <li>Verified developers receive <strong className="text-[var(--text-primary)]">90%</strong> of ad support revenue; 10% goes to the platform.</li>
            <li>Earnings are estimated and may vary based on ad fill rate, user location, and advertiser demand.</li>
            <li>Minimum payout threshold: <strong className="text-[var(--text-primary)]">$10 USD</strong>.</li>
            <li>Payouts are distributed quarterly.</li>
            <li>Fraudulent activity (e.g., self-support, bot clicks) will result in earnings forfeiture and account suspension.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">6. Advertising</h2>
          <p>RomX displays advertisements through third-party ad networks, including Google AdSense. By using the Service, you consent to the display of advertisements. See our <Link href="/privacy" className="text-[var(--primary)] hover:underline">Privacy Policy</Link> for details on advertising cookies.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">7. Intellectual Property</h2>
          <p>The RomX platform design, branding, and code are owned by us. User-uploaded content remains the property of its respective owners. By uploading content, you grant RomX a non-exclusive, worldwide license to host, display, and distribute your content on the platform.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">8. Disclaimer of Warranties</h2>
          <p>RomX is provided &quot;as is&quot; and &quot;as available&quot; without any warranties, express or implied. We do not guarantee that ROMs or other content on the platform will be compatible with your device, free from defects, or fit for any particular purpose. <strong className="text-[var(--text-primary)]">Flash at your own risk.</strong></p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">9. Limitation of Liability</h2>
          <p>To the maximum extent permitted by law, RomX shall not be liable for any indirect, incidental, special, or consequential damages, including but not limited to device damage, data loss, or bricking resulting from content downloaded from the platform.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">10. DMCA &amp; Copyright</h2>
          <p>We respect intellectual property rights. If you believe content on RomX infringes your copyright, please refer to our <Link href="/dmca" className="text-[var(--primary)] hover:underline">DMCA Policy</Link> for the takedown procedure.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">11. Termination</h2>
          <p>We may suspend or terminate your access to the Service at any time, with or without cause, and with or without notice. Upon termination, your right to use the Service ceases immediately.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">12. Changes to These Terms</h2>
          <p>We reserve the right to modify these Terms at any time. Updates will be posted on this page with a revised &quot;Last updated&quot; date. Continued use of the Service after changes constitutes acceptance.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">13. Contact Us</h2>
          <p>If you have any questions about these Terms, please <Link href="/contact" className="text-[var(--primary)] hover:underline">contact us</Link>.</p>
        </section>

      </div>
    </div>
  );
}
