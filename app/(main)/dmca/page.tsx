import type { Metadata } from "next";
import Link from "next/link";
import { Scale, ChevronRight } from "lucide-react";

export const metadata: Metadata = {
  title: "DMCA Policy — RomX",
  description: "RomX DMCA and copyright takedown policy. Learn how to report copyright infringement.",
  robots: { index: true, follow: true },
};

export default function DMCAPage() {
  const lastUpdated = "March 2026";

  return (
    <div className="min-h-screen px-4 py-10 max-w-3xl mx-auto">
      <nav className="flex items-center gap-1 text-xs text-[var(--text-muted)] mb-8">
        <Link href="/" className="hover:text-[var(--primary)] transition-colors">Home</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-[var(--text-primary)]">DMCA Policy</span>
      </nav>

      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-[var(--primary-dim)] flex items-center justify-center">
          <Scale className="w-5 h-5 text-[var(--primary)]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">DMCA &amp; Copyright Policy</h1>
          <p className="text-sm text-[var(--text-muted)]">Last updated: {lastUpdated}</p>
        </div>
      </div>

      <div className="prose prose-invert max-w-none space-y-8 text-[var(--text-secondary)] text-sm leading-relaxed">

        <section>
          <p>
            <strong className="text-[var(--text-primary)]">RomX</strong> respects the intellectual property rights of others
            and expects users of the platform to do the same. We comply with the Digital Millennium Copyright Act (DMCA)
            and will respond to valid takedown notices.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">1. Reporting Copyright Infringement</h2>
          <p className="mb-3">If you believe that content on RomX infringes your copyright, please submit a DMCA takedown notice containing the following information:</p>
          <ul className="list-disc list-inside space-y-2 ms-2">
            <li>A description of the copyrighted work that you claim has been infringed.</li>
            <li>The URL(s) of the infringing content on RomX.</li>
            <li>Your name, email address, and physical address.</li>
            <li>A statement that you have a good faith belief that the use is not authorized by the copyright owner.</li>
            <li>A statement, under penalty of perjury, that the information in your notice is accurate and that you are the copyright owner or authorized to act on behalf of the owner.</li>
            <li>Your physical or electronic signature.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">2. Where to Send Notices</h2>
          <p>Please submit DMCA takedown notices through our <Link href="/contact" className="text-[var(--primary)] hover:underline">Contact Page</Link> or by emailing us with the subject line &quot;DMCA Takedown Notice&quot;.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">3. Counter-Notification</h2>
          <p className="mb-3">If you believe your content was wrongly removed due to a DMCA notice, you may submit a counter-notification containing:</p>
          <ul className="list-disc list-inside space-y-2 ms-2">
            <li>Identification of the content that was removed and where it appeared.</li>
            <li>A statement under penalty of perjury that you have a good faith belief the content was removed in error.</li>
            <li>Your name, email, phone number, and physical address.</li>
            <li>A statement consenting to the jurisdiction of the federal court in your district.</li>
            <li>Your physical or electronic signature.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">4. Repeat Infringers</h2>
          <p>RomX will terminate the accounts of users who are repeat copyright infringers. We track infringement claims and, upon receiving multiple valid DMCA notices regarding the same user, will permanently ban the account.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">5. Open Source Considerations</h2>
          <p>Many ROMs and kernels are based on open-source projects (e.g., AOSP, Linux kernel). RomX recognizes the importance of open-source licensing. Content distributed under valid open-source licenses (GPL, Apache, MIT, etc.) is generally not subject to DMCA takedowns. However, proprietary additions or modifications may be subject to separate copyright claims.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">6. Good Faith</h2>
          <p>Submitting a false DMCA notice or counter-notification may result in legal consequences. Please ensure your claims are accurate before filing.</p>
        </section>

      </div>
    </div>
  );
}
