

export function toApiError(error) {
  const body = error?.response?.data;

  const htmlText =
    typeof body === "string"
      ? body
          .match(/<pre[^>]*>([\s\S]*?)<\/pre>/i)?.[1]
          ?.replace(/<[^>]*>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
      : "";
  const missingRoute = htmlText.match(/^Cannot (GET|POST|PATCH|PUT|DELETE) (.+)$/i);

  let message =
    typeof body === "string"
      ? missingRoute
        ? `The backend does not have this route yet: ${missingRoute[1]} ${missingRoute[2]}. Deploy the matching API route and try again.`
        : htmlText || undefined
      : body?.message ?? body?.error ?? body?.errors?.[0]?.message;
  if (!message && typeof Blob !== "undefined" && body instanceof Blob) {
    const statusMessages = {
      401: "Your session is not authorized. Please log in again.",
      403: "You do not have permission to access this resource.",
      404: "The requested PDF was not found.",
      502: "PDF storage could not be reached. Please try again.",
    };
    message = statusMessages[error?.response?.status];
  }
  if (!message) {
    if (error?.code === "ECONNABORTED") {
      message = "The server took too long to respond. Please try again.";
    } else if (error?.request && !error?.response) {
      message = "Cannot reach the server. Check your internet connection and try again.";
    } else if (error?.response?.status) {
      message = `The server returned an error (${error.response.status}). Please try again.`;
    } else {
      message = error?.message || "Something went wrong. Please try again.";
    }
  }

  const apiError = new Error(message);
  apiError.code = body?.code ?? error?.code;
  apiError.status = error?.response?.status;
  return apiError;
}
