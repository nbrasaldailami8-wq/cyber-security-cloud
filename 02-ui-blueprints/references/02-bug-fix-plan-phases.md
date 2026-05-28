# خطة إصلاح الأخطاء والمشاكل — على مراحل

> **تاريخ التقرير:** 28 مايو 2026  
> **المصدر:** نتائج فحص نظام المحادثات والإشعارات  
> **الهدف:** إصلاح تدريجي آمن دون كسر أي وظيفة موجودة

---

## فهرس المشاكل المكتشفة

| # | المشكلة | النوع | الخطورة | الملفات المتأثرة |
|---|---------|-------|---------|------------------|
| 1 | Push Notifications غير فعّالة بالكامل | خلل وظيفي | حرجة | `pushNotifications.ts`, `public/`, `FloatingBell.tsx` |
| 2 | Presence يعمل فقط في صفحة `/chat` | خلل وظيفي | عالية | `supabaseRealtime.ts`, `ChatPage.tsx` |
| 3 | `lastSeenAt` لا يُحدّث عند إغلاق المتصفح | نقص ميزة | عالية | `supabaseRealtime.ts`, `layout.tsx` |
| 4 | `idempotencyKey` اختياري ← تكرار محتمل للرسائل | ثغرة | عالية | `MessageService.ts`, `api/chat/send/route.ts` |
| 5 | اشتراك Push محدود بجهاز واحد لكل مستخدم | خلل | متوسطة | `pushNotifications.ts` |
| 6 | تنظيف Push Subscriptions على 410 فقط | نقص | متوسطة | `pushNotifications.ts` |
| 7 | لا تخزين مؤقت للرسائل (كل تحميل = طلب API) | أداء | متوسطة | `ChatPage.tsx`, `ChatArea.tsx` |
| 8 | طابور Toast المخفي محدود بـ 5 إشعارات | فقدان بيانات | متوسطة | `FloatingBell.tsx` |
| 9 | Catch blocks صامتة تبتلع الأخطاء | مراقبة | متوسطة | `FloatingBell.tsx`, `MessageService.ts` |
| 10 | الرسالة مشفرة في DB لكن نص عادي في WebSocket | أمن | متوسطة | `MessageService.ts`, `supabaseRealtime.ts` |
| 11 | `typing_stop` بعد 3 ثوانٍ (بطيء قليلاً) | تجربة | منخفضة | `ChatArea.tsx` |
| 12 | حد 2000 حرف للرسائل | قيد | منخفضة | `api/chat/send/route.ts` |
| 13 | لا retry عند فشل إنشاء إشعار في DB | مرونة | منخفضة | `MessageService.ts` |

---

# المرحلة 1: إصلاحات البنية التحتية الحرجة

> **الهدف:** جعل الميزات الموجودة تعمل فعلياً لأول مرة  
> **نوع التغيير:** إضافي بحت (Additive) — لا يمس أي كود موجود  
> **الخطورة:** منخفضة جداً — إضافة قطع مفقودة لا تعديل قائمة

---

## 1.1 إصلاح Push Notifications — إضافة Service Worker

**المشكلة:** ملف `public/sw.js` (Service Worker) غير موجود. المكتبة `web-push` مثبتة والكود موجود في `pushNotifications.ts`، ولكن لا يوجد Service Worker يستقبل أحداث الـ Push.

**الحل:** إنشاء ملف Service Worker في `public/sw.js`

```javascript
// public/sw.js
self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {}
  const { title, body, icon, badge, url, ...options } = data
  event.waitUntil(
    self.registration.showNotification(title || "إشعار", {
      body: body || "",
      icon: icon || "/icons/icon-192x192.png",
      badge: badge || "/icons/icon-96x96.png",
      url: url || "/",
      ...options,
    })
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = event.notification.data?.url || "/"
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((windowClients) => {
      const existing = windowClients.find((c) => c.url === url)
      if (existing) {
        existing.focus()
      } else {
        clients.openWindow(url)
      }
    })
  )
})
```

**التأثير:** بدون هذا الملف، المتصفح لا يعرف كيف يتعامل مع أحداث Push الواردة.

---

## 1.2 إصلاح Push Notifications — إضافة API Route للتسجيل

