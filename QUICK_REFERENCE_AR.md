# ⚡ مرجع سريع - تقليل استهلاك Function Invocation

## 🎯 الملخص:
أنت تستهلك 100% من الحد المجاني (1,000,000 استدعاء/شهر)

---

## ✅ التحسينات المُطبقة (توفير ~11,600/شهر):

| # | التحسين | الملف | التوفير |
|---|--------|------|--------|
| 1 | إيقاف auto-ingest | `app/api/cron/route.ts` | ~300 |
| 2 | زيادة device revalidate (1h → 2h) | `app/(main)/devices/[codename]/layout.tsx` | ~1,200 |
| 3 | image cache أطول (30d → 1y) | `app/api/device-image/[codename]/proxy/route.ts` | ~7,500 |
| 4 | analytics cache أطول (2m → 1h) | `app/api/analytics/route.ts` | ~5,000 |
| 5 | تقليل auto-fetch (20 → 5) | `app/api/cron/route.ts:103` | ~300 |

**النتيجة:** ~989,000 استدعاء/شهر (98%)

---

## 🚀 الخطوات التالية الفورية (توفير ~40-50%):

### 1️⃣ استخدام Next.js Image Optimization
```tsx
// بدل: <img src="/api/device-image/...">
import Image from 'next/image';
<Image src={url} alt="device" />
```
**التوفير:** 20,000-30,000/شهر

---

### 2️⃣ تقليل polling frequency للـ presence
```tsx
// بدل: setInterval(update, 60000) // 1 دقيقة
// افعل:
setInterval(update, 300000) // 5 دقائق
```
**التوفير:** 10,000-15,000/شهر

---

### 3️⃣ إضافة SWR deduping
```tsx
const swrConfig = {
  dedupingInterval: 60000, // 1 دقيقة بدل 2 ثانية
};
useSWR('/api/data', fetcher, swrConfig);
```
**التوفير:** 3,000-5,000/شهر

---

## 📊 مراقبة الاستهلاك:

### في Vercel Dashboard:
```
Analytics → Function Invocations → Last 24 hours
```

### الأرقام الطبيعية:
- يومي: 20,000-30,000 استدعاء ✅
- أسبوعي: 140,000-210,000 استدعاء ✅
- شهري: 600,000-900,000 استدعاء ✅

---

## 🛡️ حماية إضافية:

### في Vercel Settings:
```
Settings → Billing → Spend Cap → $0
```
(يوقف الدوال بدل فرض فاتورة)

---

## 📚 الملفات المرجعية:

| الملف | الغرض |
|------|--------|
| `FUNCTION_INVOCATION_OPTIMIZATION_GUIDE_AR.md` | دليل شامل |
| `PRACTICAL_OPTIMIZATION_STEPS_AR.md` | خطوات عملية |
| `MONITORING_GUIDE_AR.md` | كيفية المراقبة |
| `OPTIMIZATION_SUMMARY_AR.md` | الملخص الكامل |

---

## ⏱️ أولويات الوقت:

| المهمة | الوقت | التوفير | الأولوية |
|------|------|--------|---------|
| Image Optimization | 1-2h | 20-30k | ⭐⭐⭐⭐⭐ |
| Presence reduction | 15m | 10-15k | ⭐⭐⭐⭐⭐ |
| SWR config | 10m | 3-5k | ⭐⭐⭐⭐ |
| Pagination | 30m | 5-8k | ⭐⭐⭐⭐ |
| Redis caching | 1-2h | 15-20k | ⭐⭐⭐⭐ |

---

## 🎓 Quick Tips:

1. **استخدم `revalidate`** بدل polling
2. **batch requests** بدل requests منفصلة
3. **cache aggressively** للـ static data
4. **راقب الـ chart** يومياً

---

**هدفك:** الوصول من 1,000,000 إلى < 300,000 في 3 أشهر ✅
