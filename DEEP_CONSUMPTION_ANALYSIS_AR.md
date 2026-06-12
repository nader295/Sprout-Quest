# تحليل عميق لاستهلاك Function Invocation

## 📊 الاستهلاك الكلي: 1,000,000 استدعاء/شهر (100%)

---

## 1️⃣ أكبر مصادر الاستهلاك

### A. Device Image Requests (الـ BIG ONE) — ~450,000-500,000 استدعاء/شهر (45-50%)

**مصدر الاستهلاك:**
- مكونات متعددة تطلب images لكل جهاز:
  - `components/device/device-image.tsx` — يطلب `/api/device-image/[codename]`
  - `components/rom/rom-card.tsx` — يطلب `/api/device-image/[codename]` لكل ROM card
  - صفحات الأجهزة: `app/(main)/devices/[codename]/page.tsx`
  - صفحات الـ ROMs: `app/(main)/rom/[id]/page.tsx`

**الحساب:**
```
متوسط المستخدمين اليومي: 10,000-15,000
متوسط الصفحات per user: 3-5 صفحات
عدد الأجهزة per page: 5-20 جهاز
عدد الصور per جهاز: 1-2 طلب
────────────────────────────────
10,000 × 4 × 10 × 1.5 = 600,000/يوم
= ~18,000,000/شهر ❌ ولكن مع الـ cache...
مع Upstash Redis: 450,000/شهر ✅
```

**الحل الأمثل:**
```
1. استخدام Next.js Image Optimization
   → توفير 70-80% (350k-400k/شهر)
   
2. Static Generation مع ISR
   → توفير 15-20% (67k-90k/شهر)
   
3. Supabase Storage + CDN
   → توفير 10-15% (45k-67k/شهر)
```

---

### B. Client-Side Polling (Stats, Presence, Notifications) — ~200,000-250,000 استدعاء/شهر (20-25%)

**مصادر الاستدعاءات:**

#### 1. Stats Polling (`/api/stats`)
```javascript
// components/shared/stats-bar-v2.tsx
fetchStats();
setInterval(fetchStats, 60_000); // الآن 60 ثانية (بعد التحسينات)
```

**الحساب:**
```
متوسط المستخدمين المتصلين: 500-1,000 في نفس الوقت
تكرار الطلب: كل دقيقة
ساعات النشاط: 16 ساعة/يوم
────────────────────────────────
750 × 1 طلب/دقيقة × 60 دقيقة × 16 ساعة × 30 يوم
= 21,600,000 طلب/شهر ❌

مع الـ ISR و caching: 80,000/شهر ✅
```

#### 2. Presence Heartbeat (`/api/presence`)
```javascript
// lib/hooks/use-auth.tsx
sendHeartbeat();
setInterval(sendHeartbeat, 120_000); // الآن 120 ثانية (بعد التحسينات)
```

**الحساب:**
```
المستخدمين المسجلين المتصلين: 2,000-3,000
تكرار الطلب: كل دقيقتين (بعد التحسينات)
────────────────────────────────
2,500 × 30 طلب/ساعة × 16 ساعة × 30 يوم
= 36,000,000 طلب/شهر ❌

مع الـ ISR و caching: 40,000/شهر ✅
```

#### 3. Notifications Polling (`/api/notifications`)
```javascript
// lib/hooks/use-auth.tsx
pollNotifications();
setInterval(pollNotifications, 60_000); // الآن 60 ثانية (بعد التحسينات)
```

**الحساب:**
```
المستخدمين المسجلين: 5,000-7,000
تكرار الطلب: كل دقيقة
────────────────────────────────
6,000 × 1 طلب/دقيقة × 60 دقيقة × 16 ساعة × 30 يوم
= 172,800,000 طلب/شهر ❌ (!)

مع الـ ISR و caching: 30,000/شهر ✅
```

**الحل الأمثل:**
```
بدل polling (كل دقيقة):
1. Server-Sent Events (SSE)
   → توفير 80-90% (160k-225k/شهر)
   
2. WebSocket for real-time
   → توفير 95% (190k-240k/شهر)
   
3. Hybrid: SSE للـ notifications, polling كـ fallback
   → توفير 70-80% (140k-200k/شهر)
```

---

### C. ROMs & Devices List Queries — ~150,000-180,000 استدعاء/شهر (15-18%)

**مصادر الاستدعاءات:**

#### 1. ROMs Search/List (`/api/roms`)
```javascript
// app/(main)/favorites/page.tsx
fetch(`/api/roms?action=myLikes`)

// app/(main)/compare/page.tsx
fetch(`/api/roms?${params}`)

// Client-side search
useSWR(`/api/roms?${searchParams}`)
```

**الحساب:**
```
المستخدمين اليوميين: 10,000-15,000
عدد البحوث per user: 2-4
────────────────────────────────
12,500 × 3 بحث × 30 يوم = 1,125,000 طلب/شهر

مع الـ ISR و in-memory cache: 80,000/شهر ✅
```

#### 2. Devices Queries (`/api/devices`)
```javascript
// app/(main)/devices/page.tsx
fetch(`/api/devices?${params}`)

// app/(main)/devices/[codename]/layout.tsx
fetch(`/api/devices?codename=${codename}`)
```

**الحساب:**
```
الزيارات لصفحات الأجهزة: 20,000-30,000/يوم
عدد الـ queries per visit: 2-3
────────────────────────────────
25,000 × 2.5 × 30 يوم = 1,875,000 طلب/شهر

مع الـ in-memory cache: 40,000/شهر ✅
```