**المشكلة:** لا يوجد endpoint `POST /api/push/subscribe` لتسجيل اشتراك Push من المتصفح.

**الحل:** إنشاء مسار API جديد:

```
src/app/api/push/subscribe/route.ts
```

```typescript
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAuth } from "@/lib/auth"

export async function POST(req: Request) {
  const session = await verifyAuth()
  if (!session) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 })
  }

  const { endpoint, keys } = await req.json()
  if (!endpoint || !keys) {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 })
  }

  // استخدام upsert لاستبدال الاشتراك السابق أو إضافة جديد
  await prisma.pushSubscription.upsert({
    where: { endpoint_userId: { endpoint, userId: session.userId } },
    update: { p256dh: keys.p256dh, auth: keys.auth },
    create: {
      userId: session.userId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    },
  })

  return NextResponse.json({ success: true })
}

export async function DELETE(req: Request) {
  const session = await verifyAuth()
  if (!session) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 })
  }

  const { endpoint } = await req.json()
  if (!endpoint) {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 })
  }

  await prisma.pushSubscription.deleteMany({
    where: { endpoint, userId: session.userId },
  })

  return NextResponse.json({ success: true })
}
```

**ملاحظة:** يجب التأكد من وجود نموذج `PushSubscription` في Prisma schema مع حقل `endpoint_userId` كـ unique composite. إذا لم يكن موجوداً، يجب استخدام `findFirst/delete` بدلاً من `upsert`.

**التأثير:** بدون هذا الـ API، المتصفح لا يستطيع تسجيل نفسه لتلقي الإشعارات.

---

## 1.3 إصلاح Push Notifications — إضافة زر التفعيل في FloatingBell

**المشكلة:** لا يوجد زر لطلب الإذن (Notification Permission) في الواجهة.

**الحل:** إضافة زر "تفعيل الإشعارات" في اللوحة المنبثقة لـ FloatingBell عندما يكون `Notification.permission === "default"`.

**الموقع:** `src/components/ui/FloatingBell.tsx`

**التغيير:** إضافة دالة وسيطة داخل المكون:

```typescript
// داخل FloatingBell.tsx — إضافة دالة
const requestPushPermission = useCallback(async () => {
  if (!("Notification" in window)) return

  const permission = await Notification.requestPermission()
  if (permission !== "granted") return

  // تسجيل Service Worker
  const registration = await navigator.serviceWorker.register("/sw.js")

  // الاشتراك في Push
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
  })

  // إرسال الاشتراك إلى الخادم
  await csrfFetch("/api/push/subscribe", {
    method: "POST",
    body: JSON.stringify(subscription.toJSON()),
  })
}, [])
```

وإضافة زر شرطي في الـ JSX:

```tsx
{typeof Notification !== "undefined" && Notification.permission === "default" && (
  <button onClick={requestPushPermission} className="..." >
    🔔 تفعيل الإشعارات
  </button>
)}
```

**التأثير:** المستخدم لا يملك وسيلة لتفعيل الإشعارات حالياً.

---

## 1.4 جعل Presence عاماً — نقله إلى Layout

**المشكلة:** `trackPresence()` يُستدعى فقط من `ChatPage.tsx` (السطر ~452). إذا كان المستخدم في أي صفحة أخرى، لا يتم تتبع حضوره. هذا يؤثر على:
- دقة قائمة المتصلين
- قرار إرسال Push Notification (لأن `isUserOnline` يعطي false خاطئ)
- عرض حالة الاتصال في الشات

**الحل:**
1. نقل استدعاء `trackPresence` من `ChatPage.tsx` إلى `src/app/layout.tsx`
2. ربطه مع `useSupabaseRealtime` (أو مباشرة مع Supabase channel)
3. التأكد من استدعاء `cleanupPresence()` عند تسجيل الخروج (موجود بالفعل في `Sidebar.tsx`)

**التغيير المحدد:**

في `src/app/layout.tsx` — إضافة useEffect لتتبع الحضور:

```typescript
// داخل layout.tsx — إضافة
useEffect(() => {
  const userStr = sessionStorage.getItem("user")
  if (!userStr) return
  const user = JSON.parse(userStr)
  if (user?.id) {
    trackPresence(user.id)
  }
  return () => cleanupPresence()
}, [])
```

