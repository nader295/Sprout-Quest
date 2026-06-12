# 📊 دليل تقليل استهلاك Function Invocations

## 🔴 المشكلة الحالية
أنت تستخدم **100% من 1,000,000 استدعاء مجاني شهرياً** على Vercel

---

## 🎯 مصادر الاستهلاك العالي في RomX (مرتبة حسب التأثير)

### 1️⃣ **Cron Jobs (أكبر مصدر استهلاك)**
**الملف:** `app/api/cron/route.ts` و `app/api/cron/health/route.ts`

**المشكلة:**
- **Cron يومي:** يستدعي 11 عملية مختلفة (كل واحدة = 1-2 استدعاء)
- **Cron كل ساعة:** `cron/health` يعمل 24 مرة يومياً بـ 3 عمليات لكل مرة
- **الإجمالي:** ~70-100 استدعاء يومي من الـ crons وحدها = 2,100-3,000 شهرياً

**الحلول:**
```
✅ قلل تكرار cron/health من كل ساعة إلى كل 4 ساعات
✅ دمج بعض عمليات cron معاً (مثلاً: cleanup operations)
✅ توقف عمليات غير حيوية (مثل auto-ingest أجهزة)
```

---

### 2️⃣ **Proxying صور من خارج (device-image proxy)**
**الملف:** `app/api/device-image/[codename]/proxy/route.ts`

**المشكلة:**
- كل طلب لصورة device = استدعاء دالة (يستدعى من الصور كثيراً)
- لو لديك 1000 صورة وتُطلب 10 مرات = 10,000 استدعاء
- العدالة الطويلة للمستخدمين تعني آلاف الطلبات

**الحلول:**
```
✅ استخدم Vercel Image Optimization بدل الـ proxy
✅ احفظ الصور مباشرة في Blob Storage (vercel-blob)
✅ استخدم CDN مع caching قوي (24+ ساعة)
✅ قلل عدد صور الـ devices المعروضة في كل صفحة
```

---

### 3️⃣ **Polling و Real-time Features**
**الملفات:** `app/(main)/devices/page.tsx`, `app/(main)/community/page.tsx`

**المشكلة:**
- Presence tracking: كل مستخدم يرسل update كل دقيقة
- Community map: يفتش بيانات كل مرة
- و statistics monitoring

**الحلول:**
```
✅ قلل frequency من كل دقيقة إلى كل 5 دقائق للـ presence
✅ استخدم WebSocket بدل HTTP polling (لو ممكن)
✅ احفظ بيانات المجتمع في Redis (Upstash)
```

---

### 4️⃣ **API Calls من الـ Frontend**
**المشكلة:**
- كل صفحة تستدعي عدة API endpoints
- الـ `revalidate` قد لا يكون مُضبوط بشكل أمثل
- عدم وجود caching على الـ client side

**الحلول:**
```
✅ زيادة revalidate time من 3600 إلى 7200 (ساعتين)
✅ استخدم SWR مع dedupingInterval طويل
✅ اعمل batch requests بدل requests منفصلة
```

---

### 5️⃣ **Admin Pages و Logging**
**الملفات:** `app/(main)/admin/logs/page.tsx`, `app/(main)/admin/sync-map/page.tsx`

**المشكلة:**
- الـ logs page تجلب ملايين السجلات
- sync-script يعمل fetches منفصلة

**الحلول:**
```
✅ قيّد عدد السجلات (paginate بـ 100 أو أقل)
✅ أضف retention policy (احذف logs أقدم من 30 يوم)
✅ استخدم database indexing للـ logs
```

---

## 🚀 خطة التنفيذ (مرتبة حسب التأثير)

