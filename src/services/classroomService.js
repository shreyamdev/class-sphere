import api from "./api";
import { toApiError } from "./apiError";

const unwrap = (response) => response?.data?.data ?? response?.data;

function asList(payload, key) {
  const data = unwrap(payload);
  return Array.isArray(data) ? data : data?.[key] ?? [];
}

export const fetchMyClassrooms = async () => {
  try {
    return asList(await api.get("/classrooms"), "classrooms");
  } catch (error) {
    throw toApiError(error);
  }
};

export const createClassroom = async ({ name, description, courseStartDate }) => {
  try {
    const payload = { name, description };
    if (courseStartDate) payload.courseStartDate = courseStartDate;
    const classroom = unwrap(
      await api.post("/classrooms", payload)
    );
    return classroom?.classroom ?? classroom;
  } catch (error) {
    throw toApiError(error);
  }
};

export const joinClassroom = async (classCode) => {
  try {
    return unwrap(await api.post("/classrooms/join", { classCode }));
  } catch (error) {
    throw toApiError(error);
  }
};

export const fetchClassroomDetails = async (classroomId) => {
  try {
    return unwrap(await api.get(`/classrooms/${classroomId}`));
  } catch (error) {
    throw toApiError(error);
  }
};

export const updateClassroom = async (classroomId, data) => {
  try {
    return unwrap(await api.patch(`/classrooms/${classroomId}`, data));
  } catch (error) {
    throw toApiError(error);
  }
};

export const removeStudentFromClassroom = async (classroomId, studentId) => {
  try {
    return unwrap(
      await api.delete(`/classrooms/${classroomId}/students/${studentId}`)
    );
  } catch (error) {
    throw toApiError(error);
  }
};

export const leaveClassroom = async (classroomId) => {
  try {
    return unwrap(await api.post(`/classrooms/${classroomId}/leave`));
  } catch (error) {
    throw toApiError(error);
  }
};

export const deleteClassroom = async (classroomId) => {
  try {
    return unwrap(await api.delete(`/classrooms/${classroomId}`));
  } catch (error) {
    throw toApiError(error);
  }
};

export { asList, unwrap };
