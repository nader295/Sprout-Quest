# Phase 2 Monitoring & Alerts Setup

**Purpose:** Track the impact of Phase 2 optimizations and detect issues early
**Duration:** Continuous (at least 4 weeks post-deployment)

---

## Key Metrics to Monitor

### 1. Function Invocation Count (Primary Metric)

**Dashboard Name:** Invocation Usage
**Vercel Path:** Project Settings > Usage > Function Invocations

#### Targets
- **Daily Target:** 970,000 → 11,600/day (from 32,258/day)
- **Weekly Target:** 81,200/week (from 225,806/week)
- **Monthly Target:** 290,000-370,000 (from 970,000)
- **Reduction:** 61-68%

#### Alerting Rules
```
WARN if: daily invocations > 15,000 (130% of target)
CRITICAL if: daily invocations > 20,000 (170% of target)
CRITICAL if: daily invocations increase > 5% from previous day
```

#### What to Do If Alert Fires
1. Check if deployment just happened (give 2 hours to stabilize)
2. Review error logs for new exceptions
3. Check SSE connection health
4. Monitor cache hit rates
5. If still high after 4h, trigger rollback

---

### 2. Cache Hit Rates

#### Device Image Cache
```
Metric: device_cache_hit_rate
Target: 90-95%
Alert: < 80%
```

**Monitor**
- Track via application logging in API responses
- Log cache hits vs. total requests
- Analyze by device codename

**What to Do If Low**
1. Check if top-devices.json is up-to-date
2. Verify cron job ran successfully
3. Check if new popular devices missing from cache
4. Review which devices are causing misses

#### Query Cache
```
Metric: query_cache_hit_rate
Target: 85-90%
Alert: < 75%
```

**Monitor**
- Track in query-cache.ts hit/miss counts
- Monitor by cache key pattern (ROM, device, stats, etc.)
- Alert on sustained low hit rate

**What to Do If Low**
1. Review cache TTL times (may need adjustment)
2. Check if popular queries changed
3. Monitor query patterns for anomalies
4. Verify cache invalidation isn't too aggressive

---

### 3. SSE Connection Health

#### Active Connections
```
Metric: sse_active_connections
Target: 500-3,000 concurrent
Alert: > 5,000 or < 100 (if traffic normal)
```

**Monitor**
- Log connection count in RealtimeManager
- Track connections by minute
- Alert on sudden spikes or drops

**What to Do If High**
1. Check if DDoS or unusual traffic
2. Verify memory usage stays acceptable
3. Check for connection leaks
4. Monitor message queue size

**What to Do If Low During Peak Hours**
1. Check error logs for connection failures
2. Verify EventSource API working in browsers
3. Check for CORS or SSL errors
4. Test from different network locations

#### Connection Stability
```
Metric: sse_reconnection_rate
Target: < 0.1 reconnections/second/1000 connections
Alert: > 0.5 reconnections/second/1000 connections
```

**Monitor**
- Track reconnection events
- Alert on sustained high reconnection rate
- Analyze reconnection patterns

**What to Do If High**
1. Check network stability
2. Review server logs for errors
3. Check memory/CPU usage on server
4. Verify timeout configurations

---

### 4. Error Rates

#### By Endpoint
```
Target: < 1% error rate per endpoint
Alert: > 2% on /api/device-image
Alert: > 3% on /api/realtime
```

**Monitor**
- `/api/device-image/[codename]` - Target: 0.5%
- `/api/realtime` - Target: 1%
- `/api/roms` (with cache) - Target: 0.5%
- `/api/devices` (with cache) - Target: 0.5%

**Error Categories**
- 4xx errors (validation/not found) - Investigate unusual spike
- 5xx errors (server errors) - Immediate escalation
- Timeout errors - Check if service dependencies slow
- Cache-related errors - Check cache state

#### Total Application Error Rate
```
Target: < 2% 
Alert: > 2.5%
```

**What to Do If Alert Fires**
1. Check error log for error patterns
2. Identify which endpoint causing issues
3. Check if new code deployment in progress
4. Review database health
5. Consider gradual rollback

---

