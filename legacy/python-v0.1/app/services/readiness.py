"""ماژول ۹ — آمادگی آزمون.

برای آزمون آینده، کاربر مباحث دلخواه را انتخاب می‌کند و سیستم با استفاده از
داده‌های موجود (عملکرد فعلی، غلط و بی‌پاسخ، باقی‌مانده اهداف، مهم و سخت، وضعیت
تدریس و آزمون‌های قبلی مرتبط) یک «برآورد احتمالی» می‌سازد و فهرست کار و مرور
پیشنهاد می‌دهد. (بند ۱۲ سند ۰۱)

هشدار همیشه همراه برآورد برگردانده می‌شود: این عدد تضمین نتیجه نیست.
"""
from __future__ import annotations

from typing import Any

from ..config import EXAM_TYPES
from ..core import (ApiError, NotFound, as_choice, as_float, as_id, as_int, clean,
                    parse_date_only, require)
from ..db import Database, dumps, loads, placeholders, today_iso, utc_now
from .topics import subtree_ids, topic_path

DISCLAIMER = ("این برآورد یک تخمین احتمالی بر پایه داده‌های ثبت‌شده است و "
              "تضمین نتیجه آزمون نیست.")

WEIGHTS = {
    "coverage": 0.25,        # پوشش تست‌های حل‌شده از مباحث انتخابی
    "mastery": 0.30,         # درستی آخرین تلاش هر تست
    "review_debt": 0.15,     # بدهی مرور (غرط/بی‌پاسخ باز)
    "teaching": 0.10,        # وضعیت تدریس مباحث
    "goal_progress": 0.10,   # پیشرفت نسبت به اهداف
    "past_exams": 0.10,      # عملکرد در آزمون‌های قبلی مرتبط
}


# ---------------------------------------------------------------------------
# ساخت و ویرایش برنامه آزمون آینده
# ---------------------------------------------------------------------------

def list_plans(db: Database, status: str | None = None,
               upcoming_only: bool = False) -> list[dict]:
    where = []
    params: list[Any] = []
    if status:
        where.append("p.preparation_status = ?")
        params.append(status)
    if upcoming_only:
        where.append("(p.exam_date IS NULL OR p.exam_date >= ?)")
        params.append(today_iso())
    clause = " AND ".join(where) if where else "1=1"
    rows = db.query(
        f"""SELECT p.*, e.title AS exam_title, e.exam_type,
                   (SELECT COUNT(*) FROM future_exam_plan_topic pt WHERE pt.plan_id = p.id)
                       AS topic_count
              FROM future_exam_plan p
              LEFT JOIN exam e ON e.id = p.exam_id
             WHERE {clause}
             ORDER BY IFNULL(p.exam_date, '9999-12-31'), p.id DESC""", params)
    for row in rows:
        row["days_remaining"] = _days_remaining(row.get("exam_date"))
        row["details"] = loads(row.get("readiness_details"), {})
    return rows


def get_plan(db: Database, plan_id: int) -> dict:
    row = db.query_one(
        """SELECT p.*, e.title AS exam_title, e.exam_type FROM future_exam_plan p
           LEFT JOIN exam e ON e.id = p.exam_id WHERE p.id = ?""", (plan_id,))
    if not row:
        raise NotFound("برنامه آزمون آینده یافت نشد")
    row["topics"] = db.query(
        """SELECT t.id, t.title, pt.weight FROM future_exam_plan_topic pt
             JOIN topic t ON t.id = pt.topic_id WHERE pt.plan_id = ?
            ORDER BY t.order_index""", (plan_id,))
    for topic in row["topics"]:
        topic["path"] = topic_path(db, topic["id"])
    row["details"] = loads(row.get("readiness_details"), {})
    row["days_remaining"] = _days_remaining(row.get("exam_date"))
    row["work_items"] = db.query(
        """SELECT r.* FROM review_item r
            WHERE r.origin_ref = ? AND r.state IN ('open','in_progress')
            ORDER BY r.priority DESC LIMIT 50""", (f"plan:{plan_id}",))
    return row


