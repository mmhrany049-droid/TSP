from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from pathlib import Path
import json, shutil, uuid
from ..database import get_db
from ..models import *
from ..schemas import *
from ..core.deps import current_user
from ..core.security import hash_password, verify_password, create_access_token
from ..config import settings
from ..services.attempts import calculate_result
from ..services.analytics import percentage, summarize

auth_api = APIRouter(prefix="/api/v1")
books_api = APIRouter(prefix="/api/v1")
questions_api = APIRouter(prefix="/api/v1")
attempts_api = APIRouter(prefix="/api/v1")
topics_api = APIRouter(prefix="/api/v1")
teaching_api = APIRouter(prefix="/api/v1")
review_api = APIRouter(prefix="/api/v1")
exams_api = APIRouter(prefix="/api/v1")
readiness_api = APIRouter(prefix="/api/v1")
dashboard_api = APIRouter(prefix="/api/v1")
def dump(obj):
    from fastapi.encoders import jsonable_encoder
    return jsonable_encoder(obj)
def owned_book(db, book_id, user):
    x=db.get(Book,book_id)
    if not x or x.user_id != user.id: raise HTTPException(404,"کتاب پیدا نشد")
    return x
def owned_topic(db, topic_id, user):
    x=db.get(Topic,topic_id)
    if not x or x.user_id != user.id: raise HTTPException(404,"مبحث پیدا نشد")
    return x
def owned_question(db, question_id, user):
    x=db.get(Question,question_id)
    if not x or not db.query(Book).filter_by(id=x.book_id,user_id=user.id).first(): raise HTTPException(404,"تست پیدا نشد")
    return x
def owned_exam(db, exam_id, user):
    x=db.get(Exam,exam_id)
    if not x or x.user_id != user.id: raise HTTPException(404,"آزمون پیدا نشد")
    return x
def owned_plan(db, plan_id, user):
    x=db.get(FutureExamPlan,plan_id)
    if not x or x.user_id != user.id: raise HTTPException(404,"برنامه پیدا نشد")
    return x

@auth_api.post("/auth/register", status_code=201)
def register(data:Register, db:Session=Depends(get_db)):
    if db.query(User).filter(func.lower(User.email)==data.email.lower()).first(): raise HTTPException(409,"این ایمیل قبلاً ثبت شده است")
    user=User(email=data.email.lower(),name=data.name,password_hash=hash_password(data.password)); db.add(user); db.commit(); db.refresh(user)
    return {"id":user.id,"email":user.email,"name":user.name}
@auth_api.post("/auth/login")
def login(data:Login, db:Session=Depends(get_db)):
    u=db.query(User).filter(func.lower(User.email)==data.email.lower()).first()
    if not u or not verify_password(data.password,u.password_hash): raise HTTPException(401,"ایمیل یا گذرواژه نادرست است")
    return {"access_token":create_access_token(u.id),"token_type":"bearer","user":{"id":u.id,"email":u.email,"name":u.name}}
@auth_api.get("/auth/me")
def me(user:User=Depends(current_user)): return {"id":user.id,"email":user.email,"name":user.name,"created_at":user.created_at}

@books_api.get("/books")
def books(db:Session=Depends(get_db), user:User=Depends(current_user), include_archived:bool=False):
    q=db.query(Book).filter_by(user_id=user.id)
    if not include_archived:q=q.filter_by(is_active=True)
    items=q.order_by(Book.created_at.desc()).all()
    return [{**dump(book),"nodes":dump(db.query(BookNode).filter_by(book_id=book.id,is_active=True).order_by(BookNode.order_index).all())} for book in items]
@books_api.post("/books",status_code=201)
def create_book(data:BookIn,db:Session=Depends(get_db),user:User=Depends(current_user)):
    x=Book(user_id=user.id,**data.model_dump());db.add(x);db.commit();db.refresh(x);return dump(x)
@books_api.get("/books/{book_id}")
def get_book(book_id:str,db:Session=Depends(get_db),user:User=Depends(current_user)):
    b=owned_book(db,book_id,user); nodes=db.query(BookNode).filter_by(book_id=b.id,is_active=True).order_by(BookNode.order_index).all()
    return {**dump(b),"nodes":dump(nodes)}
