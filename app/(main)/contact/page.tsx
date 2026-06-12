"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, MessageSquare, ChevronRight, Send, Github, Twitter } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

export default function ContactPage() {
  const { t } = useTranslation();
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) return;
    setSending(true);
    // Simulate form submission — replace with your actual backend call
    await new Promise(r => setTimeout(r, 1000));
    setSending(false);
    setSent(true);
  };

  return (
    <div className="min-h-screen px-4 py-10 max-w-2xl mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-xs text-[var(--text-muted)] mb-8">
        <Link href="/" className="hover:text-[var(--primary)] transition-colors">Home</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-[var(--text-primary)]">Contact</span>
      </nav>

      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-[var(--primary-dim)] flex items-center justify-center">
          <Mail className="w-5 h-5 text-[var(--primary)]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Contact Us</h1>
          <p className="text-sm text-[var(--text-muted)]">We'd love to hear from you</p>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card-bg)]">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="w-4 h-4 text-[var(--primary)]" />
            <span className="text-sm font-medium text-[var(--text-primary)]">General Inquiries</span>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Questions about RomX, partnerships, or general feedback.
          </p>
        </div>
        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card-bg)]">
          <div className="flex items-center gap-2 mb-2">
            <Mail className="w-4 h-4 text-[var(--primary)]" />
            <span className="text-sm font-medium text-[var(--text-primary)]">Support</span>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Issues with your account, uploads, or platform features.
          </p>
        </div>
      </div>

      {/* Contact Form */}
      {sent ? (
        <div className="p-8 rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] text-center">
          <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
            <Send className="w-5 h-5 text-green-400" />
          </div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Message Sent!</h3>
          <p className="text-sm text-[var(--text-muted)]">
            Thank you for reaching out. We'll get back to you within 48 hours.
          </p>
        </div>
      ) : (
        <div className="p-6 rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Your name"
                className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--input-bg)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">Email *</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="you@example.com"
                className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--input-bg)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">Subject</label>
            <input
              type="text"
              value={form.subject}
              onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
              placeholder="How can we help?"
              className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--input-bg)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">Message *</label>
            <textarea
              rows={5}
              value={form.message}
              onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
              placeholder="Tell us more about your inquiry..."
              className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--input-bg)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] transition-colors resize-none"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={sending || !form.name || !form.email || !form.message}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {sending ? t("contact.sending") : t("contact.send")}
          </button>
        </div>
      )}

      {/* Social Links */}
      <div className="mt-8 pt-6 border-t border-[var(--border)]">
        <p className="text-xs text-[var(--text-muted)] mb-4 text-center">Or reach us on social media</p>
        <div className="flex items-center justify-center gap-4">
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--primary)] transition-colors"
          >
            <Github className="w-4 h-4" />
            GitHub
          </a>
          <a
            href="https://twitter.com/RomXApp"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--primary)] transition-colors"
          >
            <Twitter className="w-4 h-4" />
            Twitter / X
          </a>
        </div>
      </div>
    </div>
  );
}
