import { useEffect, useState } from "react";
import { ClipboardList, Clock, Check, FileText, Upload, X } from "lucide-react";

import Topbar from "../../components/Topbar";
import HeroBanner from "../../components/HeroBanner";
import Tabs from "../../components/Tabs";
import Card from "../../components/Card";
import AssignmentCard from "../../components/AssignmentCard";
import ProgressRing from "../../components/ProgressRing";
import Loader from "../../components/Loader";
import {
  fetchMyClassrooms,
} from "../../services/classroomService";
import {
  getClassroomAssignments,
  getMyAssignmentSubmission,
  fetchAssignmentPdf,
  submitAssignment,
} from "../../services/assignmentService";
import { daysLeft, daysLeftLabel } from "../../utils/date";

const tabs = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "submitted", label: "Submitted" },
  { key: "graded", label: "Graded" },
];

function normalizeAssignment(assignment, classroom) {
  const dueDate = assignment.dueDate
    ? new Date(assignment.dueDate)
    : null;
  const validDueDate =
    dueDate && !Number.isNaN(dueDate.getTime()) ? dueDate : null;
  const id = assignment._id ?? assignment.id;

  return {
    ...assignment,
    id,
    title: assignment.title ?? "Assignment",
    shortTitle: assignment.shortTitle ?? assignment.title ?? "Assignment",
    course:
      classroom.name ?? classroom.title ?? assignment.classroom?.name ?? "Classroom",
    description: assignment.description ?? assignment.instructions ?? "",
    dueDate: validDueDate ? validDueDate.toISOString().slice(0, 10) : "",
    due: validDueDate
      ? `${new Intl.DateTimeFormat(undefined, { day: "numeric" }).format(validDueDate)} ${new Intl.DateTimeFormat(undefined, { month: "short" }).format(validDueDate)}`
      : "No due date",
    marks: assignment.maxMarks ?? assignment.marks ?? 0,
    submittedOn: assignment.submittedAt
      ? new Date(assignment.submittedAt).toLocaleDateString()
      : "",
    status: ["pending", "submitted", "graded"].includes(assignment.status)
      ? assignment.status
      : "pending",
  };
}

