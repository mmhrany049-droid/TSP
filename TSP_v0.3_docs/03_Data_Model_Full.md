# مدل داده کامل — TSP v0.3

این مدل داده تمام قابلیت‌های نسخه ۰.۳ را پوشش می‌دهد.

---

## موجودیت‌ها

### 1. User
| فیلد | نوع | توضیح |
|------|-----|------|
| id | String (UUID/CUID) | کلید اصلی |
| email | String (unique) | ایمیل |
| name | String? | نام |
| password_hash | String | رمز هش‌شده |
| created_at | DateTime | تاریخ ایجاد |

### 2. Book
| فیلد | نوع | توضیح |
|------|-----|------|
| id | String | کلید اصلی |
| user_id | String (FK → User) | صاحب کتاب |
| title | String | عنوان |
| subject | String | درس |
| publisher | String? | ناشر |
| grade | String? | پایه |
| field | String? | رشته (پیش‌فرض ریاضی-فیزیک) |
| notes | String? | یادداشت |
| is_active | Boolean | فعال/آرشیو |
| created_at | DateTime | |

### 3. BookNode (ساختار کتاب)
| فیلد | نوع | توضیح |
|------|-----|------|
| id | String | کلید اصلی |
| book_id | String (FK) | |
| parent_id | String? (FK → self) | والد |
| node_type | String | chapter / section / subsection / mixed_tests / checkup / comprehensive / other |
| title | String | عنوان گره |
| order_index | Int | ترتیب نمایش |

### 4. Topic (مبحث آموزشی — مستقل)
| فیلد | نوع | توضیح |
|------|-----|------|
| id | String | |
| subject | String | درس |
| parent_id | String? | والد |
| title | String | عنوان مبحث |
| status | String | active / archived |

### 5. Question
| فیلد | نوع | توضیح |
|------|-----|------|
| id | String | شناسه داخلی یکتا |
| book_id | String (FK) | |
| book_node_id | String (FK) | محل در ساختار کتاب |
| display_number | String | شماره نمایشی (یکتا نیست) |
| correct_answer | String | پاسخ صحیح |
| publisher_difficulty | String? | سختی ناشر |
| is_important | Boolean | علامت مهم کاربر |
| is_hard | Boolean | علامت سخت کاربر |
| is_active | Boolean | فعال/آرشیو |
| created_at | DateTime | |

### 6. QuestionTopic (چندبه‌چند)
| فیلد | نوع | توضیح |
|------|-----|------|
| question_id | String | |
| topic_id | String | |
| relation_type | String | primary / secondary / mixed |

### 7. QuestionAttempt (تلاش جدید)
| فیلد | نوع | توضیح |
|------|-----|------|
| id | String | |
| question_id | String (FK) | |
| user_answer | String? | |
| result | String | correct / wrong / unanswered |
| spent_seconds | Int? | |
| attempted_at | DateTime | |
| source | String | manual / review / exam / import |

**قاعده:** هر بار حل = یک رکورد جدید. هرگز آپدیت نمی‌شود.

### 8. PreviousSolvedEntry (تست‌های قبلی)
| فیلد | نوع | توضیح |
|------|-----|------|
| id | String | |
| question_id | String (FK) | |
| user_answer | String? | |
| result | String | correct / wrong / unanswered |
| note | String? | |
| imported_at | DateTime | |
| import_batch | String? | برچسب دسته ورود |

### 9. TeachingRecord
| فیلد | نوع | توضیح |
|------|-----|------|
| id | String | |
| topic_id | String (unique FK) | |
| taught_status | String | not_taught / taught / reviewed |
| taught_at | DateTime? | |
| notes | String? | |

### 10. TeachingGoal
| فیلد | نوع | توضیح |
|------|-----|------|
| id | String | |
| topic_id | String (FK) | |
| target_count | Int | هدف تعداد تست |
| period_start | DateTime? | |
| period_end | DateTime? | |
| notes | String? | |

### 11. Exam
| فیلد | نوع | توضیح |
|------|-----|------|
| id | String | |
| title | String | |
| exam_type | String | single_subject / multi_subject / mock / checkup |
| planned_date | DateTime? | |
| notes | String? | |
| created_at | DateTime | |

### 12. ExamTopic
| فیلد | نوع |
|------|-----|
| exam_id | String |
| topic_id | String |

### 13. ExamQuestion
| فیلد | نوع | توضیح |
|------|-----|------|
| id | String | |
| exam_id | String | |
| question_id | String? | اگر از بانک باشد |
| order_index | Int | |
| correct_answer | String? | |

### 14. ExamAttempt
| فیلد | نوع | توضیح |
|------|-----|------|
| id | String | |
| exam_id | String | |
| started_at | DateTime | |
| finished_at | DateTime? | |
| score_summary | String? (JSON) | خلاصه (محاسبه از روی answers) |

### 15. ExamAnswer
| فیلد | نوع | توضیح |
|------|-----|------|
| id | String | |
| exam_attempt_id | String | |
| exam_question_id | String | |
| user_answer | String? | |
| result | String | |
| spent_seconds | Int? | |

### 16. ExamAsset (فایل سؤال)
| فیلد | نوع | توضیح |
|------|-----|------|
| id | String | |
| exam_id | String? | |
| exam_question_id | String? | |
| file_type | String | pdf / image |
| file_path | String | مسیر ذخیره |
| original_name | String? | |

### 17. FutureExamPlan
| فیلد | نوع | توضیح |
|------|-----|------|
| id | String | |
| title | String | |
| planned_date | DateTime? | |
| readiness_estimate | Float? | درصد برآوردی |
| notes | String? | |
| created_at | DateTime | |

### 18. FutureExamPlanTopic
| فیلد | نوع |
|------|-----|
| plan_id | String |
| topic_id | String |

### 19. ReviewItem
| فیلد | نوع | توضیح |
|------|-----|------|
| id | String | |
| question_id | String | |
| reasons | String (JSON یا متن) | لیست دلایل |
| priority | Int | |
| status | String | pending / done |
| created_at | DateTime | |
| resolved_at | DateTime? | |

---

## قواعد مهم مدل داده

1. `display_number` هرگز unique در نظر گرفته نشود.
2. `Question.id` شناسه واقعی و یکتا است.
3. `BookNode` محل فیزیکی تست در کتاب است.
4. `Topic` مفهوم آموزشی است و از BookNode جداست.
5. `QuestionAttempt` فقط insert می‌شود، update نمی‌شود.
6. `PreviousSolvedEntry` جدول جداگانه است.
7. حذف کتاب → Cascade روی ساختار و تست‌های همان کتاب.
8. حذف تست بانک → ExamQuestion.question_id = null (SetNull).
9. آمار همیشه از روی Attemptها و Entryها محاسبه شود، نه فیلد خلاصه.
