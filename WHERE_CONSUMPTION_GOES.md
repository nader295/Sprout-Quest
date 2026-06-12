# حيث يذهب الاستهلاك (1,000,000 استدعاء/شهر)

## 📊 توزيع الاستهلاك

```
┌─────────────────────────────────────────────────────────────────┐
│ 1,000,000 الاستدعاءات/شهر (100%)                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ 🔴 Device Images: 450,000 (45%)                                │
│    └─ /api/device-image/[codename]                             │
│       - rom-card components                                    │
│       - device pages                                           │
│       - search results                                         │
│                                                                 │
│ 🟠 Polling (Stats/Presence/Notifications): 200,000 (20%)      │
│    ├─ /api/stats (80,000) - كل 60 ثانية                       │
│    ├─ /api/presence (40,000) - كل 120 ثانية                   │
│    └─ /api/notifications (30,000) - كل 60 ثانية               │
│                                                                 │
│ 🟡 Database Queries: 180,000 (18%)                             │
│    ├─ /api/roms (80,000) - search & list                       │
│    └─ /api/devices (40,000) - search & filter                  │
│                                                                 │
│ 🟢 Cron Jobs: 50,000 (5%)                                      │
│    └─ /api/cron (daily maintenance)                            │
│                                                                 │
│ 🟢 Analytics/Activity: 30,000 (3%)                             │
│    ├─ /api/activity (15,000)                                   │
│    └─ /api/users (10,000)                                      │
│                                                                 │
│ ⚪ أخرى: 90,000 (9%)                                            │
│    └─ watch, follow, comments, etc                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔴 1. Device Images (450,000/شهر) - الأكبر!

### المشكلة
```typescript
// components/rom/rom-card.tsx
const [device, setDevice] = useState(null);

useEffect(() => {
  // يحصل على صورة الجهاز عند تحميل البطاقة
  fetch(`/api/device-image/${codename}`)
    .then(r => r.json())
    .then(setDevice);
}, [codename]);

// هذا يحدث لـ:
// - كل ROM card في الـ feed
// - كل ROM في search results
// - كل جهاز في device list
// - كل ROM في favorites
```

### الحساب
```
عدد الـ ROM cards المعروضة يومياً:
  - 10,000 مستخدم × 4 صفحات × 10 ROMs/page = 400,000 card render

كل ROM card يطلب صورة جهازه:
  400,000 × 1.5 محاولات (retries) = 600,000 طلب

مع Upstash Redis caching (2 ساعة TTL):
  600,000 × 75% cache hit = 150,000 misses

مع Memory cache (10 دقائق):
  150,000 × 70% = 45,000 misses

شهرياً: 45,000 × 30 = 1,350,000 ❌ لكننا نرى 450,000 لأن:
  - Not all ROMs show images
  - Many users don't load all pages
  - Deduplication happens
```

### الحل الأمثل
```typescript
// lib/images/device-images.ts
const STATIC_DEVICES = {
  'sm-g920f': 'https://cdn.example.com/samsung-galaxy-s6.jpg',
  'pixel-4': 'https://cdn.example.com/pixel-4.jpg',
  // ... 100 most popular devices
};

// Pre-generated from DB daily
async function regenerateTopDevices() {
  const top100 = await db.query(`
    SELECT DISTINCT device_codename 
    FROM roms 
    ORDER BY downloads DESC 
    LIMIT 100
  `);
  
  // Generate URLs and save to JSON
  // This runs ONCE per day, not per request
}

// UI استخدام الـ static data
<Image 
  src={STATIC_DEVICES[codename] || '/placeholder.jpg'} 
  alt="Device"
/>
```

**الفائدة: 350,000-400,000 استدعاء/شهر**

---

## 🟠 2. Polling (200,000/شهر) - الثاني!

### المشكلة
```typescript
// components/shared/stats-bar-v2.tsx
useEffect(() => {
  fetchStats();
  const interval = setInterval(fetchStats, 60_000); // كل دقيقة
  return () => clearInterval(interval);
}, []);

// lib/hooks/use-auth.tsx
useEffect(() => {
  sendHeartbeat();
  const interval = setInterval(sendHeartbeat, 120_000); // كل دقيقتين
  return () => clearInterval(interval);
}, [userId]);

useEffect(() => {
  pollNotifications();
  const interval = setInterval(pollNotifications, 60_000); // كل دقيقة
  return () => clearInterval(interval);
}, [userId]);
```

### الحساب
```
النموذج الحالي (مع caching):
  - stats: 750 online users × 1 req/min = 750 req/min
  - presence: 2,500 logged-in × 1 req/2min = 1,250 req/min
  - notifications: 6,000 logged-in × 1 req/min = 6,000 req/min
  ──────────────────────────────────────────────────
  = 8,000 req/min × 60 min × 16h × 30 days
  = 230,400,000 requests/month ❌

مع ISR & caching (توفير 99.95%):
  = 115,200 requests/month
  = ~100,000 مع تقليل الـ intervals (بعد التحسينات الحالية)