@books_api.patch("/books/{book_id}")
def update_book(book_id:str,data:dict,db:Session=Depends(get_db),user:User=Depends(current_user)):
    b=owned_book(db,book_id,user); allowed={"title","subject","publisher","grade","field","notes","is_active"}
    for k,v in data.items():
        if k in allowed:setattr(b,k,v)
    db.commit();db.refresh(b);return dump(b)
@books_api.delete("/books/{book_id}")
def archive_book(book_id:str,db:Session=Depends(get_db),user:User=Depends(current_user)):
    b=owned_book(db,book_id,user);b.is_active=False;db.commit();return {"message":"کتاب بایگانی شد"}
@books_api.post("/books/{book_id}/nodes",status_code=201)
def create_node(book_id:str,data:NodeIn,db:Session=Depends(get_db),user:User=Depends(current_user)):
    b=owned_book(db,book_id,user)
    if data.parent_id and not db.query(BookNode).filter_by(id=data.parent_id,book_id=b.id).first():raise HTTPException(400,"گره والد در این کتاب وجود ندارد")
    x=BookNode(book_id=b.id,**data.model_dump());db.add(x);db.commit();db.refresh(x);return dump(x)
@books_api.patch("/nodes/{node_id}")
def update_node(node_id:str,data:dict,db:Session=Depends(get_db),user:User=Depends(current_user)):
    x=db.get(BookNode,node_id)
    if not x:raise HTTPException(404,"گره پیدا نشد")
    owned_book(db,x.book_id,user)
    if "parent_id" in data and data["parent_id"] is not None:
        parent=db.get(BookNode,data["parent_id"])
        if not parent or parent.book_id!=x.book_id or parent.id==x.id:raise HTTPException(400,"گره والد معتبر نیست")
        ancestor=parent
        while ancestor is not None:
            if ancestor.id==x.id:raise HTTPException(400,"ساختار گره‌ها نمی‌تواند چرخه داشته باشد")
            ancestor=db.get(BookNode,ancestor.parent_id) if ancestor.parent_id else None
    for k in ("title","node_type","parent_id","order_index","is_active"):
        if k in data:setattr(x,k,data[k])
    db.commit();db.refresh(x);return dump(x)
@books_api.delete("/nodes/{node_id}")
def archive_node(node_id:str,db:Session=Depends(get_db),user:User=Depends(current_user)):
    x=db.get(BookNode,node_id)
    if not x:raise HTTPException(404,"گره پیدا نشد")
    owned_book(db,x.book_id,user);x.is_active=False;db.commit();return {"message":"گره بایگانی شد"}

@questions_api.get("/questions")
def questions(book_id:str|None=None,book_node_id:str|None=None,topic_id:str|None=None,is_important:bool|None=None,is_hard:bool|None=None,is_active:bool=True,page:int=1,size:int=50,db:Session=Depends(get_db),user:User=Depends(current_user)):
    q=db.query(Question).join(Book,Question.book_id==Book.id).filter(Book.user_id==user.id,Question.is_active==is_active)
    if book_id:q=q.filter(Question.book_id==book_id)
    if book_node_id:q=q.filter(Question.book_node_id==book_node_id)
    if topic_id:q=q.join(QuestionTopic).filter(QuestionTopic.topic_id==topic_id)
    if is_important is not None:q=q.filter(Question.is_important==is_important)
    if is_hard is not None:q=q.filter(Question.is_hard==is_hard)
    total=q.count(); items=q.order_by(Question.created_at.desc()).offset((page-1)*size).limit(min(size,200)).all()
    return {"items":dump(items),"total":total,"page":page,"size":size}
@questions_api.post("/questions",status_code=201)
def create_question(data:QuestionIn,db:Session=Depends(get_db),user:User=Depends(current_user)):
    b=owned_book(db,data.book_id,user)
    if not db.query(BookNode).filter_by(id=data.book_node_id,book_id=b.id).first():raise HTTPException(400,"گره انتخاب‌شده متعلق به این کتاب نیست")
    x=Question(**data.model_dump());db.add(x);db.commit();db.refresh(x);return dump(x)
