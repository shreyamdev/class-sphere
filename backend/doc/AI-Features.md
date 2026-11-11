# ClassSphere — AI Features, Flashcards & Quiz System

This document describes the AI summarizer, flashcard generation, AI quiz generation, and the persistent quiz assessment workflow in the ClassSphere Node.js backend.

The AI endpoints proxy requests to separately deployed Python services. The persistent quiz endpoints use MongoDB to save quizzes, publish them to enrolled students, evaluate submissions, and retrieve results.

**Base URL (local):** `http://localhost:5000`

## Environment Variables

Configure these in the Node.js backend `.env` file and the backend's Render environment:

```env
AI_SERVICE_URL=https://<deployed-summarizer-service-host>
QUIZ_SERVICE_URL=https://<deployed-quiz-generator-service-host>
```

Use the actual public base URLs supplied by the service owners. Do not append endpoint paths or a trailing route path. `QUIZ_SERVICE_URL` must point to the Flask quiz-generator deployment that exposes `GET /health`, `POST /generate-quiz`, and `POST /generate-quiz-from-pdf`. Configure `GEMINI_API_KEY` in that Python service's own environment, not in the browser or Node backend. A non-JSON upstream response usually indicates a wrong service URL, hosting error page, or failed deployment; inspect the Python service logs.

Do not put Gemini API keys or service secrets in frontend code. The deployed service URLs were not provided in the supplied integration guide and must be replaced with the real URLs before production use.

---

## 1. Summarize Notes and Generate Flashcards

**Endpoint:** `POST /api/ai/summarize`

**Access:** Authenticated student or teacher.

**Headers:**

The browser sends the HttpOnly access cookie automatically. The shared Axios client must use `withCredentials: true`; do not add a Bearer token header.

**Body:** `multipart/form-data`

| Field | Type | Requirement |
|---|---|---|
| `file` | PDF file | Required; maximum 10 MB |

Select `form-data` in Postman, add a field named `file`, change its type to **File**, and select a PDF. Do not manually set the multipart `Content-Type`; Postman generates the boundary.

### Successful response

```json
{
  "success": true,
  "data": {
    "summary": "## Main heading\n- Key point",
    "flashcards": [
      {
        "question": "What is photosynthesis?",
        "answer": "The process by which plants convert light energy into chemical energy."
      }
    ]
  }
}
```

The exact generated content and number of flashcards depend on the service response.

**Limitations:**
- The PDF must contain extractable text.
- Scanned/image-only PDFs may fail because OCR is not included in the supplied service.
- Uploads are limited to 10 MB.
- This endpoint returns generated content; it does not automatically save summaries or flashcards in MongoDB.

---

## 2. Generate an AI Quiz from a Topic or Study Text

**Endpoint:** `POST /api/ai/quizzes/generate`

**Access:** Authenticated teacher only.

**Headers:**

Send `Content-Type: application/json`. The browser sends the HttpOnly session cookie automatically (`withCredentials: true`).

### Request body

```json
{
  "topic": "Photosynthesis",
  "study_material": "",
  "num_questions": 5,
  "difficulty": "mixed"
}
```

### Parameters

| Field | Requirement |
|---|---|
| `topic` | Optional if `study_material` is supplied |
| `study_material` | Optional if `topic` is supplied |
| `num_questions` | 1–20 |
| `difficulty` | `easy`, `medium`, `hard`, or `mixed` |

At least one of `topic` or `study_material` must be non-empty.

The service may return fewer valid unique questions than requested. Check the returned question count and any warnings in the response.

**Security:** Generated quiz responses include correct answers. Keep this endpoint teacher-only. Never expose its unfiltered response directly to student quiz-taking screens.

---

## 3. Generate an AI Quiz from a PDF

**Endpoint:** `POST /api/ai/quizzes/generate-from-pdf`

**Access:** Authenticated teacher only.

**Headers:**

The browser sends the HttpOnly session cookie automatically (`withCredentials: true`).

**Body:** `multipart/form-data`

| Field | Type | Requirement |
|---|---|---|
| `file` | PDF file | Required |
| `num_questions` | Number | Optional; default 5, range 1–20 |
| `difficulty` | String | Optional; default `mixed` |

The PDF must contain at least 50 characters of extractable text. OCR is not available in the supplied service.

This endpoint generates quiz content but does not, by itself, save or publish the quiz in MongoDB.

---

## 4. Persistent Quiz Workflow

The persistent quiz system is separate from the AI generation endpoints. It uses the `Quiz` and `QuizAttempt` MongoDB models.

### Workflow

1. A teacher generates questions using AI or prepares questions manually.
2. The teacher saves the questions as a draft.
3. The teacher publishes the quiz.
4. Enrolled students retrieve published quizzes.
5. Students submit their answers.
6. The backend evaluates the answers and saves each attempt.
7. Students can retrieve their attempt history.
8. Teachers can retrieve results for quizzes in their own classrooms.

AI-generated questions can be saved through the persistent quiz API after checking that their question and answer structure matches the schema expected by the backend.

### Quiz status

- `draft`: Not available to students.
- `published`: Available to eligible enrolled students.

Publishing validates that the questions have the correct-answer information needed for grading.

### Quiz model overview

The quiz model includes:

- `title`
- `topic`
- `classroom` reference
- `teacher` reference
- `questions`
- `difficulty`
- `source`
- `status`
- `totalMarks`
- timestamps