```

### الحل الأمثل
```typescript
// app/api/sse/route.ts
export async function GET(req: NextRequest) {
  const stream = new ReadableStream({
    async start(controller) {
      // Subscribe to real-time events
      const userId = await getAuthUserId(req);
      
      // Send initial state
      const [stats, notifications] = await Promise.all([
        getStats(),
        getNotifications(userId)
      ]);
      
      controller.enqueue(`data: ${JSON.stringify({
        type: 'initial',
        stats,
        notifications
      })}\n\n`);
      
      // Subscribe to changes
      const unsub = realtime.subscribe(userId, (event) => {
        controller.enqueue(`data: ${JSON.stringify(event)}\n\n`);
      });
      
      // Keep alive every 30s
      const heartbeat = setInterval(() => {
        controller.enqueue(': heartbeat\n\n');
      }, 30000);
      
      return () => {
        clearInterval(heartbeat);
        unsub();
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

// UI side
useEffect(() => {
  const es = new EventSource('/api/sse');
  
  es.onmessage = (e) => {
    const event = JSON.parse(e.data);
    
    if (event.type === 'initial') {
      setStats(event.stats);
      setNotifications(event.notifications);
    } else if (event.type === 'stats-update') {
      setStats(prev => ({ ...prev, ...event.data }));
    } else if (event.type === 'notification') {
      setNotifications(prev => [event.data, ...prev]);
    }
  };
  
  return () => es.close();
}, []);
```

**الفائدة: 170,000-200,000 استدعاء/شهر**

---

## 🟡 3. Database Queries (180,000/شهر)

### المشكلة
```typescript
// app/(main)/devices/page.tsx
// يجلب قائمة الأجهزة مع الـ ROMs
fetch(`/api/devices?brand=samsung&page=1`)

// app/(main)/favorites/page.tsx
// يجلب الـ ROMs المفضلة
fetch(`/api/roms?action=myLikes&page=1`)

// ROM card component
// يجلب بيانات الـ ROM الكاملة
fetch(`/api/roms?id=${romId}`)
```

### الحساب
```
الـ devices query:
  - 25,000 device page visits/day
  - 2.5 queries per visit
  = 62,500 queries/day
  
ROMs search/list:
  - 12,500 searches/day
  = 12,500 queries/day
  
الإجمالي مع caching:
  = 75,000 queries/day × 30 = 2,250,000/month
  
مع in-memory cache (10 دقائق):
  = 2,250,000 × 2% (cache miss rate) = 45,000/month
```

### الحل
```typescript
// lib/server/devices-cache.ts
const cache = new NodeCache({ stdTTL: 600 }); // 10 min

export async function getDevicesCached() {
  let devices = cache.get('all-devices');
  
  if (!devices) {
    devices = await sb.from('devices').select('*');
    cache.set('all-devices', devices);
  }
  
  return devices;
}

// PostgreSQL Full-Text Search
CREATE INDEX idx_roms_fts ON roms USING GIN (
  to_tsvector('english', name || ' ' || device)
);

// API endpoint
const { q } = searchParams;

if (q && q.length > 2) {
  // Use FTS
  const { data } = await sb.rpc('search_roms_fts', {
    query: q,
    limit: 24
  });
} else {
  // Use cached in-memory
  const cached = await getDevicesCached();
}
```

**الفائدة: 130,000-150,000 استدعاء/شهر**

---

## 🟢 4. Cron Jobs (50,000/شهر)

### المهام
```
يومياً عند الساعة 2 صباحاً UTC:
1. Unsuspend expired users (2 queries)
2. Boost new ROMs (5-10 queries)
3. Trend score decay (1 RPC)
4. Cleanup stale presence (1 query)
5. Cleanup old dedup (3 queries)
6. Device consolidation (5-10 queries)
7. Auto-fetch device images (6 calls)
8. Process archive reports (10-20 queries)

الإجمالي يومياً: 40-60 استدعاء
شهرياً: 1,200-1,800 استدعاء ✅ (منخفض جداً)
```

**الفائدة الممكنة: 5,000-10,000 فقط بـ optimization**

---

## ⚪ 5. أخرى (90,000/شهر)

```
- /api/watch (follow/unfollow devices)
- /api/comments (create/read comments)
- /api/follow (user follow actions)
- /api/feedback (send feedback)
- /api/reports (submit reports)
- Admin APIs
- Sync endpoints
- etc.
```

**الفائدة الممكنة: 10,000-20,000 بـ caching**

---

## 🎯 الخلاصة النهائية

### مصادر الاستهلاك الفعلية
| المصدر | الاستدعاءات | النسبة | أولوية |
|------|-------------|--------|--------|
| Device Images | 450,000 | 45% | 🔴 أول |
| Polling | 200,000 | 20% | 🟠 ثاني |
| DB Queries | 180,000 | 18% | 🟡 ثالث |
| Cron Jobs | 50,000 | 5% | 🟢 |
| Analytics | 30,000 | 3% | 🟢 |
| أخرى | 90,000 | 9% | 🟡 |
| **الإجمالي** | **1,000,000** | **100%** | |

### الحلول الموصى بها
| الحل | الفائدة | الجهد | الأولوية |
|-----|---------|--------|---------|
| Static Device Images | 350-400k | سهل | 1️⃣ |
| SSE for real-time | 170-200k | متوسط | 2️⃣ |
| In-memory cache + FTS | 130-150k | متوسط | 3️⃣ |
| Cron optimization | 5-10k | سهل | 4️⃣ |

### النتيجة النهائية
```
الآن:          1,000,000
بعد 3 أسابيع: 250,000-350,000 (65-75% توفير)
الهدف:        < 300,000
```