@questions_api.get("/questions/{question_id}")
def get_question(question_id:str,db:Session=Depends(get_db),user:User=Depends(current_user)):
    x=owned_question(db,question_id,user); links=db.query(QuestionTopic).filter_by(question_id=x.id).all();return {**dump(x),"topics":dump(links)}
@questions_api.patch("/questions/{question_id}")
def update_question(question_id:str,data:dict,db:Session=Depends(get_db),user:User=Depends(current_user)):
    x=owned_question(db,question_id,user)
    if "book_node_id" in data:
        node=db.get(BookNode,data["book_node_id"])
        if not node or node.book_id!=x.book_id:raise HTTPException(400,"گره باید متعلق به کتاب همین تست باشد")
    for k in ("display_number","correct_answer","publisher_difficulty","is_important","is_hard","is_active","book_node_id"):
        if k in data:setattr(x,k,data[k])
    db.commit();db.refresh(x);return dump(x)
@questions_api.post("/questions/{question_id}/topics",status_code=201)
def link_topic(question_id:str,data:TopicLinkIn,db:Session=Depends(get_db),user:User=Depends(current_user)):
    x=owned_question(db,question_id,user);owned_topic(db,data.topic_id,user)
    link=db.query(QuestionTopic).filter_by(question_id=x.id,topic_id=data.topic_id).first()
    if link:link.relation_type=data.relation_type
    else:link=QuestionTopic(question_id=x.id,**data.model_dump());db.add(link)
    db.commit();db.refresh(link);return dump(link)

@attempts_api.post("/attempts",status_code=201)
def create_attempt(data:AttemptIn,db:Session=Depends(get_db),user:User=Depends(current_user)):
    q=owned_question(db,data.question_id,user);x=QuestionAttempt(question_id=q.id,user_answer=data.user_answer,result=calculate_result(data.user_answer,q.correct_answer),spent_seconds=data.spent_seconds,source=data.source)
    db.add(x);db.commit();db.refresh(x);return dump(x)
@attempts_api.get("/attempts")
def attempts(question_id:str|None=None,result:str|None=None,page:int=1,size:int=50,db:Session=Depends(get_db),user:User=Depends(current_user)):
    q=db.query(QuestionAttempt).join(Question).join(Book).filter(Book.user_id==user.id)
    if question_id:q=q.filter(QuestionAttempt.question_id==question_id)
    if result:q=q.filter(QuestionAttempt.result==result)
    total=q.count();return {"items":dump(q.order_by(QuestionAttempt.attempted_at.desc()).offset((page-1)*size).limit(min(size,200)).all()),"total":total,"page":page,"size":size}
@attempts_api.post("/previous-solved",status_code=201)
def previous(data:PreviousIn|list[PreviousIn],db:Session=Depends(get_db),user:User=Depends(current_user)):
    rows=[]
    for d in (data if isinstance(data,list) else [data]):
        owned_question(db,d.question_id,user)
        if d.result not in {"correct","wrong","unanswered"}:raise HTTPException(422,"نتیجه باید درست، غلط یا بی‌پاسخ باشد")
        x=PreviousSolvedEntry(**d.model_dump());db.add(x);rows.append(x)
    db.commit();return dump(rows)

@topics_api.get("/topics")
def topics(db:Session=Depends(get_db),user:User=Depends(current_user)):
    return dump(db.query(Topic).filter_by(user_id=user.id).order_by(Topic.subject,Topic.title).all())
@topics_api.post("/topics",status_code=201)
def create_topic(data:TopicIn,db:Session=Depends(get_db),user:User=Depends(current_user)):
    if data.parent_id:owned_topic(db,data.parent_id,user)
    x=Topic(user_id=user.id,**data.model_dump());db.add(x);db.commit();db.refresh(x);return dump(x)
@topics_api.patch("/topics/{topic_id}")
def update_topic(topic_id:str,data:dict,db:Session=Depends(get_db),user:User=Depends(current_user)):
    x=owned_topic(db,topic_id,user)
    if "parent_id" in data and data["parent_id"] is not None:owned_topic(db,data["parent_id"],user)
    if "status" in data and data["status"] not in ("active","archived"):raise HTTPException(422,"وضعیت مبحث معتبر نیست")
    for k in ("title","subject","parent_id","status"):
        if k in data:setattr(x,k,data[k])
    db.commit();db.refresh(x);return dump(x)
