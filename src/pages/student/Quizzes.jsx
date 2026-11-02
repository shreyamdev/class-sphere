import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CircleHelp, ClipboardCheck, X } from "lucide-react";
import Topbar from "../../components/Topbar";
import HeroBanner from "../../components/HeroBanner";
import Card from "../../components/Card";
import { fetchMyClassrooms } from "../../services/classroomService";
import {
  getStudentClassroomQuizzes,
  getStudentQuizAttempts,
  getStudentQuizAttemptReview,
  normalizeQuiz,
} from "../../services/quizService";

function quizIdOf(value) {
  const quiz = value?.quiz;
  return String(
    (typeof quiz === "string" ? quiz : quiz?._id ?? quiz?.id) ??
      value?.quizId ?? value?.quiz?._id ?? value?.quiz?.id ?? ""
  );
}

function attemptIdOf(value) {
  return String(value?._id ?? value?.id ?? value?.attemptId ?? "");
}

export default function Quizzes() {
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [review, setReview] = useState(null);
  const [reviewStatus, setReviewStatus] = useState("idle");
  const [reviewError, setReviewError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([fetchMyClassrooms(), getStudentQuizAttempts()])
      .then(async ([classrooms, attempts]) => {
        const groups = await Promise.all(
          classrooms.map(async (classroom) => {
            const id = String(classroom._id ?? classroom.id);
            const classroomQuizzes = await getStudentClassroomQuizzes(id);
            return classroomQuizzes.map((quiz) => normalizeQuiz(quiz, classroom));
          })
        );
        if (!active) return;
        const attemptByQuizId = new Map(
          attempts.map((attempt) => [quizIdOf(attempt), attempt])
        );
        setQuizzes(groups.flat().map((quiz) => {
          const attempt = attemptByQuizId.get(quiz.id);
          return {
            ...quiz,
            attempt,
            completed: Boolean(attempt),
            score: attempt?.score ?? attempt?.marksObtained,
            total: attempt?.totalMarks ?? attempt?.total ?? quiz.totalMarks,
          };
        }));
        setStatus("ready");
      })
      .catch((loadError) => {
        if (!active) return;
        setError(loadError.message || "Could not load published quizzes.");
        setStatus("error");
      });
    return () => { active = false; };
  }, []);

  async function openReview(attempt) {
    const attemptId = attemptIdOf(attempt);
    if (!attemptId) return;
    setReview({ attempt, items: [] });
    setReviewStatus("loading");
    setReviewError("");
    try {
      const items = await getStudentQuizAttemptReview(attemptId);
      setReview({ attempt, items });
      setReviewStatus("ready");
    } catch (loadError) {
      setReviewError(loadError.message || "Could not load this attempt review.");
      setReviewStatus("error");
    }
  }

  return (
    <div className="dashboard-stagger space-y-5">
      <Topbar title="Quizzes" subtitle="Published quizzes from your classrooms" />
      <HeroBanner
        variant="yellow"
        title="Practice what you have learned"
        subtitle="Take a published class quiz and review your saved results."
        icons={[CircleHelp, ClipboardCheck]}
      />

      {status === "loading" && (
        <Card className="p-6 text-center text-sm text-muted">Loading your quizzes...</Card>
      )}
      {status === "error" && (
        <Card className="p-5 text-sm text-tone-red-fg" role="alert">{error}</Card>
      )}
      {status === "ready" && quizzes.length === 0 && (
        <Card className="p-8 text-center">
          <p className="font-bold">No published quizzes yet</p>
          <p className="mt-1 text-sm text-muted">When a teacher publishes a quiz for your class, it will appear here.</p>
        </Card>
      )}
      {status === "ready" && quizzes.length > 0 && (
        <div className="grid gap-3">
          {quizzes.map((quiz) => (
            <Card key={quiz.id} className="flex flex-wrap items-center gap-4 p-4">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-tone-yellow text-tone-yellow-fg">
                <CircleHelp size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate font-extrabold">{quiz.title}</h2>
                <p className="mt-1 text-xs text-muted">
                  {quiz.course} · {quiz.topic} · {quiz.questionCount} questions · {quiz.difficulty}
                </p>
              </div>
              {quiz.completed ? (
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-tone-green px-3 py-1.5 text-xs font-bold text-tone-green-fg">
                    Completed{quiz.score != null ? ` · ${quiz.score}/${quiz.total}` : ""}
                  </span>
                  {quiz.attempt?.reviewAvailable && attemptIdOf(quiz.attempt) && (
                    <button
                      type="button"
                      onClick={() => openReview(quiz.attempt)}
                      className="rounded-xl border border-line px-3 py-1.5 text-xs font-bold hover:bg-soft"
                    >
                      Review answers
                    </button>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => navigate(`/student/quizzes/${quiz.id}`, {
                    state: { quiz, classroomId: quiz.classroomId },
                  })}
                  className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-on-brand"
                >
                  Start quiz
                </button>
              )}
            </Card>
          ))}
        </div>
      )}

      {review && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/60 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setReview(null); }}>
          <Card role="dialog" aria-modal="true" aria-label="Quiz attempt review" className="max-h-[90vh] w-full max-w-3xl overflow-hidden">
            <div className="flex items-start justify-between gap-3 border-b border-line p-4">
              <div>
                <h2 className="text-lg font-extrabold">Quiz attempt review</h2>
                <p className="mt-1 text-xs text-muted">
                  {review.attempt?.score ?? review.attempt?.marksObtained ?? "—"}
                  {review.attempt?.totalMarks != null ? ` / ${review.attempt.totalMarks}` : ""}
                </p>
              </div>
              <button type="button" aria-label="Close review" onClick={() => setReview(null)} className="rounded-lg p-2 text-muted hover:bg-soft">
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[calc(90vh-5rem)] overflow-y-auto">
              {reviewStatus === "loading" && <p className="p-6 text-sm text-muted">Loading answer review...</p>}
              {reviewStatus === "error" && (
                <div className="flex flex-wrap items-center justify-between gap-3 p-5 text-sm text-tone-red-fg">
                  <span>{reviewError}</span>
                  <button type="button" onClick={() => openReview(review.attempt)} className="rounded-xl border border-line px-3 py-2 font-bold text-ink">Try again</button>
                </div>
              )}
              {reviewStatus === "ready" && review.items.length === 0 && (
                <p className="p-6 text-center text-sm text-muted">No review items are available for this attempt.</p>
              )}
              {reviewStatus === "ready" && review.items.length > 0 && (
                <div className="divide-y divide-line">
                  {review.items.map((item, index) => {
                    const statusValue = String(item?.status ?? (item?.isCorrect ? "correct" : "incorrect")).toLowerCase();
                    return (
                      <div key={item?.questionIndex ?? index} className="p-4">
                        <p className="font-bold"><span className="mr-2 text-muted">{(item?.questionIndex ?? index) + 1}.</span>{item?.question ?? item?.text ?? "Question unavailable"}</p>
                        <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                          {statusValue === "correct" && <span className="rounded-lg bg-tone-green px-3 py-2 font-bold text-tone-green-fg">Your answer: {item?.selectedAnswer}</span>}
                          {statusValue === "incorrect" && (
                            <>
                              <span className="rounded-lg bg-tone-red px-3 py-2 font-bold text-tone-red-fg">Your answer: {item?.selectedAnswer ?? "Not answered"}</span>
                              <span className="rounded-lg bg-tone-green px-3 py-2 font-bold text-tone-green-fg">Correct answer: {item?.correctAnswer}</span>
                            </>
                          )}
                          {statusValue === "unanswered" && (
                            <>
                              <span className="rounded-lg bg-tone-yellow px-3 py-2 font-bold text-tone-yellow-fg">Not answered</span>
                              <span className="rounded-lg bg-tone-green px-3 py-2 font-bold text-tone-green-fg">Correct answer: {item?.correctAnswer}</span>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
