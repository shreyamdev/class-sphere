import { useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { linksByRole } from "../data/navLinks";
import { useAuth } from "../context/authContext";

function Brand() {
  return (
    <h1 className="px-3 py-3 text-2xl font-extrabold tracking-tight">
      Class<span className="text-brand">Sphere</span>
    </h1>
  );
}

function NavigationLinks({ links, onNavigate }) {
  return (
    <nav className="mt-3 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
      {links.map(({ label, to, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
              isActive
                ? "bg-brand text-on-brand shadow-[0_5px_18px_rgba(255,224,77,0.22)]"
                : "text-white/70 hover:bg-white/10 hover:text-white"
            }`
          }
        >
          <Icon size={16} />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

function HelpCenter({ onHelpClick }) {
  return (
    <div className="mt-3 shrink-0 rounded-2xl border border-white/15 bg-white/[0.08] p-3 text-center">
      <p className="text-xs font-bold">Help center</p>
      <p className="mt-0.5 text-xs text-white/65">Have a problem? Send us a message.</p>
      <button
        type="button"
        onClick={onHelpClick}
        className="mt-2 w-full rounded-lg bg-white/90 py-1.5 text-xs font-bold text-on-brand transition hover:bg-white"
      >
        Go to help center
      </button>
    </div>
  );
}

export default function Sidebar({
  role = "student",
  mobileOpen = false,
  onMobileClose,
  onHelpClick,
}) {
  const links = linksByRole[role] ?? [];
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = async () => {
    onMobileClose?.();
    await logout();
    navigate("/", { replace: true });
  };

  useEffect(() => {
    if (!mobileOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onMobileClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [mobileOpen, onMobileClose]);

  return (
    <>
      <aside className="glass-sidebar sticky top-3 mx-3 my-3 hidden h-[calc(100vh-1.5rem)] w-64 shrink-0 flex-col rounded-3xl p-3 text-white lg:flex">
        <Brand />
        <NavigationLinks links={links} />
        <HelpCenter onHelpClick={onHelpClick} />
        <button
          type="button"
          onClick={handleLogout}
          className="mt-3 flex w-full shrink-0 items-center justify-center rounded-xl px-3 py-2.5 text-sm font-bold text-red-400 transition hover:bg-white/10 hover:text-red-300"
        >
          Logout
        </button>
      </aside>

      {mobileOpen && (
        <div className="lg:hidden">
          <button
            type="button"
            aria-label="Close navigation menu"
            className="fixed inset-0 z-40 bg-black/45 backdrop-blur-sm"
            onClick={onMobileClose}
          />
          <aside
            id="mobile-navigation"
            role="dialog"
            aria-modal="true"
            aria-label="Main navigation"
            className="glass-sidebar fixed inset-y-3 left-3 z-50 flex w-[min(18rem,calc(100vw-1.5rem))] flex-col rounded-3xl p-3 text-white shadow-2xl lg:hidden"
          >
            <div className="flex items-center justify-between">
              <Brand />
              <button
                type="button"
                aria-label="Close navigation menu"
                onClick={onMobileClose}
                className="grid h-10 w-10 place-items-center rounded-xl text-white/80 transition hover:bg-white/10 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
            <NavigationLinks links={links} onNavigate={onMobileClose} />
            <HelpCenter onHelpClick={onHelpClick} />
            <button
              type="button"
              onClick={handleLogout}
              className="mt-3 flex w-full shrink-0 items-center justify-center rounded-xl px-3 py-2.5 text-sm font-bold text-red-400 transition hover:bg-white/10 hover:text-red-300"
            >
              Logout
            </button>
          </aside>
        </div>
      )}
    </>
  );
}