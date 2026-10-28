import { useEffect, useMemo, useState } from "react";
import { Download, Users } from "lucide-react";
import Card from "../../components/Card";
import HeroBanner from "../../components/HeroBanner";
import Topbar from "../../components/Topbar";
import {
  fetchClassroomDetails,
  fetchMyClassrooms,
  removeStudentFromClassroom,
} from "../../services/classroomService";

const unwrap = (response) => response?.data?.data ?? response?.data ?? response;
const idOf = (item) => item?._id ?? item?.id;

export default function ManageMembers() {
  const [classrooms, setClassrooms] = useState([]);
  const [classroomId, setClassroomId] = useState("");
  const [students, setStudents] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [removingId, setRemovingId] = useState("");

  useEffect(() => {
    let active = true;
    fetchMyClassrooms()
      .then((items) => {
        if (!active) return;
        setClassrooms(items);
        if (items.length) {
          setClassroomId(String(idOf(items[0])));
        } else {
          setStatus("ready");
        }
      })
      .catch((loadError) => {
        if (active) {
          setError(loadError.message || "Could not load your classrooms.");
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

    fetchClassroomDetails(classroomId)
      .then((response) => {
        if (!active) return;
        const detail = unwrap(response);
        const classroom = detail?.classroom ?? detail;
        setStudents(Array.isArray(classroom?.students) ? classroom.students : []);
        setStatus("ready");
      })
      .catch((loadError) => {
        if (!active) return;
        setError(loadError.message || "Could not load classroom members.");
        setStatus("error");
      });

    return () => {
      active = false;
    };
  }, [classroomId]);

  const selectedClassroom = classrooms.find(
    (classroom) => String(idOf(classroom)) === classroomId
  );

  const members = useMemo(
    () =>
      students.map((student) => {
        const user = student.user ?? student.student ?? student;
        return {
          id: idOf(user) ?? idOf(student),
          name: user.name ?? user.fullName ?? "Student",
          email: user.email ?? "",
        };
      }),
    [students]
  );

  function downloadStudentReport() {
    const rows = [
      ["Student name", "Email", "Student ID"],
      ...members.map((student) => [student.name, student.email, student.id]),
    ];
    const csv = "\ufeff" + rows.map((row) => row.map((value) =>
      `"${String(value ?? "").replaceAll('"', '""')}"`
    ).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${selectedClassroom?.name ?? "classroom"}-student-report.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async function handleRemove(studentId) {
    if (!window.confirm("Remove this student from the classroom?")) return;
    setRemovingId(studentId);
    setError("");
    try {
      await removeStudentFromClassroom(classroomId, studentId);
      setStudents((current) =>
        current.filter((student) => {
          const user = student.user ?? student.student ?? student;
          return String(idOf(user) ?? idOf(student)) !== String(studentId);
        })
      );
    } catch (removeError) {
      setError(removeError.message || "Could not remove this student.");
    } finally {
      setRemovingId("");
    }
  }

  return (
    <div className="space-y-5">
      <Topbar title="Members" subtitle="View and manage classroom enrollment" backFallbackPath="/teacher/dashboard" />
      <HeroBanner
        variant="navy"
        eyebrow="CLASSROOM COMMUNITY"
        title="Manage your students"
        subtitle="Choose a classroom to view its enrolled students."
        icons={[Users, Users, Users]}
      />

      <Card className="p-4">
        <label
          htmlFor="members-classroom"
          className="mb-2 block text-xs font-bold text-ink"
        >
          Classroom
        </label>
        <select
          id="members-classroom"
          value={classroomId}
          onChange={(event) => {
            setClassroomId(event.target.value);
            setStatus("loading");
            setError("");
          }}
          disabled={!classrooms.length}
          className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-brand disabled:opacity-60 sm:max-w-md"
        >
          {classrooms.length ? (
            classrooms.map((classroom) => (
              <option key={idOf(classroom)} value={idOf(classroom)}>
                {classroom.name ?? classroom.title ?? "Classroom"}
              </option>
            ))
          ) : (
            <option value="">No classrooms available</option>
          )}
        </select>
      </Card>

      {error && (
        <Card className="p-4 text-sm text-tone-red-fg" role="alert">
          {error}
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-line p-4">
          <div>
            <h2 className="font-extrabold text-ink">
              {selectedClassroom?.name ?? "Classroom members"}
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              {status === "ready" ? `${members.length} students enrolled` : " "}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={downloadStudentReport}
              disabled={status !== "ready" || members.length === 0}
              className="inline-flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-xs font-bold text-ink transition hover:bg-soft disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download size={15} />
              Download student report
            </button>
            <div className="hidden h-10 w-10 place-items-center rounded-xl bg-tone-blue text-tone-blue-fg sm:grid">
              <Users size={18} />
            </div>
          </div>
        </div>

        {status === "loading" ? (
          <p className="p-8 text-center text-sm text-muted">
            Loading members...
          </p>
        ) : members.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted">
            No students are enrolled in this classroom yet.
          </p>
        ) : (
          <div className="divide-y divide-line">
            {members.map((student) => (
              <div
                key={student.id}
                className="flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-soft text-sm font-extrabold text-tone-yellow-fg">
                    {student.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-ink">
                      {student.name}
                    </p>
                    {student.email && (
                      <p className="truncate text-xs text-muted">{student.email}</p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={!student.id || removingId === student.id}
                  onClick={() => handleRemove(student.id)}
                  className="rounded-lg px-3 py-2 text-xs font-semibold text-tone-red-fg transition hover:bg-tone-red disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {removingId === student.id ? "Removing..." : "Remove"}
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