@topics_api.get("/topics/{topic_id}/questions")
def topic_questions(topic_id:str,db:Session=Depends(get_db),user:User=Depends(current_user)):
    owned_topic(db,topic_id,user);return dump(db.query(Question).join(QuestionTopic).filter(QuestionTopic.topic_id==topic_id).all())

@teaching_api.get("/teaching/records")
def teaching_records(db:Session=Depends(get_db),user:User=Depends(current_user)):
    rows=db.query(TeachingRecord,Topic).join(Topic).filter(Topic.user_id==user.id).all();return [{**dump(r),"topic":dump(t)} for r,t in rows]
@teaching_api.put("/teaching/records/{topic_id}")
def set_teaching(topic_id:str,data:TeachingIn,db:Session=Depends(get_db),user:User=Depends(current_user)):
    owned_topic(db,topic_id,user);r=db.query(TeachingRecord).filter_by(topic_id=topic_id).first()
    if not r:r=TeachingRecord(topic_id=topic_id);db.add(r)
    r.taught_status=data.taught_status;r.taught_at=data.taught_at;r.notes=data.notes;db.commit();db.refresh(r);return dump(r)
@teaching_api.get("/teaching/goals")
def goals(db:Session=Depends(get_db),user:User=Depends(current_user)):
    return dump(db.query(TeachingGoal).join(Topic).filter(Topic.user_id==user.id).all())
@teaching_api.post("/teaching/goals",status_code=201)
def add_goal(data:GoalIn,db:Session=Depends(get_db),user:User=Depends(current_user)):
    owned_topic(db,data.topic_id,user);x=TeachingGoal(**data.model_dump());db.add(x);db.commit();db.refresh(x);return dump(x)
@teaching_api.get("/teaching/progress")
def teaching_progress(db:Session=Depends(get_db),user:User=Depends(current_user)):
    result=[]
    for g in db.query(TeachingGoal).join(Topic).filter(Topic.user_id==user.id).all():
        qids=[x[0] for x in db.query(QuestionTopic.question_id).filter_by(topic_id=g.topic_id).all()]
        done=db.query(QuestionAttempt).filter(QuestionAttempt.question_id.in_(qids)).count() if qids else 0
        result.append({**dump(g),"completed_count":done,"remaining_count":max(0,g.target_count-done)})
    return result

@review_api.get("/review/items")
def review_items(status:str|None=None,db:Session=Depends(get_db),user:User=Depends(current_user)):
    q=db.query(ReviewItem).join(Question).join(Book).filter(Book.user_id==user.id)
    if status:q=q.filter(ReviewItem.status==status)
    return dump(q.order_by(ReviewItem.priority.desc(),ReviewItem.created_at.desc()).all())
