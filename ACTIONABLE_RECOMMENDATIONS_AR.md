# التوصيات العملية - تقليل الاستهلاك بـ 70%

## 🎯 الهدف النهائي
من **1,000,000** إلى **300,000** استدعاء/شهر (توفير 700,000)

---

## 🥇 الأولوية الأولى: Device Images (الأكبر - 45% من الاستهلاك)

### الحالية
```
/api/device-image/[codename] يُطلب:
- من rom-card.tsx (كل بطاقة ROM)
- من device-image.tsx (صفحة الجهاز)
- من favorites, search results, etc.

النتيجة: ~450,000 طلب/شهر
```

### الحل الأمثل: Next.js Image + Static Generation

**الخطوات:**

1. **إضافة Static Image Provider**
```typescript
// lib/images/device-images.ts
const DEVICE_IMAGES: Record<string, string> = {
  'sm-g920f': 'https://images.supabase.co/devices/samsung-galaxy-s6.jpg',
  'sm-g930f': 'https://images.supabase.co/devices/samsung-galaxy-s7-edge.jpg',
  // ...generate from devices table statically
};

export async function getDeviceImage(codename: string) {
  return DEVICE_IMAGES[codename] || DEFAULT_FALLBACK;
}
```

2. **استبدال device-image.tsx**
```typescript
// components/device/device-image.tsx
import Image from 'next/image';
import { getDeviceImage } from '@/lib/images/device-images';

export async function DeviceImage({ codename }: { codename: string }) {
  const src = await getDeviceImage(codename);
  
  return (
    <Image
      src={src}
      alt="Device"
      width={200}
      height={200}
      priority={false}
    />
  );
}
```

3. **Pre-generate images للأجهزة الـ top 100**
```typescript
// scripts/generate-device-images.mjs
// يولد static JSON مع آخر 100 جهاز شعبي
// يُشغّل مرة في الساعة مع cron

const topDevices = await db.query(`
  SELECT codename, display_name, brand 
  FROM devices 
  ORDER BY updated_at DESC 
  LIMIT 100
`);

// Save to public/data/top-devices.json
```

**التوفير:**
- قبل: 450,000/شهر
- بعد: 50,000-100,000/شهر (مع fallback للجديدة)
- **الفائدة: 350,000-400,000 استدعاء/شهر (39-44%)**

---

## 🥈 الأولوية الثانية: Polling → SSE (25% من الاستهلاك)

### الحالية
```
استدعاءات متكررة كل دقيقة:
- /api/stats (750 × 60 × 16 × 30 = 21.6M)
- /api/presence (2,500 × 30 × 16 × 30 = 36M)
- /api/notifications (6,000 × 60 × 16 × 30 = 172.8M)

الإجمالي بعد التحسينات الحالية: ~100,000/شهر مع caching
لكن بدون caching: 230,400,000 ❌
```

### الحل: Server-Sent Events (SSE)

**الخطوات:**

1. **إضافة SSE endpoint**
```typescript
// app/api/sse/route.ts
export async function GET(req: NextRequest) {
  const stream = new ReadableStream({
    async start(controller) {
      const userId = await getAuthUserId(req);
      
      // Subscribe to real-time events
      const unsubscribe = realtime.on('notification', userId, (notif) => {
        controller.enqueue(`data: ${JSON.stringify(notif)}\n\n`);
      });
      
      // Keep connection alive
      const heartbeat = setInterval(() => {
        controller.enqueue(`: heartbeat\n\n`);
      }, 30000); // ping every 30 seconds
      
      return () => {
        clearInterval(heartbeat);
        unsubscribe();
      };
    }
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
}
```

2. **استبدال useAuth polling**
```typescript
// lib/hooks/use-auth.tsx
useEffect(() => {
  const eventSource = new EventSource('/api/sse');
  
  eventSource.onmessage = (e) => {
    const data = JSON.parse(e.data);
    
    if (data.type === 'notification') {
      setNotifications(prev => [data, ...prev]);
    } else if (data.type === 'presence') {
      setPresence(data.users);
    } else if (data.type === 'stats') {
      setStats(data);
    }
  };
  
  return () => eventSource.close();
}, []);
```

3. **Backend: Supabase Real-time**
```typescript
// lib/realtime.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(url, key);

supabase
  .channel('notifications')
  .on('postgres_changes', 
    { event: 'INSERT', schema: 'public', table: 'notifications' },
    (payload) => {
      // broadcast to connected clients
      eventBus.emit('notification', payload.new);
    }
  )
  .subscribe();
```