ثم إزالة نفس الكود من `ChatPage.tsx`.

**التأثير:** بدون هذا الإصلاح، المستخدمون خارج صفحة `/chat` يظهرون كغير متصلين.

---

## 1.5 تحديث `lastSeenAt` عند إغلاق المتصفح

**المشكلة:** عند إغلاق المتصفح أو التبويب، لا يتم تحديث حقل `lastSeenAt` في قاعدة البيانات. النظام يعتمد فقط على Presence API الذي يفقد الاتصال عند قطع WebSocket (قد يستغرق 30-60 ثانية حتى يكتشف الخادم انقطاع الاتصال).

**الحل:** إضافة `beforeunload` عالمي في `layout.tsx` يُحدّث `lastSeenAt` عبر API بسيط.

**التغيير:**

1. إنشاء API بسيط:
```
src/app/api/user/ping/route.ts
```
```typescript
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAuth } from "@/lib/auth"

export async function POST(req: Request) {
  const session = await verifyAuth()
  if (!session) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 })
  }

  await prisma.user.update({
    where: { id: session.userId },
    data: { lastSeenAt: new Date() },
  })

  return NextResponse.json({ success: true })
}
```

2. إضافة `beforeunload` في `layout.tsx`:

```typescript
useEffect(() => {
  const handleUnload = () => {
    navigator.sendBeacon("/api/user/ping", JSON.stringify({}))
  }
  window.addEventListener("beforeunload", handleUnload)
  window.addEventListener("pagehide", handleUnload)
  return () => {
    window.removeEventListener("beforeunload", handleUnload)
    window.removeEventListener("pagehide", handleUnload)
  }
}, [])
```

**التأثير:** بدون هذا الإصلاح، `lastSeenAt` يبقى عالقاً في آخر نشاط معروف، وقد يظهر المستخدم "متصلاً" لفترة بعد خروجه الفعلي.

---

# المرحلة 2: منع فقدان البيانات والتكرار

> **الهدف:** ضمان سلامة البيانات ومنع التكرار  
> **نوع التغيير:** تعديل كود موجود + إضافات  
> **الخطورة:** متوسطة — يجب اختبار كل تغيير جيداً

---

## 2.1 تعزيز Idempotency — جعل `idempotencyKey` تلقائياً من الخادم

**المشكلة:** `idempotencyKey` اختياري في الـ Zod schema (`idempotencyKey: z.string().max(64).optional()`). إذا لم يُرسله العميل (أو إذا كان هناك خطأ في الشبكة وأعاد العميل الإرسال)، يمكن أن تُنشأ رسائل مكررة.

**الحل:** تعديل `MessageService.sendMessage` لإنشاء `idempotencyKey` تلقائياً إذا لم يُرسل، أو جعله إجبارياً في الـ Zod schema على مستوى الخادم.

**الموقع:** `src/app/api/chat/send/route.ts` + `src/services/chat/MessageService.ts`

**التغيير في API route:**

```typescript
// تعديل Zod schema
const schema = z.object({
  receiverId: z.string().min(1),
  body: z.string().min(1).max(2000),
  replyToId: z.string().optional(),
  idempotencyKey: z.string().max(64).optional(),
})
```

**التغيير في MessageService:**

```typescript
// داخل sendMessage — إضافة قبل التحقق من idempotency
if (!idempotencyKey) {
  idempotencyKey = `${senderId}-${Date.now()}-${crypto.randomUUID()}`
}
```

**التأثير:** الرسائل المكررة ممكنة حالياً.

---

## 2.2 دعم أجهزة متعددة لكل مستخدم في Push

**المشكلة:** `pushNotifications.ts` يستخدم `findUnique({ where: { userId } })` في Prisma، مما يعني أن المستخدم يمكنه امتلاك اشتراك واحد فقط. تسجيل الدخول من جهاز آخر يحل محل الاشتراك السابق.

**الحل:** تغيير `findUnique` إلى `findMany` وإرسال الإشعار إلى جميع الأجهزة المسجلة.

**الموقع:** `src/lib/pushNotifications.ts`

**التغيير:**