@review_api.post("/review/generate")
def generate_review(data:ReviewGenerate,db:Session=Depends(get_db),user:User=Depends(current_user)):
    questions_q=db.query(Question).join(Book).filter(Book.user_id==user.id,Question.is_active==True); candidates={}
    due_topics=set()
    if data.backlog:
        for goal in db.query(TeachingGoal).join(Topic).filter(Topic.user_id==user.id).all():
            linked=[r[0] for r in db.query(QuestionTopic.question_id).filter_by(topic_id=goal.topic_id).all()]
            attempts_done=db.query(QuestionAttempt).filter(QuestionAttempt.question_id.in_(linked)).count() if linked else 0
            if attempts_done < goal.target_count: due_topics.add(goal.topic_id)
    future_topics=set()
    if data.future_exam:
        plans=db.query(FutureExamPlan).filter(FutureExamPlan.user_id==user.id).all()
        plan_ids=[p.id for p in plans if p.planned_date is None or p.planned_date >= datetime.now(timezone.utc)]
        if plan_ids:future_topics={r[0] for r in db.query(FutureExamPlanTopic.topic_id).filter(FutureExamPlanTopic.plan_id.in_(plan_ids)).all()}
    for q in questions_q.all():
        reasons=[]
        attempts=db.query(QuestionAttempt).filter_by(question_id=q.id).order_by(QuestionAttempt.attempted_at.desc()).all()
        prev=db.query(PreviousSolvedEntry).filter_by(question_id=q.id).all()
        if data.wrong and any(a.result=="wrong" for a in attempts):reasons.append("غلط")
        if data.unanswered and any(a.result=="unanswered" for a in attempts):reasons.append("بی‌پاسخ")
        if data.previous and any(p.result in ((["wrong"] if data.wrong else []) + (["unanswered"] if data.unanswered else [])) for p in prev):reasons.append("سابقه قبلی")
        if data.important and q.is_important:reasons.append("مهم")
        if data.hard and q.is_hard:reasons.append("سخت")
        topic_ids={r[0] for r in db.query(QuestionTopic.topic_id).filter_by(question_id=q.id).all()}
        if topic_ids & due_topics:reasons.append("عقب‌ماندگی هدف تدریس")
        if topic_ids & future_topics:reasons.append("مرتبط با آزمون آینده")
        if reasons:candidates[q.id]=(q,reasons)
    created=[]
    for q,reasons in list(candidates.values())[:data.limit]:
        existing=db.query(ReviewItem).filter_by(question_id=q.id,status="pending").first()
        if existing:
            existing.reasons=json.dumps(sorted(set(json.loads(existing.reasons)+reasons)),ensure_ascii=False);created.append(existing)
        else:
            x=ReviewItem(question_id=q.id,reasons=json.dumps(reasons,ensure_ascii=False),priority=len(reasons));db.add(x);created.append(x)
    db.commit();return dump(created)
@review_api.patch("/review/items/{item_id}")
def update_review(item_id:str,data:dict,db:Session=Depends(get_db),user:User=Depends(current_user)):
    x=db.get(ReviewItem,item_id)
    if not x:raise HTTPException(404,"آیتم مرور پیدا نشد")
    owned_question(db,x.question_id,user)
    if data.get("status") in ("done","pending"):
        x.status=data["status"];x.resolved_at=datetime.now(timezone.utc) if x.status=="done" else None
    db.commit();db.refresh(x);return dump(x)

@exams_api.get("/exams")
def exams(db:Session=Depends(get_db),user:User=Depends(current_user)):
    return dump(db.query(Exam).filter_by(user_id=user.id).order_by(Exam.created_at.desc()).all())
@exams_api.post("/exams",status_code=201)
def create_exam(data:ExamIn,db:Session=Depends(get_db),user:User=Depends(current_user)):
    values=data.model_dump();topic_ids=values.pop("topic_ids");x=Exam(user_id=user.id,**values);db.add(x);db.flush()
    for tid in topic_ids:owned_topic(db,tid,user);db.add(ExamTopic(exam_id=x.id,topic_id=tid))
    db.commit();db.refresh(x);return dump(x)
@exams_api.get("/exams/{exam_id}")
def exam_detail(exam_id:str,db:Session=Depends(get_db),user:User=Depends(current_user)):
    x=owned_exam(db,exam_id,user);return {**dump(x),"questions":dump(db.query(ExamQuestion).filter_by(exam_id=x.id).order_by(ExamQuestion.order_index).all()),"topics":dump(db.query(ExamTopic).filter_by(exam_id=x.id).all()),"attempts":dump(db.query(ExamAttempt).filter_by(exam_id=x.id).order_by(ExamAttempt.started_at.desc()).all())}
@exams_api.post("/exams/{exam_id}/questions",status_code=201)
def exam_add_question(exam_id:str,data:ExamQuestionIn,db:Session=Depends(get_db),user:User=Depends(current_user)):
    owned_exam(db,exam_id,user)
    if data.question_id:owned_question(db,data.question_id,user)
    x=ExamQuestion(exam_id=exam_id,**data.model_dump());db.add(x);db.commit();db.refresh(x);return dump(x)
@exams_api.post("/exams/{exam_id}/attempts",status_code=201)
def start_exam(exam_id:str,db:Session=Depends(get_db),user:User=Depends(current_user)):
    owned_exam(db,exam_id,user);x=ExamAttempt(exam_id=exam_id);db.add(x);db.commit();db.refresh(x);return dump(x)
