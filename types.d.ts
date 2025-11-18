type Question = {
  question_id: string;
  question_type: string;
  question: string;
  answer: string;
  question_date: string;
  haystack_dates: string[];
  haystack_session_ids: string[];
  haystack_sessions: Session[];
  answer_session_ids: string[];
};

type Session = Message[];

type Message = {
  role: "user" | "assistant";
  content: string;
  has_answer: boolean;
};