def create_plan(db: Database, data: dict) -> dict:
    require(data, ["title"])
    exam_id = as_id(data.get("exam_id"), "exam_id")
    if exam_id and not db.scalar("SELECT 1 FROM exam WHERE id = ?", (exam_id,)):
        raise NotFound("آزمون یافت نشد")
    plan_id = db.insert("future_exam_plan", {
        "exam_id": exam_id,
        "title": clean(data["title"]),
        "exam_date": parse_date_only(data.get("exam_date") or data.get("date")),
        "target": clean(data.get("target")),
        "preparation_status": as_choice(data.get("preparation_status"),
                                        ["planning", "studying", "reviewing", "ready", "done"],
                                        "preparation_status", allow_none=True,
                                        default="planning"),
        "notes": clean(data.get("notes")),
        "created_at": utc_now(),
        "updated_at": utc_now(),
    })
    if data.get("topic_ids"):
        set_topics(db, plan_id, [{"topic_id": t} for t in data["topic_ids"]])
    evaluate(db, plan_id, generate_items=bool(data.get("generate_review", True)))
    return get_plan(db, plan_id)


def update_plan(db: Database, plan_id: int, data: dict) -> dict:
    get_plan(db, plan_id)
    updates: dict[str, Any] = {"updated_at": utc_now()}
    if "title" in data:
        title = clean(data["title"])
        if not title:
            raise ApiError("عنوان برنامه نمی‌تواند خالی باشد", 422, {"title": "الزامی"})
        updates["title"] = title
    if "target" in data:
        updates["target"] = clean(data["target"])
    if "notes" in data:
        updates["notes"] = clean(data["notes"])
    if "exam_date" in data or "date" in data:
        updates["exam_date"] = parse_date_only(data.get("exam_date") or data.get("date"))
    if "exam_id" in data:
        exam_id = as_id(data["exam_id"], "exam_id")
        if exam_id and not db.scalar("SELECT 1 FROM exam WHERE id = ?", (exam_id,)):
            raise NotFound("آزمون یافت نشد")
        updates["exam_id"] = exam_id
    if "preparation_status" in data:
        updates["preparation_status"] = as_choice(
            data["preparation_status"],
            ["planning", "studying", "reviewing", "ready", "done"],
            "preparation_status", allow_none=False)
    db.update("future_exam_plan", plan_id, updates)
    return get_plan(db, plan_id)


def set_topics(db: Database, plan_id: int, topics: list[dict]) -> dict:
    get_plan(db, plan_id)
    normalized: list[tuple[int, float]] = []
    for row in topics:
        topic_id = as_id(row.get("topic_id"), "topic_id")
        if not topic_id:
            continue
        if not db.scalar("SELECT 1 FROM topic WHERE id = ?", (topic_id,)):
            raise NotFound(f"مبحث {topic_id} یافت نشد")
        normalized.append((topic_id, as_float(row.get("weight"), "weight") or 1.0))
    with db.write() as cur:
        cur.execute("DELETE FROM future_exam_plan_topic WHERE plan_id = ?", (plan_id,))
        for topic_id, weight in normalized:
            cur.execute(
                "INSERT INTO future_exam_plan_topic(plan_id, topic_id, weight) VALUES (?, ?, ?)",
                (plan_id, topic_id, weight))
    from .review import sync_topic_review
    for topic_id, _ in normalized:
        sync_topic_review(db, topic_id)
    return get_plan(db, plan_id)


def delete_plan(db: Database, plan_id: int) -> dict:
    get_plan(db, plan_id)
    with db.write() as cur:
        cur.execute("DELETE FROM future_exam_plan_topic WHERE plan_id = ?", (plan_id,))
        cur.execute("DELETE FROM future_exam_plan WHERE id = ?", (plan_id,))
        cur.execute("UPDATE review_item SET state='archived', updated_at=? "
                    "WHERE origin_ref = ? AND state IN ('open','in_progress')",
                    (utc_now(), f"plan:{plan_id}"))
    return {"deleted": True, "id": plan_id}


