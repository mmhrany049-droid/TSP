from datetime import datetime
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from typing import Literal

class Input(BaseModel):
    model_config = ConfigDict(extra="forbid")
class Register(Input):
    email: EmailStr; password: str = Field(min_length=8, max_length=128); name: str | None = Field(default=None, max_length=120)
class Login(Input):
    email: EmailStr; password: str
class BookIn(Input):
    title: str = Field(min_length=1, max_length=200); subject: str = Field(min_length=1, max_length=100); publisher: str | None = None; grade: str | None = None; field: str = "ریاضی-فیزیک"; notes: str | None = None
class NodeIn(Input):
    title: str = Field(min_length=1, max_length=200); node_type: str = "chapter"; parent_id: str | None = None; order_index: int = 0
class TopicIn(Input):
    title: str = Field(min_length=1, max_length=200); subject: str = Field(min_length=1, max_length=100); parent_id: str | None = None; status: str = "active"
class QuestionIn(Input):
    book_id: str; book_node_id: str; display_number: str = Field(min_length=1, max_length=50); correct_answer: str = Field(min_length=1, max_length=100); publisher_difficulty: str | None = None; is_important: bool = False; is_hard: bool = False
class AttemptIn(Input):
    question_id: str; user_answer: str | None = None; spent_seconds: int | None = Field(default=None, ge=0); source: Literal["manual","review","exam","import"] = "manual"
class PreviousIn(Input):
    question_id: str; user_answer: str | None = None; result: Literal["correct","wrong","unanswered"]; note: str | None = None; import_batch: str | None = None
class TeachingIn(Input):
    taught_status: Literal["not_taught","taught","reviewed"] = "not_taught"; taught_at: datetime | None = None; notes: str | None = None
class GoalIn(Input):
    topic_id: str; target_count: int = Field(ge=0); period_start: datetime | None = None; period_end: datetime | None = None; notes: str | None = None
class ExamIn(Input):
    title: str; exam_type: Literal["single_subject","multi_subject","mock","checkup"] = "single_subject"; planned_date: datetime | None = None; notes: str | None = None; topic_ids: list[str] = Field(default_factory=list)
class ExamQuestionIn(Input):
    question_id: str | None = None; order_index: int = 0; correct_answer: str | None = None
class AnswerIn(Input):
    exam_question_id: str; user_answer: str | None = None; spent_seconds: int | None = Field(default=None, ge=0)
class PlanIn(Input):
    title: str; planned_date: datetime | None = None; notes: str | None = None; topic_ids: list[str] = Field(default_factory=list)
class TopicLinkIn(Input):
    topic_id: str; relation_type: str = "primary"
class ReviewGenerate(Input):
    wrong: bool = True; unanswered: bool = True; previous: bool = False; important: bool = False; hard: bool = False; backlog: bool = True; future_exam: bool = True; limit: int = Field(default=200, ge=1, le=1000)