Supported difficulty values are `easy`, `medium`, `hard`, and `mixed`. Supported source values include `topic`, `study_material`, `pdf`, and `mixed`, according to the configured schema.

### Quiz attempt model overview

A quiz attempt stores:

- Quiz reference
- Student reference
- Submitted answers and question indexes
- Score and total marks
- Number of correct answers and total questions
- Submission time
- Timestamps

A unique quiz/student index prevents the same student from creating multiple attempts for the same quiz under the current implementation.

---

## 5. Persistent Quiz API Reference

All routes below are mounted under `/api/quizzes`.

Protected routes require:

The browser sends the HttpOnly access cookie automatically. The shared Axios client must use `withCredentials: true`; do not add a Bearer token header.

Use the teacher or student session created by the corresponding login. The backend verifies the role from the authenticated user record.

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| `POST` | `/api/quizzes` | Teacher | Save a quiz as draft or publish it during creation if valid |
| `GET` | `/api/quizzes/classrooms/:classroomId` | Teacher | List quizzes for a classroom the teacher owns |
| `PATCH` | `/api/quizzes/:quizId/publish` | Teacher | Publish a saved draft |
| `PATCH` | `/api/quizzes/:quizId/unpublish` | Teacher | Return a quiz to draft, subject to attempt restrictions |
| `GET` | `/api/quizzes/:quizId/results` | Teacher | Retrieve student attempts and results for a quiz |
| `GET` | `/api/quizzes/student/classrooms/:classroomId` | Enrolled student | List published quizzes without answer keys |
| `POST` | `/api/quizzes/:quizId/submit` | Enrolled student | Submit answers and receive the evaluated result |
| `GET` | `/api/quizzes/student/attempts` | Student | Retrieve the student's own quiz attempt history |

Replace `:classroomId` and `:quizId` with actual MongoDB ObjectIds. Do not send the literal placeholder strings.

### 5.1 Save a Quiz

**Method:** `POST`

**Endpoint:** `/api/quizzes`

**Access:** Teacher who owns the classroom.

Example JSON body:

```json
{
  "title": "Photosynthesis Quiz",
  "topic": "Photosynthesis",
  "classroomId": "<CLASSROOM_OBJECT_ID>",
  "difficulty": "easy",
  "source": "topic",
  "status": "draft",
  "totalMarks": 2,
  "questions": [
    {
      "question": "Where does photosynthesis occur?",
      "options": [
        "Mitochondria",
        "Chloroplast",
        "Nucleus",
        "Ribosome"
      ],
      "correctAnswer": "Chloroplast"
    },
    {
      "question": "Which gas do plants absorb?",
      "options": [
        "Oxygen",
        "Nitrogen",
        "Carbon dioxide",
        "Hydrogen"
      ],
      "correctAnswer": "Carbon dioxide"
    }
  ]
}
```

Save as `draft` first when the teacher still needs to review the questions. Use a valid answer key for every question before publishing.

### 5.2 List Teacher Quizzes

**Method:** `GET`

**Endpoint:** `/api/quizzes/classrooms/:classroomId`

Returns the quizzes belonging to the specified classroom, subject to teacher ownership checks.

### 5.3 Publish a Quiz

**Method:** `PATCH`

**Endpoint:** `/api/quizzes/:quizId/publish`

**Body:** None required.

The backend checks classroom ownership and validates that the quiz questions contain correct-answer information required for evaluation.

### 5.4 Unpublish a Quiz

**Method:** `PATCH`

**Endpoint:** `/api/quizzes/:quizId/unpublish`

**Body:** None required.

This changes a published quiz back to draft when the backend's restrictions allow it. The current implementation blocks unpublishing when the quiz already has student attempts.

### 5.5 Fetch Published Quizzes as a Student

**Method:** `GET`

**Endpoint:** `/api/quizzes/student/classrooms/:classroomId`

**Access:** Student enrolled in the classroom.

The response includes published quizzes and student-safe question data. Correct-answer fields must be removed from the student-facing response.

### 5.6 Submit a Quiz

**Method:** `POST`

**Endpoint:** `/api/quizzes/:quizId/submit`

**Access:** Enrolled student.

Example JSON body:

```json
{
  "answers": [
    {
      "questionIndex": 0,
      "selectedAnswer": "Chloroplast"
    },
    {
      "questionIndex": 1,
      "selectedAnswer": "Carbon dioxide"
    }
  ]
}
```

The backend checks quiz availability and classroom enrollment, evaluates submitted answers, calculates the score, and saves the attempt. The current implementation rejects duplicate attempts for the same student and quiz.

For a two-question quiz worth two marks, answering both questions correctly should produce `2/2`, assuming one mark per question under the configured scoring calculation.

### 5.7 Retrieve Student Attempt History

**Method:** `GET`

**Endpoint:** `/api/quizzes/student/attempts`

Returns the authenticated student's saved quiz attempts and related quiz information.

### 5.8 Retrieve Teacher Quiz Results

**Method:** `GET`

**Endpoint:** `/api/quizzes/:quizId/results`

Returns the saved attempts and results for a quiz belonging to the authenticated teacher's classroom.

---

## 6. Security and Validation

- Quiz creation, publishing, unpublishing, and result retrieval require teacher authorization and classroom ownership.
- Students must be enrolled in the classroom to access and submit