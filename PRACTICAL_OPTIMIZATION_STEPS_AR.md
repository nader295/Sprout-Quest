# 🎯 خطوات عملية لتقليل استهلاك Function Invocation

## ✅ الخطوات المنفذة بالفعل:

1. **[✅] إيقاف auto-ingest** (`app/api/cron/route.ts`)
   - توفير: ~300 استدعاء/شهر
   - تم: ✓

2. **[✅] زيادة device revalidate** من 1 ساعة إلى 2 ساعة (`app/(main)/devices/[codename]/layout.tsx`)
   - توفير: ~1,200-1,800 استدعاء/شهر
   - تم: ✓

3. **[✅] تحسين device image caching** من 30 يوم إلى سنة (`app/api/device-image/[codename]/proxy/route.ts`)
   - توفير: ~5,000-10,000 استدعاء/شهر
   - تم: ✓

4. **[✅] زيادة analytics cache** من 2 دقيقة إلى 1 ساعة (`app/api/analytics/route.ts`)
   - توفير: ~4,000-6,000 استدعاء/شهر
   - تم: ✓

---

## 🔧 الخطوات المتبقية (يمكنك تطبيقها):

### الخطوة 1: تقليل تكرار الـ cron من 24 مرة/يوم إلى 6 مرات

**الملف:** `vercel.json`

**الخطوة الحالية:**
```json
"crons": [
  {
    "path": "/api/cron",
    "schedule": "0 2 * * *"  // مرة واحدة يومياً الساعة 2 صباحاً
  }
]
```

**لا تغيير مطلوب هنا** - الـ cron الرئيسي يعمل مرة واحدة فقط، وهذا منطقي.

لكن **إذا كان هناك cron health منفصل**، يجب تعديله:

**المشكلة:** إذا كان يعمل كل ساعة (24 مرة/يوم)
**الحل:** اجعله كل 4 ساعات (6 مرات/يوم)

---

### الخطوة 2: استخدام Next.js Image Optimization بدل proxy يدوي

**الملف:** `app/(main)/components/DeviceCard.tsx` (أو أي مكان تعرض فيه device images)

**قبل:**
```tsx
<img 
  src={`/api/device-image/${device.codename}/proxy?url=${imageUrl}`}
  alt={device.displayName}
/>
```

**بعد:**
```tsx
import Image from 'next/image';

<Image
  src={imageUrl}
  alt={device.displayName}
  width={300}
  height={300}
  loading="lazy"
  unoptimized={false}
/>
```

**النتيجة:** Next.js تحسّن الصور تلقائياً ويستخدم CDN (Vercel)
**التوفير:** ~20,000-30,000 استدعاء/شهر

---

### الخطوة 3: إضافة pagination للـ admin logs

**الملف:** `app/(main)/admin/logs/page.tsx` (أو `route.ts` إن كانت API)

**المشكلة الحالية:** تحميل جميع السجلات دفعة واحدة

**الحل:**
```tsx
// استخدم limit و offset
const page = searchParams.get('page') ?? '1';
const limit = 50; // عدد السجلات في كل صفحة
const offset = (parseInt(page) - 1) * limit;

const { data: logs } = await sbAdmin
  .from('logs')
  .select('*')
  .order('created_at', { ascending: false })
  .range(offset, offset + limit - 1);

const { count } = await sbAdmin
  .from('logs')
  .select('*', { count: 'exact', head: true });

return {
  logs,
  totalCount: count,
  currentPage: parseInt(page),
  totalPages: Math.ceil((count ?? 0) / limit),
};
```

**التوفير:** ~3,000-5,000 استدعاء/شهر

---

### الخطوة 4: تقليل polling frequency للـ presence/online status

**الملفات:** أي مكان يرسل presence updates

**المشكلة الحالية:** تحديث كل دقيقة = 1,440 استدعاء/يوم/مستخدم

