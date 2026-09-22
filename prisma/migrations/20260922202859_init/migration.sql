-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Book" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "publisher" TEXT,
    "grade" TEXT,
    "field" TEXT,
    "notes" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Book_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BookNode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookId" TEXT NOT NULL,
    "parentId" TEXT,
    "nodeType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "BookNode_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BookNode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "BookNode" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Topic" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subject" TEXT NOT NULL,
    "parentId" TEXT,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    CONSTRAINT "Topic_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Topic" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookId" TEXT NOT NULL,
    "bookNodeId" TEXT NOT NULL,
    "displayNumber" TEXT NOT NULL,
    "correctAnswer" TEXT NOT NULL,
    "publisherDifficulty" TEXT,
    "isImportant" BOOLEAN NOT NULL DEFAULT false,
    "isHard" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Question_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Question_bookNodeId_fkey" FOREIGN KEY ("bookNodeId") REFERENCES "BookNode" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuestionTopic" (
    "questionId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "relationType" TEXT NOT NULL DEFAULT 'primary',

    PRIMARY KEY ("questionId", "topicId"),
    CONSTRAINT "QuestionTopic_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuestionTopic_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuestionAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionId" TEXT NOT NULL,
    "userAnswer" TEXT,
    "result" TEXT NOT NULL,
    "spentSeconds" INTEGER,
    "attemptedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'manual',
    CONSTRAINT "QuestionAttempt_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PreviousSolvedEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionId" TEXT NOT NULL,
    "userAnswer" TEXT,
    "result" TEXT NOT NULL,
    "note" TEXT,
    "importedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "importBatch" TEXT,
    CONSTRAINT "PreviousSolvedEntry_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TeachingRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "topicId" TEXT NOT NULL,
    "taughtStatus" TEXT NOT NULL DEFAULT 'not_taught',
    "taughtAt" DATETIME,
    "notes" TEXT,
    CONSTRAINT "TeachingRecord_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TeachingGoal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "topicId" TEXT NOT NULL,
    "targetCount" INTEGER NOT NULL,
    "periodStart" DATETIME,
    "periodEnd" DATETIME,
    "notes" TEXT,
    CONSTRAINT "TeachingGoal_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Exam" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "examType" TEXT NOT NULL DEFAULT 'single_subject',
    "plannedDate" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ExamTopic" (
    "examId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,

    PRIMARY KEY ("examId", "topicId"),
    CONSTRAINT "ExamTopic_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExamTopic_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExamQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examId" TEXT NOT NULL,
    "questionId" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "correctAnswer" TEXT,
    CONSTRAINT "ExamQuestion_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExamQuestion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExamAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examId" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "scoreSummary" TEXT,
    CONSTRAINT "ExamAttempt_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExamAnswer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examAttemptId" TEXT NOT NULL,
    "examQuestionId" TEXT NOT NULL,
    "userAnswer" TEXT,
    "result" TEXT NOT NULL,
    "spentSeconds" INTEGER,
    CONSTRAINT "ExamAnswer_examAttemptId_fkey" FOREIGN KEY ("examAttemptId") REFERENCES "ExamAttempt" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExamAnswer_examQuestionId_fkey" FOREIGN KEY ("examQuestionId") REFERENCES "ExamQuestion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FutureExamPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "plannedDate" DATETIME,
    "selectedTopicIds" TEXT NOT NULL DEFAULT '[]',
    "readinessEstimate" REAL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ReviewItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionId" TEXT NOT NULL,
    "reasons" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    CONSTRAINT "ReviewItem_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Book_userId_idx" ON "Book"("userId");

-- CreateIndex
CREATE INDEX "BookNode_bookId_idx" ON "BookNode"("bookId");

-- CreateIndex
CREATE INDEX "BookNode_parentId_idx" ON "BookNode"("parentId");

-- CreateIndex
CREATE INDEX "Topic_parentId_idx" ON "Topic"("parentId");

-- CreateIndex
CREATE INDEX "Topic_subject_idx" ON "Topic"("subject");

-- CreateIndex
CREATE INDEX "Question_bookId_idx" ON "Question"("bookId");

-- CreateIndex
CREATE INDEX "Question_bookNodeId_idx" ON "Question"("bookNodeId");

-- CreateIndex
CREATE INDEX "Question_bookId_displayNumber_idx" ON "Question"("bookId", "displayNumber");

-- CreateIndex
CREATE INDEX "QuestionTopic_topicId_idx" ON "QuestionTopic"("topicId");

-- CreateIndex
CREATE INDEX "QuestionAttempt_questionId_attemptedAt_idx" ON "QuestionAttempt"("questionId", "attemptedAt");

-- CreateIndex
CREATE INDEX "QuestionAttempt_attemptedAt_idx" ON "QuestionAttempt"("attemptedAt");

-- CreateIndex
CREATE INDEX "PreviousSolvedEntry_questionId_idx" ON "PreviousSolvedEntry"("questionId");

-- CreateIndex
CREATE INDEX "PreviousSolvedEntry_importedAt_idx" ON "PreviousSolvedEntry"("importedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TeachingRecord_topicId_key" ON "TeachingRecord"("topicId");

-- CreateIndex
CREATE INDEX "TeachingGoal_topicId_idx" ON "TeachingGoal"("topicId");

-- CreateIndex
CREATE INDEX "Exam_plannedDate_idx" ON "Exam"("plannedDate");

-- CreateIndex
CREATE INDEX "ExamTopic_topicId_idx" ON "ExamTopic"("topicId");

-- CreateIndex
CREATE INDEX "ExamQuestion_examId_orderIndex_idx" ON "ExamQuestion"("examId", "orderIndex");

-- CreateIndex
CREATE INDEX "ExamQuestion_questionId_idx" ON "ExamQuestion"("questionId");

-- CreateIndex
CREATE INDEX "ExamAttempt_examId_startedAt_idx" ON "ExamAttempt"("examId", "startedAt");

-- CreateIndex
CREATE INDEX "ExamAnswer_examQuestionId_idx" ON "ExamAnswer"("examQuestionId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamAnswer_examAttemptId_examQuestionId_key" ON "ExamAnswer"("examAttemptId", "examQuestionId");

-- CreateIndex
CREATE INDEX "FutureExamPlan_plannedDate_idx" ON "FutureExamPlan"("plannedDate");

-- CreateIndex
CREATE INDEX "ReviewItem_status_priority_idx" ON "ReviewItem"("status", "priority");

-- CreateIndex
CREATE INDEX "ReviewItem_questionId_idx" ON "ReviewItem"("questionId");