```typescript
// قبل
const subscription = await prisma.pushSubscription.findUnique({
  where: { userId },
})

// بعد
const subscriptions = await prisma.pushSubscription.findMany({
  where: { userId },
})

for (const sub of subscriptions) {
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      JSON.stringify(payload)
    )
  } catch (error: any) {
    if (error.statusCode === 410 || error.statusCode === 404) {
      await prisma.pushSubscription.delete({ where: { id: sub.id } })
    }
  }
}
```

**التأثير:** بدون هذا الإصلاح، المستخدمون على أجهزة متعددة لا يستقبلون الإشعارات.

---

## 2.3 توسيع طابور Toast المخفي

**المشكلة:** `hiddenToastQueueRef` في `FloatingBell.tsx` مقيد بـ 5 إشعارات. إذا كان المستخدم بعيداً عن التبويب فترة طويلة، تُفقد الإشعارات الزائدة.

**الحل:** زيادة الحد إلى 20، أو جعله ديناميكياً بناءً على الوقت المنقضي.

**الموقع:** `src/components/ui/FloatingBell.tsx` — البحث عن `hiddenToastQueueRef`

**التغيير:**

```typescript
// قبل
const hiddenToastQueueRef = useRef<any[]>([])
const MAX_HIDDEN_TOASTS = 5

// بعد
const hiddenToastQueueRef = useRef<any[]>([])
const MAX_HIDDEN_TOASTS = 20
```

**التأثير:** المستخدمون الذين يعودون بعد غياب طويل قد يفقدون إشعارات.

---

# المرحلة 3: تحسين الأمان والمراقبة

> **الهدف:** سد الثغرات الأمنية وتحسين logging  
> **نوع التغيير:** تعديل + إضافة  
> **الخطورة:** متوسطة

---

## 3.1 تشفير الرسالة في البث المباشر (Real-time)

**المشكلة:** الرسائل تُخزّن مشفّرة في قاعدة البيانات (`encryptMessage`)، ولكن تُبث **نصاً عادياً** عبر Supabase Realtime WebSocket. أي شخص لديه صلاحية الوصول إلى قناة المستخدم يمكنه قراءة محتوى الرسالة.

**الحل:** تعديل `MessageService.sendMessageWithSideEffects` لتشفير الرسالة قبل البث المباشر أيضاً.

**الموقع:** `src/services/chat/MessageService.ts` — دالة `sendMessageWithSideEffects`

**التغيير:**

```typescript
// قبل البث — تشفير الرسالة للبث
const broadcastPayload = {
  ...message,
  body: encryptMessage(message.body),  // ← إضافة
}

// البث باستخدام payload المشفر بدلاً من message العادي
broadcastEvent(senderChannel, "new-message", broadcastPayload)
broadcastEvent(receiverChannel, "new-message", broadcastPayload)
```

ثم في `ChatPage.tsx` — عند استقبال رسالة جديدة، فك التشفير:

```typescript
// عند استقبال حدث "new-message"
const handler = (payload) => {
  const decryptedMessage = {
    ...payload,
    body: decryptMessage(payload.body),
  }
  // ... باقي المعالجة
}
```

**ملاحظة:** دالتا `encryptMessage` و `decryptMessage` مستوردتان من `src/lib/crypto.ts` والمفتاح موجود في الخادم فقط. يجب توفير مفتاح آخر للـ client-side أو استخدام آلية مختلفة.

**بديل أكثر أماناً:** إنشاء زوج مفاتيح لكل محادثة، أو استخدام `crypto.subtle` في المتصفح. ولكن هذا تغيير كبير. الإصلاح الأبسط هو تشفير الـ payload بنفس مفتاح الخادم (مع العلم أن المفتاح سيكون في الكود المصدّر للمتصفح).

**التأثير:** البيانات الحساسة (الرسائل) تنتقل نصاً عادياً عبر WebSocket.

---

## 3.2 إصلاح Catch Blocks الصامتة

**المشكلة:** بعض `try/catch` في `FloatingBell.tsx` و `MessageService.ts` تبتلع الأخطاء دون تسجيل أو إشعار المستخدم. هذا يجعل تصحيح الأخطاء صعباً وقد يخفي مشاكل حقيقية.

