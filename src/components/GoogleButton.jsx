import { GoogleLogin } from "@react-oauth/google";

export default function GoogleButton({ 
  mode = "signin_with", 
  role = "student", 
  onSuccess, 
  onError, 
  disabled 
}) {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();

  if (!clientId) {
    return (
      <p role="status" className="text-center text-xs text-rose-500 py-2">
        Google sign-in is not configured. Set VITE_GOOGLE_CLIENT_ID in .env.
      </p>
    );
  }

  const handleSuccess = (credentialResponse) => {
    if (typeof onSuccess === "function") {
      onSuccess(credentialResponse, role);
    }
  };

  return (
    <div className={`w-full flex justify-center items-center ${disabled ? "pointer-events-none opacity-60" : ""}`}>
      <GoogleLogin
        text={mode}
        theme="outline"
        size="large"
        shape="rectangular"
        width="320"
        onSuccess={handleSuccess}
        onError={onError || (() => console.error("Google Login Failed"))}
        useOneTap={false}
      />
    </div>
  );
}