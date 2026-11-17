import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, Send, Trash2, AlertCircle, CheckCircle2, 
  Megaphone, Calendar, FolderOpen, RefreshCw, Plus
} from 'lucide-react';
import Topbar from '../../components/Topbar';
import HeroBanner from '../../components/HeroBanner';
import { fetchMyClassrooms } from '../../services/classroomService';
import {
  createAnnouncement,
  deleteAnnouncement,
  getClassroomAnnouncements,
} from '../../services/announcementService';

export default function Announcements() {
  const navigate = useNavigate();

  const [classrooms, setClassrooms] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [announcements, setAnnouncements] = useState([]);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const [loading, setLoading] = useState(false);
  const [classroomsLoading, setClassroomsLoading] = useState(true);
  const [feedLoading, setFeedLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const loadClassrooms = async () => {
    setClassroomsLoading(true);
    setErrorMsg('');

    try {
      const list = await fetchMyClassrooms();
      setClassrooms(list);

      if (list.length > 0) {
        setSelectedClassId((prev) => prev || list[0]._id || list[0].id);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Could not load your classrooms.');
    } finally {
      setClassroomsLoading(false);
    }
  };

  useEffect(() => {
    Promise.resolve().then(loadClassrooms);
  }, []);

  const loadAnnouncements = async (classroomId) => {
    if (!classroomId) return;
    setFeedLoading(true);

    try {
      setAnnouncements(await getClassroomAnnouncements(classroomId));
    } catch (err) {
      setErrorMsg(err.message || 'Could not load announcements.');
      setAnnouncements([]);
    } finally {
      setFeedLoading(false);
    }
  };

  useEffect(() => {
    if (selectedClassId) {
      Promise.resolve().then(() => loadAnnouncements(selectedClassId));
    }
  }, [selectedClassId]);

  const handlePost = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!selectedClassId) {
      setErrorMsg('Please select a classroom first.');
      return;
    }
    if (!title.trim() || !content.trim()) {
      setErrorMsg('Please enter both a title and message content.');
      return;
    }

    setLoading(true);
    try {
      await createAnnouncement(selectedClassId, {
        title: title.trim(),
        content: content.trim(),
      });

      setSuccessMsg('Announcement broadcasted to all enrolled students!');
      setTitle('');
      setContent('');
      await loadAnnouncements(selectedClassId);
    } catch (err) {
      setErrorMsg(
        err.response?.data?.message || err.message || 'Failed to post announcement.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (announcementId) => {
    if (!window.confirm('Delete this announcement? Students will no longer see it.')) return;

    try {
      await deleteAnnouncement(announcementId);
      setAnnouncements((prev) => prev.filter((a) => (a._id || a.id) !== announcementId));
      setSuccessMsg('Announcement deleted.');
    } catch (err) {
      setErrorMsg(err.message || 'Failed to delete announcement.');
    }
  };

  return (
    <div className="space-y-6 dashboard-stagger max-w-6xl mx-auto">
      <Topbar
        title="Class announcements"
        subtitle="Broadcast updates, assignment deadlines, and reminders to your students."
        backFallbackPath="/teacher/dashboard"
      />
      <HeroBanner
        variant="navy"
  eyebrow="KEEP EVERYONE INFORMED"
        title="Share an update with your students"
        subtitle="Choose a classroom and post important news, reminders, and schedule changes."
        icons={[Megaphone, Bell, Calendar]}
      />

      {/* Alerts */}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Composer Card */}
        <form
          onSubmit={handlePost}
          className="bg-white dark:bg-[#121214] border border-[#e5e7eb] dark:border-[#1f1f23] rounded-2xl p-6 space-y-4 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              New Announcement
            </h3>
            <button
              type="button"
              onClick={loadClassrooms}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-semibold flex items-center gap-1"
              title="Refresh classrooms list"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${classroomsLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Select Classroom <span className="text-rose-500">*</span>
              </label>
              {classrooms.length === 0 && (
                <button
                  type="button"
                  onClick={() => navigate('/teacher/create-class')}
                  className="text-xs font-bold text-[#facc15] hover:underline flex items-center gap-0.5"
                >
                  <Plus className="w-3 h-3" /> Create Classroom
                </button>
              )}
            </div>

            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              disabled={classroomsLoading || classrooms.length === 0}
              className="w-full bg-[#f8f9fa] dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#fde047] disabled:opacity-60"
            >
              {classroomsLoading ? (
                <option value="">Loading your classrooms...</option>
              ) : classrooms.length === 0 ? (
                <option value="">No classrooms found. Create one first.</option>
              ) : (
                classrooms.map((c) => (
                  <option key={c._id || c.id} value={c._id || c.id}>
                    {c.name} ({c.classCode || c.code || 'Cohort'})
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Lab Session Rescheduled to Friday"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-[#f8f9fa] dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#fde047]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Message / Content <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows="4"
              required
              placeholder="Write your announcement details here..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full bg-[#f8f9fa] dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#fde047]"
            />
          </div>

          <button
            type="submit"
            disabled={loading || classrooms.length === 0}
            className="px-6 py-2.5 rounded-xl bg-[#fde047] hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-2 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-3.5 h-3.5" />
            {loading ? 'Broadcasting...' : 'Post Announcement'}
          </button>
        </form>

        {/* Posted Announcements Feed */}
        <div className="bg-white dark:bg-[#121214] border border-[#e5e7eb] dark:border-[#1f1f23] rounded-2xl p-6 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Posted Announcements ({announcements.length})
            </h3>

            {feedLoading ? (
              <p className="text-xs text-slate-400 py-8 text-center">Loading feed...</p>
            ) : announcements.length === 0 ? (
              <div className="text-center py-12 space-y-2">
                <FolderOpen className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto" />
                <p className="text-xs text-slate-500">No announcements posted for this classroom yet.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1 divide-y divide-slate-100 dark:divide-slate-800">
                {announcements.map((item) => {
                  const id = item._id || item.id;
                  const dateStr = item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'Recent';

                  return (
                    <div key={id} className="pt-3 first:pt-0 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                          {item.title}
                        </h4>
                        <button
                          onClick={() => handleDelete(id)}
                          className="text-slate-400 hover:text-rose-500 transition shrink-0 p-1"
                          title="Delete announcement"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        {item.content}
                      </p>

                      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                        <span>{dateStr}</span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          Sent to enrolled students
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}