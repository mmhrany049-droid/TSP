# مدل داده – TSP v0.2

این مدل داده برای نسخه ۰.۲ ساده‌سازی شده تا قابل پیاده‌سازی سریع باشد، در عین حال اصول اصلی (تاریخچه‌محور بودن و جداسازی ساختار کتاب از مبحث) حفظ شده است.

---

## موجودیت‌های اصلی

### User
- id
- email
- name
- password (hashed)
- createdAt

### Book
- id
- title
- subject          (مثلاً شیمی، فیزیک، حسابان)
- publisher
- grade
- field            (ریاضی-فیزیک)
- notes
- userId
- createdAt

### BookNode (ساختار کتاب)
- id
- bookId
- parentId         (nullable)
- nodeType         (chapter | section | subsection | mixed_tests | checkup | comprehensive | other)
- title
- orderIndex

### Topic (مبحث آموزشی – مستقل از کتاب)
- id
- subject
- parentId         (nullable)
- title
- status           (active | archived)

### Question
- id               (شناسه داخلی یکتا – مثلاً Q-000184)
- bookId
- bookNodeId       (محل تست در ساختار کتاب)
- displayNumber    (شماره نمایشی – یکتا نیست)
- correctAnswer
- publisherDifficulty  (اختیاری)
- isImportant      (علامت کاربر)
- isHard           (علامت کاربر)
- isActive         (true/false)
- createdAt

### QuestionTopic (رابط چندبه‌چند)
- questionId
- topicId
- relationType     (primary | secondary | mixed)

### QuestionAttempt (تلاش جدید)
- id
- questionId
- userAnswer
- result           (correct | wrong | unanswered)
- spentSeconds     (nullable)
- attemptedAt
- source           (manual | review | exam | import)

### PreviousSolvedEntry (تست‌های قبلاً حل‌شده)
- id
- questionId
- userAnswer
- result
- note
- importedAt
- importBatch

### TeachingRecord
- id
- topicId
- taughtStatus     (not_taught | taught | reviewed)
- taughtAt
- notes

### TeachingGoal
- id
- topicId
- targetCount
- periodStart
- periodEnd
- notes

### Exam
- id
- title
- examType         (single_subject | multi_subject | mock | checkup)
- plannedDate
- notes
- createdAt

### ExamTopic
- examId
- topicId

### ExamQuestion
- id
- examId
- questionId       (nullable – اگر از بانک باشد)
- orderIndex
- correctAnswer

### ExamAttempt
- id
- examId
- startedAt
- finishedAt
- scoreSummary

### ExamAnswer
- id
- examAttemptId
- examQuestionId
- userAnswer
- result
- spentSeconds

### FutureExamPlan
- id
- title
- plannedDate
- selectedTopicIds
- readinessEstimate
- notes
- createdAt

### ReviewItem
- id
- questionId
- reasons          (wrong | unanswered | important | hard | backlog | exam_related)
- priority
- status           (pending | done)
- createdAt
- resolvedAt

---

## قواعد کلیدی مدل داده

1. **displayNumber یکتا نیست** → همیشه از `Question.id` استفاده شود.
2. **BookNode** محل تست در کتاب را نشان می‌دهد.
3. **Topic** مفهوم آموزشی را نشان می‌دهد و از BookNode جداست.
4. هر `QuestionAttempt` یک رکورد جدید است و قبلی را تغییر نمی‌دهد.
5. `PreviousSolvedEntry` با `QuestionAttempt` متفاوت است.
6. سختی ناشر، isHard و isImportant سه فیلد جدا هستند.
7. آمار همیشه از روی Attemptها محاسبه می‌شود، نه از روی یک فیلد خلاصه.
