import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import AuthLayout from "../../layouts/AuthLayout";
import FormField from "../../components/FormField";
import RoleToggle from "../../components/RoleToggle";
import GoogleButton from "../../components/GoogleButton";
import ServerWakeHint from "../../components/ServerWakeHint";
import { useAuth } from "../../context/authContext";
import { getHomePath } from "../../utils/roleHome";
import { registerRequest } from "../../services/authService";
import { isValidEmail } from "../../utils/validators";

const MIN_PASSWORD = 8;

export default function Register() {
  const navigate = useNavigate();
  const { loginWithGoogle } = useAuth();

  const [role, setRole] = useState("student");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [showNextSteps, setShowNextSteps] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const next = {};
    if (name.trim().length < 2) next.name = "Enter your full name.";
    if (!isValidEmail(email)) next.email = "Enter a valid email address.";
    if (password.length < MIN_PASSWORD) {
      next.password = `Password must be at least ${MIN_PASSWORD} characters.`;
    }
    if (confirm !== password) next.confirm = "Passwords do not match.";

    setErrors(next);
    setFormError("");
    setShowNextSteps(false);
    if (Object.keys(next).length > 0) return;

    setLoading(true);
    try {
      await registerRequest({ name: name.trim(), email: email.trim(), password, role });

      navigate("/verify-otp", { state: { email: email.trim(), justSent: true } });
    } catch (err) {
      setFormError(err.message);

setShowNextSteps(err.status === 409 || !err.status);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async ({ credential }) => {
    if (!credential) {
      setFormError("Google did not return an ID token. Please try again.");
      return;
    }

    setFormError("");
    setLoading(true);
    try {
      const user = await loginWithGoogle(credential, role);
      navigate(getHomePath(user.role), { replace: true });
    } catch (err) {
      setFormError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout role={role}>
      <h1 className="text-2xl font-extrabold">Create your account</h1>
      <p className="mt-1 text-sm text-muted">Join ClassSphere as a student or a teacher</p>

      <div className="mt-5">
        <RoleToggle value={role} onChange={setRole} />
      </div>

      <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-3.5">
        <FormField
          label="Full name"
          autoComplete="name"
          placeholder="Your full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
        />

        <FormField
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@college.edu"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
        />

        <FormField
          label="Password"
          type="password"
          autoComplete="new-password"
          placeholder="Create a password"
          hint={`At least ${MIN_PASSWORD} characters`}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
        />

        <FormField
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          placeholder="Re-enter your password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={errors.confirm}
        />

        {formError && (
          <p role="alert" className="rounded-xl bg-tone-red px-3 py-2 text-xs font-semibold text-tone-red-fg">
            {formError}
          </p>
        )}

        {showNextSteps && (
          <div className="space-y-1 text-xs text-muted">
            <p>
              The account may have been created even though the request timed out. Check your spam
              folder, then{" "}
              <Link
                to="/verify-otp"
                state={{ email: email.trim() }}
                className="font-bold text-ink hover:underline"
              >
                verify your email or resend the code
              </Link>
              . Avoid submitting registration again.
            </p>
            <p>
              Already verified?{" "}
              <Link
                to="/login"
                state={{ email: email.trim() }}
                className="font-bold text-ink hover:underline"
              >
                Login
              </Link>
              .
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-panel py-3 text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Creating account..." : `Create ${role} account`}
        </button>
        <ServerWakeHint active={loading} />
      </form>

      <div className="my-4 flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-line" />
        or
        <span className="h-px flex-1 bg-line" />
      </div>

      <GoogleButton
        mode="signup_with"
        role={role}
        onSuccess={handleGoogleSuccess}
        onError={() => setFormError("Google sign-up failed. Please try again.")}
        disabled={loading}
      />
      <p className="mt-2 text-center text-xs text-muted">
        New Google accounts use the selected role. Existing accounts keep their saved role.
      </p>

      <p className="mt-5 text-center text-xs text-muted">
        Already have an account?{" "}
        <Link to="/login" className="font-bold text-ink hover:underline">
          Login
        </Link>
      </p>
    </AuthLayout>
  );
}
