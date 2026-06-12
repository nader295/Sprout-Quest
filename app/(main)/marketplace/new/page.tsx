"use client";

/**
 * Create a new marketplace listing (request or offer).
 *
 * Real flow:
 *   1. Optional cover image → /api/marketplace/upload (Cloudinary).
 *   2. POST /api/marketplace/listings with the parsed payload.
 *   3. SWR cache invalidation + redirect to the listing page.
 *
 * Auth required. Redirects to /login when the visitor isn't signed in.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Info,
  Loader2,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";

import {
  CATEGORY_LABEL,
  URGENCY_LABEL,
  type Category,
  type ContactChannelKey,
  type ContactChannels,
  type ListingKind,
  type Urgency,
} from "@/lib/marketplace/types";
import {
  createListing,
  MarketplaceApiError,
} from "@/lib/marketplace/api-client";
import { invalidateMarketplace } from "@/lib/marketplace/hooks";
import { CoverUploader } from "@/components/marketplace/image-uploader";
import { useAuth } from "@/lib/hooks/use-auth";
import { toast } from "@/components/shared/toast";
import { cn } from "@/lib/utils";

const CURRENCIES = ["USD", "EUR", "GBP", "EGP", "SAR", "AED", "INR"] as const;

const CHANNELS: { key: ContactChannelKey; label: string; placeholder: string }[] = [
  { key: "telegram", label: "Telegram", placeholder: "@your_handle" },
  { key: "whatsapp", label: "WhatsApp", placeholder: "+20 100 000 0000" },
  { key: "discord", label: "Discord", placeholder: "username#0000" },
  { key: "matrix", label: "Matrix", placeholder: "@you:server.org" },
  { key: "signal", label: "Signal", placeholder: "+20 100 000 0000" },
  { key: "xmpp", label: "XMPP", placeholder: "you@xmpp.org" },
  { key: "email", label: "Email", placeholder: "you@example.com" },
  { key: "website", label: "Website", placeholder: "https://yoursite.com" },
];

export default function NewListingPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const { user, isLoggedIn, loading: authLoading } = useAuth();

  const initialKind: ListingKind = sp?.get("kind") === "offer" ? "offer" : "request";

  const [kind, setKind] = useState<ListingKind>(initialKind);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<Category>("kernel");
  const [deviceLabel, setDeviceLabel] = useState("");
  const [deviceCodes, setDeviceCodes] = useState("");
  const [tags, setTags] = useState("");
  const [budgetMin, setBudgetMin] = useState<string>("");
  const [budgetMax, setBudgetMax] = useState<string>("");
  const [currency, setCurrency] = useState<(typeof CURRENCIES)[number]>("USD");
  const [negotiable, setNegotiable] = useState(true);
  const [urgency, setUrgency] = useState<Urgency>("normal");
  const [deliveryDays, setDeliveryDays] = useState<string>("");
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(false);

  const [channelValues, setChannelValues] = useState<ContactChannels>({});
  const [preferred, setPreferred] = useState<ContactChannelKey | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRequest = kind === "request";
  const accent = isRequest ? "var(--primary)" : "#f59e0b";

  // Redirect unauthenticated visitors.
  useEffect(() => {
    if (!authLoading && !isLoggedIn) {
      const next = encodeURIComponent(`/marketplace/new?kind=${kind}`);
      router.replace(`/login?next=${next}`);
    }
  }, [authLoading, isLoggedIn, kind, router]);

  const populatedChannels = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(channelValues).filter(([, v]) => v && v.trim().length > 0),
      ) as ContactChannels,
    [channelValues],
  );

  const canSubmit =
    title.trim().length >= 6 &&
    body.trim().length >= 20 &&
    Object.keys(populatedChannels).length > 0 &&
    !submitting &&
    !done;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);

    try {
      const min = budgetMin === "" ? null : Number(budgetMin);
      const max = budgetMax === "" ? null : Number(budgetMax);
      if (min != null && max != null && min > max) {
        setError("Min budget can't be greater than max budget.");
        setSubmitting(false);
        return;
      }

      const tagList = tags
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 10);
      const deviceList = deviceCodes
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 8);

      const { item } = await createListing({
        kind,
        title: title.trim(),
        body: body.trim(),
        category,
        deviceCodenames: deviceList,
        deviceLabel: deviceLabel.trim() || null,
        budgetMin: min,
        budgetMax: max,
        currency,
        isNegotiable: negotiable,
        urgency,
        deliveryDays: deliveryDays === "" ? null : Number(deliveryDays),
        tags: tagList,
        coverImage,
        contactChannels: populatedChannels,
        preferredChannel: preferred,
        isAnonymous,
      });

      await invalidateMarketplace();
      setDone(true);
      toast.success("Listing published");
      setTimeout(() => router.push(`/marketplace/${item.id}`), 600);
    } catch (err) {
      if (err instanceof MarketplaceApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Something went wrong, please try again.");
      }
      setSubmitting(false);
    }
  }

  if (authLoading || (!isLoggedIn && typeof window !== "undefined")) {
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-4xl items-center justify-center px-3 py-3">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-3 py-3 pb-24 sm:px-4 sm:py-4 lg:px-6">
      <Link
        href="/marketplace"
        className="group mb-3 inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
        Back to marketplace
      </Link>

      {/* Kind toggle */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-5 overflow-hidden rounded-3xl border bg-card p-1.5"
        style={{
          borderColor: `color-mix(in srgb, ${accent} 25%, transparent)`,
          boxShadow: "var(--card-shadow)",
        }}
      >
        <div className="grid grid-cols-2 gap-1.5">
          <KindCard
            selected={kind === "request"}
            onClick={() => setKind("request")}
            icon={<ArrowDownLeft className="h-5 w-5" />}
            accent="var(--primary)"
            title="Post a request"
            body="You need a service. Let providers come to you."
          />
          <KindCard
            selected={kind === "offer"}
            onClick={() => setKind("offer")}
            icon={<ArrowUpRight className="h-5 w-5" />}
            accent="#f59e0b"
            title="Post an offer"
            body="You deliver a service. Let clients find you."
          />
        </div>
      </motion.div>

      <motion.form
        onSubmit={handleSubmit}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="relative overflow-hidden rounded-3xl border bg-card p-5 sm:p-7"
        style={{
          borderColor: `color-mix(in srgb, ${accent} 22%, transparent)`,
        }}
      >
        <span
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{
            background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
          }}
        />

        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <div
              className="text-[10px] font-black uppercase tracking-[0.22em]"
              style={{ color: accent }}
            >
              {isRequest ? "New request" : "New offer"}
            </div>
            <h1 className="mt-1 text-balance text-xl font-black tracking-tight text-foreground sm:text-2xl">
              {isRequest ? "What do you need done?" : "What can you deliver?"}
            </h1>
          </div>
          <ShieldCheck
            className="hidden h-7 w-7 sm:block"
            style={{ color: accent }}
            aria-hidden
          />
        </div>

        <div className="flex flex-col gap-5">
          {/* Cover image */}
          <Field label="Cover image (optional)">
            <CoverUploader
              value={coverImage}
              onChange={setCoverImage}
              folder={isRequest ? "listings" : "covers"}
            />
          </Field>

          {/* Title */}
          <Field label="Title" hint={`${title.length}/120`} htmlFor="title">
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 120))}
              placeholder={
                isRequest
                  ? "e.g. Need custom kernel for Pixel 8 Pro — EAS + KernelSU"
                  : "e.g. Custom kernel builds · AOSP devices · EAS tuning"
              }
              className="h-11 w-full rounded-xl border border-border bg-muted/40 px-3 text-sm font-bold text-foreground outline-none transition-colors focus:border-[color:var(--primary)]/60"
              required
              minLength={6}
            />
          </Field>

          {/* Body */}
          <Field
            label="Description"
            hint={`${body.length}/8000 · min. 20 chars`}
            htmlFor="body"
          >
            <textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, 8000))}
              placeholder={
                isRequest
                  ? "Detail what you need, device specifics, constraints, and your deadline."
                  : "Describe the service, turnaround, revisions, and what's included."
              }
              rows={6}
              className="w-full resize-y rounded-xl border border-border bg-muted/40 p-3 text-sm leading-relaxed text-foreground outline-none transition-colors focus:border-[color:var(--primary)]/60"
              required
              minLength={20}
            />
          </Field>

          {/* Two-col grid */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category" htmlFor="category">
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                className="h-11 w-full rounded-xl border border-border bg-muted/40 px-3 text-sm font-bold text-foreground outline-none focus:border-[color:var(--primary)]/60"
              >
                {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABEL[c]}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Urgency" htmlFor="urgency">
              <select
                id="urgency"
                value={urgency}
                onChange={(e) => setUrgency(e.target.value as Urgency)}
                className="h-11 w-full rounded-xl border border-border bg-muted/40 px-3 text-sm font-bold text-foreground outline-none focus:border-[color:var(--primary)]/60"
              >
                {(Object.keys(URGENCY_LABEL) as Urgency[]).map((u) => (
                  <option key={u} value={u}>
                    {URGENCY_LABEL[u]}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label="Target device (optional)"
              hint="display name"
              htmlFor="device"
            >
              <input
                id="device"
                type="text"
                value={deviceLabel}
                onChange={(e) => setDeviceLabel(e.target.value)}
                placeholder="e.g. Pixel 8 Pro"
                className="h-11 w-full rounded-xl border border-border bg-muted/40 px-3 text-sm text-foreground outline-none focus:border-[color:var(--primary)]/60"
              />
            </Field>

            <Field
              label="Device codenames (optional)"
              hint="comma separated"
              htmlFor="codenames"
            >
              <input
                id="codenames"
                type="text"
                value={deviceCodes}
                onChange={(e) => setDeviceCodes(e.target.value)}
                placeholder="e.g. husky, shiba"
                className="h-11 w-full rounded-xl border border-border bg-muted/40 px-3 text-sm text-foreground outline-none focus:border-[color:var(--primary)]/60"
              />
            </Field>

            <Field label="Tags" hint="comma separated · max 10" htmlFor="tags">
              <input
                id="tags"
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="e.g. kernelsu, eas, safetynet"
                className="h-11 w-full rounded-xl border border-border bg-muted/40 px-3 text-sm text-foreground outline-none focus:border-[color:var(--primary)]/60"
              />
            </Field>

            <Field
              label="Delivery / turnaround"
              hint="days (optional)"
              htmlFor="delivery"
            >
              <input
                id="delivery"
                type="number"
                min={1}
                max={365}
                value={deliveryDays}
                onChange={(e) => setDeliveryDays(e.target.value)}
                placeholder="e.g. 7"
                className="h-11 w-full rounded-xl border border-border bg-muted/40 px-3 text-sm font-bold text-foreground outline-none focus:border-[color:var(--primary)]/60"
              />
            </Field>
          </div>

          {/* Budget block */}
          <div
            className="rounded-2xl border p-4"
            style={{
              borderColor: `color-mix(in srgb, ${accent} 22%, transparent)`,
              background: `color-mix(in srgb, ${accent} 4%, transparent)`,
            }}
          >
            <div className="mb-3 text-[11px] font-black uppercase tracking-wider text-muted-foreground">
              {isRequest ? "Budget range" : "Pricing"}
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_120px]">
              <Field label={isRequest ? "Min" : "From"} htmlFor="bmin">
                <input
                  id="bmin"
                  type="number"
                  min={0}
                  value={budgetMin}
                  onChange={(e) => setBudgetMin(e.target.value)}
                  placeholder="50"
                  className="h-11 w-full rounded-xl border border-border bg-muted/40 px-3 text-sm font-bold text-foreground outline-none focus:border-[color:var(--primary)]/60"
                />
              </Field>
              <Field label={isRequest ? "Max" : "To"} htmlFor="bmax">
                <input
                  id="bmax"
                  type="number"
                  min={0}
                  value={budgetMax}
                  onChange={(e) => setBudgetMax(e.target.value)}
                  placeholder="200"
                  className="h-11 w-full rounded-xl border border-border bg-muted/40 px-3 text-sm font-bold text-foreground outline-none focus:border-[color:var(--primary)]/60"
                />
              </Field>
              <Field label="Currency" htmlFor="cur">
                <select
                  id="cur"
                  value={currency}
                  onChange={(e) =>
                    setCurrency(e.target.value as (typeof CURRENCIES)[number])
                  }
                  className="h-11 w-full rounded-xl border border-border bg-muted/40 px-3 text-sm font-black text-foreground outline-none focus:border-[color:var(--primary)]/60"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <label className="mt-3 inline-flex cursor-pointer items-center gap-2.5 rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm font-bold text-foreground transition-colors hover:bg-muted/60">
              <input
                type="checkbox"
                checked={negotiable}
                onChange={(e) => setNegotiable(e.target.checked)}
                className="h-4 w-4 accent-[color:var(--primary)]"
              />
              Price is negotiable
            </label>
          </div>

          {/* Contact channels */}
          <div
            className="rounded-2xl border p-4"
            style={{
              borderColor: `color-mix(in srgb, ${accent} 22%, transparent)`,
              background: `color-mix(in srgb, ${accent} 5%, transparent)`,
            }}
          >
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4" style={{ color: accent }} />
              <div className="text-xs font-black uppercase tracking-wider text-foreground">
                Contact channels
              </div>
            </div>
            <p className="mb-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
              <Info className="mt-0.5 h-3 w-3 shrink-0" />
              Add at least one channel. We never broker your conversations —
              clients reach you directly on the platforms you publish.
            </p>

            <div className="grid gap-2 sm:grid-cols-2">
              {CHANNELS.map(({ key, label, placeholder }) => (
                <div key={key} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setPreferred((p) => (p === key ? null : key))
                    }
                    title={
                      preferred === key
                        ? "Preferred channel"
                        : "Mark as preferred"
                    }
                    className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border text-[10px] font-black uppercase tracking-wider transition-colors",
                      preferred === key
                        ? "border-primary/50 bg-primary/15 text-primary"
                        : "border-border bg-muted/40 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {preferred === key ? "★" : "☆"}
                  </button>
                  <div className="flex h-11 flex-1 overflow-hidden rounded-xl border border-border bg-muted/40 focus-within:border-[color:var(--primary)]/60">
                    <span className="flex w-24 items-center border-r border-border px-3 text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                      {label}
                    </span>
                    <input
                      type="text"
                      value={channelValues[key] ?? ""}
                      onChange={(e) =>
                        setChannelValues((c) => ({
                          ...c,
                          [key]: e.target.value,
                        }))
                      }
                      placeholder={placeholder}
                      className="h-full flex-1 bg-transparent px-3 text-sm font-bold text-foreground outline-none"
                    />
                    {channelValues[key] && (
                      <button
                        type="button"
                        onClick={() =>
                          setChannelValues((c) => {
                            const next = { ...c };
                            delete next[key];
                            return next;
                          })
                        }
                        className="px-3 text-muted-foreground transition-colors hover:text-destructive"
                        aria-label={`Clear ${label}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Anonymity */}
          <label
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition-colors",
              isAnonymous
                ? "border-cyan-500/40 bg-cyan-500/5"
                : "border-border bg-muted/30 hover:bg-muted/60",
            )}
          >
            <input
              type="checkbox"
              checked={isAnonymous}
              onChange={(e) => setIsAnonymous(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-cyan-500"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 text-sm font-black text-foreground">
                {isAnonymous ? (
                  <EyeOff className="h-4 w-4 text-cyan-500" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
                Post anonymously
              </div>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                Your username and avatar will be hidden from public viewers.
                Contact channels remain visible so people can still reach you.
              </p>
            </div>
          </label>

          {/* Error */}
          {error && (
            <div className="rounded-xl border border-destructive/35 bg-destructive/10 p-3 text-sm font-bold text-destructive">
              {error}
            </div>
          )}

          {/* Submit */}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Link
              href="/marketplace"
              className="text-center text-xs font-bold text-muted-foreground hover:text-foreground"
            >
              Cancel
            </Link>

            <button
              type="submit"
              disabled={!canSubmit}
              className={cn(
                "group inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-black text-white shadow-md transition-all",
                canSubmit
                  ? "hover:scale-[1.02] active:scale-[0.97]"
                  : "cursor-not-allowed opacity-60",
              )}
              style={{
                background: `linear-gradient(135deg, ${accent}, color-mix(in srgb, ${accent} 70%, #000))`,
                boxShadow: `0 6px 20px color-mix(in srgb, ${accent} 35%, transparent)`,
              }}
            >
              {done ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Published — redirecting
                </>
              ) : submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Publishing…
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  Publish {isRequest ? "request" : "offer"}
                </>
              )}
            </button>
          </div>
        </div>
      </motion.form>

      {/* Author preview */}
      {!isAnonymous && user && (
        <p className="mt-4 text-center text-[11px] font-semibold text-muted-foreground">
          Posting as <span className="text-foreground">{user.displayName || user.email}</span>
        </p>
      )}
    </div>
  );
}

function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label
          htmlFor={htmlFor}
          className="text-[11px] font-black uppercase tracking-wider text-muted-foreground"
        >
          {label}
        </label>
        {hint && (
          <span className="text-[10px] font-semibold text-muted-foreground/70">
            {hint}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function KindCard({
  selected,
  onClick,
  icon,
  accent,
  title,
  body,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  accent: string;
  title: string;
  body: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden rounded-2xl border p-4 text-start transition-all",
        selected
          ? "bg-muted/40"
          : "border-transparent bg-transparent opacity-70 hover:opacity-100",
      )}
      style={
        selected
          ? {
              borderColor: `color-mix(in srgb, ${accent} 40%, transparent)`,
              boxShadow: `0 8px 26px -8px color-mix(in srgb, ${accent} 45%, transparent), inset 0 1px 0 color-mix(in srgb, ${accent} 22%, transparent)`,
            }
          : undefined
      }
    >
      {selected && (
        <span
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{
            background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
          }}
        />
      )}
      <div className="flex items-center gap-3">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-xl border"
          style={{
            color: accent,
            borderColor: `color-mix(in srgb, ${accent} 40%, transparent)`,
            background: `color-mix(in srgb, ${accent} 12%, transparent)`,
          }}
        >
          {icon}
        </span>
        <div>
          <div className="text-sm font-black text-foreground">{title}</div>
          <div className="text-[11px] leading-tight text-muted-foreground">
            {body}
          </div>
        </div>
      </div>
    </button>
  );
}