@exams_api.post("/exam-attempts/{attempt_id}/answers",status_code=201)
def answer_exam(attempt_id:str,data:AnswerIn,db:Session=Depends(get_db),user:User=Depends(current_user)):
    att=db.get(ExamAttempt,attempt_id)
    if not att:raise HTTPException(404,"اجرای آزمون پیدا نشد")
    owned_exam(db,att.exam_id,user)
    if att.finished_at:raise HTTPException(409,"این اجرای آزمون پایان یافته است")
    eq=db.get(ExamQuestion,data.exam_question_id)
    if not eq or eq.exam_id!=att.exam_id:raise HTTPException(400,"تست متعلق به این آزمون نیست")
    correct=eq.correct_answer
    if eq.question_id:correct=owned_question(db,eq.question_id,user).correct_answer
    ans=ExamAnswer(exam_attempt_id=att.id,exam_question_id=eq.id,user_answer=data.user_answer,result=calculate_result(data.user_answer,correct),spent_seconds=data.spent_seconds);db.add(ans);db.commit();db.refresh(ans);return dump(ans)
@exams_api.patch("/exam-attempts/{attempt_id}/finish")
def finish_exam(attempt_id:str,db:Session=Depends(get_db),user:User=Depends(current_user)):
    att=db.get(ExamAttempt,attempt_id)
    if not att:raise HTTPException(404,"اجرای آزمون پیدا نشد")
    owned_exam(db,att.exam_id,user)
    if att.finished_at:raise HTTPException(409,"این اجرا قبلاً پایان یافته است")
    answers=db.query(ExamAnswer).filter_by(exam_attempt_id=att.id).all()
    summary={k:sum(1 for a in answers if a.result==k) for k in ("correct","wrong","unanswered")}
    att.finished_at=datetime.now(timezone.utc);att.score_summary=json.dumps(summary,ensure_ascii=False);db.commit();db.refresh(att)
    return {**dump(att),"summary":summary}
@exams_api.get("/exam-attempts/{attempt_id}")
def exam_attempt_detail(attempt_id:str,db:Session=Depends(get_db),user:User=Depends(current_user)):
    att=db.get(ExamAttempt,attempt_id)
    if not att:raise HTTPException(404,"اجرای آزمون پیدا نشد")
    owned_exam(db,att.exam_id,user);answers=db.query(ExamAnswer).filter_by(exam_attempt_id=att.id).all();summary={k:sum(1 for a in answers if a.result==k) for k in ("correct","wrong","unanswered")}
    return {**dump(att),"answers":dump(answers),"summary":summary}
@exams_api.post("/exams/{exam_id}/assets",status_code=201)
async def upload_asset(exam_id:str,file:UploadFile=File(...),db:Session=Depends(get_db),user:User=Depends(current_user)): 
    owned_exam(db,exam_id,user)
    ext=Path(file.filename or "").suffix.lower()
    if ext not in (".pdf",".png",".jpg",".jpeg",".webp"):raise HTTPException(400,"فقط فایل PDF یا تصویر مجاز است")
    folder=Path(settings.upload_dir)/user.id;folder.mkdir(parents=True,exist_ok=True);name=f"{uuid.uuid4().hex}{ext}"
    content=await file.read()
    if len(content)>20*1024*1024:raise HTTPException(413,"حجم فایل نباید بیشتر از ۲۰ مگابایت باشد")
    (folder/name).write_bytes(content)
    a=ExamAsset(exam_id=exam_id,file_type="pdf" if ext==".pdf" else "image",file_path=str(folder/name),original_name=file.filename);db.add(a);db.commit();db.refresh(a);return dump(a)
@exams_api.get("/exams/{exam_id}/assets")
def exam_assets(exam_id:str,db:Session=Depends(get_db),user:User=Depends(current_user)):
    owned_exam(db,exam_id,user);return dump(db.query(ExamAsset).filter_by(exam_id=exam_id).all())
