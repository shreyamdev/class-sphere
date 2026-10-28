import { fetchMyClassrooms } from "./classroomService";
import { getStudentClassroomAnalytics } from "./analyticsService";
import {
  getStudentClassroomQuizzes,
  getStudentQuizAttempts,
  normalizeQuiz,
} from "./quizService";

// An attempt can point to its quiz as a plain id string or as a populated object.
function quizIdOf(attempt) {
  const quiz = attempt?.quiz;
  return String(
    (typeof quiz === "string" ? quiz : quiz?._id ?? quiz?.id) ??
      attempt?.quizId ??
      ""
  );
}

const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const formatDate = (value, fallback) =>
  value ? new Date(value).toLocaleDateString() : fallback;

/**
 * One place that collects EVERYTHING a student has done, per classroom:
 *  - graded assignments  (from /analytics/student/classrooms/:id)
 *  - quiz attempts       (from /quizzes/student/attempts)
 * Grades, Progress (and later the Dashboard) all read from this.
 */
export async function getStudentGradeData() {
  const [classrooms, attempts] = await Promise.all([
    fetchMyClassrooms(),
    getStudentQuizAttempts(),
  ]);

  const attemptByQuizId = new Map(attempts.map((a) => [quizIdOf(a), a]));

  const courses = await Promise.all(
    classrooms.map(async (classroom) => {
      const id = String(classroom._id ?? classroom.id);
      const name = classroom.name ?? classroom.title ?? "Classroom";

      const [analytics, rawQuizzes] = await Promise.all([
        getStudentClassroomAnalytics(id),
        getStudentClassroomQuizzes(id).catch(() => []),
      ]);

      const assignments = analytics?.assignments ?? [];
      const quizzes = rawQuizzes.map((q) => normalizeQuiz(q, classroom));

      // ---- graded assignments -> result rows
      const assignmentResults = assignments
        .filter(
          (a) =>
            a.status === "graded" && Number.isFinite(Number(a.marksObtained))
        )
        .map((a) => ({
          id: `assignment-${a.assignmentId}`,
          type: "assignment",
          title: a.title ?? "Assignment",
          course: name,
          score: toNumber(a.marksObtained),
          total: toNumber(a.maxMarks),
          date: formatDate(a.gradedAt, "Graded"),
          time: a.gradedAt ? new Date(a.gradedAt).getTime() : 0,
        }));

      // ---- attempted quizzes -> result rows
      const quizResults = quizzes
        .filter((quiz) => attemptByQuizId.has(quiz.id))
        .map((quiz) => {
          const attempt = attemptByQuizId.get(quiz.id);
          const when = attempt.submittedAt ?? attempt.createdAt;
          return {
            id: `quiz-${quiz.id}`,
            type: "quiz",
            title: quiz.title,
            course: name,
            score: toNumber(attempt.score ?? attempt.marksObtained),
            total: toNumber(
              attempt.totalMarks ?? attempt.total ?? quiz.totalMarks
            ),
            date: formatDate(when, "Attempted"),
            time: when ? new Date(when).getTime() : 0,
          };
        });

      const results = [...assignmentResults, ...quizResults];
      const scored = results.reduce((sum, r) => sum + r.score, 0);
      const total = results.reduce((sum, r) => sum + r.total, 0);

      return {
        id,
        name,
        teacher: classroom.teacher?.name ?? classroom.owner?.name ?? "Teacher",
        tag: classroom.subject ?? classroom.semesterSection ?? "Classroom",
        assignments, // raw analytics rows (status, marks...) for Progress
        totalAssignments: analytics?.totalAssignments ?? assignments.length,
        completedAssignments: analytics?.completedAssignments ?? 0,
        quizzes, // published quizzes of this class
        quizzesTaken: quizResults.length,
        results, // graded assignments + quiz attempts together
        assignmentCount: assignmentResults.length,
        quizCount: quizResults.length,
        scored,
        total,
      };
    })
  );

  return { courses };
}