**الموقع:** البحث عن `catch` في:
- `src/components/ui/FloatingBell.tsx`
- `src/services/chat/MessageService.ts`
- `src/lib/supabaseRealtime.ts`

**الحل:** إضافة `console.error` في كل `catch` block صامت، مع إعادة رمي الخطأ إذا كان مناسباً.

**مثال للتغيير:**

```typescript
// قبل
try {
  // ...
} catch {
  // صامت
}

// بعد
try {
  // ...
} catch (error) {
  console.error("[FloatingBell] فشل في معالجة الإشعار:", error)
  // إظهار Toast للمستخدم إذا كان خطأ حرج
  showToast("error", "حدث خطأ في الإشعارات")
}
```

**التأثير:** الأخطاء تُبتلع حالياً دون أي تسجيل.

---

## 3.3 تحسين تنظيف Push Subscriptions

**المشكلة:** `sendPushToUsers` يحذف الاشتراكات منتهية الصلاحية فقط عند استقبال HTTP 410 (Gone). الأخطاء الأخرى (404, 400, 403) لا تؤدي إلى حذف الاشتراك، مما يسبب تراكم اشتراكات غير صالحة.

**الموقع:** `src/lib/pushNotifications.ts`

**التغيير:**

```typescript
// قبل
if (error.statusCode === 410) {
  await prisma.pushSubscription.delete({ where: { id: sub.id } })
}

// بعد
if ([410, 404, 400, 403].includes(error.statusCode)) {
  await prisma.pushSubscription.delete({ where: { id: sub.id } })
  console.warn(`[Push] تم حذف اشتراك غير صالح: ${sub.endpoint}`)
}
```

**التأثير:** تراكم الاشتراكات المنتهية يستهلك مساحة في قاعدة البيانات ويسبب محاولات إرسال فاشلة.

---

# المرحلة 4: تحسين الأداء وتجربة المستخدم

> **الهدف:** تسريع التطبيق وتحسين UX  
> **نوع التغيير:** إضافي (Additive)  
> **الخطورة:** منخفضة

---

## 4.1 إضافة تخزين مؤقت للرسائل (IndexedDB)

**المشكلة:** عند تحميل صفحة `/chat`، كل المحادثات والرسائل تُحمل من API. عند العودة إلى الصفحة، يُعاد الطلب من جديد. لا يوجد Cache.

**الحل:** استخدام `localStorage` مؤقتاً (للبداية) أو IndexedDB للتخزين الدائم للرسائل. يمكن البدء بحل بسيط باستخدام `localStorage` للمحادثات الأخيرة.

**الموقع:** `src/app/chat/page.tsx` أو إنشاء ملف مساعد `src/lib/messageCache.ts`

**مخطط بسيط للمرحلة الأولى:**

```typescript
// src/lib/messageCache.ts
const CACHE_KEY = "chat-cache"
const CACHE_TTL = 5 * 60 * 1000 // 5 دقائق

export interface MessageCache {
  conversations: Conversation[]
  messages: Record<string, Message[]>
  timestamp: number
}

export const getMessageCache = (): MessageCache | null => {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const cache: MessageCache = JSON.parse(raw)
    if (Date.now() - cache.timestamp > CACHE_TTL) {
      localStorage.removeItem(CACHE_KEY)
      return null
    }
    return cache
  } catch {
    return null
  }
}

export const setMessageCache = (data: Partial<MessageCache>) => {
  try {
    const existing = getMessageCache() ?? { conversations: [], messages: {}, timestamp: Date.now() }
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ...existing, ...data, timestamp: Date.now() }))
  } catch {
    // localStorage قد يكون ممتلئاً
  }
}
```

**التأثير:** كل تحميل صفحة يُعيد جلب جميع البيانات من API.

---

## 4.2 تحسين توقيت `typing_stop`

**المشكلة:** `resetTypingStop` في `ChatArea.tsx` يستخدم مهلة 3000ms (قُلّصت من 5000ms سابقاً). قد تكون 3000ms لا تزال طويلة بعض الشيء.

**الحل:** تقليص المهلة إلى 2000ms.

**الموقع:** `src/components/chat/ChatArea.tsx`

**التغيير:**

