export type Result = "correct" | "wrong" | "unanswered";
export type AttemptSource = "manual" | "review" | "exam" | "import";
export type NodeType =
  | "chapter"
  | "section"
  | "subsection"
  | "mixed_tests"
  | "checkup"
  | "comprehensive"
  | "other";

export type User = {
  id: string;
  email: string;
  name: string | null;
  created_at: string;
};

export type Stats = {
  total: number;
  correct: number;
  wrong: number;
  unanswered: number;
  percentage: number | null;
};

export type Page<T> = {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
};

export type Book = {
  id: string;
  title: string;
  subject: string;
  publisher: string | null;
  grade: string | null;
  field: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  question_count: number;
  attempt_count: number;
  percentage: number | null;
};

export type BookNode = {
  id: string;
  book_id: string;
  parent_id: string | null;
  node_type: NodeType;
  title: string;
  order_index: number;
  question_count: number;
  children: BookNode[];
};

export type BookDetail = Book & {
  nodes: BookNode[];
  stats: Stats;
};

export type NodeBrief = {
  id: string;
  title: string;
  node_type: NodeType;
};

export type Question = {
  id: string;
  book_id: string;
  book_node_id: string;
  display_number: string;
  correct_answer: string;
  publisher_difficulty: string | null;
  is_important: boolean;
  is_hard: boolean;
  is_active: boolean;
  created_at: string;
  book_title: string | null;
  node_title: string | null;
  path: NodeBrief[];
  attempt_count: number;
  latest_result: Result | null;
};

export type Attempt = {
  id: string;
  question_id: string;
  user_answer: string | null;
  result: Result;
  spent_seconds: number | null;
  attempted_at: string;
  source: AttemptSource;
  attempt_index: number | null;
  display_number: string | null;
  book_id: string | null;
  book_title: string | null;
  node_title: string | null;
};

export type AttemptCreated = Attempt & {
  correct_answer: string;
  overall: Stats;
  book: Stats;
  question: Stats;
};

export type BookStatBrief = {
  id: string;
  title: string;
  subject: string;
  question_count: number;
  attempt_count: number;
  percentage: number | null;
};

export type DashboardSummary = {
  books_count: number;
  questions_count: number;
  important_count: number;
  hard_count: number;
  attempts: Stats;
  checklist: {
    has_book: boolean;
    has_chapter: boolean;
    has_question: boolean;
    has_attempt: boolean;
  };
  continue_book_id: string | null;
  continue_question_id: string | null;
  books: BookStatBrief[];
  recent_attempts: Attempt[];
};

export type BookInput = {
  title: string;
  subject: string;
  publisher?: string | null;
  grade?: string | null;
  field?: string | null;
  notes?: string | null;
};
