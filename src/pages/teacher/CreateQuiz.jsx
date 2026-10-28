import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Plus, Sparkles, Trash2 } from "lucide-react";
import Topbar from "../../components/Topbar";
import HeroBanner from "../../components/HeroBanner";
import Card from "../../components/Card";
import { fetchMyClassrooms } from "../../services/classroomService";
import { fetchClassroomMaterials, fetchMaterialFile } from "../../services/materialService";
import { generateQuizFromPdf, generateQuizFromTopic } from "../../services/aiService";
import { createQuiz, publishQuiz } from "../../services/quizService";

const emptyQuestion = () => ({
  question: "",
  options: ["", "", "", ""],
  correctAnswer: "",
});

const optionText = (option) =>
  typeof option === "string"
    ? option
    : option?.text ?? option?.value ?? option?.label ?? option?.option ?? "";

// AI services answer in different shapes: options can be an array OR an object like {A: "...", B: "..."}
function normalizeOptions(raw) {
  if (Array.isArray(raw)) return raw.map(optionText);
  if (raw && typeof raw === "object") return Object.values(raw).map(optionText);
  return [];
}

// the correct answer can be the option text, an index (0/1/2), or a letter ("A", "B)")
function resolveCorrectAnswer(item, options, rawOptions) {
  const raw =
    item.correctAnswer ??
    item.correct_answer ??
    item.correctOption ??
    item.correct_option ??
    item.answer ??
    "";
  if (typeof raw === "number") return options[raw] ?? "";

  const text = String(raw).trim();
  if (options.includes(text)) return text;

  const letter = text.match(/^\(?([A-Da-d])[).:]?$/);
  if (letter) {
    const index = letter[1].toUpperCase().charCodeAt(0) - 65;
    if (options[index]) return options[index];
  }

  if (rawOptions && !Array.isArray(rawOptions) && typeof rawOptions === "object" && rawOptions[text] !== undefined) {
    return optionText(rawOptions[text]);
  }

  const loose = options.find((option) => option.trim().toLowerCase() === text.toLowerCase());
  return loose ?? text;
}

function extractQuestions(response) {
  const data = response?.quiz ?? response?.data?.quiz ?? response?.data ?? response;
  const questions =
    data?.questions ?? data?.quiz?.questions ?? data?.mcqs ?? data?.items ??
    (Array.isArray(data) ? data : undefined);
  if (!Array.isArray(questions)) {
    throw new Error("The AI service did not return a quiz question list.");
  }
  return questions
    .map((item) => {
      const rawOptions = item.options ?? item.choices ?? item.answers;
      const options = normalizeOptions(rawOptions);
      return {
        question: item.question ?? item.question_text ?? item.questionText ?? item.text ?? item.prompt ?? "",
        options,
        correctAnswer: resolveCorrectAnswer(item, options, rawOptions),
      };
    })
    .filter((item) => item.question && item.options.length >= 2);
}

function isPdf(material) {
  const type = String(material.type ?? material.mimeType ?? material.contentType ?? "").toLowerCase();
  const name = String(material.fileName ?? material.originalName ?? material.title ?? "").toLowerCase();
  return !type.includes("link") &&
    (type.includes("pdf") || name.endsWith(".pdf") || (!type && !name));
}

