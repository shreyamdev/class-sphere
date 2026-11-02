import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileText,
  Upload,
  Sparkles,
  Trophy,
} from "lucide-react";
import Card from "../../components/Card";
import HeroBanner from "../../components/HeroBanner";
import Topbar from "../../components/Topbar";
import { createAssignment } from "../../services/assignmentService";
import { fetchMyClassrooms } from "../../services/classroomService";

const fieldClassName =
  "w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-brand focus:ring-2 focus:ring-brand/30";

export default function CreateAssignment() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: "",
    course: "",
    instructions: "",
    points: "100",
    weight: "100",
    dueDate: "",
    dueTime: "23:59",
  });
  const [classrooms, setClassrooms] = useState([]);
  const [loadingClassrooms, setLoadingClassrooms] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [questionPdf, setQuestionPdf] = useState(null);

  useEffect(() => {
    let active = true;
    fetchMyClassrooms()
      .then((items) => {
        if (!active) return;
        setClassrooms(items);
        if (items.length) {
          setFormData((current) => ({
            ...current,
            course: String(items[0]._id ?? items[0].id),
          }));
        }
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || "Could not load classrooms.");
      })
      .finally(() => {
        if (active) setLoadingClassrooms(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const selectedClassroom = classrooms.find(
    (classroom) => String(classroom._id ?? classroom.id) === formData.course
  );

  const updateField = (field) => (event) => {
    setFormData((current) => ({ ...current, [field]: event.target.value }));
    setError("");
    setIsSuccess(false);
  };

  const handleQuestionPdfChange = (event) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!file) return;

    if (
      file.type !== "application/pdf" ||
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      setError("Select a PDF file for the assignment questions.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("The question PDF must be 10 MB or smaller.");
      return;
    }

    setQuestionPdf(file);
    setError("");
    setIsSuccess(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setIsSuccess(false);

    const dueAt = new Date(`${formData.dueDate}T${formData.dueTime || "23:59"}`);
    if (Number.isNaN(dueAt.getTime())) {
      setError("Choose a valid due date and time.");
      return;
    }

    const weight = formData.weight === "" ? 100 : Number(formData.weight);
    if (!Number.isFinite(weight) || weight < 0 || weight > 100) {
      setError("Weight must be between 0 and 100.");
      return;
    }

    const maxMarks = Number(formData.points);
    if (!Number.isFinite(maxMarks) || maxMarks < 1 || maxMarks > 10000) {
      setError("Maximum marks must be between 1 and 10,000.");
      return;
    }

    setSubmitting(true);
    try {
      await createAssignment(formData.course, {
        title: formData.title.trim(),
        description: formData.instructions.trim(),
        dueDate: dueAt.toISOString(),
        maxMarks,
        weight,
        questionPdf,
      });
      setIsSuccess(true);
    } catch (submitError) {
      setError(submitError.message || "Could not publish this assignment.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5 dashboard-stagger">
      <Topbar
        title="Create assignment"
        subtitle="Set clear expectations and a deadline for your students"
        backFallbackPath="/teacher/dashboard"
      />

      <HeroBanner
        variant="navy"
        eyebrow="CLASSROOM WORK"
        title="Give your students their next challenge"
        subtitle="Create an assignment with clear instructions, a fair score, and a deadline everyone can plan for."
        icons={[ClipboardList, CalendarDays, Trophy]}
      />

      {error && (
        <Card role="alert" className="flex items-start gap-3 border border-tone-red/40 p-4 text-sm text-tone-red-fg">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <p>{error}</p>
        </Card>
      )}

      {isSuccess && (
        <Card role="status" className="flex flex-wrap items-center justify-between gap-3 border border-tone-green/50 bg-tone-green p-4">
          <div className="flex items-center gap-3 text-tone-green-fg">
            <CheckCircle2 size={20} className="shrink-0" />
            <div>
              <p className="text-sm font-extrabold">Assignment published</p>
              <p className="mt-0.5 text-xs">It’s now available to students in {selectedClassroom?.name ?? "your classroom"}.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate("/teacher/dashboard")}
            className="rounded-xl bg-card px-4 py-2 text-xs font-bold text-ink transition hover:bg-soft"
          >
            Back to dashboard
          </button>
        </Card>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <Card className="overflow-hidden">
          <div className="border-b border-line px-5 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-tone-yellow-fg">
                <FileText size={19} />
              </div>
              <div>
                <h2 className="font-extrabold">Assignment details</h2>
                <p className="mt-0.5 text-xs text-muted">Fields marked with * are required.</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 p-5 sm:p-6">
            <div>
              <label htmlFor="assignment-title" className="mb-1.5 block text-sm font-bold">
                Assignment title <span className="text-tone-red-fg">*</span>
              </label>
              <input
                id="assignment-title"
                type="text"
                minLength={3}
                maxLength={150}
                required
                value={formData.title}
                onChange={updateField("title")}
                placeholder="e.g. Lab 5: Balanced Trees"
                className={fieldClassName}
              />
              <p className="mt-1.5 text-right text-[11px] text-muted">{formData.title.length}/150</p>
            </div>

            <div>
              <label htmlFor="assignment-classroom" className="mb-1.5 block text-sm font-bold">
                Classroom <span className="text-tone-red-fg">*</span>
              </label>
              <div className="relative">
                <BookOpen size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                <select
                  id="assignment-classroom"
                  value={formData.course}
                  onChange={updateField("course")}
                  required
                  disabled={loadingClassrooms || classrooms.length === 0}
                  className={`${fieldClassName} pl-10`}
                >
                  {loadingClassrooms ? (
                    <option value="">Loading classrooms...</option>
                  ) : classrooms.length === 0 ? (
                    <option value="">Create a classroom first</option>
                  ) : (
                    classrooms.map((classroom) => {
                      const classroomId = classroom._id ?? classroom.id;
                      return (
                        <option key={classroomId} value={classroomId}>
                          {classroom.name ?? classroom.title ?? "Classroom"}
                        </option>
                      );
                    })
                  )}
                </select>
              </div>
              {!loadingClassrooms && classrooms.length === 0 && (
                <button
                  type="button"
                  onClick={() => navigate("/teacher/create-class")}
                  className="mt-2 text-xs font-bold text-tone-blue-fg underline"
                >
                  Create a classroom to continue
                </button>
              )}
            </div>

            <div>
              <label htmlFor="assignment-instructions" className="mb-1.5 block text-sm font-bold">
                Instructions <span className="text-tone-red-fg">*</span>
              </label>
              <textarea
                id="assignment-instructions"
                rows={6}
                maxLength={5000}
                required
                value={formData.instructions}
                onChange={updateField("instructions")}
                placeholder="Describe the task, what students should submit, and any requirements or grading guidance..."
                className={`${fieldClassName} resize-y leading-6`}
              />
              <p className="mt-1.5 text-right text-[11px] text-muted">{formData.instructions.length}/5000</p>
            </div>

            <div>
              <label htmlFor="assignment-question-pdf" className="mb-1.5 block text-sm font-bold">
                Question PDF <span className="text-xs font-medium text-muted">(optional, max 10 MB)</span>
              </label>
              <label
                htmlFor="assignment-question-pdf"
                className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-line bg-soft/50 px-4 py-6 text-center transition hover:border-brand"
              >
                <input
                  id="assignment-question-pdf"
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handleQuestionPdfChange}
                  className="sr-only"
                />
                <Upload size={24} className="mb-2 text-muted" />
                <span className="text-sm font-bold">
                {questionPdf?.name ?? "Click to choose a question PDF"}
                </span>
                <span className="mt-1 text-xs text-muted">PDF only · Up to 10 MB</span>
              </label>
              {questionPdf && (
                <button
                  type="button"
                  onClick={() => setQuestionPdf(null)}
                  className="mt-2 text-xs font-bold text-tone-red-fg hover:underline"
                >
                  Remove PDF
                </button>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div>
                <label htmlFor="assignment-points" className="mb-1.5 block text-sm font-bold">
                  Maximum marks
                </label>
                <div className="relative">
                  <Trophy size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    id="assignment-points"
                    type="number"
                    min="1"
                    max="10000"
                    step="1"
                    value={formData.points}
                    onChange={updateField("points")}
                    className={`${fieldClassName} pl-10`}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="assignment-weight" className="mb-1.5 block text-sm font-bold">
                  Weight
                </label>
                <input
                  id="assignment-weight"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={formData.weight}
                  onChange={updateField("weight")}
                  placeholder="100"
                  className={fieldClassName}
                />
              </div>
              <div>
                <label htmlFor="assignment-due-date" className="mb-1.5 block text-sm font-bold">
                  Due date <span className="text-tone-red-fg">*</span>
                </label>
                <div className="relative">
                  <CalendarDays size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    id="assignment-due-date"
                    type="date"
                    required
                    value={formData.dueDate}
                    onChange={updateField("dueDate")}
                    className={`${fieldClassName} pl-10`}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="assignment-due-time" className="mb-1.5 block text-sm font-bold">
                  Due time
                </label>
                <div className="relative">
                  <Clock3 size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    id="assignment-due-time"
                    type="time"
                    value={formData.dueTime}
                    onChange={updateField("dueTime")}
                    className={`${fieldClassName} pl-10`}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:justify-between">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-line px-4 py-3 text-sm font-bold text-ink transition hover:bg-soft"
              >
                <ArrowLeft size={16} />
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || loadingClassrooms || classrooms.length === 0}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-panel px-5 py-3 text-sm font-extrabold text-white shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Sparkles size={16} className="text-brand" />
                {submitting ? "Publishing..." : "Publish assignment"}
              </button>
            </div>
          </form>
        </Card>

        <aside className="space-y-4 lg:sticky lg:top-6">
          <Card className="overflow-hidden">
            <div className="bg-panel px-5 py-4 text-white">
              <p className="text-[11px] font-bold uppercase tracking-wider text-white/65">Quick preview</p>
              <h2 className="mt-1 text-lg font-extrabold">Student view</h2>
            </div>
            <div className="space-y-4 p-5">
              <div>
                <p className="break-words font-extrabold">
                  {formData.title.trim() || "Your assignment title"}
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                  <BookOpen size={14} />
                  {selectedClassroom?.name ?? "Select a classroom"}
                </p>
              </div>
              <p className="line-clamp-5 whitespace-pre-wrap text-sm leading-6 text-muted">
                {formData.instructions.trim() || "Add instructions so students know what to work on and how to submit it."}
              </p>
              {questionPdf && (
                <div className="flex items-center gap-2 rounded-xl bg-soft p-3 text-xs font-semibold">
                  <FileText size={16} className="shrink-0 text-tone-blue-fg" />
                  <span className="min-w-0 truncate">{questionPdf.name}</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 border-t border-line pt-4">
                <div className="rounded-xl bg-soft p-3">
                  <p className="text-[11px] text-muted">Maximum marks</p>
                  <p className="mt-1 font-extrabold">{formData.points || "—"}</p>
                </div>
                <div className="rounded-xl bg-soft p-3">
                  <p className="text-[11px] text-muted">Due</p>
                  <p className="mt-1 text-sm font-extrabold">
                    {formData.dueDate
                      ? new Date(`${formData.dueDate}T${formData.dueTime || "23:59"}`).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })
                      : "Choose a date"}
                  </p>
                </div>
              </div>
            </div>
          </Card>

          <Card className="flex items-start gap-3 p-4">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-tone-blue text-tone-blue-fg">
              <FileText size={17} />
            </div>
            <div>
              <p className="text-sm font-extrabold">A helpful tip</p>
              <p className="mt-1 text-xs leading-5 text-muted">
                Include the expected format and any key requirements in your instructions to help students submit confidently.
              </p>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
