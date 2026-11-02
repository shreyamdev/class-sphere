import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { CheckCircle2, CircleHelp } from "lucide-react";
import Topbar from "../../components/Topbar";
import HeroBanner from "../../components/HeroBanner";
import Card from "../../components/Card";
import { fetchMyClassrooms } from "../../services/classroomService";
import {
  getStudentClassroomQuizzes,
  normalizeQuiz,
  normalizeQuizReview,
  submitQuiz,
} from "../../services/quizService";

export default function AttemptQuiz() {
  const { quizId } = useParams();
  const location = useLocation();
  const [quiz, setQuiz] = useState(location.state?.quiz ?? null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(!location.state?.quiz);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (quiz) return undefined;
    let active = true;
    fetchMyClassrooms()
      .then(async (classrooms) => {
        const groups = await Promise.all(classrooms.map(async (classroom) => {
          const classroomId = String(classroom._id ?? classroom.id);
          const quizzes = await getStudentClassroomQuizzes(classroomId);
          return quizzes.map((item) => normalizeQuiz(item, classroom));
        }));
        const found = groups.flat().find((item) => item.id === String(quizId));
        if (active) {
          if (found) setQuiz(found);
          else setError("This published quiz could not be found in your classrooms.");
        }
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || "Could not load this quiz.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [quiz, quizId]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!quiz) return;
    setSubmitting(true);
    setError("");
    try {
      const submittedAnswers = quiz.questions.map((question, questionIndex) => ({
        questionIndex,
        selectedAnswer: answers[questionIndex] ?? "",
      }));
      const response = await submitQuiz({ quizId: quiz.id, answers: submittedAnswers });
      const submittedResult = response?.attempt ?? response?.result ?? response;
      setResult({
        ...submittedResult,
        review: normalizeQuizReview(submittedResult?.review),
      });
    } catch (submitError) {
      if (submitError.status === 409 || submitError.code === "DUPLICATE_SUBMISSION") {
        setError("This quiz has already been submitted. You cannot submit it again.");
      } else {
        setError(submitError.message || "Could not submit your quiz.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="dashboard-stagger space-y-5">
      <Topbar title="Quiz attempt" subtitle={quiz?.title} backFallbackPath="/student/quizzes" />
      {quiz && (
        <HeroBanner
          variant="yellow"
          title={quiz.title}
          subtitle={`${quiz.course} · ${quiz.topic} · ${quiz.questionCount} questions`}
          icons={[CircleHelp, CheckCircle2]}
        />
      )}
      {loading && <Card className="p-6 text-sm text-muted">Loading quiz...</Card>}
      {error && <Card role="alert" className="p-4 text-sm text-tone-red-fg">{error}</Card>}
      {!loading && !quiz && (
        <Card className="p-5 text-sm text-muted">
          Return to <Link className="font-bold underline" to="/student/quizzes">Quizzes</Link> and open a published quiz.
        </Card>
      )}

      {quiz && !result && (
        <form onSubmit={handleSubmit} className="space-y-4">
          {quiz.questions.map((question, questionIndex) => (
            <Card key={question.id ?? questionIndex} className="p-5">
              <fieldset>
                <legend className="font-extrabold">
                  <span className="mr-2 text-muted">{questionIndex + 1}.</span>
                  {question.question}
                </legend>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {question.options.map((option, optionIndex) => (
                    <label
                      key={`${questionIndex}-${optionIndex}`}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm transition ${
                        answers[questionIndex] === option
                          ? "border-brand bg-brand-soft"
                          : "border-line bg-card hover:bg-soft"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`question-${questionIndex}`}
                        value={option}
                        checked={answers[questionIndex] === option}
                        onChange={() => setAnswers((previous) => ({
                          ...previous,
                          [questionIndex]: option,
                        }))}
                        className="mt-0.5 accent-yellow-400"
                      />
                      {option}
                    </label>
                  ))}
                </div>
              </fieldset>
            </Card>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted">
              {Object.keys(answers).length} of {quiz.questions.length} answered
            </p>
            <button
              type="submit"
              disabled={submitting || !quiz.questions.length}
              className="rounded-xl bg-brand px-5 py-2.5 text-sm font-extrabold text-on-brand disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Submit quiz"}
            </button>
          </div>
        </form>
      )}

      {result && (
        <div className="space-y-4">
          <Card className="p-6 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-tone-green-fg" />
            <h2 className="mt-3 text-xl font-extrabold">Quiz submitted</h2>
            <p className="mt-2 text-3xl font-extrabold">
              {result.score ?? result.marksObtained ?? "—"}
              <span className="text-base text-muted"> / {result.totalMarks ?? result.total ?? quiz.totalMarks}</span>
            </p>
            {result.correctAnswers != null && result.totalQuestions != null && (
              <p className="mt-1 text-sm text-muted">{result.correctAnswers} of {result.totalQuestions} answers correct</p>
            )}
          </Card>
          {Array.isArray(result.review) && result.review.length > 0 && (
            <Card className="overflow-hidden">
              <div className="border-b border-line p-4"><h2 className="font-extrabold">Answer review</h2></div>
              <div className="divide-y divide-line">
                {result.review.map((item, index) => {
                  const status = String(item.status ?? (item.isCorrect ? "correct" : "incorrect")).toLowerCase();
                  return (
                    <div key={index} className="p-4">
                      <p className="font-bold"><span className="mr-2 text-muted">{(item.questionIndex ?? index) + 1}.</span>{item.question ?? item.text ?? "Question unavailable"}</p>
                      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                        {status === "correct" ? (
                          <span className="rounded-lg bg-tone-green px-3 py-2 font-bold text-tone-green-fg">{item.selectedAnswer}</span>
                        ) : status === "unanswered" ? (
                          <>
                            <span className="rounded-lg bg-tone-yellow px-3 py-2 font-bold text-tone-yellow-fg">Not answered</span>
                            <span className="rounded-lg bg-tone-green px-3 py-2 font-bold text-tone-green-fg">Correct answer: {item.correctAnswer}</span>
                          </>
                        ) : (
                          <>
                            <span className="rounded-lg bg-tone-red px-3 py-2 font-bold text-tone-red-fg">Your answer: {item.selectedAnswer ?? "Not answered"}</span>
                            <span className="rounded-lg bg-tone-green px-3 py-2 font-bold text-tone-green-fg">Correct answer: {item.correctAnswer}</span>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
          <Link to="/student/quizzes" className="inline-flex rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-on-brand">Back to quizzes</Link>
        </div>
      )}
    </div>
  );
}