@exams_api.get("/assets/{asset_id}/download")
def download_exam_asset(asset_id:str,db:Session=Depends(get_db),user:User=Depends(current_user)):
    asset=db.get(ExamAsset,asset_id)
    if not asset or not asset.exam_id:raise HTTPException(404,"پیوست پیدا نشد")
    owned_exam(db,asset.exam_id,user)
    if not Path(asset.file_path).is_file():raise HTTPException(404,"فایل پیوست در دسترس نیست")
    return FileResponse(asset.file_path,filename=asset.original_name or Path(asset.file_path).name)

@readiness_api.post("/readiness/plans",status_code=201)
def create_plan(data:PlanIn,db:Session=Depends(get_db),user:User=Depends(current_user)):
    vals=data.model_dump();ids=vals.pop("topic_ids");p=FutureExamPlan(user_id=user.id,**vals);db.add(p);db.flush()
    for tid in ids:owned_topic(db,tid,user);db.add(FutureExamPlanTopic(plan_id=p.id,topic_id=tid))
    db.commit();return plan_detail(p.id,db,user)
def readiness_calc(p,db):
    tids={r[0] for r in db.query(FutureExamPlanTopic.topic_id).filter_by(plan_id=p.id).all()}
    qids={r[0] for r in db.query(QuestionTopic.question_id).filter(QuestionTopic.topic_id.in_(tids)).all()} if tids else set()
    qs=db.query(Question).filter(Question.id.in_(qids),Question.is_active==True).all() if qids else []
    tasks=[]; weighted=0.0
    for q in qs:
        ats=db.query(QuestionAttempt).filter_by(question_id=q.id).order_by(QuestionAttempt.attempted_at.desc()).all()
        previous=db.query(PreviousSolvedEntry).filter_by(question_id=q.id).order_by(PreviousSolvedEntry.imported_at.desc()).all()
        history=[a.result for a in ats]+[x.result for x in previous]
        accuracy=(history.count("correct")/len(history)*100) if history else 0.0
        weighted+=accuracy
        latest=ats[0].result if ats else (previous[0].result if previous else None)
        reasons=[]
        if latest!="correct":reasons.append("نیازمند تمرین")
        if q.is_important:reasons.append("مهم")
        if q.is_hard:reasons.append("سخت")
        if reasons:tasks.append({"question_id":q.id,"display_number":q.display_number,"reasons":reasons})
    performance=weighted/len(qs) if qs else 0.0
    records={r.topic_id:r for r in db.query(TeachingRecord).filter(TeachingRecord.topic_id.in_(tids)).all()} if tids else {}
    taught_pct=(sum(1 for tid in tids if records.get(tid) and records[tid].taught_status in ("taught","reviewed"))/len(tids)*100) if tids else 0.0
    goals=db.query(TeachingGoal).filter(TeachingGoal.topic_id.in_(tids)).all() if tids else []
    if goals:
        total_goal=sum(g.target_count for g in goals)
        total_done=0
        for goal in goals:
            linked=[r[0] for r in db.query(QuestionTopic.question_id).filter_by(topic_id=goal.topic_id).all()]
            total_done+=min(goal.target_count,db.query(QuestionAttempt).filter(QuestionAttempt.question_id.in_(linked)).count()) if linked else 0
            if linked and total_done < total_goal:
                tasks.append({"topic_id":goal.topic_id,"reasons":["تکمیل هدف تست تدریس"]})
        goal_pct=min(100,total_done/total_goal*100) if total_goal else 100.0
    else:goal_pct=100.0
    estimate=round(min(100,max(0,performance*0.7+taught_pct*0.15+goal_pct*0.15)),1) if qs else 0.0
    return estimate,tasks,len(qs)
def plan_detail(plan_id,db,user):
    p=owned_plan(db,plan_id,user);estimate,tasks,total=readiness_calc(p,db);p.readiness_estimate=estimate;db.commit()
    return {**dump(p),"topics":dump(db.query(FutureExamPlanTopic).filter_by(plan_id=p.id).all()),"estimated_question_count":total,"tasks":tasks,"disclaimer":"این برآورد صرفاً تخمینی است و نتیجه آزمون را تضمین نمی‌کند."}
@readiness_api.get("/readiness/plans")
def plans(db:Session=Depends(get_db),user:User=Depends(current_user)):
    return dump(db.query(FutureExamPlan).filter_by(user_id=user.id).order_by(FutureExamPlan.created_at.desc()).all())