def _days_remaining(exam_date: str | None) -> int | None:
    if not exam_date:
        return None
    from datetime import date
    try:
        return (date.fromisoformat(exam_date[:10]) - date.fromisoformat(today_iso())).days
    except ValueError:
        return None


# ---------------------------------------------------------------------------
# موتور برآورد آمادگی
# ---------------------------------------------------------------------------

def _topic_ids_of_plan(db: Database, plan_id: int) -> list[int]:
    rows = db.query("SELECT topic_id FROM future_exam_plan_topic WHERE plan_id = ?",
                    (plan_id,))
    return [row["topic_id"] for row in rows]


def _all_question_ids(db: Database, topic_ids: list[int]) -> list[int]:
    if not topic_ids:
        return []
    marks = placeholders(topic_ids)
    rows = db.query(
        f"""SELECT DISTINCT qt.question_id FROM question_topic qt
             JOIN question q ON q.id = qt.question_id AND q.state='active'
            WHERE qt.topic_id IN ({marks})""", topic_ids)
    return [row["question_id"] for row in rows]


def analyze(db: Database, topic_ids: list[int], exam_id: int | None = None,
            exam_date: str | None = None) -> dict:
    """تحلیل مؤلفه‌های آمادگی برای مجموعه‌ای از مباحث."""
    if not topic_ids:
        raise ApiError("برای برآورد آمادگی باید حداقل یک مبحث انتخاب شود", 422,
                       {"topic_ids": "خالی است"})
    # گسترش به زیرمباحث
    expanded: list[int] = []
    for topic_id in topic_ids:
        expanded.extend(subtree_ids(db, topic_id))
    expanded = sorted(set(expanded))
    marks = placeholders(expanded)

    question_ids = _all_question_ids(db, expanded)
    total_questions = len(question_ids)

    attempted = db.scalar(
        f"""SELECT COUNT(DISTINCT a.question_id) FROM question_attempt a
             JOIN question_topic qt ON qt.question_id = a.question_id
            WHERE qt.topic_id IN ({marks}) AND a.state='active'""", expanded, 0) or 0
    previous_touched = db.scalar(
        f"""SELECT COUNT(DISTINCT p.question_id) FROM previous_question_entry p
             JOIN question_topic qt ON qt.question_id = p.question_id
            WHERE qt.topic_id IN ({marks}) AND p.state='active'""", expanded, 0) or 0

    results = {row["result"]: row["cnt"] for row in db.query(
        f"""SELECT a.result, COUNT(*) AS cnt FROM question_attempt a
             JOIN question_topic qt ON qt.question_id = a.question_id
            WHERE qt.topic_id IN ({marks}) AND a.state='active'
            GROUP BY a.result""", expanded)}
    lifetime_total = sum(results.values())

    # درستی آخرین تلاش هر تست (تسلط فعلی)
    last_rows = db.query(
        f"""WITH last AS (
                SELECT a.question_id, a.result,
                       ROW_NUMBER() OVER (PARTITION BY a.question_id
                                          ORDER BY a.attempted_at DESC, a.id DESC) AS rn
                  FROM question_attempt a
                  JOIN question_topic qt ON qt.question_id = a.question_id
                 WHERE qt.topic_id IN ({marks}) AND a.state='active')
            SELECT result, COUNT(*) AS cnt FROM last WHERE rn = 1 GROUP BY result""",
        expanded)
    mastery = {row["result"]: row["cnt"] for row in last_rows}
    mastery_total = sum(mastery.values())
    mastery_score = (mastery.get("correct", 0) / mastery_total * 100) if mastery_total else 0.0

    coverage = (len(set(question_ids) & set(
        [row["question_id"] for row in db.query(
            f"""SELECT DISTINCT a.question_id FROM question_attempt a
                 JOIN question_topic qt ON qt.question_id = a.question_id
                WHERE qt.topic_id IN ({marks}) AND a.state='active'""", expanded)]))
        / total_questions * 100) if total_questions else 0.0

    open_reviews = db.scalar(
        f"""SELECT COUNT(*) FROM review_item r
             WHERE r.state IN ('open','in_progress')
               AND (r.topic_id IN ({marks})
                    OR r.question_id IN (SELECT question_id FROM question_topic
                                          WHERE topic_id IN ({marks})))""",
        expanded + expanded, 0) or 0
    review_debt = max(0.0, 100 - (open_reviews / max(attempted, 1) * 100)) if attempted else 0.0

    teaching_rows = db.query(
        f"""SELECT IFNULL(tu.taught_status, 'not_started') AS status, COUNT(*) AS cnt
              FROM topic t LEFT JOIN teaching_unit tu ON tu.topic_id = t.id
             WHERE t.id IN ({marks}) AND t.status <> 'archived'
             GROUP BY status""", expanded)
    teaching_totals = {row["status"]: row["cnt"] for row in teaching_rows}
    # مبحث تدریس‌شده امتیاز کامل، «نیاز به مرور» نیمی از امتیاز
    taught_count = (sum(teaching_totals.get(status, 0)
                        for status in ("taught", "in_progress"))
                    + 0.5 * teaching_totals.get("needs_review", 0))
    topic_total = sum(teaching_totals.values())
    teaching_score = (taught_count / topic_total * 100) if topic_total else 0.0

    goal_row = db.query_one(
        f"""SELECT SUM(target_count) AS target FROM teaching_test_goal
             WHERE topic_id IN ({marks}) AND status='active'""", expanded) or {}
    goal_target = goal_row.get("target") or 0
    goal_score = min(100.0, (attempted / goal_target * 100)) if goal_target else None

    past = None
    if exam_id:
        past = db.scalar(
            """SELECT AVG(score_percent) FROM exam_attempt
                WHERE exam_id = ? AND state='finished' AND score_percent IS NOT NULL""",
            (exam_id,))
    if past is None:
        overlapping = db.query(
            f"""SELECT DISTINCT ea.id, ea.score_percent FROM exam_attempt ea
                 JOIN exam_question eq ON eq.exam_id = ea.exam_id
                WHERE ea.state='finished' AND ea.score_percent IS NOT NULL
                  AND eq.topic_id IN ({marks})""", expanded)
        scores = [row["score_percent"] for row in overlapping
                  if row["score_percent"] is not None]
        past = sum(scores) / len(scores) if scores else None

    components = {
        "coverage": {"score": round(coverage, 1), "label": "پوشش تست‌های حل‌شده",
                     "detail": f"{attempted} از {total_questions} تست مبحث‌های انتخابی"},
        "mastery": {"score": round(mastery_score, 1), "label": "تسلط بر آخرین تلاش",
                    "detail": f"{mastery.get('correct', 0)} درست از {mastery_total} تست تلاش‌شده"},
        "review_debt": {"score": round(review_debt, 1), "label": "بدهی مرور",
                        "detail": f"{open_reviews} مورد مرور باز"},
        "teaching": {"score": round(teaching_score, 1), "label": "وضعیت تدریس",
                     "detail": f"{len(teaching_totals)} وضعیت ثبت‌شده در {topic_total} مبحث"},
    }
    if goal_score is not None:
        components["goal_progress"] = {
            "score": round(goal_score, 1), "label": "پیشرفت نسبت به هدف",
            "detail": f"{attempted} از {goal_target} تست هدف"}
    if past is not None:
        components["past_exams"] = {"score": round(float(past), 1),
                                    "label": "عملکرد در آزمون‌های مرتبط",
                                    "detail": "میانگین درصد آزمون‌های قبلی مرتبط"}

    weights = {key: WEIGHTS[key] for key in components if key in WEIGHTS}
    weight_sum = sum(weights.values()) or 1
    estimate = sum(components[key]["score"] * weight for key, weight in weights.items())
    estimate = round(estimate / weight_sum, 1)

    data_points = lifetime_total + previous_touched
    confidence = round(min(100.0, (data_points / 200 * 60) + (coverage * 0.4)), 1)

    weak_topics = db.query(
        f"""SELECT t.id AS topic_id, t.title,
                   COUNT(DISTINCT qt.question_id) AS question_count,
                   COUNT(a.id) AS attempts,
                   SUM(CASE WHEN a.result='correct' THEN 1 ELSE 0 END) AS correct,
                   ROUND(100.0 * SUM(CASE WHEN a.result='correct' THEN 1 ELSE 0 END)
                         / MAX(COUNT(a.id), 1), 1) AS accuracy,
                   IFNULL(tu.taught_status, 'not_started') AS taught_status,
                   (SELECT COUNT(*) FROM review_item r
                     WHERE r.state IN ('open','in_progress')
                       AND (r.topic_id = t.id
                            OR r.question_id IN (SELECT question_id FROM question_topic
                                                  WHERE topic_id = t.id))) AS open_items
              FROM topic t
              LEFT JOIN question_topic qt ON qt.topic_id = t.id
              LEFT JOIN question q ON q.id = qt.question_id AND q.state='active'
              LEFT JOIN question_attempt a ON a.question_id = qt.question_id
                   AND a.state='active'
              LEFT JOIN teaching_unit tu ON tu.topic_id = t.id
             WHERE t.id IN ({marks}) AND t.status <> 'archived'
             GROUP BY t.id ORDER BY IFNULL(accuracy, 999), open_items DESC""", expanded)
    weak_topics = [row for row in weak_topics if row["question_count"]]
    for row in weak_topics[:20]:
        row["path"] = topic_path(db, row["topic_id"])

    recommendations: list[str] = []
    if coverage < 40:
        recommendations.append("پوشش تست‌های مبحث‌های انتخابی پایین است؛ "
                               "تست‌های باقی‌مانده این مباحث را در برنامه بگذارید.")
    if mastery_total and mastery.get("incorrect", 0) + mastery.get("unanswered", 0) > 0:
        recommendations.append(
            f"{mastery.get('incorrect', 0)} تست در آخرین تلاش غلط و "
            f"{mastery.get('unanswered', 0)} تست بی‌پاسخ است؛ ابتدا همین‌ها را مرور کنید.")
    if open_reviews:
        recommendations.append(f"{open_reviews} مورد مرور باز در این مباحث وجود دارد.")
    if goal_target and attempted < goal_target:
        recommendations.append(f"{goal_target - attempted} تست تا رسیدن به هدف مباحث باقی است.")
    if teaching_totals.get("not_started"):
        recommendations.append(f"{teaching_totals['not_started']} مبحث از مباحث انتخابی "
                               "هنوز تدریس نشده است.")
    weak = [row for row in weak_topics if row["accuracy"] is not None and row["accuracy"] < 60]
    if weak:
        recommendations.append("ضعیف‌ترین مباحث: " +
                               "، ".join(row["title"] for row in weak[:4]))

    return {
        "topic_ids": expanded,
        "estimate": estimate,
        "confidence": confidence,
        "components": components,
        "weights": weights,
        "summary": {
            "questions": total_questions,
            "attempted": attempted,
            "previous_touched": previous_touched,
            "lifetime_attempts": lifetime_total,
            "correct": results.get("correct", 0),
            "incorrect": results.get("incorrect", 0),
            "unanswered": results.get("unanswered", 0),
            "open_reviews": open_reviews,
            "goal_target": goal_target,
            "days_remaining": _days_remaining(exam_date),
        },
        "weak_topics": weak_topics[:20],
        "recommendations": recommendations,
        "disclaimer": DISCLAIMER,
    }


