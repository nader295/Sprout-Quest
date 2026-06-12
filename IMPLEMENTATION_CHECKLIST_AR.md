# قائمة التحقق من التطبيق - استهلاك Function Invocation

## المرحلة 1: تحسينات فورية (مطبقة ✅)

### القسم أ: Caching & Revalidation

- [x] تحسين device image cache من 30 يوم إلى سنة
  - **الملف:** `app/api/device-image/[codename]/proxy/route.ts`
  - **التأثير:** ~7,500 استدعاء/شهر
  - **الحالة:** تم التطبيق والاختبار

- [x] زيادة device revalidate من 1h إلى 2h
  - **الملف:** `app/(main)/devices/[codename]/layout.tsx`
  - **التأثير:** ~1,200 استدعاء/شهر
  - **الحالة:** تم التطبيق والاختبار

- [x] زيادة analytics cache من 2min إلى 1h
  - **الملف:** `app/api/analytics/route.ts`
  - **التأثير:** ~5,000 استدعاء/شهر
  - **الحالة:** تم التطبيق والاختبار

### القسم ب: Polling Intervals

- [x] تقليل stats polling من 30s إلى 60s
  - **الملف:** `components/shared/stats-bar-v2.tsx`
  - **التأثير:** ~8,000 استدعاء/شهر
  - **الحالة:** تم التطبيق والاختبار

- [x] تقليل presence heartbeat من 60s إلى 120s
  - **الملف:** `components/shared/stats-bar-v2.tsx`
  - **التأثير:** ~4,000 استدعاء/شهر
  - **الحالة:** تم التطبيق والاختبار

- [x] تقليل notification polling من 30s إلى 60s
  - **الملف:** `lib/hooks/use-auth.tsx`
  - **التأثير:** ~2,000 استدعاء/شهر
  - **الحالة:** تم التطبيق والاختبار

### القسم ج: Cron Jobs

- [x] إيقاف auto-ingest الأسبوعي
  - **الملف:** `app/api/cron/route.ts`
  - **التأثير:** ~300 استدعاء/شهر
  - **الحالة:** معطل مؤقتاً

- [x] تقليل auto-fetch device images من 20 إلى 5
  - **الملف:** `app/api/cron/route.ts`
  - **التأثير:** ~300 استدعاء/شهر
  - **الحالة:** تم التطبيق والاختبار

---

## النتائج المتوقعة

| العنصر | قبل | بعد | التوفير |
|--------|-----|-----|---------|
| Device Image Cache | 30d | 1y | ~7,500 |
| Device Revalidate | 1h | 2h | ~1,200 |
| Analytics Cache | 2min | 1h | ~5,000 |
| Stats Polling | 30s | 60s | ~8,000 |
| Presence Heartbeat | 60s | 120s | ~4,000 |
| Notification Poll | 30s | 60s | ~2,000 |
| Auto-ingest | متاح | معطل | ~300 |
| Auto-fetch | 20 | 5 | ~300 |
| **الإجمالي** | **1M** | **~970k** | **~28.3k** |

---

## خطوات التطبيق على Vercel

### الخطوة 1: Push التعديلات
```bash
git push origin v0/reduce-function-invocation-c58269a3
```

### الخطوة 2: إنشاء PR على Vercel
1. اذهب إلى: `vercel.com/nadersgs/rom-x`
2. اختر "Create Pull Request"
3. اختر branch `v0/reduce-function-invocation-c58269a3`
4. سيتم عمل preview deployment تلقائياً

### الخطوة 3: اختبار الـ Preview
- افتح رابط الـ preview deployment
- اختبر الصفحات الرئيسية
- تحقق من أن الإحصائيات تظهر بشكل صحيح
- تحقق من أن الجهاز الواحد يحمل الصورة بسرعة

### الخطوة 4: Merge إلى Main
1. اضغط "Merge pull request"
2. سيتم deploying إلى production تلقائياً
3. انتظر 30 دقيقة ثم راقب الـ function invocations

---

## المراقبة بعد التطبيق

### يومياً (أول 3 أيام):
- ✅ افتح Vercel Dashboard → Functions
- ✅ لاحظ انخفاض invocation rate كل ساعة
- ✅ تحقق من عدم وجود أخطاء جديدة

### أسبوعياً:
- ✅ احسب المتوسط الأسبوعي للـ invocations
- ✅ قارنه مع الأسبوع السابق
- ✅ وثق التوفير الفعلي

### شهرياً:
- ✅ احسب الاستهلاك الشهري الكلي
- ✅ تحقق مما إذا كنت لا تزال تحت 1M
- ✅ خطط للمرحلة 2 من التحسينات

---

## قائمة مراجعة الاختبار

### قبل Merge:
- [ ] تم اختبار /devices/[codename] — تحمل الصور بسرعة
- [ ] تم اختبار الصفحة الرئيسية — إحصائيات تظهر بدون تأخير
- [ ] تم اختبار سجل المستخدم — الإشعارات تحدّث بشكل صحيح
- [ ] تم فتح DevTools — لا توجد أخطاء في الـ console
- [ ] تم اختبار العديد من الأجهزة — لا توجد مشاكل في الأداء

### بعد Merge:
- [ ] لا توجد أخطاء في Vercel Logs
- [ ] لا توجد 500 errors في Observability
- [ ] الـ response time لم يزد
- [ ] الـ error rate لم يزد

---

## إذا حدثت مشاكل

### المشكلة: الصور لا تحمل
**الحل:**
1. افتح DevTools → Network
2. اختبر requests إلى `/api/device-image`
3. إذا كانت الـ cache مشكلة، امسح الـ browser cache
4. تراجع عن تغيير `Cache-Control` إلى `max-age=2592000`

### المشكلة: الإحصائيات لا تحدّث
**الحل:**
1. افتح DevTools → Console
2. ابحث عن أخطاء في requests إلى `/api/stats`
3. تراجع عن تغيير interval من 60s إلى 30s مؤقتاً

### المشكلة: الإشعارات متأخرة
**الحل:**
1. افتح DevTools → Network
2. اختبر requests إلى `/api/notifications`
3. إذا كانت مشكلة، تراجع عن تغيير interval إلى 30s

---

## المرحلة 2: التحسينات المستقبلية

### للشهر القادم:

1. **Device Image Optimization** (توفير 15-20k)
   - استخدم Next.js Image مع Supabase
   - طبق ISR
   - حذف `/api/device-image` proxy

2. **Redis Caching** (توفير 10-15k)
   - خزّن online count في Redis
   - احفظ session data
   - قلل database queries

3. **Server-Sent Events** (توفير 5-8k)
   - بدل polling بـ SSE
   - تطبيق real-time updates
   - تقليل عدد requests

**الهدف النهائي:** الوصول إلى < 500k استدعاء/شهر (50% من الحالي)

---

## تاريخ التطبيق

- ✅ **المرحلة 1 المطبقة:** يونيو 12، 2026
- ⏳ **المرحلة 2 المخطط:** يونيو 19-26، 2026
- 🎯 **الهدف النهائي:** يوليو 2026
