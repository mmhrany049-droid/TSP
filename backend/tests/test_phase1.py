import os

os.environ["SECRET_KEY"] = "test-secret-key-please-change-for-pytest"
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["CORS_ORIGINS"] = "http://localhost:3000"

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app import models  # noqa: F401
from app.models.question import Question

engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
Base.metadata.create_all(engine)


def override_get_db():
    db = TestingSession()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


def auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def register_and_login(email: str = "student@example.com", name: str = "نگار") -> str:
    created = client.post("/api/v1/auth/register", json={"email": email, "password": "secret123", "name": name})
    assert created.status_code == 201, created.text
    logged = client.post("/api/v1/auth/login", json={"email": email, "password": "secret123"})
    assert logged.status_code == 200, logged.text
    body = logged.json()
    assert body["token_type"] == "bearer"
    assert body["user"]["email"] == email
    return body["access_token"]


def test_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["database"] == "ok"


def test_login_does_not_reveal_unknown_email() -> None:
    missing = client.post("/api/v1/auth/login", json={"email": "missing@example.com", "password": "secret123"})
    register_and_login("known@example.com")
    wrong = client.post("/api/v1/auth/login", json={"email": "known@example.com", "password": "wrong-pass"})
    assert missing.status_code == 401
    assert wrong.status_code == 401
    assert missing.json()["detail"] == wrong.json()["detail"]


def test_full_study_flow_keeps_history() -> None:
    token = register_and_login("flow@example.com", "آرمان")
    headers = auth_header(token)

    me = client.get("/api/v1/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["name"] == "آرمان"

    book = client.post(
        "/api/v1/books",
        headers=headers,
        json={"title": "شیمی ۲ مبتکران", "subject": "شیمی", "publisher": "مبتکران", "grade": "یازدهم"},
    )
    assert book.status_code == 201, book.text
    book_id = book.json()["id"]

    chapter = client.post(
        f"/api/v1/books/{book_id}/nodes",
        headers=headers,
        json={"node_type": "chapter", "title": "فصل ۱ ـ قدر هدایای زمینی را بدانیم"},
    )
    assert chapter.status_code == 201, chapter.text
    chapter_id = chapter.json()["id"]

    section = client.post(
        f"/api/v1/books/{book_id}/nodes",
        headers=headers,
        json={"node_type": "section", "title": "الگوها و روندها", "parent_id": chapter_id},
    )
    assert section.status_code == 201, section.text
    section_id = section.json()["id"]

    first = client.post(
        "/api/v1/questions",
        headers=headers,
        json={
            "book_id": book_id,
            "book_node_id": section_id,
            "display_number": "12",
            "correct_answer": "۳",
        },
    )
    second = client.post(
        "/api/v1/questions",
        headers=headers,
        json={
            "book_id": book_id,
            "book_node_id": chapter_id,
            "display_number": "12",
            "correct_answer": "1",
        },
    )
    assert first.status_code == 201, first.text
    assert second.status_code == 201, second.text
    assert first.json()["id"] != second.json()["id"]
    assert first.json()["display_number"] == second.json()["display_number"]
    question_id = first.json()["id"]

    correct = client.post(
        "/api/v1/attempts",
        headers=headers,
        json={"question_id": question_id, "user_answer": "3", "spent_seconds": 40, "source": "manual"},
    )
    assert correct.status_code == 201, correct.text
    assert correct.json()["result"] == "correct"
    assert correct.json()["question"]["percentage"] == 100.0
    first_attempt_id = correct.json()["id"]

    wrong = client.post(
        "/api/v1/attempts",
        headers=headers,
        json={"question_id": question_id, "user_answer": "1", "spent_seconds": 25},
    )
    blank = client.post("/api/v1/attempts", headers=headers, json={"question_id": question_id, "user_answer": "  "})
    assert wrong.json()["result"] == "wrong"
    assert blank.json()["result"] == "unanswered"
    assert wrong.json()["question"]["total"] == 2
    assert blank.json()["question"]["percentage"] == round(100 / 3, 1)

    history = client.get(f"/api/v1/attempts?question_id={question_id}", headers=headers)
    assert history.status_code == 200
    items = history.json()["items"]
    assert len(items) == 3
    assert {item["id"] for item in items} >= {first_attempt_id}
    original = next(item for item in items if item["id"] == first_attempt_id)
    assert original["result"] == "correct"
    assert original["user_answer"] == "3"

    blocked = client.patch(f"/api/v1/attempts/{first_attempt_id}", headers=headers, json={"user_answer": "1"})
    assert blocked.status_code == 405
    assert "رکورد جدید" in blocked.json()["detail"]

    summary = client.get("/api/v1/dashboard/summary", headers=headers)
    assert summary.status_code == 200, summary.text
    assert summary.json()["attempts"]["total"] == 3
    assert summary.json()["checklist"]["has_attempt"] is True
    assert summary.json()["questions_count"] == 2

    detail = client.get(f"/api/v1/books/{book_id}", headers=headers)
    assert detail.status_code == 200
    assert detail.json()["stats"]["total"] == 3
    titles = [node["title"] for node in detail.json()["nodes"]]
    assert "فصل ۱ ـ قدر هدایای زمینی را بدانیم" in titles
    assert detail.json()["nodes"][0]["children"][0]["title"] == "الگوها و روندها"


def test_other_user_cannot_read_book() -> None:
    owner = auth_header(register_and_login("owner@example.com"))
    stranger = auth_header(register_and_login("stranger@example.com"))
    book = client.post("/api/v1/books", headers=owner, json={"title": "حسابان", "subject": "حسابان"})
    book_id = book.json()["id"]
    hidden = client.get(f"/api/v1/books/{book_id}", headers=stranger)
    assert hidden.status_code == 404
    assert "پیدا نشد" in hidden.json()["detail"]


def test_display_number_is_not_unique_and_question_text_is_not_stored() -> None:
    column_names = {column.name for column in Question.__table__.columns}
    assert "display_number" in column_names
    assert "text" not in column_names
    assert "stem" not in column_names
    assert "body" not in column_names
    display = Question.__table__.columns["display_number"]
    assert display.unique is not True
    assert not any(column.unique for column in Question.__table__.columns if column.name == "display_number")


def test_protected_route_requires_token() -> None:
    response = client.get("/api/v1/books")
    assert response.status_code == 401
    assert "وارد" in response.json()["detail"]