export default function Assignments() {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const [tab, setTab] = useState("all");
  const [notice, setNotice] = useState("");
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [answerText, setAnswerText] = useState("");
  const [submissionUrl, setSubmissionUrl] = useState("");
  const [solutionPdf, setSolutionPdf] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState("");
  const [questionPdfUrl, setQuestionPdfUrl] = useState("");
  const [questionPdfTitle, setQuestionPdfTitle] = useState("");
  const [questionPdfError, setQuestionPdfError] = useState("");
  const [loadingPdfId, setLoadingPdfId] = useState("");

  useEffect(() => () => {
    if (questionPdfUrl) URL.revokeObjectURL(questionPdfUrl);
  }, [questionPdfUrl]);

  useEffect(() => {
    let ignore = false;

    fetchMyClassrooms()
      .then((classrooms) =>
        Promise.all(
          classrooms.map(async (classroom) => {
            const classroomId = classroom._id ?? classroom.id;
            const assignments = await getClassroomAssignments(classroomId);
            return Promise.all(assignments.map(async (assignment) => {
              const submissionData = await getMyAssignmentSubmission(
                assignment._id ?? assignment.id
              );
              const submission = submissionData?.submission;
              return {
                ...normalizeAssignment(assignment, classroom),
                status: submission?.status ?? "pending",
                score: submission?.marksObtained,
                feedback: submission?.feedback ?? "",
                submittedAt: submission?.submittedAt,
                submittedOn: submission?.submittedAt
                  ? new Date(submission.submittedAt).toLocaleDateString()
                  : "",
                answerText: submission?.answerText ?? "",
                submissionUrl: submission?.submissionUrl ?? "",
                solutionPdfUrl: submission?.solutionPdfUrl ??
                  (submission?.solutionPdfName
                    ? `/api/assignments/${assignment._id ?? assignment.id}/submissions/${submission._id ?? submission.id}/attachment`
                    : ""),
                questionPdfUrl:
                  assignment.attachmentDownloadUrl ??
                  (assignment.attachment?.originalName
                    ? `/api/assignments/${assignment._id ?? assignment.id}/attachment`
                    : ""),
              };
            }));
          })
        )
      )
      .then((groups) => {
        if (ignore) return;
        setItems(groups.flat());
        setStatus("ready");
      })
      .catch((error) => {
        if (!ignore) {
          setStatus("error");
          setNotice(error.message || "Could not load your assignments.");
        }
      });

    return () => {
      ignore = true;
    };
  }, [reloadKey]);

  const retry = () => {
    setStatus("loading");
    setReloadKey((k) => k + 1);
  };

  const handleSubmitAssignment = async (event) => {
    event.preventDefault();
    if (!selectedAssignment || (!answerText.trim() && !submissionUrl.trim() && !solutionPdf)) {
      setSubmissionError("Add a PDF solution, written answer, or link before submitting.");
      return;
    }

    setSubmitting(true);
    setSubmissionError("");
    try {
      await submitAssignment(selectedAssignment.id, {
        answerText: answerText.trim(),
        submissionUrl: submissionUrl.trim(),
        solutionPdf,
      });
      setSelectedAssignment(null);
      setAnswerText("");
      setSubmissionUrl("");
      setSolutionPdf(null);
      setStatus("loading");
      setReloadKey((key) => key + 1);
    } catch (error) {
      setSubmissionError(error.message || "Could not submit this assignment.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewQuestions = async (assignment) => {
    setLoadingPdfId(assignment.id);
    setQuestionPdfError("");
    try {
      const pdf = await fetchAssignmentPdf(assignment.id);
      if (questionPdfUrl) URL.revokeObjectURL(questionPdfUrl);
      setQuestionPdfUrl(URL.createObjectURL(pdf));
      setQuestionPdfTitle(assignment.title);
    } catch (error) {
      setQuestionPdfError(error.message || "Could not open the question PDF.");
    } finally {
      setLoadingPdfId("");
    }
  };

  const handleSolutionPdfChange = (event) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!file) return;

    if (file.type !== "application/pdf" || !file.name.toLowerCase().endsWith(".pdf")) {
      setSubmissionError("Select a PDF file for your solution.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setSubmissionError("Your solution PDF must be 10 MB or smaller.");
      return;
    }

    setSolutionPdf(file);
    setSubmissionError("");
  };

const pending = items
    .filter((a) => a.status === "pending")
    .sort((a, b) => {
      const dateA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const dateB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      return dateA - dateB;
    });
  const visible = items.filter((a) => tab === "all" || a.status === tab);
  const done = items.length - pending.length;

  return (
    <div className="space-y-5">
      <Topbar title="Assignments" subtitle="Review classroom work and due dates" />

      <HeroBanner
        variant="navy"
        title="Stay on top of deadlines"
        subtitle="Review your class assignments and keep track of upcoming deadlines."
        buttonText="View calendar"
        icons={[ClipboardList, Clock, Check]}
      />

      {status === "loading" && <Loader label="Loading assignments..." />}

      {status === "error" && (
        <Card className="p-5 text-center">
          <p className="text-sm font-semibold">{notice || "Could not load your assignments."}</p>
          <button
            onClick={retry}
            className="mt-3 rounded-lg bg-brand px-4 py-2 text-xs font-bold text-on-brand"
          >
            Try again
          </button>
        </Card>
      )}

      {status === "ready" && (
        <div className="grid gap-5 min-[1100px]:grid-cols-[minmax(0,1fr)_16rem]">

          <div className="space-y-4">
            <Tabs tabs={tabs} active={tab} onChange={setTab} />

            <div className="space-y-2">
              {visible.length === 0 && (
                <p className="py-6 text-center text-sm text-muted">Nothing here yet.</p>
              )}
              {visible.map((a) => (
                <AssignmentCard
                  key={a.id}
                  assignment={a}
                  onSubmit={setSelectedAssignment}
                  onViewQuestions={
                    a.questionPdfUrl
                      ? () => handleViewQuestions(a)
                      : undefined
                  }
                  loadingQuestions={loadingPdfId === a.id}
                />
              ))}
            </div>
          </div>

<aside className="space-y-4 min-[1100px]:self-start">
            <Card className="p-4 text-center">
              <h2 className="text-base font-extrabold">Completion</h2>
              <div className="mt-3 flex justify-center">
                <ProgressRing done={done} total={items.length} />
              </div>
              <p className="mt-3 text-xs text-muted">Assignments done</p>
            </Card>

            <Card className="p-4">
              <h2 className="text-base font-extrabold">Upcoming deadlines</h2>

              {pending.length === 0 && (
                <p className="mt-2 text-xs text-muted">No upcoming deadlines.</p>
              )}

              {selectedAssignment && (
                <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
                  <Card
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="submit-assignment-title"
                    className="w-full max-w-xl p-5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 id="submit-assignment-title" className="text-lg font-extrabold">
                          Submit {selectedAssignment.title}
                        </h2>
                        <p className="mt-1 text-xs text-muted">
                          Upload your solution as a PDF, or provide a written answer or link.
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-label="Close submission form"
                        onClick={() => setSelectedAssignment(null)}
                        className="rounded-lg p-2 text-muted hover:bg-soft"
                      >
                        <X size={18} />
                      </button>
                    </div>
                    <form onSubmit={handleSubmitAssignment} className="mt-4 space-y-3">
                      <label className="block space-y-1 text-sm font-semibold">
                        Written answer
                        <textarea
                          rows={5}
                          maxLength={10000}
                          value={answerText}
                          onChange={(event) => setAnswerText(event.target.value)}
                          className="w-full rounded-xl border border-line bg-surface p-3 text-sm font-normal text-ink"
                        />
                      </label>
                      <label className="block space-y-1 text-sm font-semibold">
                        Link to your work
                        <input
                          type="url"
                          maxLength={2048}
                          value={submissionUrl}
                          onChange={(event) => setSubmissionUrl(event.target.value)}
                          placeholder="https://..."
                          className="w-full rounded-xl border border-line bg-surface p-3 text-sm font-normal text-ink"
                        />
                      </label>
                      <div className="space-y-2">
                        <label htmlFor="solution-pdf" className="block text-sm font-semibold">
                          Solution PDF <span className="font-normal text-muted">(optional, max 10 MB)</span>
                        </label>
                        <label
                          htmlFor="solution-pdf"
                          className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-line bg-soft/50 p-4 text-sm transition hover:border-brand"
                        >
                          <input
                            id="solution-pdf"
                            type="file"
                            accept=".pdf,application/pdf"
                            onChange={handleSolutionPdfChange}
                            className="sr-only"
                          />
                          <Upload size={18} className="shrink-0 text-muted" />
                          <span className="min-w-0 truncate font-semibold">
                            {solutionPdf?.name ?? "Choose your solution PDF"}
                          </span>
                        </label>
                        {solutionPdf && (
                          <button
                            type="button"
                            onClick={() => setSolutionPdf(null)}
                            className="text-xs font-bold text-tone-red-fg hover:underline"
                          >
                            Remove PDF
                          </button>
                        )}
                      </div>
                      {submissionError && (
                        <p role="alert" className="text-sm text-tone-red-fg">
                          {submissionError}
                        </p>
                      )}
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedAssignment(null)}
                          className="rounded-xl border border-line px-4 py-2 text-sm font-semibold"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={submitting}
                          className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-on-brand disabled:opacity-50"
                        >
                          {submitting ? "Submitting..." : "Submit work"}
                        </button>
                      </div>
                    </form>
                  </Card>
                </div>
              )}

              <div className="mt-3 space-y-3">
                {pending.map((a) => {
                  const [day, month] = a.due.split(" ");
                  const days = a.dueDate ? daysLeft(a.dueDate) : null;

                  return (
                    <div key={a.id} className="flex items-start gap-3">
                      <div className="w-9 shrink-0 text-base font-extrabold leading-tight">
                        <div>{day}</div>
                        <div>{month}</div>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold leading-tight">{a.shortTitle}</p>
                        <p
                          className={`text-xs ${
                            days !== null && days < 0
                              ? "font-semibold text-tone-red-fg"
                              : "text-muted"
                          }`}
                        >
                          {days === null ? "No due date" : daysLeftLabel(days)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </aside>
        </div>
      )}
      {questionPdfError && (
        <Card role="alert" className="text-sm text-tone-red-fg p-4">
          {questionPdfError}
        </Card>
      )}
      {questionPdfUrl && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4">
          <Card
            role="dialog"
            aria-modal="true"
            aria-labelledby="question-pdf-title"
            className="flex h-[min(90vh,60rem)] w-full max-w-5xl flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between gap-3 border-b border-line p-4">
              <h2 id="question-pdf-title" className="flex min-w-0 items-center gap-2 truncate font-extrabold">
                <FileText size={18} className="shrink-0" />
                <span className="truncate">{questionPdfTitle}</span>
              </h2>
              <button
                type="button"
                aria-label="Close question PDF"
                onClick={() => setQuestionPdfUrl("")}
                className="rounded-lg p-2 text-muted hover:bg-soft"
              >
                <X size={18} />
              </button>
            </div>
            <iframe
              title={`${questionPdfTitle} questions PDF`}
              src={questionPdfUrl}
              className="min-h-0 flex-1 bg-white"
            />
          </Card>
        </div>
      )}
    </div>
  );
}
