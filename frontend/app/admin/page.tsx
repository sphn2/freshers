"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ProtectedRoute, useAuth } from "@/lib/auth";
import { errorMessage } from "@/lib/types";
import { registrationAvailability } from "@/lib/registration";
import type {
  AuditLog,
  DashboardMetrics,
  Event,
  EventCreateInput,
  EventStatus,
  ReportRow,
} from "@/lib/types";
import {
  LayoutDashboard, ShieldCheck, DollarSign, Users, Ticket, Activity,
  FileSpreadsheet, Plus, RefreshCw, CheckCircle2, QrCode,
  CreditCard, Banknote, Settings, AlertCircle, Pause, Play, CalendarClock,
  UserRoundPlus
} from "lucide-react";

export default function AdminDashboardPage() {
  return (
    <ProtectedRoute allowedRoles={["ADMIN", "EVENT_MANAGER"]}>
      <AdminDashboardContent />
    </ProtectedRoute>
  );
}

type Tab = "overview" | "registrations" | "payments" | "entries" | "offline" | "audit" | "events" | "accounts";

function AdminDashboardContent() {
  const { role } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [reportData, setReportData] = useState<ReportRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Event Create Form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState<EventCreateInput>({
    title: "", slug: "", description: "", venue: "", event_type: "CULTURAL",
    start_time: "", end_time: "", registration_start: "", registration_end: "",
    capacity: 500, ticket_price: 250, allow_online: true, allow_offline: true,
    first_year_ticket_price: 500, second_year_ticket_price: 600, other_ticket_price: null,
    gate_validation_enabled: true, food_validation_enabled: true, status: "DRAFT"
  });
  const [editingPricesEventId, setEditingPricesEventId] = useState<string | null>(null);
  const [priceDraft, setPriceDraft] = useState({
    first_year_ticket_price: 500,
    second_year_ticket_price: 600,
    other_ticket_price: null as number | null,
  });
  const [savingPrices, setSavingPrices] = useState(false);
  const [creating, setCreating] = useState(false);
  const [staffForm, setStaffForm] = useState({
    full_name: "",
    email: "",
    password: "",
    role: "GATE_STAFF" as "EVENT_MANAGER" | "GATE_STAFF" | "FOOD_STAFF",
    event_id: "",
  });
  const [creatingStaff, setCreatingStaff] = useState(false);
  const [secureContext, setSecureContext] = useState(false);

  useEffect(() => {
    setSecureContext(
      window.isSecureContext ||
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1"
    );
  }, []);

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    if (activeTab !== "overview" && activeTab !== "events" && activeTab !== "accounts") {
      loadReport(activeTab);
    } else if (activeTab === "events") {
      loadEvents();
    }
  }, [activeTab, selectedEventId]);

  const loadDashboard = async (requestedEventId = selectedEventId) => {
    setLoading(true);
    try {
      const eventData = await api.adminListEvents();
      setEvents(eventData.events);
      let eventId = requestedEventId;
      if (role === "EVENT_MANAGER" && !eventId) {
        eventId = eventData.events[0]?.id || "";
        if (eventId) setSelectedEventId(eventId);
      }
      if (role === "EVENT_MANAGER" && !eventId) {
        setMetrics(null);
        setAuditLogs([]);
        setStatusMsg("No events are assigned to your account.");
        return;
      }
      const mData = await api.getAdminMetrics(eventId || undefined);
      setMetrics(mData);
      if (role === "ADMIN") {
        const logsData = await api.getAuditLogs(20);
        setAuditLogs(logsData.audit_logs);
      } else {
        setAuditLogs([]);
      }
      setStatusMsg(null);
    } catch (err: unknown) {
      setStatusMsg(`❌ ${errorMessage(err, "Failed loading admin dashboard.")}`);
    } finally {
      setLoading(false);
    }
  };

  const loadEvents = async () => {
    try {
      const data = await api.adminListEvents();
      setEvents(data.events);
    } catch (err: unknown) {
      setStatusMsg(`❌ ${errorMessage(err, "Failed loading events.")}`);
    }
  };

  const loadReport = async (tab: Tab) => {
    setReportLoading(true);
    try {
      let data: ReportRow[] = [];
      const eid = selectedEventId || undefined;
      if (tab === "registrations") {
        const r = await api.getRegistrationsReport(eid);
        data = r.registrations || [];
      } else if (tab === "payments") {
        const r = await api.getPaymentsReport(eid);
        data = r.payments || [];
      } else if (tab === "entries") {
        const r = await api.getEntriesReport(eid);
        data = r.entries || [];
      } else if (tab === "offline") {
        const r = await api.getOfflineReport(eid);
        data = r.offline_collections || [];
      } else if (tab === "audit") {
        const r = await api.getAuditLogs(200);
        data = r.audit_logs.map((log) => ({ ...log }));
        setAuditLogs(r.audit_logs);
      }
      setReportData(data);
      setStatusMsg(null);
    } catch (err: unknown) {
      setStatusMsg(`❌ ${errorMessage(err, `Failed loading ${tab} report.`)}`);
    } finally {
      setReportLoading(false);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setStatusMsg(null);
    try {
      const payload = {
        ...createForm,
        start_time: createForm.start_time ? new Date(createForm.start_time).toISOString() : "",
        end_time: createForm.end_time ? new Date(createForm.end_time).toISOString() : "",
        registration_start: createForm.registration_start ? new Date(createForm.registration_start).toISOString() : "",
        registration_end: createForm.registration_end ? new Date(createForm.registration_end).toISOString() : "",
      };
      await api.createEvent(payload);
      setStatusMsg("✅ Event created successfully!");
      setShowCreateForm(false);
      loadEvents();
      setCreateForm({
        title: "", slug: "", description: "", venue: "", event_type: "CULTURAL",
        start_time: "", end_time: "", registration_start: "", registration_end: "",
        capacity: 500, ticket_price: 250, allow_online: true, allow_offline: true,
        first_year_ticket_price: 500, second_year_ticket_price: 600, other_ticket_price: null,
        gate_validation_enabled: true, food_validation_enabled: true, status: "DRAFT"
      });
    } catch (err: unknown) {
      setStatusMsg(`❌ ${errorMessage(err, "Failed creating event.")}`);
    } finally {
      setCreating(false);
    }
  };

  const handleStatusChange = async (eventId: string, newStatus: EventStatus) => {
    try {
      await api.updateEvent(eventId, { status: newStatus });
      setStatusMsg(`✅ Event status updated to ${newStatus}`);
      loadEvents();
    } catch (err: unknown) {
      setStatusMsg(`❌ ${errorMessage(err, "Status update failed.")}`);
    }
  };

  const handleRegistrationToggle = async (event: Event) => {
    const reopenLegacyClosed = event.status === "REGISTRATION_CLOSED";
    const nextOpen = !registrationAvailability(event).open;
    try {
      await api.updateEvent(event.id, {
        ...(reopenLegacyClosed ? { status: "PUBLISHED" as const } : {}),
        registration_open: nextOpen,
      });
      setStatusMsg(nextOpen ? "✅ Registration opened manually." : "✅ Registration closed immediately.");
      await loadEvents();
    } catch (err: unknown) {
      setStatusMsg(`❌ ${errorMessage(err, "Could not update registration access.")}`);
    }
  };

  const handleSaveEventPrices = async (eventId: string) => {
    setSavingPrices(true);
    setStatusMsg(null);
    try {
      await api.updateEvent(eventId, priceDraft);
      setEditingPricesEventId(null);
      setStatusMsg("✅ Year-specific event prices updated.");
      await loadEvents();
    } catch (err: unknown) {
      setStatusMsg(`❌ ${errorMessage(err, "Could not update event prices.")}`);
    } finally {
      setSavingPrices(false);
    }
  };

  const handleCreateStaffAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreatingStaff(true);
    setStatusMsg(null);
    try {
      const payload = {
        full_name: staffForm.full_name.trim(),
        email: staffForm.email.trim(),
        password: staffForm.password,
        role: staffForm.role,
        ...(staffForm.role === "EVENT_MANAGER" ? { event_id: staffForm.event_id } : {}),
      };
      const result = await api.createStaffAccount(payload);
      setStatusMsg(`✅ ${result.account.full_name} was created in Supabase Auth with the ${result.account.role.replaceAll("_", " ")} role.`);
      setStaffForm({ full_name: "", email: "", password: "", role: "GATE_STAFF", event_id: "" });
    } catch (err: unknown) {
      setStatusMsg(`❌ ${errorMessage(err, "Failed creating staff account.")}`);
    } finally {
      setCreatingStaff(false);
    }
  };

  const handleDownloadCSV = async () => {
    try {
      const blob = await api.downloadRegistrationsCsv(selectedEventId || undefined);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "sphoorthy_registrations.csv";
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err: unknown) {
      setStatusMsg(`❌ ${errorMessage(err, "Failed exporting registrations.")}`);
    }
  };

  const tabs: { key: Tab; label: string; icon: React.ReactNode; color: string }[] = [
    { key: "overview", label: "Overview", icon: <LayoutDashboard className="w-4 h-4" />, color: "text-pink-600" },
    { key: "events", label: "Events", icon: <Settings className="w-4 h-4" />, color: "text-blue-600" },
    { key: "accounts", label: "Staff accounts", icon: <UserRoundPlus className="w-4 h-4" />, color: "text-blue-700" },
    { key: "registrations", label: "Registrations", icon: <Users className="w-4 h-4" />, color: "text-slate-700" },
    { key: "payments", label: "Payments", icon: <CreditCard className="w-4 h-4" />, color: "text-emerald-600" },
    { key: "entries", label: "Gate Entries", icon: <QrCode className="w-4 h-4" />, color: "text-blue-600" },
    { key: "offline", label: "Offline Cash", icon: <Banknote className="w-4 h-4" />, color: "text-pink-600" },
    { key: "audit", label: "Audit Logs", icon: <Activity className="w-4 h-4" />, color: "text-rose-600" },
  ];
  const visibleTabs = role === "ADMIN"
    ? tabs
    : tabs.filter((tab) => tab.key !== "audit" && tab.key !== "accounts");

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 gap-3 text-slate-400 font-medium">
        <RefreshCw className="w-5 h-5 animate-spin text-pink-600" />
        <span>Loading Admin Operations Control...</span>
      </div>
    );
  }

  return (
    <div className="admin-dashboard space-y-7">
        {/* Header */}
        <div className="page-hero surface-grid flex flex-col justify-between gap-6 p-6 md:flex-row md:items-end md:p-8">
          <div className="relative z-10 max-w-xl">
            <p className="eyebrow !text-[#e5c86f]">Campus operations · Control room</p>
            <h1 className="editorial-title mt-3 text-4xl md:text-5xl">Make the day<br /><span className="italic text-[#e2bd55]">run smoothly.</span></h1>
            <p className="mt-3 text-xs leading-5 text-white/65">Events, registrations and the people who make them happen.</p>
          </div>
          <div className="relative z-10 flex flex-wrap gap-2">
            {events.length > 0 && (
              <select
                aria-label="Filter by event"
                value={selectedEventId}
                onChange={(event) => {
                  const eventId = event.target.value;
                  setSelectedEventId(eventId);
                  if (activeTab === "overview") void loadDashboard(eventId);
                }}
                className="field-control !min-h-10 !w-auto !border-white/25 !bg-white/10 !text-white"
              >
                {role === "ADMIN" && <option value="" className="text-slate-900">All events</option>}
                {events.map((event) => <option key={event.id} value={event.id} className="text-slate-900">{event.title}</option>)}
              </select>
            )}
            <button onClick={handleDownloadCSV} className="button-primary button-accent !min-h-10 !px-3 !text-[10px]">
              <FileSpreadsheet className="h-4 w-4" /><span>Export report</span>
            </button>
            <button onClick={() => void loadDashboard()} className="button-primary !min-h-10 !border-white/25 !bg-white/10 !px-3 !text-[10px] hover:!bg-white/20">
              <RefreshCw className="h-4 w-4" /><span>Refresh</span>
            </button>
          </div>
        </div>

      {/* Status Message */}
      {statusMsg && (
        <div className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center gap-2 ${
          statusMsg.startsWith("✅") 
            ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
            : "bg-rose-50 border border-rose-200 text-rose-800"
        }`}>
          {statusMsg.startsWith("✅") ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
          <span>{statusMsg}</span>
        </div>
      )}

      {/* Tab Bar */}
      <div role="tablist" aria-label="Operations sections" className="flex gap-1 overflow-x-auto border-b border-slate-300 pb-2">
        {visibleTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            role="tab"
            aria-selected={activeTab === t.key}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-[10px] font-extrabold uppercase tracking-[.1em] transition whitespace-nowrap ${
              activeTab === t.key
                ? "border-pink-700 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <span className={activeTab === t.key ? t.color : ""}>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* TAB: Overview */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              label="Total Registrations"
              value={metrics?.total_registrations || 0}
              sub={`${metrics?.total_paid || 0} Confirmed`}
              icon={<Users className="w-4 h-4 text-blue-600" />}
            />
            <MetricCard
              label="Total Revenue"
              value={`₹${(metrics?.total_revenue || 0).toFixed(0)}`}
              sub={`Online ₹${metrics?.online_revenue || 0} | Cash ₹${metrics?.offline_revenue || 0}`}
              icon={<DollarSign className="w-4 h-4 text-pink-600" />}
              valueClass="text-pink-600"
            />
            <MetricCard
              label="Gate Validated"
              value={metrics?.gate_validated_count || 0}
              sub={`${metrics?.unvalidated_count || 0} Unvalidated`}
              icon={<ShieldCheck className="w-4 h-4 text-emerald-600" />}
            />
            <MetricCard
              label="Food Claimed"
              value={metrics?.food_claimed_count || 0}
              sub={`${metrics?.food_remaining_count || 0} Remaining`}
              icon={<Ticket className="w-4 h-4 text-blue-600" />}
            />
          </div>

          {/* Secondary Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="panel p-5">
              <div className="text-xs text-slate-500 font-bold uppercase">Pending Payments</div>
              <div className="text-2xl font-black text-yellow-600 mt-1">{metrics?.total_pending || 0}</div>
            </div>
            <div className="panel p-5">
              <div className="text-xs text-slate-500 font-bold uppercase">Offline Registrations</div>
              <div className="text-2xl font-black text-pink-600 mt-1">{metrics?.total_offline || 0}</div>
            </div>
            <div className="panel p-5">
              <div className="text-xs text-slate-500 font-bold uppercase">Tickets Issued</div>
              <div className="text-2xl font-black text-slate-900 mt-1">{metrics?.total_tickets || 0}</div>
            </div>
          </div>

          {/* Recent Audit Logs */}
          <div className="panel space-y-4 p-5 md:p-6">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <Activity className="w-4 h-4 text-pink-600" />
              <span>Audit Log Feed</span>
            </h3>
            <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto pr-1">
              {auditLogs.length === 0 ? (
                <div className="py-6 text-center text-slate-400 text-xs">No audit logs recorded yet.</div>
              ) : (
                auditLogs.map((log) => (
                  <div key={log.id} className="py-3 flex items-start justify-between text-xs gap-2">
                    <div>
                      <span className="font-mono font-bold text-pink-600 uppercase text-[11px]">{log.action}</span>
                      <span className="text-slate-800 ml-2 font-semibold">{log.entity_type}</span>
                      <div className="text-[10px] text-slate-400 mt-0.5">{new Date(log.created_at).toLocaleString()}</div>
                    </div>
                    <div className="font-mono text-[10px] text-slate-500 max-w-[240px] truncate text-right">
                      {log.details ? (typeof log.details === "string" ? log.details.slice(0, 60) : JSON.stringify(log.details).slice(0, 60)) : ""}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB: Events Management */}
      {activeTab === "events" && (
        <div className="space-y-4">
          <div className="flex items-end justify-between gap-4 border-b border-slate-300 pb-4">
            <div><p className="eyebrow">Programme</p><h2 className="editorial-title mt-2 text-3xl">Event desk</h2><p className="mt-1 text-xs text-slate-500">{events.length} event{events.length === 1 ? "" : "s"} in view</p></div>
            {role === "ADMIN" && (
              <button
                onClick={() => setShowCreateForm(!showCreateForm)}
                className="button-primary button-accent !min-h-10 !px-4 !text-[10px]"
              >
                <Plus className="w-4 h-4" />
                <span>{showCreateForm ? "Cancel" : "Create New Event"}</span>
              </button>
            )}
          </div>

          {showCreateForm && (
            <form onSubmit={handleCreateEvent} className="admin-form panel space-y-5 p-5 md:p-7">
              <div className="border-b border-slate-200 pb-4"><p className="eyebrow">Programme setup</p><h3 className="editorial-title mt-2 text-2xl">Create an event</h3></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Event Title *</label>
                  <input type="text" required value={createForm.title}
                    onChange={e => setCreateForm(p => ({...p, title: e.target.value}))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-pink-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">URL Slug *</label>
                  <input type="text" required value={createForm.slug}
                    onChange={e => setCreateForm(p => ({...p, slug: e.target.value.toLowerCase().replace(/\s+/g, "-")}))}
                    placeholder="e.g. freshers-2k26"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-mono focus:outline-none focus:border-pink-500" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
                  <textarea value={createForm.description}
                    onChange={e => setCreateForm(p => ({...p, description: e.target.value}))}
                    rows={2}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-pink-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Venue *</label>
                  <input type="text" required value={createForm.venue}
                    onChange={e => setCreateForm(p => ({...p, venue: e.target.value}))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-pink-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Event Type</label>
                  <select value={createForm.event_type}
                    onChange={e => setCreateForm(p => ({...p, event_type: e.target.value}))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none">
                    <option value="CULTURAL">Cultural</option>
                    <option value="TECHNICAL">Technical</option>
                    <option value="SPORTS">Sports</option>
                    <option value="GENERAL">General</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Event Start *</label>
                  <input type="datetime-local" required value={createForm.start_time}
                    onChange={e => setCreateForm(p => ({...p, start_time: e.target.value}))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-pink-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Event End *</label>
                  <input type="datetime-local" required value={createForm.end_time}
                    onChange={e => setCreateForm(p => ({...p, end_time: e.target.value}))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-pink-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Registration Opens *</label>
                  <input type="datetime-local" required value={createForm.registration_start}
                    onChange={e => setCreateForm(p => ({...p, registration_start: e.target.value}))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-pink-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Registration Closes *</label>
                  <input type="datetime-local" required value={createForm.registration_end}
                    onChange={e => setCreateForm(p => ({...p, registration_end: e.target.value}))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-pink-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Capacity</label>
                  <input type="number" required min="1" value={createForm.capacity}
                    onChange={e => setCreateForm(p => ({...p, capacity: Number(e.target.value)}))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-pink-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Ticket Price (₹)</label>
                  <input type="number" required min="0" step="0.01" value={createForm.ticket_price}
                    onChange={e => setCreateForm(p => ({...p, ticket_price: Number(e.target.value)}))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-pink-600 font-bold text-sm focus:outline-none focus:border-pink-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">First-year fee · roll starts 26 (₹)</label>
                  <input type="number" required min="0" step="0.01" value={createForm.first_year_ticket_price}
                    onChange={e => setCreateForm(p => ({...p, first_year_ticket_price: Number(e.target.value)}))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-pink-600 font-bold text-sm focus:outline-none focus:border-pink-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Second-year fee · roll starts 25 (₹)</label>
                  <input type="number" required min="0" step="0.01" value={createForm.second_year_ticket_price}
                    onChange={e => setCreateForm(p => ({...p, second_year_ticket_price: Number(e.target.value)}))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-pink-600 font-bold text-sm focus:outline-none focus:border-pink-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Other roll prefixes · optional fee (₹)</label>
                  <input type="number" min="0" step="0.01" value={createForm.other_ticket_price ?? ""}
                    onChange={e => setCreateForm(p => ({...p, other_ticket_price: e.target.value === "" ? null : Number(e.target.value)}))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-pink-600 font-bold text-sm focus:outline-none focus:border-pink-500" />
                  <p className="mt-1 text-[10px] text-slate-500">Leave blank to block roll prefixes other than 26 and 25.</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Initial Status</label>
                  <select value={createForm.status}
                    onChange={e => setCreateForm(p => ({...p, status: e.target.value as EventStatus}))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none">
                    <option value="DRAFT">Draft</option>
                    <option value="PUBLISHED">Published</option>
                  </select>
                </div>
                <div className="flex flex-wrap gap-4 text-xs">
                  {([
                    { key: "allow_online", label: "Online Pay" },
                    { key: "allow_offline", label: "Offline Cash" },
                    { key: "gate_validation_enabled", label: "Gate Validation" },
                    { key: "food_validation_enabled", label: "Food Validation" },
                  ] as const).map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-1.5 cursor-pointer text-slate-700 font-bold">
                      <input
                        type="checkbox"
                        checked={createForm[key]}
                        onChange={e => setCreateForm(p => ({...p, [key]: e.target.checked}))}
                        className="w-4 h-4 accent-pink-600"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
              <button type="submit" disabled={creating}
                className="button-primary button-accent w-full">
                {creating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                <span>{creating ? "Creating..." : "Create Event"}</span>
              </button>
            </form>
          )}

          <div className="space-y-3">
            {events.map((ev) => (
              <div key={ev.id} className="panel flex flex-col justify-between gap-4 p-5 md:flex-row md:items-center">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="editorial-title truncate text-2xl">{ev.title}</h3>
                    <StatusBadge status={ev.status} />
                  </div>
                  <div className="mt-2 text-[10px] font-semibold uppercase tracking-[.08em] text-slate-500">
                    {ev.slug} • {ev.event_type} • ₹{ev.ticket_price} • Capacity: {ev.capacity}
                  </div>
                  <div className="mt-1 text-[10px] font-semibold text-slate-600">
                    Year 1 (26…): ₹{ev.first_year_ticket_price} · Year 2 (25…): ₹{ev.second_year_ticket_price}
                    {ev.other_ticket_price != null && ` · Other: ₹${ev.other_ticket_price}`}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-500">
                    <span className="flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" />{new Date(ev.start_time).toLocaleString()}</span>
                    <span className={`font-extrabold uppercase tracking-[.08em] ${registrationAvailability(ev).open ? "text-emerald-700" : "text-rose-700"}`}>
                      {registrationAvailability(ev).label}
                    </span>
                  </div>
                  <div className="mt-1 text-[10px] text-slate-400">
                    Scheduled {new Date(ev.registration_start).toLocaleDateString()} – {new Date(ev.registration_end).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingPricesEventId(editingPricesEventId === ev.id ? null : ev.id);
                      setPriceDraft({
                        first_year_ticket_price: ev.first_year_ticket_price ?? 500,
                        second_year_ticket_price: ev.second_year_ticket_price ?? 600,
                        other_ticket_price: ev.other_ticket_price ?? null,
                      });
                    }}
                    className="inline-flex min-h-10 items-center gap-2 border border-slate-300 px-3 text-[10px] font-extrabold uppercase tracking-[.08em] text-slate-700 hover:bg-slate-50"
                  >
                    <Settings className="h-3.5 w-3.5" /> Edit prices
                  </button>
                  {(ev.status === "PUBLISHED" || ev.status === "LIVE" || ev.status === "REGISTRATION_CLOSED") && (
                    <button
                      type="button"
                      onClick={() => void handleRegistrationToggle(ev)}
                      aria-label={!registrationAvailability(ev).open ? `Open registration for ${ev.title}` : `Close registration for ${ev.title}`}
                      className={`inline-flex min-h-10 items-center gap-2 border px-3 text-[10px] font-extrabold uppercase tracking-[.08em] transition ${
                        !registrationAvailability(ev).open
                          ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                          : "border-rose-300 bg-rose-50 text-rose-800 hover:bg-rose-100"
                      }`}
                    >
                      {!registrationAvailability(ev).open
                        ? <><Play className="h-3.5 w-3.5" />{ev.status === "REGISTRATION_CLOSED" ? "Reopen" : "Open registrations"}</>
                        : <><Pause className="h-3.5 w-3.5" />Close registrations</>}
                    </button>
                  )}
                  {ev.status === "DRAFT" && (
                    <button onClick={() => handleStatusChange(ev.id, "PUBLISHED")}
                      className="button-primary !min-h-10 !border-emerald-300 !bg-emerald-50 !px-3 !text-[10px] !text-emerald-800 hover:!bg-emerald-100">
                      Publish
                    </button>
                  )}
                  {(ev.status === "PUBLISHED" || ev.status === "REGISTRATION_CLOSED") && (
                    <button onClick={() => handleStatusChange(ev.id, "LIVE")}
                      className="button-primary !min-h-10 !border-blue-300 !bg-blue-50 !px-3 !text-[10px] !text-blue-800 hover:!bg-blue-100">
                      Go Live
                    </button>
                  )}
                  {ev.status === "LIVE" && (
                    <button onClick={() => handleStatusChange(ev.id, "COMPLETED")}
                      className="button-primary !min-h-10 !bg-slate-100 !px-3 !text-[10px] !text-slate-800 hover:!bg-slate-200">
                      Complete
                    </button>
                  )}
                </div>
                {editingPricesEventId === ev.id && (
                  <div className="grid basis-full gap-3 border-t border-slate-200 pt-4 sm:grid-cols-2">
                    <label className="text-[10px] font-extrabold uppercase tracking-[.08em] text-slate-600">
                      First-year · 26… (₹)
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={priceDraft.first_year_ticket_price ?? 500}
                        onChange={(e) => setPriceDraft((draft) => ({ ...draft, first_year_ticket_price: Number(e.target.value) }))}
                        className="field-control mt-1"
                      />
                    </label>
                    <label className="text-[10px] font-extrabold uppercase tracking-[.08em] text-slate-600">
                      Second-year · 25… (₹)
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={priceDraft.second_year_ticket_price ?? 600}
                        onChange={(e) => setPriceDraft((draft) => ({ ...draft, second_year_ticket_price: Number(e.target.value) }))}
                        className="field-control mt-1"
                      />
                    </label>
                    <label className="text-[10px] font-extrabold uppercase tracking-[.08em] text-slate-600">
                      Other roll prefixes · optional (₹)
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={priceDraft.other_ticket_price ?? ""}
                        onChange={(e) => setPriceDraft((draft) => ({
                          ...draft,
                          other_ticket_price: e.target.value === "" ? null : Number(e.target.value),
                        }))}
                        className="field-control mt-1"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => void handleSaveEventPrices(ev.id)}
                      disabled={savingPrices}
                      className="button-primary button-accent min-h-10 w-full sm:col-span-2"
                    >
                      {savingPrices ? "Saving prices…" : "Save year prices"}
                    </button>
                  </div>
                )}
              </div>
            ))}
            {events.length === 0 && (
              <div className="panel p-10 text-center text-sm text-slate-500">No events found. Create your first event above.</div>
            )}
          </div>
        </div>
      )}

      {activeTab === "accounts" && role === "ADMIN" && (
        <section className="mx-auto max-w-3xl space-y-5">
          <div>
            <p className="eyebrow">Access control</p>
            <h2 className="editorial-title mt-2 text-3xl">Create staff account</h2>
            <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-600">
              Creates the Supabase Auth user and assigns the matching platform role. Share the initial password privately and ask the staff member to change it after signing in.
            </p>
          </div>
          <form onSubmit={handleCreateStaffAccount} className="admin-form panel space-y-5 p-5 md:p-7">
            {!secureContext && (
              <div role="alert" className="border border-amber-300 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                Staff account creation is disabled over insecure LAN HTTP because the initial password would be exposed in transit. Open this admin page over trusted HTTPS.
              </div>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="staff-full-name">Full name</label>
                <input
                  id="staff-full-name"
                  required
                  minLength={2}
                  maxLength={255}
                  autoComplete="name"
                  className="field-control"
                  value={staffForm.full_name}
                  onChange={(event) => setStaffForm((form) => ({ ...form, full_name: event.target.value }))}
                />
              </div>
              <div>
                <label htmlFor="staff-email">Email</label>
                <input
                  id="staff-email"
                  type="email"
                  required
                  maxLength={254}
                  autoComplete="email"
                  className="field-control"
                  value={staffForm.email}
                  onChange={(event) => setStaffForm((form) => ({ ...form, email: event.target.value }))}
                />
              </div>
              <div>
                <label htmlFor="staff-role">Role</label>
                <select
                  id="staff-role"
                  className="field-control"
                  value={staffForm.role}
                  onChange={(event) => setStaffForm((form) => ({
                    ...form,
                    role: event.target.value as typeof form.role,
                    event_id: "",
                  }))}
                >
                  <option value="GATE_STAFF">Gate staff</option>
                  <option value="FOOD_STAFF">Food staff</option>
                  <option value="EVENT_MANAGER">Event organizer</option>
                </select>
              </div>
              {staffForm.role === "EVENT_MANAGER" && (
                <div>
                  <label htmlFor="staff-event">Assigned event</label>
                  <select
                    id="staff-event"
                    required
                    className="field-control"
                    value={staffForm.event_id}
                    onChange={(event) => setStaffForm((form) => ({ ...form, event_id: event.target.value }))}
                  >
                    <option value="">Choose an event</option>
                    {events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}
                  </select>
                </div>
              )}
              <div className={staffForm.role === "EVENT_MANAGER" ? "md:col-span-2" : ""}>
                <label htmlFor="staff-password">Initial password</label>
                <input
                  id="staff-password"
                  type="password"
                  required
                  minLength={12}
                  maxLength={128}
                  autoComplete="new-password"
                  className="field-control"
                  value={staffForm.password}
                  onChange={(event) => setStaffForm((form) => ({ ...form, password: event.target.value }))}
                />
                <p className="mt-1.5 text-[10px] text-slate-500">Use a unique password of at least 12 characters. Never share it in a group chat.</p>
              </div>
            </div>
            <button type="submit" disabled={creatingStaff || !secureContext} className="button-primary button-accent w-full disabled:cursor-not-allowed disabled:opacity-60">
              {creatingStaff ? <RefreshCw className="h-4 w-4 animate-spin" /> : <UserRoundPlus className="h-4 w-4" />}
              {creatingStaff ? "Creating account…" : "Create Supabase account"}
            </button>
          </form>
        </section>
      )}

      {/* TAB: Data Reports */}
      {["registrations", "payments", "entries", "offline", "audit"].includes(activeTab) && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h3 className="text-sm font-extrabold text-slate-900 capitalize">
              {activeTab === "entries" ? "Gate Entries" : activeTab === "audit" ? "Audit Logs" : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Report
            </h3>
            <div className="flex gap-2 items-center">
              <span className="text-xs text-slate-500 font-medium">{reportData.length} records</span>
              {activeTab === "registrations" && (
                <button onClick={handleDownloadCSV}
                  className="px-3 py-1.5 bg-pink-600 hover:bg-pink-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition shadow-sm">
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
              )}
              <button onClick={() => loadReport(activeTab)}
                className="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg flex items-center gap-1.5 transition hover:bg-slate-200">
                <RefreshCw className={`w-3.5 h-3.5 ${reportLoading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {reportLoading ? (
            <div className="flex items-center justify-center p-8 gap-2 text-slate-400">
              <RefreshCw className="w-4 h-4 animate-spin text-pink-600" />
              <span className="text-sm">Loading report data...</span>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                    <tr>
                      {activeTab === "registrations" && (
                        <>
                          <th className="px-4 py-3 text-left text-slate-700 font-extrabold">Name</th>
                          <th className="px-4 py-3 text-left text-slate-700 font-extrabold">Roll No.</th>
                          <th className="px-4 py-3 text-left text-slate-700 font-extrabold">Event</th>
                          <th className="px-4 py-3 text-left text-slate-700 font-extrabold">Status</th>
                          <th className="px-4 py-3 text-left text-slate-700 font-extrabold">Method</th>
                          <th className="px-4 py-3 text-left text-slate-700 font-extrabold">₹</th>
                          <th className="px-4 py-3 text-left text-slate-700 font-extrabold">Ticket Code</th>
                          <th className="px-4 py-3 text-left text-slate-700 font-extrabold">Gate</th>
                          <th className="px-4 py-3 text-left text-slate-700 font-extrabold">Food</th>
                          <th className="px-4 py-3 text-left text-slate-700 font-extrabold">Registered</th>
                        </>
                      )}
                      {activeTab === "payments" && (
                        <>
                          <th className="px-4 py-3 text-left text-slate-700 font-extrabold">Student</th>
                          <th className="px-4 py-3 text-left text-slate-700 font-extrabold">Event</th>
                          <th className="px-4 py-3 text-left text-slate-700 font-extrabold">Order ID</th>
                          <th className="px-4 py-3 text-left text-slate-700 font-extrabold">Amount</th>
                          <th className="px-4 py-3 text-left text-slate-700 font-extrabold">Status</th>
                          <th className="px-4 py-3 text-left text-slate-700 font-extrabold">Date</th>
                        </>
                      )}
                      {activeTab === "entries" && (
                        <>
                          <th className="px-4 py-3 text-left text-slate-700 font-extrabold">Student</th>
                          <th className="px-4 py-3 text-left text-slate-700 font-extrabold">Roll No.</th>
                          <th className="px-4 py-3 text-left text-slate-700 font-extrabold">Ticket</th>
                          <th className="px-4 py-3 text-left text-slate-700 font-extrabold">Event</th>
                          <th className="px-4 py-3 text-left text-slate-700 font-extrabold">Gate</th>
                          <th className="px-4 py-3 text-left text-slate-700 font-extrabold">Method</th>
                          <th className="px-4 py-3 text-left text-slate-700 font-extrabold">Validated At</th>
                        </>
                      )}
                      {activeTab === "offline" && (
                        <>
                          <th className="px-4 py-3 text-left text-slate-700 font-extrabold">Student</th>
                          <th className="px-4 py-3 text-left text-slate-700 font-extrabold">Event</th>
                          <th className="px-4 py-3 text-left text-slate-700 font-extrabold">Ticket</th>
                          <th className="px-4 py-3 text-left text-slate-700 font-extrabold">Amount</th>
                          <th className="px-4 py-3 text-left text-slate-700 font-extrabold">Receipt</th>
                          <th className="px-4 py-3 text-left text-slate-700 font-extrabold">Collected At</th>
                        </>
                      )}
                      {activeTab === "audit" && (
                        <>
                          <th className="px-4 py-3 text-left text-slate-700 font-extrabold">Action</th>
                          <th className="px-4 py-3 text-left text-slate-700 font-extrabold">Entity</th>
                          <th className="px-4 py-3 text-left text-slate-700 font-extrabold">Details</th>
                          <th className="px-4 py-3 text-left text-slate-700 font-extrabold">Timestamp</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reportData.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-4 py-8 text-center text-slate-400 font-medium">No data found for this report.</td>
                      </tr>
                    ) : reportData.map((row, i) => (
                      <tr key={String(row.id ?? i)} className="hover:bg-slate-50 transition">
                        {activeTab === "registrations" && (
                          <>
                            <td className="px-4 py-3 text-slate-900 font-bold">{row.full_name}</td>
                            <td className="px-4 py-3 font-mono text-pink-600 font-bold">{row.roll_number}</td>
                            <td className="px-4 py-3 text-slate-700 max-w-[120px] truncate">{row.event_title}</td>
                            <td className="px-4 py-3"><StatusBadge status={String(row.status || "")} /></td>
                            <td className="px-4 py-3 text-slate-500 font-medium">{row.payment_method}</td>
                            <td className="px-4 py-3 text-pink-600 font-bold">₹{row.ticket_price}</td>
                            <td className="px-4 py-3 font-mono text-yellow-800 bg-yellow-50 px-2 py-0.5 rounded border border-yellow-200 font-bold">{row.ticket_code || "—"}</td>
                            <td className="px-4 py-3">{row.gate_validated_at ? <span className="text-emerald-600 font-extrabold">✓</span> : <span className="text-slate-300">—</span>}</td>
                            <td className="px-4 py-3">{row.food_status === "CLAIMED" ? <span className="text-blue-600 font-extrabold">✓</span> : <span className="text-slate-300">—</span>}</td>
                            <td className="px-4 py-3 text-slate-400 font-medium">{formatReportDate(row.created_at, false)}</td>
                          </>
                        )}
                        {activeTab === "payments" && (
                          <>
                            <td className="px-4 py-3 text-slate-900 font-bold">{row.full_name}</td>
                            <td className="px-4 py-3 text-slate-700 max-w-[120px] truncate">{row.event_title}</td>
                            <td className="px-4 py-3 font-mono text-slate-500 text-[10px]">{typeof row.razorpay_order_id === "string" ? row.razorpay_order_id.slice(0, 16) : "—"}</td>
                            <td className="px-4 py-3 text-pink-600 font-bold">₹{row.amount}</td>
                            <td className="px-4 py-3"><StatusBadge status={String(row.status || "")} /></td>
                            <td className="px-4 py-3 text-slate-400 font-medium">{formatReportDate(row.created_at, false)}</td>
                          </>
                        )}
                        {activeTab === "entries" && (
                          <>
                            <td className="px-4 py-3 text-slate-900 font-bold">{row.full_name}</td>
                            <td className="px-4 py-3 font-mono text-pink-600 font-bold">{row.roll_number}</td>
                            <td className="px-4 py-3 font-mono text-yellow-800 bg-yellow-50 px-2 py-0.5 rounded border border-yellow-200 font-bold">{row.ticket_code}</td>
                            <td className="px-4 py-3 text-slate-700 max-w-[120px] truncate">{row.event_title}</td>
                            <td className="px-4 py-3 text-slate-700 font-medium">{row.gate_location}</td>
                            <td className="px-4 py-3 text-slate-500">{row.gate_method}</td>
                            <td className="px-4 py-3 text-blue-600 text-[10px] font-bold">{formatReportDate(row.gate_validated_at)}</td>
                          </>
                        )}
                        {activeTab === "offline" && (
                          <>
                            <td className="px-4 py-3 text-slate-900 font-bold">{row.full_name}</td>
                            <td className="px-4 py-3 text-slate-700 max-w-[120px] truncate">{row.event_title}</td>
                            <td className="px-4 py-3 font-mono text-yellow-800 bg-yellow-50 px-2 py-0.5 rounded border border-yellow-200 font-bold">{row.ticket_code || "—"}</td>
                            <td className="px-4 py-3 text-pink-600 font-black">₹{row.amount}</td>
                            <td className="px-4 py-3 font-mono text-slate-600 font-bold">{row.receipt_number}</td>
                            <td className="px-4 py-3 text-slate-400 text-[10px] font-medium">{formatReportDate(row.created_at)}</td>
                          </>
                        )}
                        {activeTab === "audit" && (
                          <>
                            <td className="px-4 py-3 font-mono font-bold text-pink-600 uppercase text-[10px]">{row.action}</td>
                            <td className="px-4 py-3 text-slate-700 font-semibold">{row.entity_type}</td>
                            <td className="px-4 py-3 text-slate-500 max-w-[240px] truncate font-mono text-[10px]">
                              {row.details ? (typeof row.details === "string" ? row.details : JSON.stringify(row.details)).slice(0, 60) : ""}
                            </td>
                            <td className="px-4 py-3 text-slate-400 text-[10px] font-medium">{formatReportDate(row.created_at)}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, sub, icon, valueClass = "text-slate-900" }: {
  label: string; value: string | number; sub: string; icon: React.ReactNode; valueClass?: string;
}) {
  return (
    <div className="metric-card panel space-y-1 p-4 md:p-5">
      <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase tracking-wider">
        <span>{label}</span>
        {icon}
      </div>
      <div className={`metric-value text-2xl ${valueClass}`}>{value}</div>
      <div className="text-[10px] text-slate-400 font-medium">{sub}</div>
    </div>
  );
}

function formatReportDate(value: ReportRow[string], dateOnly = true): string {
  if (typeof value !== "string" && typeof value !== "number") return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return dateOnly ? date.toLocaleDateString() : date.toLocaleString();
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    PUBLISHED: "bg-emerald-50 text-emerald-700 border-emerald-200",
    DRAFT: "bg-slate-100 text-slate-700 border-slate-200",
    LIVE: "bg-blue-50 text-blue-700 border-blue-200",
    COMPLETED: "bg-slate-100 text-slate-600 border-slate-200",
    REGISTRATION_CLOSED: "bg-yellow-50 text-yellow-800 border-yellow-200",
    CANCELLED: "bg-rose-50 text-rose-700 border-rose-200",
    PAID: "bg-emerald-50 text-emerald-700 border-emerald-200",
    OFFLINE_PAID: "bg-pink-50 text-pink-700 border-pink-200",
    PENDING_PAYMENT: "bg-yellow-50 text-yellow-800 border-yellow-200",
    CREATED: "bg-slate-100 text-slate-700 border-slate-200",
  };
  const cls = colors[status] || "bg-slate-100 text-slate-700 border-slate-200";
  return (
    <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-extrabold border ${cls}`}>
      {status?.replace(/_/g, " ")}
    </span>
  );
}
