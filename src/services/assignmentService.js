import api from "./api";
import { toApiError } from "./apiError";


export async function createAssignment(
  classroomId,
  { title, description, dueDate, maxMarks, questionPdf }
) {
  try {
    const payload = {
      title,
      description: description ?? "",
      dueDate,
      maxMarks: Number(maxMarks ?? 20),
    };
    const requestBody = questionPdf
      ? (() => {
        const formData = new FormData();
        Object.entries(payload).forEach(([key, value]) => formData.append(key, String(value)));
        formData.append("file", questionPdf);
        return formData;
      })()
      : payload;
    const response = await api.post(
      `/classrooms/${classroomId}/assignments`,
      requestBody
    );
    return response.data?.data ?? response.data;
  } catch (error) {
    throw toApiError(error);
  }
}

export async function fetchAssignmentPdf(assignmentId, submissionId) {
  const path = submissionId
    ? `/assignments/${assignmentId}/submissions/${submissionId}/attachment`
    : `/assignments/${assignmentId}/attachment`;
  try {
    let response;
    try {
      response = await api.get(path, { responseType: "blob" });
    } catch (error) {
      if (submissionId && error?.response?.status === 404) {
        response = await api.get(
          `/assignments/${assignmentId}/submissions/${submissionId}/file`,
          { responseType: "blob" }
        );
      } else {
        throw error;
      }
    }
    if (!(response.data instanceof Blob) || response.data.size === 0) {
      throw new Error("The server returned an empty PDF response.");
    }
    if (response.data.type && !["application/pdf", "application/octet-stream"].includes(response.data.type)) {
      throw new Error("The server did not return a valid PDF.");
    }
    const signature = await response.data.slice(0, 5).arrayBuffer();
    if (new TextDecoder().decode(signature) !== "%PDF-") {
      throw new Error("The server did not return a valid PDF.");
    }
    return response.data;
  } catch (error) {
    throw toApiError(error);
  }
}

export async function getClassroomAssignments(classroomId) {
  try {
    const response = await api.get(`/classrooms/${classroomId}/assignments`);
    const payload = response.data?.data ?? response.data;
    return Array.isArray(payload) ? payload : payload?.assignments ?? [];
  } catch (error) {
    throw toApiError(error);
  }
}

export async function submitAssignment(
  assignmentId,
  { answerText, submissionUrl, solutionPdf }
) {
  try {
    const payload = { answerText, submissionUrl };
    let requestBody = payload;
    if (solutionPdf) {
      requestBody = new FormData();
      requestBody.append("answerText", answerText);
      requestBody.append("submissionUrl", submissionUrl);
      requestBody.append("file", solutionPdf);
    }
    const response = await api.post(
      `/assignments/${assignmentId}/submit`,
      requestBody
    );
    return response.data?.data?.submission ?? response.data?.data ?? response.data;
  } catch (error) {
    throw toApiError(error);
  }
}

export async function getMyAssignmentSubmission(assignmentId) {
  try {
    const response = await api.get(`/assignments/${assignmentId}/my-submission`);
    return response.data?.data ?? response.data;
  } catch (error) {
    throw toApiError(error);
  }
}

export async function getAssignmentSubmissions(assignmentId) {
  try {
    const response = await api.get(`/assignments/${assignmentId}/submissions`);
    const payload = response.data?.data ?? response.data;
    return Array.isArray(payload) ? payload : payload?.submissions ?? [];
  } catch (error) {
    throw toApiError(error);
  }
}

export async function gradeAssignmentSubmission(
  assignmentId,
  submissionId,
  { marksObtained, feedback }
) {
  try {
    const response = await api.patch(
      `/assignments/${assignmentId}/submissions/${submissionId}/grade`,
      { marksObtained: Number(marksObtained), feedback }
    );
    return response.data?.data?.submission ?? response.data?.data ?? response.data;
  } catch (error) {
    throw toApiError(error);
  }
}