### 5. Response Time Metrics

#### Device Image API
```
Metric: device_image_response_time_p95
Target: < 100ms (cached), < 2000ms (non-cached)
Alert: > 150ms (cached), > 3000ms (non-cached)
```

#### SSE Endpoint
```
Metric: realtime_initial_response_time
Target: < 200ms
Alert: > 500ms
```

#### Query Endpoints
```
Metric: query_response_time_p99
Target: < 300ms
Alert: > 500ms
```

**What to Do If Response Time Degrades**
1. Check database query performance
2. Review cache hit rates (low hits = slow)
3. Check server CPU/memory usage
4. Analyze slow query logs
5. Consider increasing cache TTL

---

### 6. Database Health

#### Query Count
```
Metric: database_query_count_per_minute
Target: Decrease by 20-30% from Phase 1
Alert: Increase > 5% from Phase 2 baseline
```

**Monitor**
- Total queries/min
- Breakdown by query type
- Queries hitting cache vs. DB

#### Query Latency
```
Metric: database_query_duration_p99
Target: No change from Phase 1
Alert: > 10% slower than Phase 1
```

**What to Do If Database Slow**
1. Check for long-running queries
2. Review indexes are being used
3. Check for table locks
4. Monitor disk I/O
5. Consider query optimization

---

### 7. Browser Client Health

#### Device Image Load Success Rate
```
Metric: device_image_load_success_rate
Target: > 95%
Alert: < 90%
```

**Track Via:**
- Image onload/onerror events
- Track in ROM card component
- Log to analytics

**What to Do If Low**
1. Check if CDN having issues
2. Verify GSMArena/Wikipedia endpoints available
3. Check browser console for errors
4. Test from different geographic regions

#### SSE Connection Success Rate
```
Metric: sse_connection_success_rate
Target: > 99%
Alert: < 98%
```

**Track Via:**
- EventSource onerror events
- useRealtime hook connection state
- Client-side analytics

**What to Do If Low**
1. Check server-side logs
2. Test with browser dev tools
3. Check network tab for connection issues
4. Verify CORS headers correct

---

## Alert Configuration Examples

### Prometheus/Grafana Setup
```yaml
groups:
  - name: phase2_optimizations
    interval: 60s
    rules:
      # Invocation count alert
      - alert: HighInvocationCount
        expr: rate(function_invocations_total[5m]) > 13
        for: 10m
        annotations:
          summary: "Invocation rate too high: {{ $value }}/min"
          
      # Cache hit rate alert
      - alert: LowCacheHitRate
        expr: device_cache_hit_rate < 0.80
        for: 15m
        annotations:
          summary: "Device cache hit rate low: {{ $value | humanizePercentage }}"
          
      # SSE connection alert
      - alert: SSEConnectionIssues
        expr: rate(sse_reconnection_events_total[5m]) > 0.5
        for: 5m
        annotations:
          summary: "High SSE reconnection rate: {{ $value }}/s"
```

### PagerDuty Configuration
```
Critical Alerts (immediate page):
- Total invocations exceed 400k/day
- Error rate > 5%
- Database down

Urgent Alerts (1h response):
- Invocations exceed 300k/day
- Error rate 2-5%
- Cache hit rate < 60%
- SSE mass disconnection

Warning Alerts (daily digest):
- Invocations trending up
- Cache hit rate 60-80%
- Response time degradation
```

---

## Dashboard Setup

### Vercel Dashboard
1. Project Settings > Usage
   - View function invocation trend
   - Compare to previous month
   - Export for reporting

2. Logs & Monitoring
   - Search for error patterns
   - Filter by endpoint
   - Check latest deployments

### Custom Dashboard
Create a dashboard with these panels:

```
Row 1: Top-level metrics
- Total invocations (daily/weekly/monthly)
- Error rate (%)
- Cache hit rate (%)
- Active SSE connections

Row 2: Detailed breakdown
- Device image cache: hit rate, response time
- Query cache: hit rate, entry count
- SSE: connections, reconnections, memory
- Database: query count, latency

Row 3: Troubleshooting
- Error rate by endpoint
- Top slow endpoints
- Top erroring endpoints
- Cache misses by type

Row 4: Health checks
- API availability
- Database health
- External service health (GSMArena, Wikipedia)
```

