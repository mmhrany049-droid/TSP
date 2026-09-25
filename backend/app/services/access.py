from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.book import Book, BookNode
from app.models.question import Question
from app.models.user import User


def get_owned_book(db: Session, user: User, book_id: str, *, active_only: bool = False) -> Book:
    book = db.get(Book, book_id)
    if book is None or book.user_id != user.id or (active_only and not book.is_active):
        raise HTTPException(status_code=404, detail="کتاب پیدا نشد.")
    return book


def get_owned_node(db: Session, user: User, node_id: str) -> BookNode:
    node = db.get(BookNode, node_id)
    if node is None:
        raise HTTPException(status_code=404, detail="گره ساختاری پیدا نشد.")
    book = db.get(Book, node.book_id)
    if book is None or book.user_id != user.id:
        raise HTTPException(status_code=404, detail="گره ساختاری پیدا نشد.")
    return node


def get_owned_question(db: Session, user: User, question_id: str) -> Question:
    question = db.get(Question, question_id)
    if question is None:
        raise HTTPException(status_code=404, detail="تست پیدا نشد.")
    book = db.get(Book, question.book_id)
    if book is None or book.user_id != user.id:
        raise HTTPException(status_code=404, detail="تست پیدا نشد.")
    return question


def owned_book_ids(db: Session, user: User):
    return select(Book.id).where(Book.user_id == user.id)