@readiness_api.get("/readiness/plans/{plan_id}")
def get_plan(plan_id:str,db:Session=Depends(get_db),user:User=Depends(current_user)):return plan_detail(plan_id,db,user)
@readiness_api.post("/readiness/plans/{plan_id}/recalculate")
def recalculate(plan_id:str,db:Session=Depends(get_db),user:User=Depends(current_user)):return plan_detail(plan_id,db,user)

@dashboard_api.get("/dashboard/summary")
def dashboard(db:Session=Depends(get_db),user:User=Depends(current_user)):
    books_q=db.query(Book).filter_by(user_id=user.id); book_ids=[b[0] for b in books_q.with_entities(Book.id).all()]
    questions_q=db.query(Question).filter(Question.book_id.in_(book_ids)) if book_ids else db.query(Question).filter(False)
    qids=[r[0] for r in questions_q.with_entities(Question.id).all()]; ats=db.query(QuestionAttempt).filter(QuestionAttempt.question_id.in_(qids)).all() if qids else []
    entries=db.query(PreviousSolvedEntry).filter(PreviousSolvedEntry.question_id.in_(qids)).all() if qids else []; results=[a.result for a in ats]+[a.result for a in entries]
    return {"book_count":len(book_ids),"question_count":len(qids),"attempt_count":len(ats),"previous_entry_count":len(entries),"correct":results.count("correct"),"wrong":results.count("wrong"),"unanswered":results.count("unanswered"),"accuracy":round(results.count("correct")/len(results)*100,1) if results else 0,"important_count":questions_q.filter(Question.is_important==True).count(),"hard_count":questions_q.filter(Question.is_hard==True).count(),"upcoming_exams":dump(db.query(Exam).filter(Exam.user_id==user.id,Exam.planned_date>=datetime.now(timezone.utc)).order_by(Exam.planned_date).limit(5).all()),"recent_attempts":dump(db.query(QuestionAttempt).join(Question).filter(Question.id.in_(qids)).order_by(QuestionAttempt.attempted_at.desc()).limit(8).all() if qids else [])}
@dashboard_api.get("/dashboard/by-topic")
def dashboard_topic(db:Session=Depends(get_db),user:User=Depends(current_user)):
    out=[]
    for t in db.query(Topic).filter_by(user_id=user.id).all():
        qids=[r[0] for r in db.query(QuestionTopic.question_id).filter_by(topic_id=t.id).all()];a=db.query(QuestionAttempt).filter(QuestionAttempt.question_id.in_(qids)).all() if qids else [];p=db.query(PreviousSolvedEntry).filter(PreviousSolvedEntry.question_id.in_(qids)).all() if qids else [];rs=[x.result for x in a]+[x.result for x in p]
        out.append({"topic":dump(t),"question_count":len(set(qids)),"attempt_count":len(a),"accuracy":round(rs.count("correct")/len(rs)*100,1) if rs else 0,"wrong":rs.count("wrong"),"unanswered":rs.count("unanswered")})
    return out
@dashboard_api.get("/dashboard/by-book")
def dashboard_book(db:Session=Depends(get_db),user:User=Depends(current_user)):
    out=[]
    for b in db.query(Book).filter_by(user_id=user.id).all():
        qs=db.query(Question).filter_by(book_id=b.id).all();ids=[q.id for q in qs];a=db.query(QuestionAttempt).filter(QuestionAttempt.question_id.in_(ids)).all() if ids else [];p=db.query(PreviousSolvedEntry).filter(PreviousSolvedEntry.question_id.in_(ids)).all() if ids else [];rs=[x.result for x in a]+[x.result for x in p]
        out.append({"book":dump(b),"question_count":len(qs),"attempt_count":len(a),"accuracy":round(rs.count("correct")/len(rs)*100,1) if rs else 0,"wrong":rs.count("wrong"),"unanswered":rs.count("unanswered")})
    return out

api = APIRouter()
for module_router in (auth_api, books_api, questions_api, attempts_api, topics_api, teaching_api, review_api, exams_api, readiness_api, dashboard_api):
    api.include_router(module_router)