export default function CreateQuiz() {
  const navigate = useNavigate();
  const [classrooms, setClassrooms] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [classroomId, setClassroomId] = useState("");
  const [materialId, setMaterialId] = useState("");
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("mixed");
  const [questionCount, setQuestionCount] = useState(5);
  const [questions, setQuestions] = useState([emptyQuestion()]);
  const [source, setSource] = useState("topic");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [savedQuiz, setSavedQuiz] = useState(null);

  useEffect(() => {
    let active = true;
    fetchMyClassrooms()
      .then(async (items) => {
        const groups = await Promise.all(items.map(async (classroom) => {
          const id = String(classroom._id ?? classroom.id);
          const response = await fetchClassroomMaterials(id);
          const list = Array.isArray(response) ? response : response?.materials ?? [];
          return {
            classroom,
            materials: list.filter(isPdf).map((material) => ({
              id: String(material._id ?? material.id),
              title: material.title ?? material.originalName ?? material.fileName ?? "PDF",
              classroomId: id,
            })),
          };
        }));
        if (!active) return;
        const classroomList = groups.map(({ classroom }) => classroom);
        setClassrooms(classroomList);
        setClassroomId(String(classroomList[0]?._id ?? classroomList[0]?.id ?? ""));
        setMaterials(groups.flatMap((group) => group.materials));
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || "Could not load your classrooms.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const availableMaterials = useMemo(
    () => materials.filter((material) => material.classroomId === classroomId),
    [materials, classroomId]
  );

  function updateQuestion(index, key, value) {
    setQuestions((previous) => previous.map((item, itemIndex) =>
      itemIndex === index ? { ...item, [key]: value } : item
    ));
  }

  function updateOption(questionIndex, optionIndex, value) {
    setQuestions((previous) => previous.map((item, itemIndex) => {
      if (itemIndex !== questionIndex) return item;
      const options = item.options.map((option, index) =>
        index === optionIndex ? value : option
      );
      return {
        ...item,
        options,
        correctAnswer: item.correctAnswer === item.options[optionIndex]
          ? value
          : item.correctAnswer,
      };
    }));
  }

  async function generateQuestions() {
    if (!topic.trim() && !materialId) {
      setError("Enter a topic or choose a classroom PDF to generate questions.");
      return;
    }
    setWorking(true);
    setError("");
    setNotice("");
    try {
      let generated;
      if (materialId) {
        const material = availableMaterials.find((item) => item.id === materialId);
        const blob = await fetchMaterialFile(materialId);
        // sanity check: a real PDF always starts with "%PDF"
        const header = await blob.slice(0, 5).text();
        if (!blob.size || !header.startsWith("%PDF")) {
          throw new Error("The selected material could not be downloaded as a valid PDF. Please re-upload it.");
        }
        // the backend checks the file NAME, so it must end with .pdf
        const baseName = (material?.title ?? "").trim() || "study-material";
        const fileName = /\.pdf$/i.test(baseName) ? baseName : `${baseName}.pdf`;
        const file = new File([blob], fileName, { type: "application/pdf" });
        generated = await generateQuizFromPdf({ file, numQuestions: Number(questionCount), difficulty });
        setSource("pdf");
        if (!topic.trim()) setTopic(material?.title ?? "Study material");
      } else {
        generated = await generateQuizFromTopic({
          topic: topic.trim(),
          numQuestions: Number(questionCount),
          difficulty,
        });
        setSource("topic");
      }
      const generatedQuestions = extractQuestions(generated);
      if (!generatedQuestions.length) {
        console.warn("AI quiz response (no usable questions):", generated);
        throw new Error("The AI service returned no usable multiple-choice questions.");
      }
      setQuestions(generatedQuestions);
      setNotice(`Generated ${generatedQuestions.length} questions. Review the answer keys before saving.`);
    } catch (generationError) {
      setError(generationError.message || "Could not generate quiz questions.");
    } finally {
      setWorking(false);
    }
  }

  async function saveQuiz(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!classroomId) {
      setError("Create or select a classroom before saving this quiz.");
      return;
    }
    const invalidQuestion = questions.find((item) =>
      !item.question.trim() ||
      item.options.length < 2 ||
      item.options.some((option) => !option.trim()) ||
      !item.correctAnswer ||
      !item.options.includes(item.correctAnswer)
    );
    if (!questions.length || invalidQuestion) {
      setError("Complete every question, option, and correct answer before saving.");
      return;
    }
    setWorking(true);
    try {
      const created = await createQuiz({
        title: title.trim() || topic.trim() || "Class quiz",
        topic: topic.trim() || title.trim() || "General",
        classroomId,
        difficulty,
        source,
        status: "draft",
        totalMarks: questions.length,
        questions: questions.map((item) => ({
          question: item.question.trim(),
          options: item.options.map((option) => option.trim()),
          correctAnswer: item.correctAnswer,
        })),
      });
      const quiz = created?.quiz ?? created;
      const id = quiz?._id ?? quiz?.id;
      if (!id) throw new Error("Quiz saved but the server did not return its ID.");
      setSavedQuiz({ ...quiz, id: String(id) });
      setNotice("Quiz saved as a draft. Publish it when you are ready to share it.");
    } catch (saveError) {
      setError(saveError.message || "Could not save this quiz.");
    } finally {
      setWorking(false);
    }
  }

  async function handlePublish() {
    if (!savedQuiz) return;
    setWorking(true);
    setError("");
    try {
      await publishQuiz(savedQuiz.id);
      navigate("/teacher/quiz-results", { state: { quizId: savedQuiz.id } });
    } catch (publishError) {
      setError(publishError.message || "Could not publish this quiz.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="dashboard-stagger space-y-5">
      <Topbar title="Create Quiz" subtitle="Generate, review, and publish class quizzes" backFallbackPath="/teacher/dashboard" />
      <HeroBanner
        variant="navy"
        title="Create a quiz for your class"
        subtitle="Generate questions with AI from a topic or shared PDF, then review and save a draft."
        icons={[Sparkles, FileText, Plus]}
      />

      {error && <Card role="alert" className="p-4 text-sm text-tone-red-fg">{error}</Card>}
      {notice && <Card role="status" className="p-4 text-sm text-tone-green-fg">{notice}</Card>}

      {loading ? (
        <Card className="p-6 text-sm text-muted">Loading classrooms and study materials...</Card>
      ) : (
        <form onSubmit={saveQuiz} className="space-y-5">
          <Card className="space-y-4 p-5">
            <h2 className="text-lg font-extrabold">Quiz details</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-bold">
                Class
                <select
                  required
                  value={classroomId}
                  onChange={(event) => {
                    setClassroomId(event.target.value);
                    setMaterialId("");
                  }}
                  className="mt-1.5 w-full rounded-xl border border-line bg-card px-3 py-2.5 font-normal"
                >
                  <option value="">Choose classroom</option>
                  {classrooms.map((classroom) => (
                    <option key={classroom._id ?? classroom.id} value={String(classroom._id ?? classroom.id)}>
                      {classroom.name ?? classroom.title ?? "Classroom"}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-bold">
                Quiz title
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={150}
                  placeholder="e.g. Data Structures Review"
                  className="mt-1.5 w-full rounded-xl border border-line bg-card px-3 py-2.5 font-normal"
                />
              </label>
              <label className="text-sm font-bold">
                Topic
                <input
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                  placeholder="e.g. Trees and traversal"
                  className="mt-1.5 w-full rounded-xl border border-line bg-card px-3 py-2.5 font-normal"
                />
              </label>
              <label className="text-sm font-bold">
                Difficulty
                <select
                  value={difficulty}
                  onChange={(event) => setDifficulty(event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-line bg-card px-3 py-2.5 font-normal"
                >
                  {["easy", "medium", "hard", "mixed"].map((item) => (
                    <option key={item} value={item}>{item[0].toUpperCase() + item.slice(1)}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-bold">
                Questions to generate
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={questionCount}
                  onChange={(event) => setQuestionCount(event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-line bg-card px-3 py-2.5 font-normal"
                />
              </label>
              <label className="text-sm font-bold">
                Optional class PDF
                <select
                  value={materialId}
                  onChange={(event) => setMaterialId(event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-line bg-card px-3 py-2.5 font-normal"
                >
                  <option value="">Generate from topic instead</option>
                  {availableMaterials.map((material) => (
                    <option key={material.id} value={material.id}>{material.title}</option>
                  ))}
                </select>
              </label>
            </div>
            <button
              type="button"
              onClick={generateQuestions}
              disabled={working || (!topic.trim() && !materialId) || !classroomId}
              className="inline-flex items-center gap-2 rounded-xl bg-panel px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              <Sparkles size={16} />
              {working ? "Working..." : "Generate with AI"}
            </button>
          </Card>

          <Card className="space-y-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold">Questions</h2>
                <p className="text-xs text-muted">Every question needs at least two options and one correct answer.</p>
              </div>
              <button
                type="button"
                onClick={() => setQuestions((previous) => [...previous, emptyQuestion()])}
                className="inline-flex items-center gap-2 rounded-xl border border-line bg-card px-3 py-2 text-sm font-bold"
              >
                <Plus size={15} /> Add question
              </button>
            </div>
            {questions.map((question, index) => (
              <div key={index} className="space-y-3 rounded-xl border border-line p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-extrabold">Question {index + 1}</h3>
                  {questions.length > 1 && (
                    <button
                      type="button"
                      aria-label={`Remove question ${index + 1}`}
                      onClick={() => setQuestions((previous) => previous.filter((_, i) => i !== index))}
                      className="rounded-lg p-2 text-tone-red-fg hover:bg-soft"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
                <input
                  value={question.question}
                  onChange={(event) => updateQuestion(index, "question", event.target.value)}
                  placeholder="Write the question"
                  required
                  className="w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm"
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  {question.options.map((option, optionIndex) => (
                    <input
                      key={optionIndex}
                      value={option}
                      onChange={(event) => updateOption(index, optionIndex, event.target.value)}
                      placeholder={`Option ${optionIndex + 1}`}
                      required
                      className="w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm"
                    />
                  ))}
                </div>
                <label className="text-xs font-bold">
                  Correct answer
                  <select
                    value={question.correctAnswer}
                    onChange={(event) => updateQuestion(index, "correctAnswer", event.target.value)}
                    required
                    className="mt-1.5 w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm font-normal"
                  >
                    <option value="">Choose the correct option</option>
                    {question.options.filter(Boolean).map((option, optionIndex) => (
                      <option key={`${optionIndex}-${option}`} value={option}>{option}</option>
                    ))}
                  </select>
                </label>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={working || !classroomId || Boolean(savedQuiz)}
                className="rounded-xl bg-brand px-4 py-2.5 text-sm font-extrabold text-on-brand disabled:opacity-50"
              >
                {working ? "Saving..." : "Save as draft"}
              </button>
              {savedQuiz && (
                <button
                  type="button"
                  onClick={handlePublish}
                  disabled={working}
                  className="rounded-xl border border-line bg-card px-4 py-2.5 text-sm font-bold disabled:opacity-50"
                >
                  {working ? "Publishing..." : "Publish quiz"}
                </button>
              )}
            </div>
          </Card>
        </form>
      )}
      {!loading && classrooms.length === 0 && (
        <Card className="p-5 text-sm text-muted">Create a classroom before creating quizzes.</Card>
      )}
    </div>
  );
}