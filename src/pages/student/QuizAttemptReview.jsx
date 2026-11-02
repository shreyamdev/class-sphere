import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Topbar from "../../components/Topbar";
import Card from "../../components/Card";
import { getStudentQuizAttemptReview } from "../../services/quizService";

export default function QuizAttemptReview() {
  const { attemptId } = useParams();
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let active = true;
    setStatus("loading");
    setError("");
    getStudentQuizAttemptReview(attemptId)
      .then((review) => {
        if (active) {
          setItems(Array.isArray(review) ? review : []);
          setStatus("ready");
        }
      })
      .catch((loadError) => {
        if (active) {
          setError(loadError.message || "Could not load this attempt review.");
          setStatus("error");
        }
      });
    return () => { active = false; };
  }, [attemptId, retryCount]);

  return (
    <div className="space-y-5">
      <Topbar title="Attempt review" subtitle="Review your submitted answers" backFallbackPath="/student/quizzes" />
      {status === "loading" && <Card className="p-5 text-sm text-muted">Loading answer review...</Card>}
      {status === "error" && (
        <Card role="alert" className="flex flex-wrap items-center justify-between gap-3 p-5 text-sm text-tone-red-fg">
          <span>{error}</span>
          <button type="button" onClick={() => setRetryCount((count) => count + 1)} className="rounded-xl border border-line px-3 py-2 font-bold text-ink">Try again</button>
        </Card>
      )}
      {status === "ready" && (
        <Card className="overflow-hidden">
          {items.length === 0 ? <p className="p-6 text-center text-sm text-muted">No review items are available.</p> : (
            <div className="divide-y divide-line">
              {items.map((item, index) => {
                const statusValue = String(item.status ?? (item.isCorrect ? "correct" : "incorrect")).toLowerCase();
                return (
                  <div key={item.questionIndex ?? index} className="p-4">
                    <p className="font-bold"><span className="mr-2 text-muted">{(item.questionIndex ?? index) + 1}.</span>{item.question ?? item.text ?? "Question unavailable"}</p>
                    <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                      {statusValue === "correct" && (
                        <span className="rounded-lg bg-tone-green px-3 py-2 font-bold text-tone-green-fg">Your answer: {item.selectedAnswer}</span>
                      )}
                      {statusValue === "incorrect" && (
                        <>
                          <span className="rounded-lg bg-tone-red px-3 py-2 font-bold text-tone-red-fg">Your answer: {item.selectedAnswer ?? "Not answered"}</span>
                          <span className="rounded-lg bg-tone-green px-3 py-2 font-bold text-tone-green-fg">Correct answer: {item.correctAnswer}</span>
                        </>
                      )}
                      {statusValue === "unanswered" && (
                        <>
                          <span className="rounded-lg bg-tone-yellow px-3 py-2 font-bold text-tone-yellow-fg">Not answered</span>
                          <span className="rounded-lg bg-tone-green px-3 py-2 font-bold text-tone-green-fg">Correct answer: {item.correctAnswer}</span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