```typescript
// قبل
const TYPING_STOP_TIMEOUT = 3000

// بعد
const TYPING_STOP_TIMEOUT = 2000
```

**التأثير:** المستخدم قد يرى "يكتب الآن..." لمدة 3 ثوانٍ بعد توقف الطرف الآخر عن الكتابة.

---

## 4.3 إضافة Retry عند فشل إنشاء الإشعار

**المشكلة:** في `MessageService.sendMessageWithSideEffects`، إذا فشل `prisma.notification.create`، يتم ابتلاع الخطأ (catch صامت) ولا يتم إعادة المحاولة.

**الحل:** إضافة نظام retry بسيط (محاولتان) مع تسجيل الفشل.

**الموقع:** `src/services/chat/MessageService.ts`

**التغيير:**

```typescript
// إضافة دالة مساعدة
async function createNotificationWithRetry(data: any, retries = 2): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      await prisma.notification.create({ data })
      return
    } catch (error) {
      if (i === retries - 1) {
        console.error("[Notification] فشل إنشاء الإشعار بعد", retries, "محاولات:", error)
      } else {
        await new Promise((r) => setTimeout(r, 1000))
      }
    }
  }
}
```

**التأثير:** فشل عابر في قاعدة البيانات يؤدي إلى فقدان الإشعار دون أي إشعار للنظام.

---

# ملخص التغييرات حسب الملف

| الملف | المرحلة | التغيير |
|-------|---------|---------|
| `public/sw.js` | 1 | **جديد** — إنشاء Service Worker |
| `src/app/api/push/subscribe/route.ts` | 1 | **جديد** — API Route للتسجيل في Push |
| `src/components/ui/FloatingBell.tsx` | 1 | إضافة زر "تفعيل الإشعارات" |
| `src/app/layout.tsx` | 1 | إضافة `trackPresence()` + `beforeunload` لـ `lastSeenAt` |
| `src/app/api/user/ping/route.ts` | 1 | **جديد** — API لتحديث `lastSeenAt` |
| `src/app/chat/page.tsx` | 1 | إزالة `trackPresence` (منقول إلى Layout) |
| `src/app/api/chat/send/route.ts` | 2 | تعزيز `idempotencyKey` |
| `src/services/chat/MessageService.ts` | 2 | إنشاء `idempotencyKey` تلقائي |
| `src/lib/pushNotifications.ts` | 2 | `findMany` بدل `findUnique` + تحسين cleanup |
| `src/components/ui/FloatingBell.tsx` | 2 | زيادة `MAX_HIDDEN_TOASTS` من 5 إلى 20 |
| `src/services/chat/MessageService.ts` | 3 | تشفير الرسالة في البث المباشر |
| `src/components/ui/FloatingBell.tsx` | 3 | إصلاح catch blocks الصامتة |
| `src/app/chat/page.tsx` | 3 | فك تشفير الرسالة عند استقبال البث |
| `src/lib/messageCache.ts` | 4 | **جديد** — نظام تخزين مؤقت للرسائل |
| `src/app/chat/page.tsx` | 4 | استخدام messageCache |
| `src/components/chat/ChatArea.tsx` | 4 | تقليص TYPING_STOP_TIMEOUT إلى 2000ms |

---

# جدول الأولويات المقترح

| الأولوية | المرحلة | المدة المتوقعة | المخاطر |
|----------|---------|----------------|---------|
| 🥇 الأولى | المرحلة 1 (الإصلاحات الحرجة) | 2-3 ساعات | منخفضة جداً — إضافات فقط |
| 🥈 الثانية | المرحلة 2 (سلامة البيانات) | 1-2 ساعة | متوسطة — تعديل كود موجود |
| 🥉 الثالثة | المرحلة 3 (الأمان والمراقبة) | 2-3 ساعات | متوسطة — تعديل تشفير |
| 4 | المرحلة 4 (الأداء) | 1-2 ساعة | منخفضة — إضافات بشكل رئيسي |

---

> **ملاحظة مهمة:** قبل البدء بأي مرحلة، يُفضّل أخذ نسخة احتياطية من الملفات المتأثرة (Git commit أو save). كل مرحلة مصممة لتكون مستقلة وقابلة للاختبار بشكل منفصل.