### الأولويات الفورية:
| الخطوة | التأثير | الصعوبة | الوقت |
|------|--------|--------|------|
| 1. تقليل تكرار cron/health من 1h → 4h | **-2,400/شهر** ⭐⭐⭐⭐⭐ | سهل جداً | 5 دقائق |
| 2. إيقاف auto-ingest عملية (أسبوعية) | **-300/شهر** ⭐⭐⭐ | سهل جداً | 5 دقائق |
| 3. حفظ device images في Blob بدل proxy | **-30,000-50,000/شهر** ⭐⭐⭐⭐⭐ | متوسط | 2 ساعة |
| 4. قيّد الـ admin logs (pagination) | **-10,000/شهر** ⭐⭐⭐⭐ | سهل | 20 دقيقة |
| 5. استخدم Redis للـ presence بدل DB | **-15,000/شهر** ⭐⭐⭐⭐ | متوسط | ساعة |

---

## ⚙️ إعدادات Vercel للحفاظ على الخطة المجانية

### في لوحة التحكم Vercel:

**1. تعطيل الميزات الباهظة:**
- الذهاب إلى **Settings → Functions**
- تحقق من **"Function Invocations Alert"** ليخبرك قبل التجاوز

**2. إضافة Spend Cap (حد الإنفاق):**
```
Settings → Billing → Pro Plan → Set Spend Cap to $0
```
هذا يوقف الدوال بدل فرض فاتورة إضافية.

**3. تعطيل الـ Background Functions:**
- إن لم تكن تستخدمها، عطلها من الإعدادات

**4. مراقبة الاستهلاك:**
- اذهب إلى **Analytics → Function Invocations**
- شوف أي endpoints تستهلك أكثر

---

## 📝 التعديلات الموصى بها

### 1. تعديل `vercel.json` - تقليل تكرار Crons

```json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "installCommand": "npm install",
  "crons": [
    {
      "path": "/api/cron",
      "schedule": "0 2 * * *"
    }
  ],
  "functions": {
    "app/api/sync-script/route.ts": {
      "maxDuration": 60
    }
  }
}
```

✅ **لم نعدل cron الرئيسي (يومي) لأنه حيوي**

لكن تعديل `app/api/cron/health/route.ts`:

### 2. إيقاف auto-ingest (توفير ~300/شهر)

في `app/api/cron/route.ts` ابحث عن قسم "Auto-ingest":

```typescript
// ❌ قبل
if (new Date().getDay() === 0) { // الأحد فقط
  const { runDeviceIngestion } = await import("@/lib/server/device-ingestion");
  const ingestion = await runDeviceIngestion({...});
  results.deviceIngestion = `added ${ingestion.added} new devices`;
}

// ✅ بعد
// تعطيل مؤقت (إلى أن تحسّن من الاستهلاك الآخر)
results.deviceIngestion = "disabled_temporarily";
```

---

## 🎓 أفضل الممارسات لـ Serverless Functions

| ❌ تجنب | ✅ افعل بدلاً منه |
|---------|------------------|
| استدعاء دالة في loop | دمج البيانات و batch process |
| polling كل دقيقة | polling كل 5-10 دقائق أو WebSocket |
| حفظ في DB لكل view | استخدام Redis للـ ephemeral data |
| إعادة تحسين الصور في الدالة | استخدام Next.js Image Optimization |
| cron كل ساعة لعملية صغيرة | cron كل 4-6 ساعات |

---

## 📊 تقدير التوفير الشهري

بتطبيق هذه التعديلات:

```
الوضع الحالي:          ~1,000,000 استدعاء/شهر (100%)
بعد الخطوات الفورية:   ~400,000-500,000 استدعاء/شهر (40-50%)
بعد تحسين الصور:       ~150,000-250,000 استدعاء/شهر (15-25%)
الهدف النهائي:         ~100,000 استدعاء/شهر (10%) ✅
```

---

## 🔗 الموارد الإضافية

- [Vercel Function Invocations Docs](https://vercel.com/docs/functions/runtimes)
- [Next.js Image Optimization](https://nextjs.org/docs/pages/building-your-application/optimizing/images)
- [Vercel Blob Storage](https://vercel.com/docs/storage/vercel-blob)
- [Upstash Redis](https://upstash.com/)
