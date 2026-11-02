import { useEffect, useMemo, useState } from "react";
import { BarChart2, CheckCircle2, Users, ShieldAlert, Download } from "lucide-react";
import Card from "../../components/Card";
import Topbar from "../../components/Topbar";
import HeroBanner from "../../components/HeroBanner";
import RiskProfileModal from "../../components/RiskProfileModal";
import { fetchMyClassrooms } from "../../services/classroomService";
import {
  getTeacherClassroomAnalytics,
  getTeacherClassroomStudents,
  getTeacherRiskPredictions,
} from "../../services/analyticsService";

const classroomIdOf = (classroom) => classroom?._id ?? classroom?.id;

export default function ClassAnalytics() {
  const [classrooms, setClassrooms] = useState([]);
  const [classroomId, setClassroomId] = useState("");
  const [analytics, setAnalytics] = useState(null);
  const [students, setStudents] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [status, setStatus] = useState("loading");
  const [riskStatus, setRiskStatus] = useState("idle");
  const [error, setError] = useState("");
  const [riskError, setRiskError] = useState("");
  const [riskMeta, setRiskMeta] = useState(null);
  const [riskWindow, setRiskWindow] = useState(null);
  const [riskProfileStudent, setRiskProfileStudent] = useState(null);

  useEffect(() => {
    let active = true;
    fetchMyClassrooms()
      .then((items) => {
        if (!active) return;
        setClassrooms(items);
        setClassroomId(String(classroomIdOf(items[0]) ?? ""));
        if (!items.length) setStatus("ready");
      })
      .catch((loadError) => {
        if (active) {
          setError(loadError.message || "Could not load classrooms.");
          setStatus("error");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!classroomId) return undefined;
    let active = true;
    Promise.resolve()
      .then(() => {
        setStatus("loading");
        setError("");
        setPredictions([]);
        setRiskStatus("idle");
      })
      .then(() => Promise.all([
        getTeacherClassroomAnalytics(classroomId),
        getTeacherClassroomStudents(classroomId),
      ]))
      .then(([classData, studentData]) => {
        if (!active) return;
        setAnalytics(classData);
        setStudents(studentData?.students ?? []);
        setStatus("ready");
      })
      .catch((loadError) => {
        if (!active) return;
        setError(loadError.message || "Could not load class analytics.");
        setStatus("error");
      });
    return () => {
      active = false;
    };
  }, [classroomId]);

  const selectedClassroom = classrooms.find(
    (classroom) => String(classroomIdOf(classroom)) === classroomId
  );
  const metrics = useMemo(() => [
    {
      label: "Class average",
      value: analytics?.averageGradedPercentage == null
        ? "—"
        : `${analytics.averageGradedPercentage}%`,
      icon: BarChart2,
    },
    {
      label: "Submission rate",
      value: analytics?.submissionRate == null ? "—" : `${analytics.submissionRate}%`,
      icon: CheckCircle2,
    },
    {
      label: "Students",
      value: analytics?.totalStudents ?? 0,
      icon: Users,
    },
    {
      label: "Assignments",
      value: analytics?.totalAssignments ?? 0,
      icon: ShieldAlert,
    },
  ], [analytics]);

  const loadPredictions = async () => {
    setRiskStatus("loading");
    setRiskError("");
    setRiskWindow(null);
    try {
      const response = await getTeacherRiskPredictions(classroomId);
      const payload = Array.isArray(response)
        ? { predictions: response }
        : response?.data ?? response ?? {};
      const records = payload.predictions ?? payload.students ?? payload.results ?? payload.records ?? [];
      setPredictions(Array.isArray(records) ? records : []);
      setRiskMeta({
        disclaimer: payload.disclaimer ?? payload.data?.disclaimer,
        activityDataNote: payload.activityDataNote ?? payload.data?.activityDataNote,
      });
      setRiskStatus("ready");
    } catch (loadError) {
      const body = loadError.body ?? {};
      const bodyCode = body.code ?? body.data?.code;
      if (
        loadError.status === 409 ||
        bodyCode === "MODEL_WINDOW_NOT_REACHED" ||
        loadError.code === "MODEL_WINDOW_NOT_REACHED"
      ) {
        setRiskWindow(
          body.predictionEligibleFrom ??
          body.data?.predictionEligibleFrom ??
          body.eligibleFrom ??
          body.data?.eligibleFrom ??
          null
        );
        setRiskStatus("window");
      } else if ([400, 404].includes(loadError.status)) {
        setRiskError(loadError.message || "This classroom is invalid or inaccessible.");
        setRiskStatus("error");
      } else if ([502, 503, 504].includes(loadError.status)) {
        setRiskError("The prediction service is temporarily unavailable. Please retry.");
        setRiskStatus("error");
      } else {
        setRiskError(loadError.message || "Could not load risk predictions.");
        setRiskStatus("error");
      }
    }
  };

  const riskBadgeClass = (probability) => {
    if (probability >= 0.65) return "bg-tone-red text-tone-red-fg";
    if (probability >= 0.35) return "bg-tone-yellow text-tone-yellow-fg";
    return "bg-tone-green text-tone-green-fg";
  };
  const riskLabel = (probability) => {
    if (probability >= 0.65) return "High Risk";
    if (probability >= 0.35) return "Medium Risk";
    return "Low Risk";
  };

  const exportCsv = () => {
    const rows = [
      ["Student", "Email", "Assignments", "Submitted", "Graded", "Average percentage"],
      ...students.map((row) => [
        row.student?.name ?? "",
        row.student?.email ?? "",
        row.totalAssignments ?? 0,
        row.submittedAssignments ?? 0,
        row.gradedAssignments ?? 0,
        row.averagePercentage ?? "",
      ]),
    ];
    const csv = rows.map((row) => row.map((value) =>
      `"${String(value).replaceAll('"', '""')}"`
    ).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${selectedClassroom?.name ?? "class"}-analytics.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const predictionByStudent = new Map(
    predictions.map((item) => [String(item.student?.id ?? item.student?._id), item])
  );

  return (
    <div className="space-y-6">
      <Topbar
        title="Class analytics"
        subtitle="Assignment performance and participation"
        backFallbackPath="/teacher/dashboard"
      />
      <HeroBanner
        variant="navy"
        title="Understand your classes"
        subtitle="Review assignment averages, submission progress, and students who may need support."
        icons={[BarChart2, Users, CheckCircle2]}
      />

      <Card className="p-4">
        <label htmlFor="analytics-classroom" className="mb-2 block text-xs font-bold">
          Classroom
        </label>
        <select
          id="analytics-classroom"
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
      {status === "loading" && <Card className="p-5 text-sm text-muted">Loading class analytics...</Card>}
      {status === "ready" && classroomId && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-muted">{selectedClassroom?.name ?? "Selected classroom"}</p>
            <button
              type="button"
              onClick={exportCsv}
              disabled={!students.length}
              className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2 text-sm font-bold disabled:opacity-50"
            >
              <Download size={16} /> Download student report
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {metrics.map((metric) => (
              <Card key={metric.label} className="flex items-center gap-3 p-4">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-soft"><metric.icon size={17} /></div>
                <div><p className="text-xs text-muted">{metric.label}</p><p className="text-xl font-extrabold">{metric.value}</p></div>
              </Card>
            ))}
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card className="p-5">
              <h2 className="text-base font-extrabold">Assignment activity</h2>
              <div className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                <div className="rounded-xl border border-line bg-soft px-3 py-2.5 text-xs"><p className="text-muted">Submitted work</p><p className="mt-1 text-base font-extrabold">{analytics?.totalSubmissions ?? 0}/{analytics?.totalPossibleSubmissions ?? 0}</p></div>
                <div className="rounded-xl border border-line bg-soft px-3 py-2.5 text-xs"><p className="text-muted">Graded submissions</p><p className="mt-1 text-base font-extrabold">{analytics?.totalGradedSubmissions ?? 0}</p></div>
                <div className="rounded-xl border border-line bg-soft px-3 py-2.5 text-xs"><p className="text-muted">Not yet submitted</p><p className="mt-1 text-base font-extrabold">{analytics?.pendingSubmissions ?? 0}</p></div>
              </div>
            </Card>

            <Card className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-extrabold">Student risk predictions</h2>
                  <p className="mt-1 text-xs text-muted">Generated server-side from the classroom activity window.</p>
                </div>
                <button
                  type="button"
                  onClick={loadPredictions}
                  disabled={riskStatus === "loading"}
                  className="rounded-xl bg-brand px-3 py-2 text-xs font-bold text-on-brand disabled:opacity-50"
                >
                  {riskStatus === "loading" ? "Loading..." : "Load predictions"}
                </button>
              </div>
              {riskError && <p role="alert" className="mt-3 rounded-lg bg-tone-red p-3 text-xs text-tone-red-fg">{riskError}</p>}
              {riskStatus === "window" && (
                <div role="status" className="mt-3 rounded-xl bg-tone-blue p-3 text-xs text-tone-blue-fg">
                  {riskWindow ? `Prediction insights become available on ${new Date(riskWindow).toLocaleDateString()}. Set the classroom course start date to improve observation-window accuracy.` : "Prediction insights are not available yet because the classroom has not reached the required activity observation window."}
                </div>
              )}
              {riskStatus === "ready" && predictions.length === 0 && (
                <p className="mt-3 text-sm text-muted">No prediction records were returned.</p>
              )}
              {riskStatus === "ready" && predictions.length > 0 && (
                <div className="mt-4 space-y-2">
                  {predictions.map((item) => {
                    const probability = Number(item.prediction?.risk_probability);
                    const features = item.inputFeatures ?? {};
                    return (
                      <div key={item.student?.id ?? item.student?._id} className="rounded-xl border border-line bg-soft p-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold">{item.student?.name ?? "Student"}</p>
                            <p className="mt-1 text-xs text-muted">
                              {item.status === "profile_required"
                                ? "Student profile needs configuration"
                                : probability == null || Number.isNaN(probability)
                                  ? "No probability"
                                  : `${(probability * 100).toFixed(2)}% risk probability`}
                            </p>
                          </div>
                          {item.status === "profile_required" ? (
                            <button type="button" onClick={() => setRiskProfileStudent({ id: item.student?.id ?? item.student?._id, name: item.student?.name ?? "Student", email: item.student?.email ?? "" })} className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold hover:bg-card">Configure ML Profile</button>
                          ) : !Number.isNaN(probability) ? (
                            <div className="flex items-center gap-2">
                              {item.prediction?.at_risk === true && <span className="rounded-full bg-tone-red px-2 py-1 text-[11px] font-bold text-tone-red-fg">At risk</span>}
                              <span className={`rounded-full px-3 py-1 text-xs font-bold ${riskBadgeClass(probability)}`}>{riskLabel(probability)}</span>
                            </div>
                          ) : null}
                        </div>
                        {!Number.isNaN(probability) && item.status !== "profile_required" && (
                          <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-3">
                            {["num_assessments_done", "avg_score", "min_score", "weighted_score", "late_submissions", "active_days"].map((feature) => (
                              <span key={feature} className="rounded-lg bg-card px-2 py-1.5 text-muted">
                                {feature.replaceAll("_", " ")} <strong className="ml-1 text-ink">{features[feature] ?? "—"}</strong>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {riskStatus === "ready" && (riskMeta?.disclaimer || riskMeta?.activityDataNote) && (
                <div className="mt-4 space-y-1 border-t border-line pt-3 text-[11px] text-muted">
                  {riskMeta.disclaimer && <p>{riskMeta.disclaimer}</p>}
                  {riskMeta.activityDataNote && <p>{riskMeta.activityDataNote}</p>}
                </div>
              )}
            </Card>
          </div>

          <Card className="overflow-hidden">
            <div className="border-b border-line p-4">
              <h2 className="font-extrabold">Students</h2>
            </div>
            {!students.length ? (
              <p className="p-6 text-center text-sm text-muted">No students are enrolled in this classroom yet.</p>
            ) : (
              <div className="divide-y divide-line">
                {students.map((row) => {
                  const prediction = predictionByStudent.get(String(row.student?.id ?? row.student?._id));
                  return (
                    <div key={row.student?.id ?? row.student?._id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                      <div>
                        <p className="font-bold">{row.student?.name ?? "Student"}</p>
                        <p className="text-xs text-muted">{row.student?.email ?? ""}</p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-muted">
                        <span className="rounded-lg border border-line bg-soft px-2.5 py-1.5"><strong className="text-ink">{row.submittedAssignments ?? 0}/{row.totalAssignments ?? 0}</strong> submitted</span>
                        <span className="rounded-lg border border-line bg-soft px-2.5 py-1.5"><strong className="text-ink">{row.gradedAssignments ?? 0}</strong> graded</span>
                        <span className="rounded-lg border border-line bg-soft px-2.5 py-1.5"><strong className="text-ink">{row.averagePercentage == null ? "No grades" : `${row.averagePercentage}%`}</strong>{row.averagePercentage == null ? "" : " average"}</span>
                        {prediction?.status === "profile_required" ? (
                          <button
                            type="button"
                            onClick={() => setRiskProfileStudent({ id: row.student?.id ?? row.student?._id, name: row.student?.name ?? "Student", email: row.student?.email ?? "" })}
                            className="rounded-lg border border-line px-3 py-1 text-xs font-bold text-ink hover:bg-soft"
                          >
                            Configure ML Profile
                          </button>
                        ) : prediction ? (
                          <span className="font-bold text-ink">{prediction.prediction?.risk_level ?? prediction.status}</span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </>
      )}
      {status === "ready" && !classroomId && (
        <Card className="p-6 text-sm text-muted">Create a classroom to view analytics.</Card>
      )}
      {riskProfileStudent && (
        <RiskProfileModal
          key={`${classroomId}-${riskProfileStudent.id}`}
          classroomId={classroomId}
          student={riskProfileStudent}
          onClose={() => setRiskProfileStudent(null)}
          onSaved={loadPredictions}
        />
      )}
    </div>
  );
}
