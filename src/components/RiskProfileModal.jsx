import { useState } from "react";
import { X } from "lucide-react";
import Card from "./Card";
import { updateTeacherStudentRiskProfile } from "../services/analyticsService";

const choices = {
  code_module: ["AAA", "BBB", "CCC", "DDD", "EEE", "FFF", "GGG"],
  code_presentation: ["2013B", "2013J", "2014B", "2014J"],
  gender: ["M", "F"],
  region: ["East Anglian Region", "East Midlands Region", "Ireland", "London Region", "North Region", "North Western Region", "Scotland", "South East Region", "South Region", "South West Region", "Wales", "West Midlands Region", "Yorkshire Region"],
  highest_education: ["No Formal quals", "Lower Than A Level", "A Level or Equivalent", "HE Qualification", "Post Graduate Qualification"],
  imd_band: ["0-10", "10-20", "20-30", "30-40", "40-50", "50-60", "60-70", "70-80", "80-90", "90-100", "unknown"],
  age_band: ["0-35", "35-55", "55<="] ,
  disability: ["Y", "N"],
};

const initialProfile = {
  num_of_prev_attempts: "0",
  studied_credits: "",
  date_registration: "",
  date_unregistration: "",
  total_clicks: "",
  active_days: "",
  resources_visited: "",
  clicks_last_30_days: "",
  code_module: "AAA",
  code_presentation: "2014J",
  gender: "M",
  region: "East Anglian Region",
  highest_education: "A Level or Equivalent",
  imd_band: "20-30",
  age_band: "0-35",
  disability: "N",
};

export default function RiskProfileModal({ classroomId, student, onClose, onSaved }) {
  const [profile, setProfile] = useState(initialProfile);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const update = (field) => (event) => {
    setProfile((current) => ({ ...current, [field]: event.target.value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");

    const integerFields = ["num_of_prev_attempts", "studied_credits", "total_clicks", "active_days", "resources_visited", "clicks_last_30_days"];
    const payload = {};
    for (const field of integerFields) payload[field] = Number(profile[field]);
    payload.date_registration = Number(profile.date_registration);
    payload.date_unregistration = profile.date_unregistration === "" ? null : Number(profile.date_unregistration);
    for (const field of Object.keys(choices)) payload[field] = profile[field];

    try {
      await updateTeacherStudentRiskProfile(classroomId, student.id, payload);
      onSaved?.();
      onClose?.();
    } catch (saveError) {
      setError(saveError.message || "Could not save the risk profile.");
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink";
  const integerInput = (field, label) => (
    <label key={field} className="block text-xs font-bold">
      {label}
      <input type="number" min="0" step="1" required={field !== "num_of_prev_attempts"} value={profile[field]} onChange={update(field)} className={`${inputClass} mt-1`} />
    </label>
  );

  if (!student) return null;

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/60 p-4">
      <Card role="dialog" aria-modal="true" aria-labelledby="risk-profile-title" className="max-h-[90vh] w-full max-w-3xl overflow-y-auto p-5">
        <div className="flex items-start justify-between gap-3 border-b border-line pb-4">
          <div>
            <h2 id="risk-profile-title" className="text-lg font-extrabold">Configure ML profile</h2>
            <p className="mt-1 text-xs text-muted">{student.name} · {student.email}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close risk profile form" className="rounded-lg p-2 text-muted hover:bg-soft"><X size={18} /></button>
        </div>

        <form onSubmit={submit} className="mt-4 space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {integerInput("num_of_prev_attempts", "Previous attempts")}
            {integerInput("studied_credits", "Studied credits")}
            <label className="block text-xs font-bold">Date registration
              <input type="number" required value={profile.date_registration} onChange={update("date_registration")} className={`${inputClass} mt-1`} />
            </label>
            <label className="block text-xs font-bold">Date unregistration <span className="font-normal text-muted">(optional)</span>
              <input type="number" value={profile.date_unregistration} onChange={update("date_unregistration")} placeholder="Leave blank if not unregistered" className={`${inputClass} mt-1`} />
            </label>
            {integerInput("total_clicks", "Total clicks")}
            {integerInput("active_days", "Active days")}
            {integerInput("resources_visited", "Resources visited")}
            {integerInput("clicks_last_30_days", "Clicks from day 61–90 / last 30 days")}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {Object.entries(choices).map(([field, values]) => (
              <label key={field} className="block text-xs font-bold">
                {field.replaceAll("_", " ")}
                <select value={profile[field]} onChange={update(field)} className={`${inputClass} mt-1`}>
                  {values.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
            ))}
          </div>

          <p className="rounded-xl bg-soft p-3 text-xs text-muted">Use real classroom context and model-compatible categories. Do not generate fake click or activity values. Risk predictions are decision-support estimates.</p>
          {error && <p role="alert" className="text-sm font-semibold text-tone-red-fg">{error}</p>}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-line px-4 py-2 text-sm font-bold">Cancel</button>
            <button type="submit" disabled={saving} className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-on-brand disabled:opacity-50">{saving ? "Saving..." : "Save profile"}</button>
          </div>
        </form>
      </Card>
    </div>
  );
}
