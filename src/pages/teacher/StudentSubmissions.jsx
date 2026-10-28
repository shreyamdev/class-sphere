import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock, Eye, FileCheck2, Save, Users, X } from "lucide-react";
import Card from "../../components/Card";
import Topbar from "../../components/Topbar";
import HeroBanner from "../../components/HeroBanner";
import { fetchMyClassrooms } from "../../services/classroomService";
import {
  getAssignmentSubmissions,
  getClassroomAssignments,
  gradeAssignmentSubmission,
  fetchAssignmentPdf,
} from "../../services/assignmentService";

const classroomIdOf = (classroom) => classroom?._id ?? classroom?.id;
const submissionIdOf = (submission) => submission?._id ?? submission?.id;

function displayDate(value) {
  if (!value) return "Submission date unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Submission date unavailable" : date.toLocaleString();
}

export default function StudentSubmissions() {
  const [classrooms, setClassrooms] = useState([]);
  const [classroomId, setClassroomId] = useState("");
  const [submissions, setSubmissions] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [filter, setFilter] = useState("pending");
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [solutionPdfUrl, setSolutionPdfUrl] = useState("");
  const [solutionPdfTitle, setSolutionPdfTitle] = useState("");
  const [solutionPdfError, setSolutionPdfError] = useState("");
  const [loadingPdfId, setLoadingPdfId] = useState("");

  useEffect(() => () => {
    if (solutionPdfUrl) URL.revokeObjectURL(solutionPdfUrl);
  }, [solutionPdfUrl]);

  useEffect(() => {
    let active = true;
    fetchMyClassrooms()
      .then((items) => {
        if (!active) return;
        setClassrooms(items);
        setClassroomId((current) => current || String(classroomIdOf(items[0]) ?? ""));
        if (!items.length) setLoading(false);
      })
      .catch((loadError) => {
        if (active) {
          setError(loadError.message || "Could not load your classrooms.");
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!classroomId) {
      return undefined;
    }

    let active = true;
    Promise.resolve()
      .then(() => {
        setLoading(true);
        setError("");
      })
      .then(() => getClassroomAssignments(classroomId))
      .then((assignments) => Promise.all(assignments.map(async (assignment) => {
        const assignmentId = assignment._id ?? assignment.id;
        const items = await getAssignmentSubmissions(assignmentId);
        return items.map((submission) => {
          const submissionId = submissionIdOf(submission);
          const solutionPdfUrl = submission.solutionPdfUrl ||
            submission.attachment?.downloadUrl ||
            submission.attachmentUrl ||
            (submission.solutionPdfName
              ? `/api/assignments/${assignmentId}/submissions/${submissionId}/attachment`
              : "");
          return {
            ...submission,
            id: submissionId,
            assignmentId,
            assignment: assignment.title ?? "Assignment",
            maxMarks: assignment.maxMarks ?? 0,
            studentName: submission.student?.name ?? "Student",
            studentEmail: submission.student?.email ?? "",
            status: submission.status === "graded" ? "graded" : "pending",
            solutionPdfUrl,
          };
        });
      })))
      .then((groups) => {
        if (!active) return;
        const items = groups.flat();
        setSubmissions(items);
        setSelectedId((current) =>
          items.some((item) => String(item.id) === current)
            ? current
            : String(items[0]?.id ?? "")
        );
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || "Could not load student submissions.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [classroomId]);

  const filtered = useMemo(
    () => submissions.filter((item) => item.status === filter),
    [submissions, filter]
  );
  const selected = submissions.find((item) => String(item.id) === selectedId);

  const selectedDraft = drafts[selectedId] ?? {
    marks: selected?.marksObtained == null ? "" : String(selected.marksObtained),
    feedback: selected?.feedback ?? "",
  };

  const handleSaveGrade = async (event) => {
    event.preventDefault();
    if (!selected) return;
    const grade = Number(selectedDraft.marks);
    if (!Number.isFinite(grade) || grade < 0 || grade > selected.maxMarks) {
      setError(`Enter a score between 0 and ${selected.maxMarks}.`);
      return;
    }

    setSaving(true);
    setError("");
    setSaveSuccess(false);
    try {
      const updated = await gradeAssignmentSubmission(
        selected.assignmentId,
        selected.id,
        { marksObtained: grade, feedback: selectedDraft.feedback.trim() }
      );
      setSubmissions((current) => current.map((item) =>
        String(item.id) === String(selected.id)
          ? { ...item, ...updated, status: "graded", marksObtained: grade, feedback: selectedDraft.feedback.trim() }
          : item
      ));
      setSaveSuccess(true);
    } catch (saveError) {
      setError(saveError.message || "Could not save this grade.");
    } finally {
      setSaving(false);
    }
  };

  const handleViewSolution = async () => {
    if (!selected) return;
    setLoadingPdfId(String(selected.id));
    setSolutionPdfError("");
    try {
      const pdf = await fetchAssignmentPdf(selected.assignmentId, selected.id);
      setSolutionPdfUrl((currentUrl) => {
        if (currentUrl) URL.revokeObjectURL(currentUrl);
        return URL.createObjectURL(pdf);
      });
      setSolutionPdfTitle(`${selected.studentName} - ${selected.assignment}`);
    } catch (pdfError) {
      setSolutionPdfError(pdfError.message || "Could not open the solution PDF.");
    } finally {
      setLoadingPdfId("");
    }
  };

  const currentClassroom = classrooms.find(
    (item) => String(classroomIdOf(item)) === classroomId
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 dashboard-stagger">
      <Topbar title="Student Submissions" subtitle="Review and grade work submitted to your classes" />
      <HeroBanner
        variant="navy"
        eyebrow="EVALUATION WORKSPACE"
        title="Grade with feedback"
        subtitle="Review student answers, assign marks, and provide feedback."
        icons={[FileCheck2, Users, Clock]}
      />

      <Card className="p-4">
        <label htmlFor="submission-classroom" className="mb-2 block text-xs font-bold">
          Classroom
        </label>
        <select
          id="submission-classroom"
          value={classroomId}
          onChange={(event) => setClassroomId(event.target.value)}
          disabled={!classrooms.length}
          className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink sm:max-w-md"
        >
          {classrooms.length ? classrooms.map((classroom) => (
            <option key={classroomIdOf(classroom)} value={classroomIdOf(classroom)}>
              {classroom.name ?? classroom.title ?? "Classroom"}
            </option>
          )) : <option value="">No classrooms available</option>}
        </select>
      </Card>

      {error && <Card role="alert" className="p-4 text-sm text-tone-red-fg">{error}</Card>}

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="space-y-4 p-4">
          <div className="flex gap-2 rounded-xl bg-soft p-1">
            {["pending", "graded"].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={`flex-1 rounded-lg py-2 text-xs font-bold capitalize ${
                  filter === value ? "bg-surface text-ink shadow-sm" : "text-muted"
                }`}
              >
                {value === "pending" ? "To Grade" : "Graded"} ({submissions.filter((item) => item.status === value).length})
              </button>
            ))}
          </div>

          {loading ? (
            <p className="py-8 text-center text-sm text-muted">Loading submissions...</p>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">No {filter} submissions in this class.</p>
          ) : (
            <div className="max-h-[560px] space-y-2 overflow-y-auto">
              {filtered.map((submission) => (
                <button
                  key={submission.id}
                  type="button"
                  onClick={() => setSelectedId(String(submission.id))}
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    String(submission.id) === selectedId ? "border-brand bg-brand-soft" : "border-line bg-card hover:bg-soft"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold">{submission.studentName}</p>
                      <p className="mt-1 text-xs text-muted">{submission.assignment}</p>
                    </div>
                    {submission.status === "graded" && (
                      <span className="shrink-0 text-xs font-bold">
                        {submission.marksObtained}/{submission.maxMarks}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-[11px] text-muted">{displayDate(submission.submittedAt)}</p>
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card className="space-y-5 p-5 lg:col-span-2">
          {!selected ? (
            <p className="py-16 text-center text-sm text-muted">Select a submission to review.</p>
          ) : (
            <>
              <div className="border-b border-line pb-4">
                <h2 className="text-lg font-extrabold">{selected.assignment}</h2>
                <p className="mt-1 text-sm text-muted">
                  {selected.studentName}{selected.studentEmail ? ` · ${selected.studentEmail}` : ""}
                  {currentClassroom ? ` · ${currentClassroom.name ?? currentClassroom.title}` : ""}
                </p>
                <p className="mt-1 text-xs text-muted">Submitted {displayDate(selected.submittedAt)}</p>
              </div>

              <section className="space-y-3">
                <h3 className="text-sm font-bold">Student work</h3>
                {selected.answerText ? (
                  <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-soft p-4 text-sm font-sans">
                    {selected.answerText}
                  </pre>
                ) : (
                  <p className="text-sm text-muted">No written answer was attached.</p>
                )}
                {selected.submissionUrl && (
                  <a
                    href={selected.submissionUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-bold text-tone-blue-fg underline"
                  >
                    Open submitted work
                  </a>
                )}
                {(selected.solutionPdfUrl || selected.solutionPdfName || selected.attachment?.fileName || selected.attachment?.originalName) && (
                  <div>
                    <button
                      type="button"
                      onClick={handleViewSolution}
                      disabled={loadingPdfId === String(selected.id)}
                      className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-bold text-ink transition hover:bg-soft disabled:opacity-60"
                    >
                      <Eye size={16} />
                      {loadingPdfId === String(selected.id) ? "Opening PDF..." : "View solution PDF"}
                    </button>
                    {solutionPdfError && (
                      <p role="alert" className="mt-2 text-sm text-tone-red-fg">
                        {solutionPdfError}
                      </p>
                    )}
                  </div>
                )}
              </section>

              <form onSubmit={handleSaveGrade} className="space-y-4">
                <label className="block space-y-1 text-sm font-semibold">
                  Marks (out of {selected.maxMarks})
                  <input
                    type="number"
                    min="0"
                    max={selected.maxMarks}
                    step="any"
                    required
                    value={selectedDraft.marks}
                    onChange={(event) => setDrafts((current) => ({
                      ...current,
                      [selectedId]: { ...selectedDraft, marks: event.target.value },
                    }))}
                    className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink"
                  />
                </label>
                <label className="block space-y-1 text-sm font-semibold">
                  Feedback
                  <textarea
                    rows={4}
                    maxLength={3000}
                    value={selectedDraft.feedback}
                    onChange={(event) => setDrafts((current) => ({
                      ...current,
                      [selectedId]: { ...selectedDraft, feedback: event.target.value },
                    }))}
                    className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm font-normal text-ink"
                  />
                </label>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-on-brand disabled:opacity-50"
                  >
                    <Save size={16} /> {saving ? "Saving..." : "Save grade"}
                  </button>
                  {saveSuccess && <span className="inline-flex items-center gap-1 text-sm font-bold text-tone-green-fg"><CheckCircle2 size={16} /> Grade saved</span>}
                </div>
              </form>
            </>
          )}
        </Card>
      </div>

      {solutionPdfUrl && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <Card
            role="dialog"
            aria-modal="true"
            aria-labelledby="solution-pdf-title"
            className="flex h-[min(90vh,900px)] w-full max-w-5xl flex-col p-4"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 id="solution-pdf-title" className="truncate text-base font-extrabold">
                {solutionPdfTitle}
              </h2>
              <button
                type="button"
                aria-label="Close solution PDF"
                onClick={() => setSolutionPdfUrl("")}
                className="rounded-lg p-2 text-muted hover:bg-soft"
              >
                <X size={18} />
              </button>
            </div>
            <iframe
              title={`${solutionPdfTitle} PDF`}
              src={solutionPdfUrl}
              className="min-h-0 flex-1 rounded-lg border border-line"
            />
          </Card>
        </div>
      )}
    </div>
  );
}