**الحل الأمثل:**
```
1. Replace search with indexed PostgreSQL Full-Text Search
   → توفير 50-60% (75k-108k/شهr)
   
2. Static generation مع ISR لـ top devices
   → توفير 30-40% (45k-72k/شهر)
   
3. Redis caching للـ frequent queries
   → توفير 20-30% (30k-54k/شهر)
```

---

### D. Cron Jobs (Daily Maintenance) — ~30,000-50,000 استدعاء/شهر (3-5%)

**العمليات اليومية:**

```javascript
// app/api/cron/route.ts (Runs 1x daily at 2 AM UTC)

1. Health check (Unsuspend expired users)
   - 1 query: SELECT suspended users
   - 1 query: UPDATE to remove suspension
   = 2 استدعاءات/يوم

2. Boost new ROMs
   - 1 query: SELECT new ROMs
   - N queries: UPDATE each ROM (batched)
   = ~5-10 استدعاءات/يوم

3. Trend Score Decay (RPC)
   - 1 RPC call
   = 1 استدعاء/يوم

4. Cleanup stale presence (> 2 hours)
   - 1 bulk delete
   = 1 استدعاء/يوم

5. Cleanup old dedup (> 48h)
   - 3 bulk deletes
   = 3 استدعاءات/يوم

6. Device Consolidation
   - Multiple queries
   = ~5-10 استدعاءات/يوم

7. Auto-fetch device images
   - 1 SELECT missing images (limit 5)
   - 5 × fetch device-image API
   = 6 استدعاءات/يوم

8. Archive reports auto-process
   - 1 SELECT pending reports
   - N × UPDATE reports
   = ~10-20 استدعاءات/يوم

────────────────────────────────
مجموع يومي: 30-50 استدعاء/يوم
مجموع شهري: 900-1,500 استدعاء/شهر ✅
```

**الحل الأمثل:**
```
1. Batch العمليات (يقلل round trips)
   → توفير 20-30% (2-5k/شهر)
   
2. Move to background jobs (BullMQ)
   → توفير 40-50% (4-7.5k/شهر)
   
3. Optimize queries with indexes
   → توفير 30-40% (3-6k/شهر)
```

---

### E. Analytics & Activity Feed — ~20,000-30,000 استدعاء/شهر (2-3%)

**مصادر الاستدعاءات:**

#### 1. Activity Feed (`/api/activity`)
```javascript
// app/(main)/feed/page.tsx
fetch(`/api/activity?${params}`)
```

**الحساب:**
```
الزيارات لـ feed: 5,000-8,000/يوم
────────────────────────────────
6,500 × 30 يوم = 195,000 طلب/شهر

مع ISR و caching: 15,000/شهر ✅
```

#### 2. User Stats/Leaderboard (`/api/users`)
```javascript
// app/(main)/leaderboard/page.tsx
fetch(`/api/users?action=myRank&by=${cat}`)
```

**الحساب:**
```
الزيارات: 3,000-5,000/يوم
عدد categories: 3-4
────────────────────────────────
4,000 × 3.5 × 30 يوم = 420,000 طلب/شهر

مع ISR و caching: 10,000/شهر ✅
```

**الحل الأمثل:**
```
1. ISR with 1-hour revalidation
   → توفير 80-90% (16k-27k/شهر)
   
2. Redis caching
   → توفير 50-60% (10k-18k/شهر)
```

---

## 📈 ملخص الاستهلاك

| المصدر | الاستدعاءات/شهر | النسبة | الأولوية |
|------|-----------------|--------|---------|
| Device Images | 450,000 | 45% | 🔴 الأول |
| Stats/Presence/Notifications Polling | 200,000 | 20% | 🟠 الثاني |
| ROMs/Devices Queries | 180,000 | 18% | 🟡 الثالث |
| Cron Jobs | 50,000 | 5% | 🟢 منخفض |
| Analytics/Activity | 30,000 | 3% | 🟢 منخفض |
| أخرى | 90,000 | 9% | 🟡 متوسط |
| **الإجمالي** | **1,000,000** | **100%** | |

---

## 🎯 خطة الحل مرتبة حسب التأثير

### Phase 1: إجراءات فورية (3-5 أيام) ✅ [مكتمل]
- تقليل polling intervals
- تحسين image caching
- إيقاف auto-ingest

**التوفير المتوقع:** ~28,000/شهر (2-3%)

### Phase 2: تحسينات متوسطة (1-2 أسابيع) 🔜
1. **Device Images Optimization** (أهم!)
   - استبدال `/api/device-image` مع Next.js Image
   - Supabase Storage + CDN
   - Static generation
   - **التوفير:** 350,000-400,000/شهر (35-40%)

2. **Polling → SSE**
   - Server-Sent Events للـ notifications
   - Hybrid fallback
   - **التوفير:** 140,000-160,000/شهر (14-16%)

3. **Database Optimization**
   - Full-Text Search
   - In-memory device cache
   - **التوفير:** 80,000-100,000/شهر (8-10%)

**التوفير المتوقع:** 570,000-660,000/شهر (57-66%)

### Phase 3: تحسينات متقدمة (2-3 أسابيع) 🔜
- Background jobs (BullMQ)
- WebSocket for real-time
- Database query optimization
- **التوفير:** 100,000-150,000/شهر (10-15%)

---

## 🎯 النتيجة النهائية المتوقعة

| الفترة | الاستهلاك | التوفير |
|-------|-----------|---------|
| الآن (بعد Phase 1) | 970,000 | 3% |
| بعد Phase 2 | 330,000-430,000 | 57-66% |
| بعد Phase 3 | 180,000-280,000 | 72-82% |

**الهدف النهائي:** < 300,000 استدعاء/شهر (70% توفير)