def evaluate(db: Database, plan_id: int, generate_items: bool = True) -> dict:
    plan = get_plan(db, plan_id)
    topic_ids = [row["id"] for row in plan["topics"]]
    if not topic_ids:
        raise ApiError("این برنامه مبحثی ندارد؛ ابتدا مباحث آزمون را انتخاب کنید", 422,
                       {"topic_ids": "خالی است"})
    analysis = analyze(db, topic_ids, exam_id=plan.get("exam_id"),
                       exam_date=plan.get("exam_date"))
    if generate_items:
        analysis["work_items"] = generate_work_items(db, plan, analysis)
    db.update("future_exam_plan", plan_id, {
        "readiness_estimate": analysis["estimate"],
        "readiness_details": dumps({
            "estimate": analysis["estimate"],
            "confidence": analysis["confidence"],
            "components": analysis["components"],
            "summary": analysis["summary"],
            "recommendations": analysis["recommendations"],
        }),
        "evaluated_at": utc_now(),
        "updated_at": utc_now(),
    })
    result = get_plan(db, plan_id)
    result["analysis"] = analysis
    return result


def generate_work_items(db: Database, plan: dict, analysis: dict) -> dict:
    """ساخت فهرست کار/مرور پیشنهادی برای آزمون آینده."""
    plan_id = plan["id"]
    created, updated = 0, 0
    tags = []
    topic_ids = [row["id"] for row in plan["topics"]]
    expanded: list[int] = []
    for topic_id in topic_ids:
        expanded.extend(subtree_ids(db, topic_id))
    expanded = sorted(set(expanded))
    marks = placeholders(expanded)
    weak_question_rows = db.query(
        f"""SELECT q.id FROM question q
             JOIN question_topic qt ON qt.question_id = q.id
            WHERE qt.topic_id IN ({marks}) AND q.state='active'
              AND EXISTS (SELECT 1 FROM question_attempt a
                           WHERE a.question_id = q.id AND a.state='active'
                             AND a.result IN ('incorrect','unanswered'))
            ORDER BY (SELECT MAX(a2.attempted_at) FROM question_attempt a2
                       WHERE a2.question_id = q.id AND a2.state='active') ASC
            LIMIT 150""", expanded)
    with db.write():
        for row in weak_question_rows:
            question_id = row["id"]
            existing = db.query_one(
                """SELECT * FROM review_item WHERE question_id = ?
                    AND state IN ('open','in_progress') LIMIT 1""", (question_id,))
            reasons = ["incorrect", "upcoming_exam", "manual"]
            if existing:
                merged = sorted(set(loads(existing["reasons"], []) or []) |
                                {"upcoming_exam", "manual"})
                if merged != (loads(existing["reasons"], []) or []):
                    db.update("review_item", existing["id"], {
                        "reasons": dumps(merged),
                        "origin_ref": f"plan:{plan_id}",
                        "note": f"آزمون آینده: {plan['title']}",
                        "updated_at": utc_now()})
                    updated += 1
            else:
                db.insert("review_item", {
                    "question_id": question_id,
                    "reasons": dumps(reasons),
                    "priority": 70,
                    "state": "open",
                    "origin": "plan",
                    "origin_ref": f"plan:{plan_id}",
                    "note": f"آزمون آینده: {plan['title']}",
                    "created_at": utc_now(),
                    "updated_at": utc_now()})
                created += 1
    from .review import sync_topic_review
    for topic_id in expanded:
        sync_topic_review(db, topic_id)
    return {"questions_added": created, "questions_updated": updated,
            "tags": tags, "plan_id": plan_id}


def upcoming_exams(db: Database, days: int = 60) -> list[dict]:
    rows = db.query(
        """SELECT p.id, p.title, p.exam_date, p.preparation_status, p.readiness_estimate,
                  e.exam_type,
                  (SELECT COUNT(*) FROM future_exam_plan_topic pt WHERE pt.plan_id = p.id)
                      AS topic_count
             FROM future_exam_plan p LEFT JOIN exam e ON e.id = p.exam_id
            WHERE p.preparation_status <> 'done'
              AND (p.exam_date IS NULL OR p.exam_date <= date('now', ?))
            ORDER BY IFNULL(p.exam_date, '9999-12-31')""", (f"+{int(days)} days",))
    for row in rows:
        row["days_remaining"] = _days_remaining(row.get("exam_date"))
    return rows
