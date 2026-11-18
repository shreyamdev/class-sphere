import api from "./api";
import { toApiError } from "./apiError";

export async function submitSupportTicket({ role, category, subject, message }) {
  try {
    const response = await api.post("/support/tickets", {
      role,
      category,
      subject,
      message,
    });
    return response.data?.data ?? response.data;
  } catch (error) {
    throw toApiError(error);
  }
}