**التوفير:**
- قبل: 230,400,000 طلب/شهر (بدون caching)
- بعد: 15,000-30,000/شهر (SSE connections cost much less)
- **الفائدة: 170,000-200,000 استدعاء/شهر (17-20%)**

---

## 🥉 الأولوية الثالثة: Database Queries (18% من الاستهلاك)

### الحالية
```
/api/roms و /api/devices queries:
- 180,000/شهر بعد caching
- قبل caching: 2,000,000+ ❌
```

### الحل: In-Memory Cache + PostgreSQL FTS

**الخطوات:**

1. **In-Memory Device Cache (10 دقائق)**
```typescript
// lib/server/devices-cache.ts
import NodeCache from 'node-cache';

const cache = new NodeCache({ stdTTL: 600 }); // 10 minutes

export async function getDevicesCached() {
  let devices = cache.get('all-devices');
  
  if (!devices) {
    devices = await sb.from('devices').select('*');
    cache.set('all-devices', devices);
  }
  
  return devices;
}

export function searchDevicesInMemory(
  devices: Device[], 
  query: string
) {
  return devices.filter(d =>
    d.display_name.toLowerCase().includes(query) ||
    d.codename.includes(query)
  );
}
```

2. **PostgreSQL Full-Text Search**
```sql
-- Create GIN index for FTS
CREATE INDEX idx_roms_fts ON roms USING GIN (
  to_tsvector('english', name || ' ' || device)
);

-- Query using FTS
SELECT * FROM roms 
WHERE to_tsvector('english', name || ' ' || device) 
  @@ plainto_tsquery('english', ?)
LIMIT 20;
```

3. **API استخدام الـ FTS**
```typescript
// app/api/roms/route.ts - GET handler
const { q } = searchParams;

if (q && q.length > 2) {
  // Use FTS for search
  const { data } = await sb.rpc('search_roms_fts', {
    query: q,
    limit: 24
  });
  return NextResponse.json(data);
} else {
  // Use cached list + in-memory filter
  const cached = await getDevicesCached();
  return NextResponse.json(cached);
}
```

**التوفير:**
- قبل: 180,000/شهر
- بعد: 30,000-50,000/شهر
- **الفائدة: 130,000-150,000 استدعاء/شهر (13-15%)**

---

## 📊 الملخص: الادخارات الإجمالية

| الأولوية | المصدر | الحالي | الحل | الفائدة |
|---------|--------|--------|------|---------|
| 🥇 | Device Images | 450k | 50-100k | 350-400k |
| 🥈 | Polling → SSE | 100k* | 15-30k | 170-200k |
| 🥉 | DB Queries | 180k | 30-50k | 130-150k |
| - | Cron/Analytics | 80k | 40-60k | 20-40k |
| **الإجمالي** | **1,000,000** | - | **300-400k** | **600-700k** |

*قبل تطبيق التحسينات: 230M

---

## ⏱️ جدول الأعمال

### الأسبوع 1: Device Images
- [ ] إنشاء `lib/images/device-images.ts`
- [ ] تعديل `components/device/device-image.tsx`
- [ ] إنشاء `scripts/generate-device-images.mjs`
- [ ] Testing على 100 جهاز
- **التوفير المتوقع: 300-350k**

### الأسبوع 2: SSE Implementation
- [ ] إنشاء `/api/sse/route.ts`
- [ ] تعديل `use-auth.tsx` للـ EventSource
- [ ] اختبار connection lifecycle
- [ ] Supabase Real-time setup
- **التوفير المتوقع: 170-200k**

### الأسبوع 3: Database Optimization
- [ ] إضافة `node-cache` و FTS
- [ ] تعديل `/api/roms/route.ts` و `/api/devices/route.ts`
- [ ] PostgreSQL FTS indexing
- [ ] Performance testing
- **التوفير المتوقع: 130-150k**

---

## 🎯 النتيجة النهائية

```
البداية:     1,000,000 استدعاء/شهر
بعد Phase 1:   970,000 (3% توفير) ✅ مكتمل
بعد Week 1:    600,000 (40% توفير)
بعد Week 2:    400,000 (60% توفير)
بعد Week 3:    250-350,000 (65-75% توفير) ✅

الهدف النهائي: < 300,000/شهر
