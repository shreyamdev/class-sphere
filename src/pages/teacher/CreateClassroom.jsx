import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Users, Plus, Copy, Check, ArrowRight, AlertCircle } from 'lucide-react';
import Topbar from '../../components/Topbar';
import HeroBanner from '../../components/HeroBanner';
import { createClassroom } from '../../services/classroomService';

export default function CreateClassroom() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    semester: '',
    description: '',
    courseStartDate: '',
  });

  const [createdClass, setCreatedClass] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const displayCode = createdClass?.classCode || createdClass?.code || '------';

  const handleCopy = () => {
    if (!createdClass) return;
    navigator.clipboard.writeText(displayCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Please provide a classroom name.');
      return;
    }

    setLoading(true);
    setError('');

    try {

      const fullDescription = [
        formData.subject ? `Subject: ${formData.subject}` : '',
        formData.semester ? `Semester: ${formData.semester}` : '',
        formData.description || '',
      ].filter(Boolean).join(' • ');

      const classroomData = await createClassroom({
        name: formData.name.trim(),
        description: fullDescription || 'No description provided.',
        courseStartDate: formData.courseStartDate
          ? new Date(`${formData.courseStartDate}T00:00:00`).toISOString()
          : undefined,
      });

      setCreatedClass(classroomData);
    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.message ||
        'Failed to create classroom. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 dashboard-stagger max-w-6xl mx-auto">
      <Topbar
        title="Create classroom"
        subtitle="Set up a new cohort and generate a unique join code for students."
        backFallbackPath="/teacher/dashboard"
      />
      <HeroBanner
        variant="navy"
        eyebrow="CLASSROOM CREATOR"
        title="Start a new classroom"
        subtitle="Create your cohort, share the join code, and give students access to class materials and assignments."
        icons={[BookOpen, Users, Plus]}
      />

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

{createdClass && (
        <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
              🎉 Classroom created successfully!
            </p>
            <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">
              Share the code below with your students so they can enroll.
            </p>
          </div>
          <button
            onClick={() => navigate('/teacher/dashboard')}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition"
          >
            Go to Dashboard <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        <form
          onSubmit={handleSubmit}
          className="lg:col-span-2 bg-white dark:bg-[#121214] border border-[#e5e7eb] dark:border-[#1f1f23] rounded-2xl p-6 space-y-4 shadow-sm"
        >
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Classroom Details
          </h3>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Classroom Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Data Structures & Algorithms"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-[#f8f9fa] dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#fde047]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Subject / Discipline
              </label>
              <input
                type="text"
                placeholder="e.g. Computer Science"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                className="w-full bg-[#f8f9fa] dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#fde047]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Semester / Section
              </label>
              <input
                type="text"
                placeholder="e.g. 3rd Semester, Section A"
                value={formData.semester}
                onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                className="w-full bg-[#f8f9fa] dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#fde047]"
              />
            </div>
          </div>

          <div>
            <label htmlFor="course-start-date" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Course start date <span className="text-slate-400">(optional)</span>
            </label>
            <input
              id="course-start-date"
              type="date"
              value={formData.courseStartDate}
              onChange={(e) => setFormData({ ...formData, courseStartDate: e.target.value })}
              className="w-full bg-[#f8f9fa] dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#fde047]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Course Description
            </label>
            <textarea
              rows="3"
              placeholder="e.g. Arrays, linked lists, stacks, queues and trees with weekly lab assessments."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full bg-[#f8f9fa] dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#fde047]"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 rounded-xl bg-[#181829] hover:bg-black text-white text-xs font-bold transition shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating Classroom...' : 'Create Classroom'}
            </button>
          </div>
        </form>

<div className="space-y-4">
          <div className="bg-[#181829] text-white rounded-2xl p-6 text-center space-y-3 shadow-sm border border-slate-800">
            <p className="text-xs text-slate-400 font-medium">
              {createdClass ? 'Active Classroom Join Code' : 'Join Code (Generated on submit)'}
            </p>
            <p className="text-4xl font-mono font-black tracking-widest text-[#fde047]">
              {displayCode}
            </p>
            <button
              type="button"
              onClick={handleCopy}
              disabled={!createdClass}
              className="px-4 py-2 rounded-xl bg-[#fde047] text-slate-950 text-xs font-bold hover:bg-amber-400 transition flex items-center justify-center gap-1.5 mx-auto disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-700" /> Copied!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" /> Copy Code
                </>
              )}
            </button>
          </div>

<div className="bg-white dark:bg-[#121214] border border-[#e5e7eb] dark:border-[#1f1f23] rounded-2xl p-5 space-y-3">
            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              How Students Join
            </h4>
            <ol className="text-xs text-slate-600 dark:text-slate-400 space-y-2 list-decimal list-inside leading-relaxed">
              <li>Copy the 6-character code above.</li>
              <li>Share it in your lecture or group chat.</li>
              <li>Students enter it in their portal to enroll.</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