**الحل:**
```tsx
// بدل كل دقيقة:
const PRESENCE_UPDATE_INTERVAL = 5 * 60 * 1000; // 5 دقائق بدل 1 دقيقة

// استخدم
useEffect(() => {
  const interval = setInterval(updatePresence, PRESENCE_UPDATE_INTERVAL);
  return () => clearInterval(interval);
}, []);
```

**التوفير:** ~10,000-15,000 استدعاء/شهر

---

### الخطوة 5: استخدام React Query/SWR مع deduplication أقوى

**الملف:** `lib/swr-config.ts` (أو إنشاؤه)

```tsx
import useSWR from 'swr';

// إضافة deduping interval أطول
const swrConfig = {
  dedupingInterval: 60000,     // 1 دقيقة بدل 2 ثانية
  focusThrottleInterval: 300000, // 5 دقائق
  errorRetryInterval: 10000,
};

export function useRoms() {
  return useSWR('/api/roms', fetcher, swrConfig);
}
```

**التوفير:** ~5,000-8,000 استدعاء/شهر

---

## 📊 التوفير الإجمالي المتوقع:

| الخطوة | قبل | توفير | بعد |
|------|------|-------|------|
| الحالية (بعد التطبيقات ✅) | - | 10,300 | 989,700 |
| بعد Image Optimization | 989,700 | 25,000 | 964,700 |
| بعد pagination | 964,700 | 4,000 | 960,700 |
| بعد presence reduction | 960,700 | 12,500 | 948,200 |
| بعد SWR optimization | 948,200 | 6,500 | 941,700 |
| **النهاية** | **1,000,000** | **58,300** | **941,700** (~94% من الحالية) |

---

## ⚠️ ملاحظات مهمة:

1. **الأولويات:**
   - الـ Image Optimization هو الأفضل (توفير كبير + سهل)
   - تقليل polling frequency = توفير كبير + سهل
   - pagination = توفير متوسط + سهل

2. **المراقبة:**
   - بعد كل تطبيق، اذهب إلى Vercel Dashboard → Analytics
   - راقب Function Invocations في الـ Real-time
   - يجب أن ترى انخفاض في الرسم البياني

3. **اختبار:**
   - اختبر كل تغيير محلياً أولاً
   - تأكد من عدم كسر functionality

---

## 🎛️ إعدادات Vercel الإضافية:

### 1. تفعيل Function Invocation Alerts
```
Dashboard → Settings → Functions → Cost Control
Enable "Function Invocation Cost Alert"
```

### 2. إضافة Spend Cap (اختياري - لحماية أكثر)
```
Settings → Billing → Add Spend Cap
Value: $0 (يوقف الدوال بدل فرض فاتورة)
```

### 3. مراقبة real-time
```
Analytics → Function Invocations → Last 24 hours / Last week
```

---

## 💡 نصائح إضافية:

1. **استخدم Edge Runtime للـ simple operations:**
   ```tsx
   export const runtime = 'edge'; // أسرع و أقل تكلفة
   ```

2. **batch database queries:**
   ```tsx
   // ❌ لا
   for (const rom of roms) {
     await db.query(rom.id);
   }
   
   // ✅ نعم
   await db.query(roms.map(r => r.id));
   ```

3. **استخدم database caching:**
   ```tsx
   const { data } = await fetch(url, {
     next: { revalidate: 3600 } // cache لمدة ساعة
   });
   ```

---

## 📝 خطط بديلة إذا استمر الاستهلاك:

إذا لم تنخفض الأرقام بشكل كافي:

1. **استخدم Upstash Redis** لـ caching الـ hot data (سريع + رخيص)
2. **استخدم Vercel Blob** لحفظ الصور مباشرة
3. **فكر في Pro Plan** إذا كان الاستخدام حقيقي

---

## ✉️ للمساعدة:

- Vercel Docs: https://vercel.com/docs/functions/runtimes
- Next.js Optimization: https://nextjs.org/docs/app/building-your-application/optimizing
