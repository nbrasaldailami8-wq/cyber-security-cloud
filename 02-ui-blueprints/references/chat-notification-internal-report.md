# تقرير الفحص المتقدم لنظام المحادثات والإشعارات

> **تاريخ الفحص:** 28 مايو 2026  
> **نطاق الفحص:** جميع ملفات المشروع في `E:\vscod\cyber-security-cloud`  
> **نوع الفحص:** تحليل بنية داخلية وخارجية (Internal & External Architecture)  
> **حالة الفحص:** اكتمل دون تعديل أي ملف

---

## فهرس المحتويات

1. [نظام المحادثات — البنية الخارجية (Server/API)](#1-نظام-المحادثات--البنية-الخارجية-serverapi)
2. [نظام المحادثات — البنية الداخلية (Client/Browser)](#2-نظام-المحادثات--البنية-الداخلية-clientbrowser)
3. [نظام المحادثات — تدفقات البيانات (Data Flows)](#3-نظام-المحادثات--تدفقات-البيانات-data-flows)
4. [نظام المحادثات — ملاحظات وتحليلات](#4-نظام-المحادثات--ملاحظات-وتحليلات)
5. [نظام الإشعارات — البنية الخارجية (Server/API)](#5-نظام-الإشعارات--البنية-الخارجية-serverapi)
6. [نظام الإشعارات — البنية الداخلية (Client/Browser)](#6-نظام-الإشعارات--البنية-الداخلية-clientbrowser)
7. [نظام الإشعارات — تدفقات البيانات (Data Flows)](#7-نظام-الإشعارات--تدفقات-البيانات-data-flows)
8. [نظام الإشعارات — ملاحظات وتحليلات](#8-نظام-الإشعارات--ملاحظات-وتحليلات)
9. [المكتبات المشتركة بين النظامين](#9-المكتبات-المشتركة-بين-النظامين)
10. [نظام التشخيص والمراقبة (Diagnostics)](#10-نظام-التشخيص-والمراقبة-diagnostics)
11. [الملخص والنتائج النهائية](#11-الملخص-والنتائج-النهائية)

---

# 1. نظام المحادثات — البنية الخارجية (Server/API)

## 1.1 ملفات API Routes

### `src/app/api/chat/send/route.ts` — إرسال رسالة
- **الطريقة:** POST
- **المصادقة:** JWT (accessToken) عبر الكوكيز
- **التحقق من الصحة (Validation):** Zod schema مع ثلاثة حقول إلزامية:
  - `receiverId` (string, min 1) — معرف المستقبل
  - `body` (string, min 1, max 2000) — نص الرسالة
  - `replyToId` (string, optional) — معرف الرسالة المقتبسة
  - `idempotencyKey` (string, optional, max 64) — مفتاح منع التكرار
- **تحديد معدل الإرسال (Rate Limiting):** `messageRateLimiter` على أساس IP + userId
- **العزل الأكاديمي:** فحص صارم للأدوار:
  - MANAGEMENT: يمكنه مراسلة ADMIN فقط، أو TEACHER/STUDENT من نفس المستوى
  - TEACHER: لا يمكنه مراسلة TEACHER آخر، يمكنه مراسلة STUDENT/MANAGEMENT من نفس المستوى
  - STUDENT: لا يمكنه مراسلة STUDENT آخر، يمكنه مراسلة TEACHER/MANAGEMENT من نفس المستوى
  - ADMIN: يمكنه مراسلة الجميع دون قيود
- **الاستجابة:** `{ success, message, data: { message object } }`

### `src/app/api/chat/messages/route.ts` — إدارة الرسائل
- ثلاث طرق HTTP:

**GET — استرجاع المحادثات والرسائل:**
- بدون `userId`: يعيد قائمة المحادثات (conversations) للمستخدم الحالي
- مع `userId`: يعيد رسائل المحادثة بين المستخدم الحالي والمستخدم المحدد
- **الترقيم (Pagination):** Cursor-based (وليس page-based)، مع `nextCursor` للصفحة التالية
- **الحد الأقصى:** 50 عنصراً للقوائم، 50 عنصراً للرسائل
- **فحص العزل الأكاديمي:** دالة `isSameLevel` تتحقق من مستوى المستخدمين
- **علامات القراءة:** تحديث تلقائي `isRead = true` عند قراءة الرسائل

**PATCH — تعديل رسالة:**
- يستقبل `messageId` و `newBody`
- يتحقق من أن المستخدم هو مرسل الرسالة فقط
- يبث حدث `message-edited` عبر Supabase Broadcast إلى المرسل والمستقبل

**DELETE — حذف رسالة أو محادثة:**
- `حذف رسالة للجميع (delete-for-everyone)`: يضع `deletedAt` (حذف ناعم) ويبث `message-deleted` للطرفين
- `حذف رسالة لنفسي`: يضع `senderDeleted` أو `receiverDeleted` حسب الطرف
- `حذف محادثة (delete-conversation)`: يضع `senderDeleted` لكل رسائل المستخدم
- `حظر (block)`: يضع `isBlocked = true` على كل الرسائل بين الطرفين

### `src/app/api/chat/users/route.ts` — البحث عن المستخدمين
- **الطريقة:** GET
- **المعلمات:** `search`, `level`, `role`, `page`, `limit`
- **العزل الأكاديمي:** نفس القيود حسب الدور
- **يستثني:** المستخدم الحالي نفسه، المستخدمين المحذوفين، الحسابات غير المفعلة

## 1.2 طبقة الخدمة (Service Layer)

### `src/services/chat/MessageService.ts` — 393 سطراً
**الوظائف الأساسية:**

**`getConversations(userId, limit, cursor)`:**
- يبني فلتر عزل أكاديمي حسب الدور
- يسأل Prisma عن آخر رسالة لكل محادثة
- يُفك تشفير `body` لكل رسالة (لأن الرسائل مشفرة)
- يُجمّع المحادثات في مصفوفة مع `lastSeenAt`, `lastLoginAt` من جدول المستخدمين
- **ملاحظة:** `lastSeenAt` يُقرأ من `users.lastSeenAt` في قاعدة البيانات

**`getMessages(userId, otherUserId, limit, cursor)`:**
- يسترجع الرسائل بترتيب تصاعدي
- يُفك تشفير `body` لكل رسالة والرسالة المقتبسة (`replyTo`)
- يُحدّث `isRead` لكل الرسائل غير المقروءة
- يُعيد مؤشر `nextCursor` للصفحة التالية

**`sendMessage(senderId, receiverId, body, replyToId?, idempotencyKey?)`:**
- يُنظف النص باستخدام DOMPurify (إزالة كل وسوم HTML)
- يُشفر النص باستخدام `encryptMessage` قبل التخزين
- يتحقق من `idempotencyKey` لمنع الإرسال المكرر
- يُحدّث `lastSeenAt` للمرسل

**`sendMessageWithSideEffects(senderId, receiverId, body, replyToId?, idempotencyKey?, ip?)`:**
- يتحقق من عدم وجود حظر بين الطرفين
- يستدعي `sendMessage` الداخلية
- ينشئ إشعاراً في جدول `notifications` للمستقبل
- يبث حدث `new-message` عبر Supabase Broadcast إلى قنوات المرسل والمستقبل
- يتحقق مما إذا كان المستقبل متصلاً حالياً (`isUserOnline`)
- إذا لم يكن متصلاً: يُرسل إشعاراً عبر Web Push VAPID

**`editMessage(messageId, userId, newBody)`:**
- يتحقق من أن المستخدم هو مرسل الرسالة
- يُشفّر النص الجديد ويُحدّث `isEdited = true`
- يبث حدث `message-edited` للطرفين

**`deleteMessage(messageId, userId, action?, otherUserId?)`:**
- حذف للجميع: يتحقق من الملكية، يضع `deletedAt`
- حذف لنفسي: يضع `senderDeleted` أو `receiverDeleted`
- حذف محادثة: يضع `senderDeleted` لكل الرسائل
- حظر: يضع `isBlocked = true`
- كل عملية حذف تبث الأحداث عبر Broadcast

**`markConversationRead(userId, otherUserId)`:**
- يحدّث `isRead` للرسائل غير المقروءة
- يبث حدث `messages-read` إلى قناة المرسل الآخر

---

# 2. نظام المحادثات — البنية الداخلية (Client/Browser)

## 2.1 `src/app/chat/page.tsx` — 1014 سطراً (بعد التعديل)

### الحالة (State):
- قائمة المحادثات (`conversations[]`) من نوع `Conversation`
- الرسائل (`messages[]`) من نوع `Message`
- المستخدم المختار (`selectedUser`)
- حالة البحث (`searchTerm`, `searchResults`, `filterLevel`, `filterRole`)
- حالة الكتابة (`typingUser`)
- حالة المتصلين (`onlineUserIds: Set<string>`)
- الترقيم المؤشر (`conversationCursor`, `messageCursor`)

### الميزات:
- **الترقيم المؤشر (Cursor-based Pagination):** مع `loadMoreConversations` و `loadMoreMessages`
- **بث الكتابة (Typing Broadcast):** يستقبل حدثي `typing` و `typing_stop` عبر `useSupabaseRealtime`
- **تحديد المستخدم المتصل (Online Users):** يشترك في `getOnlineUsers` لتحديث `onlineUserIds`
- **حماية صوت الإشعارات:** لا يشغّل صوتاً عند استقبال رسالة في صفحة الشات (السطر 255-256 في FloatingBell)
- **استعادة الجلسة:** يحفظ `selectedUser` في `sessionStorage` لإعادة التحميل
- **خصائص الأمان:** متغيرات `mountedRef` لمنع التحديث بعد الفك، و `loadMsgGenRef` لمنع استجابات قديمة

### التفاصيل البصرية للقائمة:
- نقطة خضراء `#2ea043` بحجم 8px مع توهج `0 0 6px rgba(46,160,67,0.5)` بجانب اسم المتصل
- ✍️ **يكتب الآن...** بلون سماوي `#00e5ff` عند الكتابة
- 🟢 **متصل الآن** بلون أخضر `#2ea043` عند الاتصال
- الرسالة الأخيرة + إيصال القراءة في حالة عدم الاتصال

## 2.2 `src/components/chat/ChatArea.tsx` — 1342 سطراً

### الوظائف:
- عرض الرسائل في فقاعات (messages bubbles)
- إرسال رسائل (optimistic UI + إعادة محاولة)
- تعديل رسالة (نافذة منبثقة)
- حذف رسالة، حذف للجميع، حذف محادثة، حظر مستخدم
- الرد على رسالة (quote/reply)
- بحث داخل المحادثة
- **استقبال `typingUserId` من الصفحة الأب وعرض "✍️ يكتب الآن..." في رأس المحادثة**
- **استقبال `onlineUserIds` عبر `getOnlineUsers` وعرض "متصل الآن" أو "آخر ظهور"**
- **بث أحداث typing إلى قناة المستقبل عبر `broadcastEvent`**

### بث أحداث الكتابة (Lines 244-274):
- `debouncedTypingEmit()`: يرسل حدث `typing` عبر `broadcastEvent` مرة كل ثانيتين
- `resetTypingStop()`: يرسل حدث `typing_stop` بعد 3 ثوانٍ (قُلّصت من 5 ثوانٍ)
- عند مسح حقل الإدخال بالكامل: يُرسل `typing_stop` فوراً

### نظام إعادة المحاولة (Retry Queue):
- `retryQueueRef`: يخزّن الرسائل الفاشلة
- `MAX_RETRIES = 3` محاولات
- فترة انتظار 1.5 ثانية بين كل محاولة
- يُشغّل عند عودة الاتصال `connectionState === "connected"`

### التحقق من الحظر:
- يُتحقق قبل الإرسال عبر الخادم الذي يفحص حقل `isBlocked`

### إيصالات القراءة:
- علامة `✓` للرسالة المرسلة غير المقروءة (لون `#5a6a7a`)
- علامة `✓✓` للرسالة المقروءة (لون `#00e5ff`)

---

# 3. نظام المحادثات — تدفقات البيانات (Data Flows)

## 3.1 تدفق إرسال رسالة (مباشر)

```
[المستخدم يكتب] → ChatArea.onChange() → debouncedTypingEmit()
    ↓
broadcastEvent(getUserChannelName(receiver), "typing", { userId })
    ↓
[المستخدم يضغط Enter] → sendMessage()
    ↓
1. إنشاء رسالة مؤقتة (optimistic) ← تظهر فوراً في الواجهة
2. csrfFetch POST /api/chat/send
    ↓
 API Route → Zod validation → Rate limiting → Academic isolation check
    ↓
 MessageService.sendMessageWithSideEffects()
    ↓
    ├─ encryptMessage(body) → تخزين مشفر في Prisma
    ├─ إنشاء إشعار في جدول notifications
    ├─ broadcastEvent(senderChan, "new-message", payload)
    ├─ broadcastEvent(receiverChan, "new-message", payload)
    └─ if (!isUserOnline(receiver)) → pushNotifications(sendPushToUsers)
    ↓
3. استبدال الرسالة المؤقتة بالرسالة الحقيقية من الخادم
4. broadcastEvent(receiverChan, "typing_stop", { userId })
```

## 3.2 تدفق استلام رسالة (مباشر)

```
broadcastEvent(receiverChan, "new-message", payload)
    ↓
useSupabaseRealtime("user-{userId}", ["new-message", ...])
    ↓
 handler في ChatPage:
    ├─ تحديث قائمة المحادثات (debounced 300ms)
    ├─ إذا كانت المحادثة مفتوحة حالياً → تحديث الرسائل
    ├─ تشغيل صوت الإشعارات (إذا لم يكن في صفحة /chat)
    └─ (FloatingBell يتجاهل رسائل الشات)
```

## 3.3 تدفق حالة الاتصال (Presence Online/Offline)

```
trackPresence(userId) يُستدعى عند:
    ├─ تحميل صفحة /chat (useEffect)
    └─ عند اتصال قناة Supabase (sharedChannelPool)
    ↓
initPresenceChannel(userId)
    ↓
supabase.channel(channelName, { presence: { key: hashPresenceKey(userId) } })
    ↓
    ├─ channel.track({ userId, online_at }) ← يظهر في Presence State
    ├─ heartbeat كل 10 ثوانٍ (يثبت الاتصال)
    ├─ BroadcastChannel بين التبويبات (multi-tab coordination)
    └─ عند قطع الاتصال → presenceState() لا يعود يحتوي على userId
    ↓
subscribePresence(callback) → (Online Users[])
    ↓
ChatPage.setOnlineUserIds(new Set(users))
ChatArea.setOnlineUsers(new Set(users))
    ↓
    ├─ isOnline(user): onlineUsers.has(user.id)
    └─ عرض نقطة خضراء / "متصل الآن" / "آخر ظهور"
```

## 3.4 تدفق الحظر

```
[المستخدم يضغط حظر] → confirmAction → executeBlockUser()
    ↓
csrfFetch DELETE /api/chat/messages { otherUserId, action: "block" }
    ↓
MessageService.deleteMessage(..., action: "block")
    ↓
prisma.message.updateMany({ isBlocked: true })
    ↓
return → showToast → onClose → onConversationDeleted
```

---

# 4. نظام المحادثات — ملاحظات وتحليلات

## 4.1 نقاط القوة
1. **تشفير الرسائل:** `encryptMessage/decryptMessage` باستخدام `src/lib/crypto` — جميع الرسائل مشفرة عند التخزين
2. **منع التكرار (Idempotency):** `idempotencyKey` مع UUID عشوائي لكل رسالة
3. **العزل الأكاديمي:** قيود صارمة على من يمكنه مراسلة من حسب الدور والمستوى
4. **حماية العواصف (Storm Protection):** `sharedChannelPool` يستخدم backoff exponentials مع random jitter
5. **التشخيص الكامل:** `realtimeDiagnostics` يتتبع كل حدث، طلب، استجابة، وخطأ
6. **التفاؤلية (Optimistic UI):** الرسائل تظهر فوراً قبل تأكيد الخادم
7. **إعادة المحاولة التلقائية:** مع 3 محاولات وتباعد 1.5 ثانية
8. **التنسيق بين التبويبات:** BroadcastChannel لإدارة presence عبر التبويبات المتعددة
9. **تحديث `lastSeenAt`:** عند كل إرسال رسالة (`prisma.user.update`)

## 4.2 نقاط الضعف المحتملة
1. **عدم تحديث `lastSeenAt` عند الخروج:** لا يوجد `beforeunload` عالمي يحدّث `lastSeenAt` عند إغلاق المتصفح — يعتمد كلياً على Presence API (الذي يفقد الاتصال عند قطع WebSocket)
2. **لا يوجد WebSocket عند الخلفية:** Presence يعمل فقط في التبويبات النشطة. عند تصغير المتصفح، `visibilityState` يوقف الـ heartbeat
3. **غياب تخزين مؤقت للرسائل:** لا يوجد IndexedDB أو cache للرسائل — إذا أعيد تحميل الصفحة، كل الرسائل تُحمل من API مرة أخرى
4. **حجم الرسالة الأقصى 2000 حرف:** هذا قد يكون محدوداً لبعض حالات الاستخدام
5. **بث `typing_stop` بعد 3 ثوانٍ فقط:** قد يكون بطيئاً بعض الشيء، لكنه مقبول

## 4.3 الملفات المكونة للنظام

| الملف | الأسطر | الوظيفة |
|-------|--------|---------|
| `src/app/chat/page.tsx` | 1014 | صفحة المحادثات الرئيسية |
| `src/components/chat/ChatArea.tsx` | 1342 | مكوّن منطقة الرسائل |
| `src/services/chat/MessageService.ts` | 393 | منطق الأعمال (خدمة) |
| `src/app/api/chat/send/route.ts` | 117 | API إرسال الرسائل |
| `src/app/api/chat/messages/route.ts` | 121 | API إدارة الرسائل |
| `src/app/api/chat/users/route.ts` | 88 | API البحث عن المستخدمين |
| `src/lib/realtimeChannels.ts` | 20 | اشتقاق أسماء القنوات |
| `src/lib/supabaseRealtime.ts` | 610 | نظام Presence والبث |
| `src/lib/sharedChannelPool.ts` | 251 | تجمّع القنوات المشترك |
| `src/hooks/useSupabaseRealtime.ts` | 176 | هوك Realtime |
| `src/components/layout/Sidebar.tsx` | (متصل) | رابط القائمة الجانبية |

---

# 5. نظام الإشعارات — البنية الخارجية (Server/API)

## 5.1 ملفات API Routes

### `src/app/api/notifications/list/route.ts` — استرجاع الإشعارات
- **الطريقة:** GET
- **المعلمات:** `page` (رقم الصفحة), `limit` (عدد العناصر)
- **المصادقة:** JWT عبر الكوكيز
- **يعيد:** `{ success, data, total, unreadCount, page, limit }`

### `src/app/api/notifications/mark-read/route.ts` — تحديث القراءة
- **الطريقة:** POST
- **المحتوى:** `notificationId` (اختياري) أو `all: true`
- إذا أُرسل `all: true`: تحديث كل الإشعارات غير المقروءة للمستخدم
- إذا أُرسل `notificationId`: تحديث إشعار واحد

## 5.2 طبقة الخدمة

### `src/services/notification/NotificationService.ts` — 70 سطراً
**الوظائف:**
- `getUserNotifications(userId, page, limit)`: استعلام Prisma مع `total` و `unreadCount`
- `markAsRead(ids, userId)`: تحديث `isRead` لمجموعة من المعرفات
- `markAllAsRead(userId)`: تحديث كل الإشعارات غير المقروءة
- `markRead(userId, notificationId?, all?)`: دالة شاملة مع التحقق من صحة المدخلات
- `getUnreadCount(userId)`: عدد الإشعارات غير المقروءة

## 5.3 الإشعارات الخارجية (Web Push)

### `src/lib/pushNotifications.ts` — 101 سطراً
- يستخدم `web-push` مع VAPID keys
- **`sendPushNotification(userId, title, body, url?)`:** يرسل إشعاراً لمستخدم واحد
- **`sendPushToUsers(userIds[], notification)`:** يرسل إشعاراً لمجموعة مستخدمين
  - يشمل: `title`, `body`, `icon` (/icons/icon-192x192.png), `badge` (/icons/icon-96x96.png), `data`, `requireInteraction`, `sound`
  - يحذف الاشتراكات منتهية الصلاحية (HTTP 410)
- يُستدعى من `MessageService.sendMessageWithSideEffects` عندما يكون المستقبل غير متصل

## 5.4 إنشاء الإشعارات (Server-Side)

**أين تُنشأ الإشعارات:**
- داخل `MessageService.sendMessageWithSideEffects` (السطر 345-353):
  ```typescript
  prisma.notification.create({
    data: {
      userId: receiverId,
      type: "NEW_MESSAGE",
      title: "رسالة جديدة",
      body: `رسالة جديدة من ${sender.name}`,
      linkUrl: "/chat",
    },
  })
  ```

**أنواع الإشعارات (حسب `Notification` interface):**
- `NEW_MESSAGE` — رسالة جديدة 💬
- `ASSIGNMENT_EVALUATED` — تقييم تكليف ✅
- `NEW_ASSIGNMENT` — تكليف جديد 📤
- `NEW_ANNOUNCEMENT` — تعميم جديد 📢
- `NEW_CONTENT` — محتوى جديد 📚
- `GRADES_DISTRIBUTED` — توزيع درجات 📝
- `ACCOUNT_MODIFIED` — تعديل حساب ⚙️
- `LEVEL_PROMOTED` — ترقية مستوى 🎉

---

# 6. نظام الإشعارات — البنية الداخلية (Client/Browser)

## 6.1 `src/components/ui/FloatingBell.tsx` — 642 سطراً

### أين تظهر:
- ثابتة في `layout.tsx` — تظهر في كل صفحات التطبيق
- مخفية فقط في `/login` و `/onboarding`

### التصميم البصري:
- دائرة 56px في الزاوية السفلى اليسرى (bottom: 30px, left: 30px)
- z-index: 200
- خلفية زجاجية `rgba(10,20,40,0.75)` مع `backdrop-filter: blur(20px)`
- border: `2px solid rgba(0,229,255,0.4)`
- box-shadow: `0 8px 32px rgba(0,229,255,0.2), 0 0 60px rgba(0,229,255,0.08)`
- عداد أحمر `#f85149` في أعلى اليمين مع `box-shadow: 0 0 12px rgba(248,81,73,0.5)`
- انتقالات Spring لظهور الإشعارات

### النافذة المنبثقة (Popup):
- عرض 380px، أقصى ارتفاع 500px
- خلفية `rgba(10,20,40,0.95)` مع `backdrop-filter: blur(30px)`
- border: `1px solid rgba(0,229,255,0.2)`
- borderRadius: 20px
- box-shadow: `0 20px 60px rgba(0,0,0,0.6), 0 0 40px rgba(0,229,255,0.1)`
- z-index: 201
- يظهر 8 إشعارات فقط

### الحماية من العواصف (Storm Protection):
- إذا وصل أكثر من 20 إشعاراً في 10 ثوانٍ → يُفعل `stormActive`
- يُظهر Toast واحد "لديك إشعارات جديدة متعددة"
- يُثبّط الصوت حتى انتهاء مدة العاصفة (10 ثوانٍ إضافية)

### التحكم في الصوت:
- يُشغّل صوت `/sounds/notification.mp3` لكل إشعار جديد
- حماية التكرار: throttle 1 ثانية بين الأصوات
- حماية التبويب المخفي: لا صوت إذا كان `visibilityState ≠ visible`
- حماية صفحة الشات: لا صوت إذا كان المسار `/chat`
- حماية التبويب غير النشط: لا صوت إذا كان التبويب Standby

### معالجة الإشعارات المخفية (Hidden Toast Queue):
- إذا كان المستخدم في تبويب آخر، تُخزّن الإشعارات في `hiddenToastQueueRef`
- عند العودة للتبويب (`visibilitychange` إلى visible)، تُظهر الـ Toasts المتراكمة
- الحد الأقصى: 5 إشعارات في الطابور

### الحماية من التكرار:
- `processedIdsRef: Set<string>` يتتبع معرفات الإشعارات المعالجة
- انتهاء صلاحية بعد 60 ثانية (`setTimeout` لإزالة المعرف)
- حد أقصى 500 معرف في الذاكرة

### إعادة الاتصال (Reconnection):
- عند تغير `connectionState` من `reconnecting` إلى `connected`
- مع cooldown 2 ثانية لمنع التكرار
- يستدعي `scheduleNotificationRefresh()` (debounced 300ms)

### التوجيه عند النقر:
- ينقر المستخدم على إشعار → `csrfFetch` لتحديث `isRead` → `router.push(linkUrl)`

## 6.2 `src/app/notifications/page.tsx` — 297 سطراً

### وصف الصفحة:
- صفحة `/notifications` لعرض سجل الإشعارات الكامل
- design: `glass card` مع `#010204` خلفية

### الميزات:
- تحميل 20 إشعاراً في كل صفحة مع زر "عرض المزيد"
- حالة فارغة: 📭 "لا توجد إشعارات"
- تصميم البطاقة:
  - مقروء: خلفية `rgba(22,27,34,0.4)`، border `1px solid rgba(255,255,255,0.05)`
  - غير مقروء: خلفية `rgba(0,229,255,0.06)`، border `1px solid rgba(0,229,255,0.2)`
  - أيقونة `typeIcons[notif.type]` أو 🔔 افتراضي
  - نقطة زرقاء `10px` مع توهج للإشعارات غير المقروءة
- زر "تحديد الكل كمقروء" (يظهر فقط إذا كان هناك إشعارات غير مقروءة)
- تنسيق الوقت النسبي: "الآن"، "منذ X دقيقة"، "منذ X ساعة"، "منذ X يوم"
- التنقل إلى `linkUrl` عند النقر مع تحديث `isRead`

## 6.3 `src/store/notificationStore.ts` — 87 سطراً

### Zustand Store:
- `notifications: Notification[]` — قائمة الإشعارات
- `unreadCount: number` — عدد غير المقروء
- `isLoading: boolean` — حالة التحميل
- `setNotifications()` — مع منع التحديث غير الضروري (مقارنة الـ id + count)
- `addNotification()` — مع منع التكرار (`some(n => n.id === notification.id)`)
- `markAsRead(id)` — تحديث محلي لإشعار واحد
- `markAllAsRead()` — تحديث محلي للكل
- `fetchNotifications()` — GET `/api/notifications/list`
- `clearNotifications()` — يُستدعى عند تسجيل الخروج (Sidebar)

## 6.4 `src/components/ui/Toast.tsx` — 104 سطراً

### وصف المكوّن:
- **ToastProvider**: يغلّف التطبيق في `layout.tsx`
- **useToast()**: يعيد `{ showToast(message, type) }`
- 4 أنواع: `success` (أخضر #2ea043), `error` (أحمر #f85149), `warning` (أصفر #ffca28), `info` (سماوي #00e5ff)
- موضع: أعلى يسار الصفحة
- مدة العرض: 4 ثوانٍ
- transition: انزلاق من اليسار

**المستهلكون (28 ملفاً):** جميع الصفحات الرئيسية ولوحات التحكم والصفحات الإدارية تستخدم `useToast()` للإشعارات اللحظية.

---

# 7. نظام الإشعارات — تدفقات البيانات (Data Flows)

## 7.1 تدفق إشعار جديد (من الخادم إلى المتصفح)

```
حدث في التطبيق (مثلاً: تقييم تكليف)
    ↓
prisma.notification.create({ userId, type, title, body, linkUrl })
    ↓
(اختياري) broadcastEvent عبر Supabase
    ↓
useSupabaseRealtime("user-{userId}", "notification", handler)
    ↓
FloatingBell.handler(data):
    ├─ 1. فحص التكرار (processedIdsRef)
    ├─ 2. فحص العاصفة (20 في 10 ثوانٍ)
    ├─ 3. حفظ في popup + تحديث العداد
    ├─ 4. تشغيل الصوت (مع 7 طبقات حماية)
    ├─ 5. Toast فوري (إذا visible)
    ├─ 6. حفظ في queue (إذا hidden → يظهر عند العودة)
    └─ 7. تحديث API debounced (إذا ليس NEW_MESSAGE)
```

## 7.2 تدفق فتح الإشعارات

```
[مستخدم ينقر على إشعار]
    ↓
handleClickNotification(notif):
    ├─ csrfFetch POST /api/notifications/mark-read { notificationId }
    ├─ loadNotifications() ← تحديث القائمة
    └─ router.push(notif.linkUrl)
```

## 7.3 تدفق Push Notification (عند عدم الاتصال)

```
MessageService.sendMessageWithSideEffects()
    ↓
isUserOnline(receiverId) === false
    ↓
sendPushToUsers([receiverId], { title, body, data })
    ↓
prisma.pushSubscription.findMany({ where: { userId } })
    ↓
webpush.sendNotification(subscription, payload)
    ↓
[متصفح المستخدم] → Service Worker → إشعار نظام
```

---

# 8. نظام الإشعارات — ملاحظات وتحليلات

## 8.1 نقاط القوة
1. **تحديث مباشر مزدوج:** Supabase Broadcast + Web Push VAPID — يضمن وصول الإشعارات حتى عند إغلاق المتصفح
2. **حماية شاملة من العواصف:** 7 طبقات حماية للصوت، storm detection، throttling، deduplication
3. **معالجة التبويبات المخفية:** تجميع الإشعارات في queue وتفريغها عند العودة
4. **تنسيق متعدد التبويبات:** BroadcastChannel لإدارة presence عبر التبويبات
5. **إعادة الاتصال الذكية:** cooldown 2 ثانية + debounce 300ms + exponential backoff
6. **التتبع الكامل للتشخيص:** `trackNotifRefresh`, `trackNotifDedup`, `trackNotifReconnect` مع forensic audio tracing

## 8.2 نقاط الضعف المحتملة
1. **Push Subscription لكل مستخدم واحد فقط:** `prisma.pushSubscription.findUnique({ where: { userId } })` — مستخدم واحد = اشتراك واحد فقط. إذا سجّل الدخول من جهاز آخر، يُستبدل الاشتراك السابق
2. **لا يوجد إشعارات مجدولة:** جميع الإشعارات فورية. لا يوجد نظام إشعارات مؤجلة (scheduled notifications)
3. **حجم `hiddenToastQueueRef` محدود بـ 5:** إذا كان المستخدم بعيداً عن التبويب فترة طويلة، قد يفقد بعض الإشعارات
4. **حذف Push Subscription عند الفشل فقط بحالة 410:** أنواع أخرى من الأخطاء (مثل 404) لا تحذف الاشتراك
5. **الاعتماد على `prisma.notification.create` فقط:** لا يوجد نظام retry إذا فشل إنشاء الإشعار في قاعدة البيانات (catch صامت)

## 8.3 الملفات المكونة للنظام

| الملف | الأسطر | الوظيفة |
|-------|--------|---------|
| `src/components/ui/FloatingBell.tsx` | 642 | أيقونة الجرس العائمة + النافذة المنبثقة |
| `src/components/ui/Toast.tsx` | 104 | نظام Toast المنبثق |
| `src/app/notifications/page.tsx` | 297 | صفحة سجل الإشعارات |
| `src/store/notificationStore.ts` | 87 | Zustand store للإشعارات |
| `src/services/notification/NotificationService.ts` | 70 | خدمة الإشعارات |
| `src/app/api/notifications/list/route.ts` | 24 | API قائمة الإشعارات |
| `src/app/api/notifications/mark-read/route.ts` | 23 | API تحديث القراءة |
| `src/lib/pushNotifications.ts` | 101 | إشعارات Web Push |
| `src/app/layout.tsx` | (متصل) | تضمين FloatingBell + ToastProvider |

---

# 9. المكتبات المشتركة بين النظامين

## 9.1 `src/lib/supabaseRealtime.ts` — 610 أسطر

**المسؤولة عن:**
- إنشاء اتصال Supabase
- `broadcastEvent(channelName, eventName, data)` — إرسال أحداث عبر WebSocket مع queue للقنوات غير الجاهزة
- `trackPresence(userId)` — بدء تتبع الحضور
- `subscribePresence(callback)` — الاشتراك في قائمة المتصلين
- `isUserOnline(userId)` — التحقق من حالة مستخدم معين
- `cleanupPresence()` — تنظيف كامل للـ Presence عند تسجيل الخروج

**إدارة القنوات:**
- `getOrCreateChannel(channelName)` — مع حد أقصى 10 قنوات
- `evictOldestChannel()` — إزالة الأقدم استخداماً عند تجاوز الحد
- قائمة انتظار للرسائل أثناء عدم جاهزية القناة

**Presence System:**
- Heartbeat كل 10 ثوانٍ
- BroadcastChannel للتنسيق بين التبويبات
- Watchdog failover: إذا لم يستقبل التبويب الخامل heartbeat لمدة 35s، يطالب بالدور النشط
- معالجة تغير الرؤية (visibilitychange) مع debounce 500ms

## 9.2 `src/lib/sharedChannelPool.ts` — 251 سطراً

**تجمّع القنوات المشترك:**
- عدة مشتركين يمكنهم مشاركة نفس قناة Supabase
- تسجيل الأحداث (`registerEventListeners`) لكل مشترك جديد
- إعادة اتصال تلقائي مع backoff exponentials (1000ms base, 30000ms max, random jitter 10%)
- تنظيف عند مغادرة آخر مشترك (إزالة القناة من Supabase)
- تتبع التشخيص (`registerPoolSnapshot`)

## 9.3 `src/hooks/useSupabaseRealtime.ts` — 176 سطراً

**هوك React لـ Realtime:**
- يصادق على القناة عبر `/api/realtime/authorize`
- يشترك في `sharedChannelPool`
- يحمي من العواصف (`getStormWarning()` + تأخير 5 ثوانٍ)
- يتتبع الحالة (`connected`, `disconnected`, `reconnecting`)
- يُشغّل `trackPresence` عند الاتصال

## 9.4 `src/lib/realtimeChannels.ts` — 20 سطراً

**اشتقاق أسماء القنوات:**
- `getUserChannelName(userId)`: `user-{hmac-sha256(userId).slice(0,16)}`
- `getPresenceChannelName()`: `presence-{hmac-sha256("presence-global").slice(0,16)}`
- يستخدم `crypto.createHmac` مع `REALTIME_CHANNEL_SECRET`

## 9.5 `src/lib/realtimeDiagnostics.ts` — 1611 سطراً

(انظر القسم التالي)

---

# 10. نظام التشخيص والمراقبة (Diagnostics)

## 10.1 `realtimeDiagnostics.ts` — 1611 سطراً

نظام تشخيص متطور جداً للتطوير (Development Mode Only):

**الميزات:**
- **تتبع دورة الحياة:** `traceLifecycle(component, action, data)` — يتتبع تحميل وفك كل مكوّن
- **تتبع الأحداث المباشرة:** `traceRealtimeEvent(event, id, timestamp, userId, metadata)`
- **تتبع الطلبات:** `traceAsyncRequest` / `traceAsyncResponse` — يقيس زمن الاستجابة
- **تتبع تحورات الرسائل:** `traceMessageMutation` — يتتبع إضافة/حذف/تعديل الرسائل
- **تتبع تحورات المحادثات:** `traceConversationMutation`
- **تتبع الصوت:** `traceAudio` + `traceAudioForensic` — تشخيص متقدم لمشاكل الصوت
- **تتبع الإشعارات:** `trackNotifRefresh`, `trackNotifDedup`, `trackNotifReconnect`
- **تتبع الحضور:** `tracePresence` — يتتبع كل حدث في نظام الـ Presence
- **تتبع الكتابة:** `traceTyping`
- **كشف العواصف:** `getStormWarning()` — يعيد تحذيراً إذا كان هناك نشاط غير طبيعي
- **تسجيل القنوات:** `registerChannel`, `unregisterChannel`, `updateChannelState`
- **تتبع التجمع:** `registerPoolSnapshot` — لقطة لحالة تجمع القنوات

**API لتصحيح الأخطاء (Browser Console):**
- `window.__REALTIME_DEBUG` — لوحة معلومات شاملة:
  - `.audio()` — إحصائيات الصوت
  - `.presence()` — حالة الحضور
  - `.channels()` — حالة القنوات
  - `.notifications()` — تحليلات الإشعارات
  - `.lifetimes()` — دورة حياة المكونات
  - `.hydrate(id)` — تفاصيل رسالة معينة
  - `.search(query)` — بحث في سجل الأحداث
- `window.__PRESENCE_DEBUG` — أدوات تحليل الحضور:
  - `.channels()`, `.presenceState()`, `.stats()`, `.cleanup()`, `.retrack()`
- `window.__REALTIME_TRACE` — تحميل/تصدير سجل الأحداث
- `window.__REALTIME_FORENSICS` — الروابط السببية بين الأحداث
- `window.__REALTIME_ANALYZER` — محلل آلي:
  - `.latency()` — تحليل زمن الاستجابة
  - `.rootCause(action, id)` — تحليل السبب الجذري
  - `.anomalies()` — كشف الشذوذ
  - `.health()` — تقييم صحة النظام

---

# 11. الملخص والنتائج النهائية

## 11.1 إحصائيات عامة

| المعيار | نظام المحادثات | نظام الإشعارات |
|---------|----------------|----------------|
| عدد الملفات الأساسية | 11 | 11 |
| إجمالي الأسطر | ~4,000 | ~1,900 |
| طبقات الحماية من العواصف | 3 | 7 |
| عدد مستهلكي Toast | — | 28 ملفاً |
| التشفير | نعم (AES?) | لا (بيانات غير حساسة) |
| التخزين المؤقت | لا (دائماً من API) | لا (دائماً من API) |
| Push Notifications | غير مباشر (عبر الإشعارات) | نعم (VAPID Web Push) |
| Realtime | Supabase Broadcast + Presence | Supabase Broadcast |
| Diagnostics | متقدم جداً | متقدم جداً |

## 11.2 الخلاصة

1. **النظامان متكاملان بشكل وثيق:** الإشعارات تُستقبل عبر نفس قنوات Supabase Realtime التي تستخدمها المحادثات
2. **مستوى الأمان عالٍ جداً:** تشفير الرسائل، منع التكرار، عزل أكاديمي، rate limiting، مصادقة JWT
3. **الحماية من العواصف شاملة:** 7 طبقات في FloatingBell، backoff exponentials في القنوات، storm detection
4. **التشخيص مكثف جداً:** نظام `realtimeDiagnostics` (1611 سطراً) هو الأكبر بين الملفات — يتتبع كل حدث بدقة
5. **نظام Presence متطور:** معالجة متعددة التبويبات، heartbeat، watchdog، failover
6. **الأجزاء الأقل قوة:**
   - `pushSubscription` يدعم جهازاً واحداً فقط لكل مستخدم
   - لا يوجد تخزين مؤقت للرسائل (IndexedDB)
   - `lastSeenAt` لا يُحدّث عند الخروج المفاجئ
   - بعض catch blocks صامتة (قد تخفي أخطاءً)