---

## Daily Monitoring Checklist

### Every Morning (Check Past 24h)
- [ ] Total invocations: On track?
- [ ] Error rate: Below 2%?
- [ ] Device cache hit rate: > 90%?
- [ ] No new error patterns?
- [ ] SSE connections stable?

### Weekly Review (Check Past Week)
- [ ] Invocation trend: Decreasing as expected?
- [ ] Cache hit rates consistent?
- [ ] Response times stable?
- [ ] Database performance unchanged?
- [ ] Any alerts fired? How were they resolved?

### Monthly Review (Check Past Month)
- [ ] Total invocations: Achieved target range?
- [ ] Compare to projections
- [ ] Identify any unexpected costs
- [ ] Plan optimizations for Phase 3
- [ ] Document lessons learned

---

## Troubleshooting Guide

### Issue: Invocation Count Not Decreasing

**Likely Causes:**
1. Static cache not being used (device not in cache)
2. SSE connections failing, falling back to polling
3. Cache not invalidating properly
4. New features consuming API calls

**Debug Steps:**
1. Check device-image API response logs
   ```
   Look for: "source: static-cache" in responses
   Expected: > 90% of requests
   ```
2. Check SSE connection logs
   ```
   Look for: Connection count > 1000
   If < 100: Users falling back to polling
   ```
3. Review cache hit rates
   ```
   If < 80%: Cache invalidation too aggressive
   ```
4. Check for new API calls in user flows

---

### Issue: High Error Rate on Device Images

**Likely Causes:**
1. External CDN (GSMArena, Wikipedia) down
2. CORS errors from browser
3. Timeout trying to fetch images
4. Invalid device codename

**Debug Steps:**
1. Check error logs for patterns
   ```
   Search: device-image 4xx or 5xx errors
   ```
2. Test manually
   ```
   curl "https://yourdomain.com/api/device-image/pixel-4"
   ```
3. Check browser console
   ```
   Look for CORS or timeout errors
   ```
4. Verify external services
   ```
   Test: https://fdn2.gsmarena.com/vv/bigpic/google-pixel-4.jpg
   ```

---

### Issue: SSE Connections Dropping

**Likely Causes:**
1. Server memory leak
2. Network connectivity issues
3. Browser tab closing without cleanup
4. Too many concurrent connections

**Debug Steps:**
1. Monitor server memory
   ```
   If > 1GB: Possible memory leak
   Review: RealtimeManager.connections map
   ```
2. Check browser network tab
   ```
   Look for: Connection reset/timeout
   Check: Network tab shows EventSource
   ```
3. Review reconnection logic
   ```
   Verify: Exponential backoff working
   Check: Max reconnection delay reached?
   ```

---

## Rollback Decision Tree

```
Is invocation count > 350k/month?
├─ YES: Is error rate > 5%?
│  ├─ YES: CRITICAL - Start rollback immediately
│  └─ NO: Wait 6h, recheck
└─ NO: Continue monitoring

Is error rate > 2%?
├─ YES: Investigate error cause
│  ├─ Device image errors: Disable static cache
│  ├─ SSE errors: Disable SSE, use polling
│  └─ Other: Full rollback
└─ NO: Continue

Is cache hit rate < 60%?
├─ YES: Disable SSE, keep static cache
│  └─ (Need to regenerate cache data)
└─ NO: Continue

All metrics normal?
├─ YES: Deployment successful!
│  └─ Plan Phase 3 in 2 weeks
└─ NO: Investigate specific metric
```

---

## Contact Information

**On-Call Engineer:** (To be assigned)
**Engineering Lead:** (To be assigned)
**Escalation Path:**
1. Incident Commander
2. Engineering Lead
3. VP Engineering

**Communication Channels:**
- #romx-incidents (Slack)
- Incident report: (Link to form)
- Status page: (Link to status page)

---

**Last Updated:** June 12, 2026
**Next Review:** June 13, 2026 (24h post-deployment)
