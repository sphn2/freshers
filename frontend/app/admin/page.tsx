"use client";

import { useEffect, useState, useRef } from "react";
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
  StaffAccount,
  StudentDirectoryEntry,
  DirectoryUploadResponse,
  DirectoryStatsResponse,
  DailyRevenueReport,
  CollectorDailyRow,
  Settlement,
  PaymentGatewaySettings,
  BannerSettings,
} from "@/lib/types";
import {
  LayoutDashboard, ShieldCheck, DollarSign, Users, Ticket, Activity,
  FileSpreadsheet, Plus, RefreshCw, CheckCircle2, QrCode,
  CreditCard, Banknote, Settings, AlertCircle, Pause, Play, CalendarClock,
  UserRoundPlus, KeyRound, Mail, Edit3, Search, X,
  Database, UploadCloud, Download, Trash2, Lock, FileUp,
  TrendingUp, BarChart3, Receipt, Printer, CheckSquare, Building2,
  Megaphone, Wrench, AlertOctagon
} from "lucide-react";

export default function AdminDashboardPage() {
  return (
    <ProtectedRoute allowedRoles={["SUPER_ADMIN", "ADMIN", "EVENT_MANAGER"]}>
      <AdminDashboardContent />
    </ProtectedRoute>
  );
}

type Tab = "overview" | "registrations" | "payments" | "entries" | "offline" | "audit" | "events" | "accounts" | "directory" | "daily-report" | "settlements";

function AdminDashboardContent() {
  const { role, user, refreshUser } = useAuth();
  const isSuperAdmin = role === "SUPER_ADMIN";
  const isAdmin = role === "SUPER_ADMIN" || role === "ADMIN";
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
    gate_validation_enabled: true, food_validation_enabled: true,
    payment_gateway: "DEFAULT", status: "DRAFT"
  });
  const [editingPricesEventId, setEditingPricesEventId] = useState<string | null>(null);
  const [priceDraft, setPriceDraft] = useState({
    first_year_ticket_price: 500,
    second_year_ticket_price: 600,
    other_ticket_price: null as number | null,
  });
  const [savingPrices, setSavingPrices] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingFullEventId, setEditingFullEventId] = useState<string | null>(null);
  const [editEventForm, setEditEventForm] = useState<EventCreateInput>({
    title: "", slug: "", description: "", venue: "", event_type: "CULTURAL",
    start_time: "", end_time: "", registration_start: "", registration_end: "",
    capacity: 500, ticket_price: 250, allow_online: true, allow_offline: true,
    allow_autofill: true, first_year_ticket_price: 500, second_year_ticket_price: 600,
    other_ticket_price: null, gate_validation_enabled: true, food_validation_enabled: true,
    payment_gateway: "DEFAULT", status: "DRAFT"
  });
  const [savingFullEvent, setSavingFullEvent] = useState(false);
  const [gatewaySettings, setGatewaySettings] = useState<PaymentGatewaySettings | null>(null);
  const [savingGatewaySettings, setSavingGatewaySettings] = useState(false);

  const [staffForm, setStaffForm] = useState({
    full_name: "",
    email: "",
    password: "",
    role: "GATE_STAFF" as "ADMIN" | "EVENT_MANAGER" | "GATE_STAFF" | "FOOD_STAFF" | "OFFLINE_COLLECTOR",
    event_id: "",
  });
  const [creatingStaff, setCreatingStaff] = useState(false);
  const [secureContext, setSecureContext] = useState(false);
  const [staffAccounts, setStaffAccounts] = useState<StaffAccount[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [pinModalUser, setPinModalUser] = useState<StaffAccount | null>(null);
  const [pinInputValue, setPinInputValue] = useState("");
  const [settingPin, setSettingPin] = useState(false);
  const [togglingRoleId, setTogglingRoleId] = useState<string | null>(null);
  const [editingEmailRegId, setEditingEmailRegId] = useState<string | null>(null);
  const [emailDraft, setEmailDraft] = useState<string>("");
  const [savingEmail, setSavingEmail] = useState<boolean>(false);
  const [resendingTicketId, setResendingTicketId] = useState<string | null>(null);
  const [resendingAll, setResendingAll] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [feeSettings, setFeeSettings] = useState<{ enabled: boolean; amount: number } | null>(null);
  const [feeAmountDraft, setFeeAmountDraft] = useState<string>("3.79");
  const [feeEnabledDraft, setFeeEnabledDraft] = useState<boolean>(true);
  const [savingFeeSettings, setSavingFeeSettings] = useState<boolean>(false);

  // Announcement Banners state (Admin & Super Admin)
  const [bannerSettings, setBannerSettings] = useState<BannerSettings | null>(null);
  const [closedBannerDraft, setClosedBannerDraft] = useState<boolean>(false);
  const [closedTextDraft, setClosedTextDraft] = useState<string>("");
  const [maintBannerDraft, setMaintBannerDraft] = useState<boolean>(false);
  const [maintTextDraft, setMaintTextDraft] = useState<string>("");
  const [savingBannerSettings, setSavingBannerSettings] = useState<boolean>(false);

  // Student Directory state
  const [directoryStudents, setDirectoryStudents] = useState<StudentDirectoryEntry[]>([]);
  const [directoryTotal, setDirectoryTotal] = useState(0);
  const [directoryPage, setDirectoryPage] = useState(1);
  const [directoryTotalPages, setDirectoryTotalPages] = useState(1);
  const [directorySearch, setDirectorySearch] = useState("");
  const [directoryDeptFilter, setDirectoryDeptFilter] = useState("");
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [directoryStats, setDirectoryStats] = useState<DirectoryStatsResponse | null>(null);
  const [directoryUploadFile, setDirectoryUploadFile] = useState<File | null>(null);
  const [directoryUploading, setDirectoryUploading] = useState(false);
  const [directoryUploadResult, setDirectoryUploadResult] = useState<DirectoryUploadResponse | null>(null);
  const [showClearDirectoryModal, setShowClearDirectoryModal] = useState(false);
  const [clearingDirectory, setClearingDirectory] = useState(false);

  // Daily Revenue Report state
  const [dailyRevenue, setDailyRevenue] = useState<DailyRevenueReport | null>(null);
  const [dailyCollectors, setDailyCollectors] = useState<CollectorDailyRow[]>([]);
  const [dailyReportLoading, setDailyReportLoading] = useState(false);
  const [collectorDateFilter, setCollectorDateFilter] = useState("");
  const [dailyChannel, setDailyChannel] = useState<"ONLINE" | "CASH">("ONLINE");

  // Settlements state
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [settlementsLoading, setSettlementsLoading] = useState(false);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [settlingId, setSettlingId] = useState<string | null>(null);
  const [settlementForm, setSettlementForm] = useState({
    receiver_name: "",
    bank_name: "",
    account_number: "",
    ifsc_code: "",
    transaction_id: "",
    transaction_date: "",
    notes: "",
    authorized_by_name: "",
  });
  const [submittingSettle, setSubmittingSettle] = useState(false);
  const [receiptSettlement, setReceiptSettlement] = useState<Settlement | null>(null);
  const [showCreateSettlementModal, setShowCreateSettlementModal] = useState(false);
  const [newSettlementForm, setNewSettlementForm] = useState({
    event_id: "",
    settlement_date: new Date().toISOString().slice(0, 10),
    total_online_amount: 0,
    total_cash_amount: 0,
    total_tickets_issued: 0,
  });
  const [creatingSettlement, setCreatingSettlement] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);

  const loadFeeSettings = async () => {
    if (!isSuperAdmin) return;
    try {
      const data = await api.getConvenienceFeeSettings();
      setFeeSettings(data);
      setFeeEnabledDraft(data.enabled);
      setFeeAmountDraft(String(data.amount));
    } catch {
      // silent
    }
  };

  const loadGatewaySettings = async () => {
    if (!isSuperAdmin) return;
    try {
      const data = await api.getPaymentGatewaySettings();
      setGatewaySettings(data);
    } catch {
      // silent
    }
  };

  const loadBannerSettings = async () => {
    try {
      const data = await api.getAdminBannerSettings();
      setBannerSettings(data);
      setClosedBannerDraft(data.registrations_closed);
      setClosedTextDraft(data.registrations_closed_text);
      setMaintBannerDraft(data.maintenance_mode);
      setMaintTextDraft(data.maintenance_mode_text);
    } catch {
      // silent
    }
  };

  const handleSaveBannerSettings = async (overrides?: {
    registrations_closed?: boolean;
    maintenance_mode?: boolean;
  }) => {
    setSavingBannerSettings(true);
    try {
      const nextClosed = overrides?.registrations_closed !== undefined ? overrides.registrations_closed : closedBannerDraft;
      const payload: Partial<BannerSettings> = {
        registrations_closed: nextClosed,
        registrations_closed_text: closedTextDraft,
      };
      if (isSuperAdmin) {
        const nextMaint = overrides?.maintenance_mode !== undefined ? overrides.maintenance_mode : maintBannerDraft;
        payload.maintenance_mode = nextMaint;
        payload.maintenance_mode_text = maintTextDraft;
      }
      const res = await api.updateBannerSettings(payload);
      setBannerSettings(res.settings);
      setClosedBannerDraft(res.settings.registrations_closed);
      setClosedTextDraft(res.settings.registrations_closed_text);
      setMaintBannerDraft(res.settings.maintenance_mode);
      setMaintTextDraft(res.settings.maintenance_mode_text);
      setStatusMsg(`✅ ${res.message}`);
    } catch (err: unknown) {
      setStatusMsg(`❌ ${errorMessage(err, "Failed updating announcement banner settings.")}`);
      void loadBannerSettings();
    } finally {
      setSavingBannerSettings(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      void loadBannerSettings();
    }
    if (isSuperAdmin) {
      void loadFeeSettings();
      void loadGatewaySettings();
    }
  }, [isAdmin, isSuperAdmin]);

  const handleUpdateDefaultGateway = async (gatewayName: string) => {
    if (!isSuperAdmin) return;
    setSavingGatewaySettings(true);
    try {
      const res = await api.updatePaymentGatewaySettings({ default_gateway: gatewayName });
      setGatewaySettings(res.settings);
      setStatusMsg(`✅ Global default payment gateway updated to ${gatewayName}`);
    } catch (err: unknown) {
      setStatusMsg(`❌ ${errorMessage(err, "Could not update payment gateway setting.")}`);
      void loadGatewaySettings();
    } finally {
      setSavingGatewaySettings(false);
    }
  };

  const handleToggleGateway = async (gatewayKey: string, enabled: boolean) => {
    if (!isSuperAdmin || !gatewaySettings) return;
    setSavingGatewaySettings(true);
    try {
      const currentEnabled = Object.fromEntries(
        Object.entries(gatewaySettings.gateways).map(([k, v]) => [k.toLowerCase(), v.enabled])
      );
      currentEnabled[gatewayKey.toLowerCase()] = enabled;
      const res = await api.updatePaymentGatewaySettings({ gateways_enabled: currentEnabled });
      setGatewaySettings(res.settings);
      setStatusMsg(`✅ ${gatewayKey} gateway availability updated.`);
    } catch (err: unknown) {
      setStatusMsg(`❌ ${errorMessage(err, "Could not update gateway toggle.")}`);
      void loadGatewaySettings();
    } finally {
      setSavingGatewaySettings(false);
    }
  };

  const handleSaveFeeSettings = async (overrideEnabled?: boolean) => {
    if (!isSuperAdmin) return;
    const nextEnabled = overrideEnabled !== undefined ? overrideEnabled : feeEnabledDraft;
    const numAmount = parseFloat(feeAmountDraft);
    if (isNaN(numAmount) || numAmount < 0) {
      setStatusMsg("❌ Please enter a valid fee amount.");
      return;
    }
    setSavingFeeSettings(true);
    try {
      const res = await api.updateConvenienceFeeSettings({
        enabled: nextEnabled,
        amount: numAmount,
      });
      setFeeSettings(res.settings);
      setFeeEnabledDraft(res.settings.enabled);
      setFeeAmountDraft(String(res.settings.amount));
      setStatusMsg(`✅ ${res.message}`);
    } catch (err: unknown) {
      setStatusMsg(`❌ ${errorMessage(err, "Could not update GST & Convenience fee settings.")}`);
      void loadFeeSettings();
    } finally {
      setSavingFeeSettings(false);
    }
  };

  const filteredReportData = reportData.filter((row) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return Object.values(row).some((val) => {
      if (val === null || val === undefined) return false;
      if (typeof val === "object") {
        return JSON.stringify(val).toLowerCase().includes(q);
      }
      return String(val).toLowerCase().includes(q);
    });
  });

  const handleSaveRegistrationEmail = async (registrationId: string) => {
    if (!emailDraft || !emailDraft.includes("@") || !emailDraft.includes(".")) {
      setStatusMsg("❌ Please enter a valid email address.");
      return;
    }
    setSavingEmail(true);
    try {
      const res = await api.updateRegistrationEmail(registrationId, emailDraft);
      setStatusMsg(`✅ ${res.message}`);
      setEditingEmailRegId(null);
      setEmailDraft("");
      void loadReport("registrations");
    } catch (err: unknown) {
      setStatusMsg(`❌ ${errorMessage(err, "Failed updating registration email.")}`);
    } finally {
      setSavingEmail(false);
    }
  };

  const handleResendTicketEmail = async (registrationId: string) => {
    setResendingTicketId(registrationId);
    try {
      const res = await api.resendTicketEmail(registrationId);
      setStatusMsg(`✅ ${res.message}`);
    } catch (err: unknown) {
      setStatusMsg(`❌ ${errorMessage(err, "Failed resending ticket email.")}`);
    } finally {
      setResendingTicketId(null);
    }
  };

  const handleResendMail = async (
    registrationId: string,
    mailType: "TICKET" | "PAYMENT" | "GATE" | "FOOD" | "ALL"
  ) => {
    const key = `${registrationId}-${mailType}`;
    setResendingTicketId(key);
    try {
      const res = await api.resendAnyMail(registrationId, mailType);
      setStatusMsg(`✅ ${res.message}`);
    } catch (err: unknown) {
      setStatusMsg(`❌ ${errorMessage(err, "Failed resending email.")}`);
    } finally {
      setResendingTicketId(null);
    }
  };

  const handleResendAllTickets = async () => {
    if (!window.confirm("Are you sure you want to resend ticket pass emails to ALL participants?")) {
      return;
    }
    setResendingAll(true);
    try {
      const res = await api.resendAllTickets(selectedEventId || undefined);
      setStatusMsg(`✅ ${res.message}`);
    } catch (err: unknown) {
      setStatusMsg(`❌ ${errorMessage(err, "Failed resending ticket emails to all participants.")}`);
    } finally {
      setResendingAll(false);
    }
  };

  const handleTogglePrivilege = async (account: StaffAccount, roleName: string, currentlyEnabled: boolean) => {
    if (!isSuperAdmin) return;
    const toggleKey = `${account.id}-${roleName}`;
    setTogglingRoleId(toggleKey);
    const newEnabled = !currentlyEnabled;

    setStaffAccounts((prev) =>
      prev.map((acc) => {
        if (acc.id !== account.id) return acc;
        const existingRoles = acc.roles || [acc.role];
        const updatedRoles = newEnabled
          ? Array.from(new Set([...existingRoles, roleName]))
          : existingRoles.filter((r) => r !== roleName);
        return { ...acc, roles: updatedRoles };
      })
    );

    try {
      const res = await api.updateStaffPrivilege(account.id, roleName, newEnabled);
      setStatusMsg(`✅ ${res.message}`);
      if (user?.id === account.id) {
        void refreshUser();
      }
    } catch (err: unknown) {
      setStatusMsg(`❌ ${errorMessage(err, "Failed updating privilege toggle.")}`);
      void loadStaffAccounts();
    } finally {
      setTogglingRoleId(null);
    }
  };

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
    const targetEid = selectedEventId || events[0]?.id;
    if (activeTab === "daily-report") {
      if (targetEid) void loadDailyReport(targetEid);
    } else if (activeTab === "settlements") {
      void loadSettlements(targetEid);
    } else if (activeTab === "directory") {
      // handled by directory effect
    } else if (activeTab === "events") {
      loadEvents();
    } else if (activeTab === "accounts" && isAdmin) {
      void loadStaffAccounts();
    } else if (activeTab !== "overview") {
      loadReport(activeTab);
    }
  }, [activeTab, selectedEventId, events]);

  const loadDashboard = async (requestedEventId?: string) => {
    setLoading(true);
    try {
      if (isAdmin) {
        const eventData = await api.adminListEvents();
        setEvents(eventData.events);

        let targetId = requestedEventId !== undefined ? requestedEventId : selectedEventId;
        if (!targetId && eventData.events.length > 0) {
          targetId = eventData.events[0].id;
          setSelectedEventId(targetId);
        }

        const [mData, logsData] = await Promise.all([
          api.getAdminMetrics(targetId || undefined),
          api.getAuditLogs(20),
        ]);
        setMetrics(mData);
        setAuditLogs(logsData.audit_logs);
      } else {
        const eventData = await api.adminListEvents();
        setEvents(eventData.events);
        let eventId = requestedEventId !== undefined ? requestedEventId : (selectedEventId || eventData.events[0]?.id || "");
        if (eventId && !selectedEventId) setSelectedEventId(eventId);
        if (!eventId) {
          setMetrics(null);
          setAuditLogs([]);
          setStatusMsg("No events are assigned to your account.");
          return;
        }
        const mData = await api.getAdminMetrics(eventId);
        setMetrics(mData);
        setAuditLogs([]);
      }
      setStatusMsg(null);
    } catch (err: unknown) {
      setStatusMsg(`❌ ${errorMessage(err, "Failed loading admin dashboard.")}`);
    } finally {
      setLoading(false);
    }
  };

  const loadDailyReport = async (eid?: string) => {
    const targetEid = eid || selectedEventId || events[0]?.id;
    if (!targetEid) return;
    setDailyReportLoading(true);
    try {
      const [revenueData, collectorsData] = await Promise.all([
        api.getDailyRevenueReport(targetEid),
        api.getDailyCollectorsReport(targetEid, collectorDateFilter || undefined),
      ]);
      setDailyRevenue(revenueData);
      setDailyCollectors(collectorsData.collectors);
    } catch (err: unknown) {
      setStatusMsg(`❌ ${errorMessage(err, "Failed loading daily report.")}`);
    } finally {
      setDailyReportLoading(false);
    }
  };

  const loadSettlements = async (eid?: string) => {
    const targetEid = eid || selectedEventId || events[0]?.id;
    setSettlementsLoading(true);
    try {
      const data = await api.getSettlements(targetEid || undefined);
      setSettlements(data.settlements);
    } catch (err: unknown) {
      setStatusMsg(`❌ ${errorMessage(err, "Failed loading settlements.")}`);
    } finally {
      setSettlementsLoading(false);
    }
  };

  const handleCreateSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingSettlement(true);
    try {
      const res = await api.createSettlement({
        event_id: newSettlementForm.event_id || null,
        settlement_date: newSettlementForm.settlement_date,
        total_online_amount: Number(newSettlementForm.total_online_amount),
        total_cash_amount: Number(newSettlementForm.total_cash_amount),
        total_tickets_issued: Number(newSettlementForm.total_tickets_issued),
      });
      setStatusMsg(`✅ ${res.message}`);
      setShowCreateSettlementModal(false);
      void loadSettlements();
    } catch (err: unknown) {
      setStatusMsg(`❌ ${errorMessage(err, "Failed creating settlement record.")}`);
    } finally {
      setCreatingSettlement(false);
    }
  };

  const handleMarkSettled = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlingId) return;
    setSubmittingSettle(true);
    try {
      const res = await api.markSettlementSettled(settlingId, settlementForm);
      setStatusMsg(`✅ ${res.message}`);
      setShowSettleModal(false);
      setSettlingId(null);
      setReceiptSettlement(res.settlement);
      void loadSettlements();
    } catch (err: unknown) {
      setStatusMsg(`❌ ${errorMessage(err, "Failed marking settlement as settled.")}`);
    } finally {
      setSubmittingSettle(false);
    }
  };

  const handlePrintReceipt = () => {
    window.print();
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
  const toDatetimeLocal = (isoStr: string | null | undefined): string => {
    if (!isoStr) return "";
    const d = new Date(isoStr);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const handleOpenEditEventModal = (ev: Event) => {
    setEditingFullEventId(ev.id);
    setEditEventForm({
      title: ev.title || "",
      slug: ev.slug || "",
      description: ev.description || "",
      venue: ev.venue || "",
      event_type: ev.event_type || "CULTURAL",
      start_time: toDatetimeLocal(ev.start_time),
      end_time: toDatetimeLocal(ev.end_time),
      registration_start: toDatetimeLocal(ev.registration_start),
      registration_end: toDatetimeLocal(ev.registration_end),
      capacity: ev.capacity || 500,
      ticket_price: ev.ticket_price || 0,
      first_year_ticket_price: ev.first_year_ticket_price ?? 500,
      second_year_ticket_price: ev.second_year_ticket_price ?? 600,
      other_ticket_price: ev.other_ticket_price ?? null,
      allow_online: ev.allow_online ?? true,
      allow_offline: ev.allow_offline ?? true,
      allow_autofill: ev.allow_autofill ?? true,
      gate_validation_enabled: ev.gate_validation_enabled ?? true,
      food_validation_enabled: ev.food_validation_enabled ?? true,
      payment_gateway: ev.payment_gateway || "DEFAULT",
      status: ev.status || "DRAFT",
    });
  };

  const handleSaveFullEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFullEventId) return;
    setSavingFullEvent(true);
    setStatusMsg(null);
    try {
      const payload = {
        ...editEventForm,
        start_time: editEventForm.start_time ? new Date(editEventForm.start_time).toISOString() : "",
        end_time: editEventForm.end_time ? new Date(editEventForm.end_time).toISOString() : "",
        registration_start: editEventForm.registration_start ? new Date(editEventForm.registration_start).toISOString() : "",
        registration_end: editEventForm.registration_end ? new Date(editEventForm.registration_end).toISOString() : "",
      };
      await api.updateEvent(editingFullEventId, payload);
      setStatusMsg("✅ Event details updated successfully!");
      setEditingFullEventId(null);
      await loadEvents();
    } catch (err: unknown) {
      setStatusMsg(`❌ ${errorMessage(err, "Failed updating event details.")}`);
    } finally {
      setSavingFullEvent(false);
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
    if (staffForm.password.length < 12) {
      setStatusMsg("❌ Password must be at least 12 characters long.");
      setCreatingStaff(false);
      return;
    }
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
      void loadStaffAccounts();
    } catch (err: unknown) {
      setStatusMsg(`❌ ${errorMessage(err, "Failed creating staff account.")}`);
    } finally {
      setCreatingStaff(false);
    }
  };

  const loadStaffAccounts = async () => {
    setLoadingStaff(true);
    try {
      const data = await api.listStaffAccounts();
      setStaffAccounts(data.staff_accounts);
    } catch (err: unknown) {
      setStatusMsg(`❌ ${errorMessage(err, "Failed loading staff accounts.")}`);
    } finally {
      setLoadingStaff(false);
    }
  };

  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinModalUser) return;
    if (pinInputValue.length !== 6 || !/^\d{6}$/.test(pinInputValue)) {
      setStatusMsg("❌ Authorization PIN must be exactly 6 digits.");
      return;
    }
    setSettingPin(true);
    try {
      const res = await api.setStaffPin(pinModalUser.id, pinInputValue);
      setStatusMsg(`✅ ${res.message}`);
      setPinModalUser(null);
      setPinInputValue("");
      void loadStaffAccounts();
    } catch (err: unknown) {
      setStatusMsg(`❌ ${errorMessage(err, "Failed updating staff PIN.")}`);
    } finally {
      setSettingPin(false);
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

  const loadDirectoryData = async (page = 1, search = directorySearch, dept = directoryDeptFilter) => {
    setDirectoryLoading(true);
    try {
      const [listRes, statsRes] = await Promise.all([
        api.getStudentDirectory({ page, limit: 50, search: search || undefined, department: dept || undefined }),
        api.getStudentDirectoryStats(),
      ]);
      setDirectoryStudents(listRes.students);
      setDirectoryTotal(listRes.total);
      setDirectoryPage(listRes.page);
      setDirectoryTotalPages(listRes.total_pages);
      setDirectoryStats(statsRes);
    } catch (err: unknown) {
      setStatusMsg(`❌ ${errorMessage(err, "Failed loading student directory.")}`);
    } finally {
      setDirectoryLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "directory") {
      void loadDirectoryData(1, directorySearch, directoryDeptFilter);
    }
  }, [activeTab, directorySearch, directoryDeptFilter]);

  const handleUploadDirectory = async () => {
    if (!directoryUploadFile) return;
    setDirectoryUploading(true);
    setDirectoryUploadResult(null);
    try {
      const res = await api.uploadStudentDirectory(directoryUploadFile);
      setDirectoryUploadResult(res);
      setStatusMsg(`✅ ${res.message}`);
      setDirectoryUploadFile(null);
      void loadDirectoryData(1);
    } catch (err: unknown) {
      setStatusMsg(`❌ ${errorMessage(err, "Failed uploading directory file.")}`);
    } finally {
      setDirectoryUploading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const blob = await api.downloadStudentDirectoryTemplate();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "student_directory_template.csv";
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err: unknown) {
      setStatusMsg(`❌ ${errorMessage(err, "Failed downloading directory template.")}`);
    }
  };

  const handleClearDirectory = async () => {
    setClearingDirectory(true);
    try {
      const res = await api.clearStudentDirectory();
      setStatusMsg(`✅ ${res.message}`);
      setShowClearDirectoryModal(false);
      void loadDirectoryData(1);
    } catch (err: unknown) {
      setStatusMsg(`❌ ${errorMessage(err, "Failed clearing student directory.")}`);
    } finally {
      setClearingDirectory(false);
    }
  };

  const handleDeleteDirectoryRecord = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove "${name}" from the student directory?`)) return;
    try {
      const res = await api.deleteStudentDirectoryRecord(id);
      setStatusMsg(`✅ ${res.message}`);
      void loadDirectoryData(directoryPage);
    } catch (err: unknown) {
      setStatusMsg(`❌ ${errorMessage(err, "Failed deleting record.")}`);
    }
  };

  const handleToggleEventAutofill = async (eventId: string, currentVal: boolean) => {
    try {
      const res = await api.toggleEventAutofill(eventId, !currentVal);
      setStatusMsg(`✅ ${res.message}`);
      setEvents((prev) =>
        prev.map((ev) => (ev.id === eventId ? { ...ev, allow_autofill: res.allow_autofill } : ev))
      );
    } catch (err: unknown) {
      setStatusMsg(`❌ ${errorMessage(err, "Failed toggling event autofill.")}`);
    }
  };

  const tabs: { key: Tab; label: string; icon: React.ReactNode; color: string }[] = [
    { key: "overview", label: "Overview", icon: <LayoutDashboard className="w-4 h-4" />, color: "text-pink-600" },
    { key: "events", label: "Events", icon: <Settings className="w-4 h-4" />, color: "text-blue-600" },
    { key: "accounts", label: "Staff accounts", icon: <UserRoundPlus className="w-4 h-4" />, color: "text-blue-700" },
    { key: "directory", label: "Student Directory", icon: <Database className="w-4 h-4" />, color: "text-indigo-600" },
    { key: "registrations", label: "Registrations", icon: <Users className="w-4 h-4" />, color: "text-slate-700" },
    { key: "payments", label: "Payments", icon: <CreditCard className="w-4 h-4" />, color: "text-emerald-600" },
    { key: "entries", label: "Gate Entries", icon: <QrCode className="w-4 h-4" />, color: "text-blue-600" },
    { key: "offline", label: "Offline Cash", icon: <Banknote className="w-4 h-4" />, color: "text-pink-600" },
    { key: "daily-report", label: "Daily Report", icon: <BarChart3 className="w-4 h-4" />, color: "text-violet-600" },
    { key: "settlements", label: "Settlements", icon: <Receipt className="w-4 h-4" />, color: "text-amber-600" },
    { key: "audit", label: "Audit Logs", icon: <Activity className="w-4 h-4" />, color: "text-rose-600" },
  ];
  const visibleTabs = isAdmin
    ? tabs
    : tabs.filter((tab) => tab.key !== "audit" && tab.key !== "accounts" && tab.key !== "events" && tab.key !== "directory");

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
                  else if (activeTab === "daily-report") void loadDailyReport(eventId);
                  else if (activeTab === "settlements") void loadSettlements(eventId);
                }}
                className="field-control !min-h-10 !w-auto !border-white/25 !bg-white/10 !text-white"
              >
                {isAdmin && <option value="" className="text-slate-900">All events</option>}
                {events.map((event) => <option key={event.id} value={event.id} className="text-slate-900">{event.title}</option>)}
              </select>
            )}
            <button onClick={handleDownloadCSV} className="button-primary button-accent !min-h-10 !px-3 !text-[10px]">
              <FileSpreadsheet className="h-4 w-4" /><span>Export report</span>
            </button>
            <button onClick={() => void loadDashboard(selectedEventId)} className="button-primary !min-h-10 !border-white/25 !bg-white/10 !px-3 !text-[10px] hover:!bg-white/20">
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
              sub={`Online ₹${metrics?.online_revenue || 0} | Cash ₹${metrics?.offline_revenue || 0}${isSuperAdmin && metrics?.total_convenience_fee ? ` | Fee ₹${metrics.total_convenience_fee.toFixed(2)}` : ""}`}
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
          <div className={`grid gap-4 ${isSuperAdmin ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-3"}`}>
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
              <div className="text-[11px] font-semibold text-slate-500 mt-1">
                1st Yr: <span className="font-bold text-indigo-700">{metrics?.first_year_tickets ?? 0}</span> &bull; 2nd Yr: <span className="font-bold text-purple-700">{metrics?.second_year_tickets ?? 0}</span>
              </div>
            </div>
            {isSuperAdmin && (
              <div className="panel p-5 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200">
                <div className="text-xs text-amber-800 font-bold uppercase">Rudvay Tech Fee (₹3.79)</div>
                <div className="text-2xl font-black text-amber-900 mt-1">
                  ₹{(metrics?.total_convenience_fee || 0).toFixed(2)}
                </div>
                <div className="text-[11px] font-semibold text-amber-700 mt-1">
                  GST &amp; Convenience ({metrics?.online_paid_count || 0} online payments)
                </div>
              </div>
            )}
          </div>

          {/* Announcement & Emergency Banners Controller (ADMIN & SUPER ADMIN) */}
          {isAdmin && (
            <div className="panel space-y-5 p-5 md:p-6 bg-gradient-to-br from-slate-900 via-[#16201b] to-slate-900 text-white border border-amber-300/30 shadow-md">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400/20 text-amber-300 border border-amber-400/30">
                    <Megaphone className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Live Site Banners & Operations Control</h3>
                    <p className="text-xs text-slate-300">
                      Toggle emergency announcements, registration pause, and maintenance banners across the public website.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => loadBannerSettings()}
                    disabled={savingBannerSettings}
                    className="button-secondary !py-1.5 !px-3 !text-xs text-slate-200 border-white/20 bg-white/5 hover:bg-white/10 flex items-center gap-1.5"
                    title="Refresh status"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${savingBannerSettings ? "animate-spin" : ""}`} />
                    <span>Sync Live Status</span>
                  </button>
                </div>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                {/* 1. Registrations Closed Banner (Admin + Super Admin) */}
                <div className="rounded-2xl border border-rose-500/30 bg-[#250d12]/80 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <AlertOctagon className="h-4 w-4 text-rose-400 shrink-0" />
                      <div>
                        <h4 className="text-xs font-bold text-rose-200 uppercase tracking-wide">
                          Registrations Closed Banner
                        </h4>
                        <p className="text-[10px] text-rose-300/80">Toggleable by Admin & Super Admin</p>
                      </div>
                    </div>
                    <label htmlFor="toggle-closed-banner" className="relative inline-flex cursor-pointer items-center">
                      <input
                        id="toggle-closed-banner"
                        type="checkbox"
                        checked={closedBannerDraft}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setClosedBannerDraft(checked);
                          void handleSaveBannerSettings({ registrations_closed: checked });
                        }}
                        disabled={savingBannerSettings}
                        className="sr-only peer"
                      />
                      <div className="h-6 w-11 rounded-full bg-slate-700 peer-checked:bg-rose-600 peer-focus:outline-none transition-colors after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-full" />
                    </label>
                  </div>

                  <div className="flex items-center justify-between text-[11px] pt-1">
                    <span className="text-slate-400 font-medium">Public Status:</span>
                    <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] border ${
                      closedBannerDraft
                        ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                        : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                    }`}>
                      {closedBannerDraft ? "REGISTRATIONS CLOSED (BANNER ON)" : "REGISTRATIONS OPEN"}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="closed-banner-text" className="text-[11px] font-semibold text-slate-300">
                      Banner Message / Helpline Notice:
                    </label>
                    <textarea
                      id="closed-banner-text"
                      rows={2}
                      value={closedTextDraft}
                      onChange={(e) => setClosedTextDraft(e.target.value)}
                      placeholder="Registrations are closed. For more details or spot registrations, contact the Freshers Organizing Team."
                      className="w-full rounded-lg border border-rose-500/30 bg-black/40 px-3 py-1.5 text-xs text-rose-100 placeholder-rose-300/40 focus:border-rose-400 focus:outline-none"
                    />
                  </div>

                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => handleSaveBannerSettings()}
                      disabled={savingBannerSettings}
                      className="button-primary !min-h-[32px] !px-3 !text-xs !bg-rose-700 hover:!bg-rose-600 border border-rose-400/40 text-white font-bold"
                    >
                      {savingBannerSettings ? "Saving..." : "Save Closed Notice"}
                    </button>
                  </div>
                </div>

                {/* 2. Website Under Maintenance Mode (Super Admin Only) */}
                <div className={`rounded-2xl border p-4 space-y-3 ${
                  isSuperAdmin
                    ? "border-amber-500/30 bg-[#291e0a]/80"
                    : "border-slate-800 bg-slate-900/60 opacity-60"
                }`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Wrench className="h-4 w-4 text-amber-400 shrink-0" />
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-amber-200 uppercase tracking-wide">
                            Website Maintenance Mode
                          </h4>
                          {!isSuperAdmin && (
                            <span className="inline-flex items-center gap-1 rounded bg-slate-800 px-1.5 py-0.5 text-[9px] font-bold text-slate-400">
                              <Lock className="h-2.5 w-2.5" /> Super Admin Only
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-amber-300/80">
                          {isSuperAdmin
                            ? "Toggle ON when redeploying or applying system changes"
                            : "Restricted to Super Admin role"}
                        </p>
                      </div>
                    </div>

                    <label htmlFor="toggle-maint-banner" className={`relative inline-flex items-center ${isSuperAdmin ? "cursor-pointer" : "cursor-not-allowed"}`}>
                      <input
                        id="toggle-maint-banner"
                        type="checkbox"
                        checked={maintBannerDraft}
                        disabled={!isSuperAdmin || savingBannerSettings}
                        onChange={(e) => {
                          if (!isSuperAdmin) return;
                          const checked = e.target.checked;
                          setMaintBannerDraft(checked);
                          void handleSaveBannerSettings({ maintenance_mode: checked });
                        }}
                        className="sr-only peer"
                      />
                      <div className="h-6 w-11 rounded-full bg-slate-700 peer-checked:bg-amber-500 peer-focus:outline-none transition-colors after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-full" />
                    </label>
                  </div>

                  <div className="flex items-center justify-between text-[11px] pt-1">
                    <span className="text-slate-400 font-medium">Public Status:</span>
                    <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] border ${
                      maintBannerDraft
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse"
                        : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                    }`}>
                      {maintBannerDraft ? "MAINTENANCE ACTIVE (REDEPLOY MODE)" : "SITE OPERATIONAL"}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="maint-banner-text" className="text-[11px] font-semibold text-slate-300">
                      Maintenance Quote & Reassurance Text:
                    </label>
                    <textarea
                      id="maint-banner-text"
                      rows={2}
                      disabled={!isSuperAdmin}
                      value={maintTextDraft}
                      onChange={(e) => setMaintTextDraft(e.target.value)}
                      placeholder="Website is Under Maintenance. This maintenance is to ensure your seamless experience and proper security. The website will be live within 10-15 minutes."
                      className="w-full rounded-lg border border-amber-500/30 bg-black/40 px-3 py-1.5 text-xs text-amber-100 placeholder-amber-300/40 focus:border-amber-400 focus:outline-none disabled:opacity-50"
                    />
                  </div>

                  {isSuperAdmin && (
                    <div className="text-right">
                      <button
                        type="button"
                        onClick={() => handleSaveBannerSettings()}
                        disabled={savingBannerSettings}
                        className="button-primary !min-h-[32px] !px-3 !text-xs !bg-amber-500 hover:!bg-amber-400 border border-amber-300/40 text-black font-bold"
                      >
                        {savingBannerSettings ? "Saving..." : "Save Maintenance Mode"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* GST & Convenience Fee Settings Panel (SUPER ADMIN ONLY) */}
          {isSuperAdmin && (
            <div className="panel space-y-4 p-5 md:p-6 bg-gradient-to-br from-amber-50/80 to-orange-50/50 border border-amber-200 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-200/80 pb-3">
                <div className="flex items-center gap-2 text-amber-950">
                  <CreditCard className="h-5 w-5 text-amber-700 shrink-0" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">GST & Convenience Fee Control (Super Admin)</h3>
                    <p className="text-[11px] text-amber-800">
                      Enable or disable transaction fee at checkout and configure fee amount.
                    </p>
                  </div>
                </div>
                <span
                  className={`px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider rounded-full border ${
                    feeEnabledDraft
                      ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                      : "bg-slate-100 text-slate-600 border-slate-300"
                  }`}
                >
                  {feeEnabledDraft ? "FEE ENABLED AT CHECKOUT" : "FEE DISABLED"}
                </span>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 items-center">
                <div className="flex items-center justify-between gap-4 bg-white p-3.5 rounded-xl border border-amber-200/80 shadow-2xs">
                  <div>
                    <div className="text-xs font-bold text-slate-900">Enable Fee at Checkout</div>
                    <p className="text-[10px] text-slate-500">Collects fee on online transactions</p>
                  </div>
                  <label htmlFor="toggle-convenience-fee" className="relative inline-flex cursor-pointer items-center">
                    <input
                      id="toggle-convenience-fee"
                      type="checkbox"
                      checked={feeEnabledDraft}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setFeeEnabledDraft(checked);
                        void handleSaveFeeSettings(checked);
                      }}
                      className="sr-only peer"
                    />
                    <div className="h-6 w-11 rounded-full bg-slate-300 peer-checked:bg-amber-600 peer-focus:outline-none transition-colors duration-200 ease-in-out after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full" />
                  </label>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-amber-200/80 shadow-2xs space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <label htmlFor="fee-amount-input" className="font-bold text-slate-900">Fee Amount (₹)</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      id="fee-amount-input"
                      type="number"
                      step="0.01"
                      min="0"
                      disabled={savingFeeSettings}
                      value={feeAmountDraft}
                      onChange={(e) => setFeeAmountDraft(e.target.value)}
                      placeholder="3.79"
                      className="field-control font-mono !py-1.5 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveFeeSettings()}
                      disabled={savingFeeSettings}
                      className="button-primary button-accent !min-h-[38px] !px-4 !text-xs whitespace-nowrap"
                    >
                      {savingFeeSettings ? "Saving..." : "Save Fee"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Payment Gateways Controller (SUPER ADMIN ONLY) */}
          {isSuperAdmin && (
            <div className="panel space-y-4 p-5 md:p-6 bg-gradient-to-br from-indigo-50/80 to-blue-50/50 border border-indigo-200 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-indigo-200/80 pb-3">
                <div className="flex items-center gap-2 text-indigo-950">
                  <CreditCard className="h-5 w-5 text-indigo-700 shrink-0" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Payment Gateways Controller (Super Admin)</h3>
                    <p className="text-[11px] text-indigo-800">
                      Configure active gateways, switch global default provider, and control provider states anytime.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-indigo-900">Default Gateway:</span>
                  <select
                    disabled={savingGatewaySettings}
                    value={gatewaySettings?.default_gateway || "RAZORPAY"}
                    onChange={(e) => void handleUpdateDefaultGateway(e.target.value)}
                    className="px-2.5 py-1 text-xs font-bold rounded-lg border border-indigo-300 bg-white text-indigo-900 shadow-2xs focus:outline-indigo-500"
                  >
                    <option value="RAZORPAY">Razorpay</option>
                    <option value="CASHFREE">Cashfree</option>
                    <option value="PHONEPE">PhonePe</option>
                  </select>
                </div>
              </div>

              {/* Gateways Grid */}
              <div className="grid gap-3 sm:grid-cols-3">
                {/* Razorpay Card */}
                <div className={`p-4 rounded-xl border bg-white shadow-2xs flex flex-col justify-between ${
                  gatewaySettings?.default_gateway === "RAZORPAY" ? "border-indigo-400 ring-2 ring-indigo-300" : "border-slate-200"
                }`}>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-extrabold text-sm text-slate-900">Razorpay</span>
                      {gatewaySettings?.default_gateway === "RAZORPAY" && (
                        <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-700 rounded-md">
                          DEFAULT
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mb-2">Standard modal & UPI payments</p>
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-700">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>{gatewaySettings?.gateways?.RAZORPAY?.configured ? "Configured in .env" : "Pending Keys"}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-4 pt-2 border-t border-slate-100">
                    <span className="text-[11px] text-slate-600 font-medium">Gateway Active</span>
                    <input
                      type="checkbox"
                      checked={gatewaySettings?.gateways?.RAZORPAY?.enabled ?? true}
                      onChange={(e) => void handleToggleGateway("razorpay", e.target.checked)}
                      disabled={savingGatewaySettings}
                      className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                    />
                  </div>
                </div>

                {/* Cashfree Card */}
                <div className={`p-4 rounded-xl border bg-white shadow-2xs flex flex-col justify-between ${
                  gatewaySettings?.default_gateway === "CASHFREE" ? "border-indigo-400 ring-2 ring-indigo-300" : "border-slate-200"
                }`}>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-extrabold text-sm text-slate-900">Cashfree</span>
                      {gatewaySettings?.default_gateway === "CASHFREE" && (
                        <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-700 rounded-md">
                          DEFAULT
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mb-2">Seamless Drop Checkout & UPI</p>
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-700">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>Test / Sandbox Connected</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-4 pt-2 border-t border-slate-100">
                    <span className="text-[11px] text-slate-600 font-medium">Gateway Active</span>
                    <input
                      type="checkbox"
                      checked={gatewaySettings?.gateways?.CASHFREE?.enabled ?? true}
                      onChange={(e) => void handleToggleGateway("cashfree", e.target.checked)}
                      disabled={savingGatewaySettings}
                      className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                    />
                  </div>
                </div>

                {/* PhonePe Card */}
                <div className={`p-4 rounded-xl border bg-white shadow-2xs flex flex-col justify-between ${
                  gatewaySettings?.default_gateway === "PHONEPE" ? "border-indigo-400 ring-2 ring-indigo-300" : "border-slate-200"
                }`}>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-extrabold text-sm text-slate-900">PhonePe</span>
                      {gatewaySettings?.default_gateway === "PHONEPE" && (
                        <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-700 rounded-md">
                          DEFAULT
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mb-2">Standard PG Checkout & Pay Page</p>
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-700">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>UAT / Sandbox Connected</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-4 pt-2 border-t border-slate-100">
                    <span className="text-[11px] text-slate-600 font-medium">Gateway Active</span>
                    <input
                      type="checkbox"
                      checked={gatewaySettings?.gateways?.PHONEPE?.enabled ?? true}
                      onChange={(e) => void handleToggleGateway("phonepe", e.target.checked)}
                      disabled={savingGatewaySettings}
                      className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

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
                      <div className="text-[10px] text-slate-400 mt-0.5">{new Date(log.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</div>
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
            {isAdmin && (
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
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Payment Gateway</label>
                  <select value={createForm.payment_gateway || "DEFAULT"}
                    onChange={e => setCreateForm(p => ({...p, payment_gateway: e.target.value}))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none">
                    <option value="DEFAULT">⚙️ System Default ({gatewaySettings?.default_gateway || "RAZORPAY"})</option>
                    <option value="RAZORPAY">Razorpay</option>
                    <option value="CASHFREE">Cashfree (Sandbox / Live)</option>
                    <option value="PHONEPE">PhonePe (UAT / Live)</option>
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
              <div key={ev.id} className="panel p-5">
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
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
                    <span className="flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" />{new Date(ev.start_time).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</span>
                    <span className={`font-extrabold uppercase tracking-[.08em] ${registrationAvailability(ev).open ? "text-emerald-700" : "text-rose-700"}`}>
                      {registrationAvailability(ev).label}
                    </span>
                  </div>
                  <div className="mt-1 text-[10px] text-slate-400">
                    Scheduled {new Date(ev.registration_start).toLocaleDateString()} – {new Date(ev.registration_end).toLocaleDateString()}
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (editingFullEventId === ev.id) {
                          setEditingFullEventId(null);
                        } else {
                          handleOpenEditEventModal(ev);
                        }
                      }}
                      className="inline-flex min-h-10 items-center gap-2 border border-pink-300 bg-pink-50 px-3 text-[10px] font-extrabold uppercase tracking-[.08em] text-pink-700 hover:bg-pink-100"
                    >
                      <Edit3 className="h-3.5 w-3.5" /> {editingFullEventId === ev.id ? "Close Edit" : "Edit Event Form"}
                    </button>
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
                )}
                </div>
                {editingFullEventId === ev.id && (
                  <form onSubmit={handleSaveFullEvent} className="mt-4 space-y-4 border-t border-slate-200 pt-4 bg-slate-50 p-4 rounded-xl">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Edit All Event Details ({ev.title})</h4>
                      <button type="button" onClick={() => setEditingFullEventId(null)} className="text-xs text-slate-500 font-bold hover:text-slate-700">
                        Cancel
                      </button>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="text-[10px] font-extrabold uppercase tracking-[.08em] text-slate-600">Title</label>
                        <input
                          type="text"
                          required
                          value={editEventForm.title}
                          onChange={(e) => setEditEventForm((f) => ({ ...f, title: e.target.value }))}
                          className="field-control mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-extrabold uppercase tracking-[.08em] text-slate-600">Slug</label>
                        <input
                          type="text"
                          required
                          value={editEventForm.slug}
                          onChange={(e) => setEditEventForm((f) => ({ ...f, slug: e.target.value }))}
                          className="field-control mt-1"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-extrabold uppercase tracking-[.08em] text-slate-600">Description</label>
                      <textarea
                        rows={2}
                        value={editEventForm.description || ""}
                        onChange={(e) => setEditEventForm((f) => ({ ...f, description: e.target.value }))}
                        className="field-control mt-1"
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <div>
                        <label className="text-[10px] font-extrabold uppercase tracking-[.08em] text-slate-600">Venue</label>
                        <input
                          type="text"
                          required
                          value={editEventForm.venue}
                          onChange={(e) => setEditEventForm((f) => ({ ...f, venue: e.target.value }))}
                          className="field-control mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-extrabold uppercase tracking-[.08em] text-slate-600">Event Type</label>
                        <select
                          value={editEventForm.event_type}
                          onChange={(e) => setEditEventForm((f) => ({ ...f, event_type: e.target.value }))}
                          className="field-control mt-1"
                        >
                          <option value="FRESHERS">FRESHERS</option>
                          <option value="FAREWELL">FAREWELL</option>
                          <option value="CULTURAL">CULTURAL</option>
                          <option value="CONCERT">CONCERT</option>
                          <option value="WORKSHOP">WORKSHOP</option>
                          <option value="OTHER">OTHER</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-extrabold uppercase tracking-[.08em] text-slate-600">Status</label>
                        <select
                          value={editEventForm.status}
                          onChange={(e) => setEditEventForm((f) => ({ ...f, status: e.target.value as EventStatus }))}
                          className="field-control mt-1"
                        >
                          <option value="DRAFT">DRAFT</option>
                          <option value="PUBLISHED">PUBLISHED</option>
                          <option value="LIVE">LIVE</option>
                          <option value="REGISTRATION_CLOSED">REGISTRATION CLOSED</option>
                          <option value="COMPLETED">COMPLETED</option>
                          <option value="CANCELLED">CANCELLED</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <label className="text-[10px] font-extrabold uppercase tracking-[.08em] text-slate-600">Event Start Time</label>
                        <input
                          type="datetime-local"
                          required
                          value={editEventForm.start_time}
                          onChange={(e) => setEditEventForm((f) => ({ ...f, start_time: e.target.value }))}
                          className="field-control mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-extrabold uppercase tracking-[.08em] text-slate-600">Event End Time</label>
                        <input
                          type="datetime-local"
                          required
                          value={editEventForm.end_time}
                          onChange={(e) => setEditEventForm((f) => ({ ...f, end_time: e.target.value }))}
                          className="field-control mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-extrabold uppercase tracking-[.08em] text-slate-600">Reg Start Time</label>
                        <input
                          type="datetime-local"
                          required
                          value={editEventForm.registration_start}
                          onChange={(e) => setEditEventForm((f) => ({ ...f, registration_start: e.target.value }))}
                          className="field-control mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-extrabold uppercase tracking-[.08em] text-slate-600">Reg End Time</label>
                        <input
                          type="datetime-local"
                          required
                          value={editEventForm.registration_end}
                          onChange={(e) => setEditEventForm((f) => ({ ...f, registration_end: e.target.value }))}
                          className="field-control mt-1"
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <label className="text-[10px] font-extrabold uppercase tracking-[.08em] text-slate-600">Capacity</label>
                        <input
                          type="number"
                          min="1"
                          required
                          value={editEventForm.capacity}
                          onChange={(e) => setEditEventForm((f) => ({ ...f, capacity: Number(e.target.value) }))}
                          className="field-control mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-extrabold uppercase tracking-[.08em] text-slate-600">Default Price (₹)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          required
                          value={editEventForm.ticket_price}
                          onChange={(e) => setEditEventForm((f) => ({ ...f, ticket_price: Number(e.target.value) }))}
                          className="field-control mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-extrabold uppercase tracking-[.08em] text-slate-600">1st Year Price (₹)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          required
                          value={editEventForm.first_year_ticket_price}
                          onChange={(e) => setEditEventForm((f) => ({ ...f, first_year_ticket_price: Number(e.target.value) }))}
                          className="field-control mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-extrabold uppercase tracking-[.08em] text-slate-600">2nd Year Price (₹)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          required
                          value={editEventForm.second_year_ticket_price}
                          onChange={(e) => setEditEventForm((f) => ({ ...f, second_year_ticket_price: Number(e.target.value) }))}
                          className="field-control mt-1"
                        />
                      </div>
                    </div>

                    <div className="pt-2">
                      <label className="text-[10px] font-extrabold uppercase tracking-[.08em] text-slate-600">
                        Payment Gateway for this Event
                      </label>
                      <select
                        value={editEventForm.payment_gateway || "DEFAULT"}
                        onChange={(e) => setEditEventForm((f) => ({ ...f, payment_gateway: e.target.value }))}
                        className="field-control mt-1 font-semibold text-xs text-slate-800"
                      >
                        <option value="DEFAULT">⚙️ System Default ({gatewaySettings?.default_gateway || "RAZORPAY"})</option>
                        <option value="RAZORPAY">Razorpay</option>
                        <option value="CASHFREE">Cashfree (Sandbox / Live)</option>
                        <option value="PHONEPE">PhonePe (UAT / Live)</option>
                      </select>
                      <p className="mt-1 text-[10px] text-slate-500">
                        Select which gateway processes online payments for this event. Super Admins can update this anytime.
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-6 pt-2">
                      <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editEventForm.allow_online}
                          onChange={(e) => setEditEventForm((f) => ({ ...f, allow_online: e.target.checked }))}
                          className="rounded border-slate-300 text-pink-600 focus:ring-pink-500"
                        />
                        <span>Allow Online Payment</span>
                      </label>
                      <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editEventForm.allow_offline}
                          onChange={(e) => setEditEventForm((f) => ({ ...f, allow_offline: e.target.checked }))}
                          className="rounded border-slate-300 text-pink-600 focus:ring-pink-500"
                        />
                        <span>Allow Offline Collection</span>
                      </label>
                      <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editEventForm.allow_autofill}
                          onChange={(e) => setEditEventForm((f) => ({ ...f, allow_autofill: e.target.checked }))}
                          className="rounded border-slate-300 text-pink-600 focus:ring-pink-500"
                        />
                        <span>Allow Student Details Autofill</span>
                      </label>
                      <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editEventForm.gate_validation_enabled}
                          onChange={(e) => setEditEventForm((f) => ({ ...f, gate_validation_enabled: e.target.checked }))}
                          className="rounded border-slate-300 text-pink-600 focus:ring-pink-500"
                        />
                        <span>Requires Gate Pass</span>
                      </label>
                      <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editEventForm.food_validation_enabled}
                          onChange={(e) => setEditEventForm((f) => ({ ...f, food_validation_enabled: e.target.checked }))}
                          className="rounded border-slate-300 text-pink-600 focus:ring-pink-500"
                        />
                        <span>Includes Food Pass</span>
                      </label>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        type="submit"
                        disabled={savingFullEvent}
                        className="button-primary button-accent flex-1"
                      >
                        {savingFullEvent ? "Saving All Event Details…" : "Save Complete Event Form"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingFullEventId(null)}
                        className="px-4 py-2 bg-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
                {editingPricesEventId === ev.id && (
                  <div className="mt-4 grid gap-3 border-t border-slate-200 pt-4 sm:grid-cols-2">
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

      {activeTab === "accounts" && isAdmin && (
        <section className="mx-auto max-w-5xl space-y-6">
          {/* Header Banner depending on Role */}
          {isSuperAdmin ? (
            <div className="space-y-4">
              <div>
                <p className="eyebrow !text-[#e5c86f]">Super Admin Access Control</p>
                <h2 className="editorial-title mt-1 text-3xl">Create Staff Account & Manage Privileges</h2>
                <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-600">
                  Create platform accounts and toggle specific functional privileges (Cash Desk, Gate Desk, Food Counter, Event Management) for staff members.
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
                    <label htmlFor="staff-role">Initial Role / Desk</label>
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
                      {isSuperAdmin && <option value="ADMIN">College Admin</option>}
                      <option value="GATE_STAFF">Gate Entry Staff</option>
                      <option value="FOOD_STAFF">Food Counter Staff</option>
                      <option value="EVENT_MANAGER">Event Organizer</option>
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
                  {creatingStaff ? "Creating account…" : "Create Supabase Staff Account"}
                </button>
              </form>
            </div>
          ) : (
            <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 space-y-1 shadow-sm">
              <div className="flex items-center gap-2 font-extrabold text-sm text-amber-950">
                <ShieldCheck className="w-5 h-5 text-amber-700 flex-shrink-0" />
                <span>College Admin View (Read-Only Privilege Directory)</span>
              </div>
              <p className="text-xs text-amber-800 leading-relaxed">
                As a College Admin, you can review all registered staff members and inspect their active access privileges below (what operations they can perform). Creating new staff accounts and modifying privilege toggles are managed by the Tech Team.
              </p>
            </div>
          )}

          {/* STAFF ACCOUNTS & PRIVILEGE TOGGLES DIRECTORY */}
          <div className="space-y-4 pt-4 border-t border-slate-200">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">Staff Privileges & Authorization PINs</h3>
                <p className="text-xs text-slate-500">
                  {isSuperAdmin
                    ? "Use toggle switches to grant or revoke specific operational permissions per staff member."
                    : "Inspect authorized staff capabilities and 6-digit cash desk PIN status."}
                </p>
              </div>
              <button onClick={() => void loadStaffAccounts()} className="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg flex items-center gap-1.5 transition hover:bg-slate-200">
                <RefreshCw className={`w-3.5 h-3.5 ${loadingStaff ? "animate-spin" : ""}`} />
                <span>Refresh List</span>
              </button>
            </div>

            {pinModalUser && isSuperAdmin && (
              <form onSubmit={handleSavePin} className="border-2 border-blue-500 bg-blue-50 p-5 rounded-2xl space-y-3 shadow-md">
                <div className="flex items-center justify-between">
                  <div className="font-extrabold text-sm text-blue-900 flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-blue-700" />
                    <span>Set 6-Digit Authorization PIN for {pinModalUser.full_name} ({pinModalUser.role.replace(/_/g, " ")})</span>
                  </div>
                  <button type="button" onClick={() => setPinModalUser(null)} className="text-xs text-slate-500 font-bold hover:text-slate-800">Cancel</button>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="password"
                    required
                    minLength={6}
                    maxLength={6}
                    pattern="\d{6}"
                    inputMode="numeric"
                    placeholder="Enter 6-digit PIN"
                    value={pinInputValue}
                    onChange={(e) => setPinInputValue(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="field-control max-w-xs font-mono text-center tracking-widest text-lg"
                  />
                  <button type="submit" disabled={settingPin || pinInputValue.length !== 6} className="button-primary button-accent !min-h-10 !px-4 !text-xs disabled:opacity-50">
                    {settingPin ? "Saving PIN…" : "Save PIN"}
                  </button>
                </div>
              </form>
            )}

            <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left font-extrabold text-slate-700">Staff Member</th>
                      <th className="px-4 py-3 text-left font-extrabold text-slate-700">Primary Role</th>
                      <th className="px-3 py-3 text-center font-extrabold text-slate-700">Cash Desk 💵</th>
                      <th className="px-3 py-3 text-center font-extrabold text-slate-700">Gate Entry 🚪</th>
                      <th className="px-3 py-3 text-center font-extrabold text-slate-700">Food Counter 🍱</th>
                      <th className="px-3 py-3 text-center font-extrabold text-slate-700">Event Manager 📅</th>
                      <th className="px-4 py-3 text-left font-extrabold text-slate-700">PIN Status</th>
                      <th className="px-4 py-3 text-right font-extrabold text-slate-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(() => {
                      const visibleAccounts = isSuperAdmin
                        ? staffAccounts
                        : staffAccounts.filter(
                            (acc) =>
                              !(acc.roles || [acc.role]).includes("SUPER_ADMIN") &&
                              acc.role !== "SUPER_ADMIN"
                          );

                      if (visibleAccounts.length === 0) {
                        return (
                          <tr>
                            <td colSpan={8} className="px-4 py-8 text-center text-slate-400 font-medium">
                              {loadingStaff ? "Loading staff members..." : "No staff accounts found."}
                            </td>
                          </tr>
                        );
                      }

                      return visibleAccounts.map((account) => {
                        const accountRoles = account.roles || [account.role];

                        const renderPrivilegeToggle = (roleName: string, label: string) => {
                          const hasRole = accountRoles.includes(roleName) || accountRoles.includes("SUPER_ADMIN");
                          const isPending = togglingRoleId === `${account.id}-${roleName}`;

                          if (!isSuperAdmin) {
                            return (
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold inline-flex items-center gap-1 border ${
                                hasRole
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-slate-50 text-slate-400 border-slate-200"
                              }`}>
                                {hasRole ? "✓ Allowed" : "✕ No Access"}
                              </span>
                            );
                          }

                          return (
                            <button
                              type="button"
                              disabled={isPending || accountRoles.includes("SUPER_ADMIN")}
                              onClick={() => void handleTogglePrivilege(account, roleName, hasRole)}
                              title={accountRoles.includes("SUPER_ADMIN") ? "Super Admin has full access to all capabilities" : `${hasRole ? 'Revoke' : 'Grant'} ${label} for ${account.full_name}`}
                              className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
                                hasRole ? "bg-emerald-600" : "bg-slate-300"
                              }`}
                            >
                              <span
                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                  hasRole ? "translate-x-4" : "translate-x-0"
                                }`}
                              />
                            </button>
                          );
                        };

                        return (
                          <tr key={account.id} className="hover:bg-slate-50 transition">
                            <td className="px-4 py-3">
                              <div className="font-bold text-slate-900">{account.full_name}</div>
                              <div className="font-mono text-[10px] text-slate-500">{account.email}</div>
                            </td>
                            <td className="px-4 py-3">
                              <StatusBadge status={account.role} />
                            </td>
                            <td className="px-3 py-3 text-center">
                              {renderPrivilegeToggle("OFFLINE_COLLECTOR", "Cash Desk")}
                            </td>
                            <td className="px-3 py-3 text-center">
                              {renderPrivilegeToggle("GATE_STAFF", "Gate Entry")}
                            </td>
                            <td className="px-3 py-3 text-center">
                              {renderPrivilegeToggle("FOOD_STAFF", "Food Counter")}
                            </td>
                            <td className="px-3 py-3 text-center">
                              {renderPrivilegeToggle("EVENT_MANAGER", "Event Manager")}
                            </td>
                            <td className="px-4 py-3">
                              {account.has_pin ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">PIN Set</span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200">No PIN</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {isSuperAdmin ? (
                                <button
                                  onClick={() => {
                                    setPinModalUser(account);
                                    setPinInputValue("");
                                  }}
                                  className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 font-bold rounded-md text-[10px] inline-flex items-center gap-1 transition"
                                >
                                  <KeyRound className="w-3 h-3" />
                                  <span>{account.has_pin ? "Reset PIN" : "Set PIN"}</span>
                                </button>
                              ) : (
                                <span className="text-slate-400 font-medium">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* TAB: Data Reports */}
      {["registrations", "payments", "entries", "offline", "audit"].includes(activeTab) && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap flex-1">
              <h3 className="text-sm font-extrabold text-slate-900 capitalize">
                {activeTab === "entries" ? "Gate Entries" : activeTab === "audit" ? "Audit Logs" : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Report
              </h3>
              <div className="relative min-w-[240px] max-w-md flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by Roll No, Name, Email, Ticket Code, Phone..."
                  className="w-full pl-9 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-pink-500 transition"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
            <div className="flex gap-2 items-center">
              <span className="text-xs text-slate-500 font-medium">
                {filteredReportData.length} {searchQuery ? `of ${reportData.length}` : ""} records
              </span>
              {activeTab === "registrations" && (
                <>
                  <button
                    onClick={() => void handleResendAllTickets()}
                    disabled={resendingAll}
                    title="Resend ticket pass emails to all registered participants"
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition shadow-sm disabled:opacity-50"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>{resendingAll ? "Sending to All…" : "Resend Mails to All"}</span>
                  </button>
                  <button onClick={handleDownloadCSV}
                    className="px-3 py-1.5 bg-pink-600 hover:bg-pink-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition shadow-sm">
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Export CSV</span>
                  </button>
                </>
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
                          <th className="px-4 py-3 text-left text-slate-700 font-extrabold">Email</th>
                          <th className="px-4 py-3 text-left text-slate-700 font-extrabold">Event</th>
                          <th className="px-4 py-3 text-left text-slate-700 font-extrabold">Status</th>
                          <th className="px-4 py-3 text-left text-slate-700 font-extrabold">Method</th>
                          <th className="px-4 py-3 text-left text-slate-700 font-extrabold">₹</th>
                          <th className="px-4 py-3 text-left text-slate-700 font-extrabold">Ticket Code</th>
                          <th className="px-4 py-3 text-left text-slate-700 font-extrabold">Gate</th>
                          <th className="px-4 py-3 text-left text-slate-700 font-extrabold">Food</th>
                          <th className="px-4 py-3 text-left text-slate-700 font-extrabold">Registered</th>
                          <th className="px-4 py-3 text-right text-slate-700 font-extrabold">Actions</th>
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
                          <th className="px-4 py-3 text-right text-slate-700 font-extrabold">Actions</th>
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
                          <th className="px-4 py-3 text-left text-slate-700 font-extrabold">Issued By</th>
                          <th className="px-4 py-3 text-left text-slate-700 font-extrabold">Collected At</th>
                          <th className="px-4 py-3 text-right text-slate-700 font-extrabold">Actions</th>
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
                    {filteredReportData.length === 0 ? (
                      <tr>
                        <td colSpan={12} className="px-4 py-8 text-center text-slate-400 font-medium">
                          {searchQuery ? "No matching records found." : "No data found for this report."}
                        </td>
                      </tr>
                    ) : filteredReportData.map((row, i) => {
                      const regId = String(row.registration_id || row.id || "");
                      return (
                      <tr key={String(row.id ?? i)} className="hover:bg-slate-50 transition">
                        {activeTab === "registrations" && (
                          <>
                            <td className="px-4 py-3 text-slate-900 font-bold">{row.full_name}</td>
                            <td className="px-4 py-3 font-mono text-pink-600 font-bold">{row.roll_number}</td>
                            <td className="px-4 py-3 font-mono text-slate-600">
                              {editingEmailRegId === regId ? (
                                <div className="flex items-center gap-1.5 min-w-[220px]">
                                  <input
                                    type="email"
                                    value={emailDraft}
                                    onChange={(e) => setEmailDraft(e.target.value)}
                                    className="field-control !py-1 !px-2 !text-xs font-mono"
                                    placeholder="New email"
                                  />
                                  <button
                                    onClick={() => void handleSaveRegistrationEmail(regId)}
                                    disabled={savingEmail}
                                    className="px-2 py-1 bg-emerald-600 text-white font-bold rounded text-[10px] hover:bg-emerald-700 disabled:opacity-50"
                                  >
                                    {savingEmail ? "..." : "Save"}
                                  </button>
                                  <button
                                    onClick={() => setEditingEmailRegId(null)}
                                    className="px-2 py-1 bg-slate-200 text-slate-700 font-bold rounded text-[10px] hover:bg-slate-300"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1">
                                  <span>{row.email}</span>
                                  <button
                                    onClick={() => {
                                      setEditingEmailRegId(regId);
                                      setEmailDraft(String(row.email || ""));
                                    }}
                                    title="Edit Email Address"
                                    className="text-slate-400 hover:text-blue-600 transition"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-slate-700 max-w-[120px] truncate">{row.event_title}</td>
                            <td className="px-4 py-3"><StatusBadge status={String(row.status || "")} /></td>
                            <td className="px-4 py-3 text-slate-500 font-medium">{row.payment_method}</td>
                            <td className="px-4 py-3 text-pink-600 font-bold">₹{row.ticket_price}</td>
                            <td className="px-4 py-3 font-mono text-yellow-800 bg-yellow-50 px-2 py-0.5 rounded border border-yellow-200 font-bold">{row.ticket_code || "—"}</td>
                            <td className="px-4 py-3">{row.gate_validated_at ? <span className="text-emerald-600 font-extrabold">✓</span> : <span className="text-slate-300">—</span>}</td>
                            <td className="px-4 py-3">{row.food_status === "CLAIMED" ? <span className="text-blue-600 font-extrabold">✓</span> : <span className="text-slate-300">—</span>}</td>
                            <td className="px-4 py-3 text-slate-400 font-medium">{formatReportDate(row.created_at, false)}</td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                <button
                                  onClick={() => {
                                    setEditingEmailRegId(regId);
                                    setEmailDraft(String(row.email || ""));
                                  }}
                                  className="px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 font-bold rounded text-[10px] inline-flex items-center gap-1 transition"
                                >
                                  <Edit3 className="w-3 h-3" />
                                  <span>Edit Mail</span>
                                </button>
                                {(row.ticket_code || row.status === "PAID" || row.status === "OFFLINE_PAID") ? (
                                  <button
                                    onClick={() => void handleResendMail(regId, "TICKET")}
                                    disabled={resendingTicketId === `${regId}-TICKET`}
                                    className="px-2 py-1 bg-pink-50 text-pink-700 hover:bg-pink-100 border border-pink-200 font-bold rounded text-[10px] inline-flex items-center gap-1 transition disabled:opacity-50"
                                  >
                                    <Mail className="w-3 h-3 text-pink-600" />
                                    <span>{resendingTicketId === `${regId}-TICKET` ? "Sending…" : "Resend Ticket"}</span>
                                  </button>
                                ) : (
                                  <span className="text-slate-400 text-[10px] font-medium">—</span>
                                )}
                              </div>
                            </td>
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
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                {regId ? (
                                  <>
                                    <button
                                      onClick={() => void handleResendMail(regId, "PAYMENT")}
                                      disabled={resendingTicketId === `${regId}-PAYMENT`}
                                      className="px-2 py-1 bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 font-bold rounded text-[10px] inline-flex items-center gap-1 transition disabled:opacity-50"
                                    >
                                      <Mail className="w-3 h-3 text-amber-600" />
                                      <span>{resendingTicketId === `${regId}-PAYMENT` ? "Sending…" : "Resend Pay Mail"}</span>
                                    </button>
                                    <button
                                      onClick={() => void handleResendMail(regId, "TICKET")}
                                      disabled={resendingTicketId === `${regId}-TICKET`}
                                      className="px-2 py-1 bg-pink-50 text-pink-700 hover:bg-pink-100 border border-pink-200 font-bold rounded text-[10px] inline-flex items-center gap-1 transition disabled:opacity-50"
                                    >
                                      <Mail className="w-3 h-3 text-pink-600" />
                                      <span>{resendingTicketId === `${regId}-TICKET` ? "Sending…" : "Resend Ticket"}</span>
                                    </button>
                                  </>
                                ) : (
                                  <span className="text-slate-400 text-[10px] font-medium">—</span>
                                )}
                              </div>
                            </td>
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
                            <td className="px-4 py-3 text-blue-700 font-extrabold">{row.collector_name || "—"}</td>
                            <td className="px-4 py-3 text-slate-400 text-[10px] font-medium">{formatReportDate(row.created_at)}</td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                {regId ? (
                                  <button
                                    onClick={() => void handleResendMail(regId, "TICKET")}
                                    disabled={resendingTicketId === `${regId}-TICKET`}
                                    className="px-2 py-1 bg-pink-50 text-pink-700 hover:bg-pink-100 border border-pink-200 font-bold rounded text-[10px] inline-flex items-center gap-1 transition disabled:opacity-50"
                                  >
                                    <Mail className="w-3 h-3 text-pink-600" />
                                    <span>{resendingTicketId === `${regId}-TICKET` ? "Sending…" : "Resend Ticket"}</span>
                                  </button>
                                ) : (
                                  <span className="text-slate-400 text-[10px] font-medium">—</span>
                                )}
                              </div>
                            </td>
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
                    );})}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: Student Directory */}
      {activeTab === "directory" && (
        <div className="space-y-6">
          {/* Top Info Banner */}
          <div className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50/80 via-white to-purple-50/80 p-5 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-bold uppercase tracking-wider mb-2">
                  <Database className="w-3 h-3 text-indigo-700" /> Identity Anti-Spoofing & Auto-Fill Directory
                </div>
                <h2 className="text-xl font-bold text-slate-900">Student Directory Management</h2>
                <p className="mt-1 text-xs text-slate-600 max-w-2xl leading-relaxed">
                  Upload official college records via Excel (.xlsx) or CSV. When auto-fill verification is enabled on an event, students only enter their Roll No, Mobile, and Email; their official Name and Department are auto-filled and locked to avoid booking tickets on another student&apos;s name.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold inline-flex items-center gap-2 shadow-sm transition"
                >
                  <Download className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Download Sample Template</span>
                </button>
                {directoryTotal > 0 && isSuperAdmin && (
                  <button
                    type="button"
                    onClick={() => setShowClearDirectoryModal(true)}
                    className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    <span>Clear Entire Directory</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2 items-start">
            {/* CARD 1: Multiple Uploads (Excel / CSV) */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                    <FileUp className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Upload Student Records</h3>
                    <p className="text-[11px] text-slate-500">Supports .xlsx (Excel) and .csv formats</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  Batch Upsert Enabled
                </span>
              </div>

              <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-xs text-blue-900 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <span>💡</span> Multi-batch uploads supported:
                </p>
                <p className="text-[11px] leading-relaxed text-blue-800">
                  You can upload files multiple times (e.g. by year or by branch). Existing roll numbers are updated with latest info and new roll numbers are inserted automatically without duplicates.
                </p>
              </div>

              {/* Upload Input Area */}
              <div className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-xl p-5 text-center transition bg-slate-50/50">
                <input
                  type="file"
                  id="directory-file-input"
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setDirectoryUploadFile(e.target.files[0]);
                      setDirectoryUploadResult(null);
                    }
                  }}
                />
                <label htmlFor="directory-file-input" className="cursor-pointer block">
                  <UploadCloud className="w-9 h-9 mx-auto text-indigo-500 mb-2" />
                  <p className="text-xs font-bold text-slate-800">
                    {directoryUploadFile ? directoryUploadFile.name : "Click to select Excel (.xlsx) or CSV file"}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1">
                    {directoryUploadFile
                      ? `${(directoryUploadFile.size / 1024).toFixed(1)} KB selected`
                      : "Columns: Roll Number, Full Name, Department, College, Phone, Email"}
                  </p>
                </label>
              </div>

              {directoryUploadFile && (
                <div className="flex items-center justify-between gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setDirectoryUploadFile(null)}
                    className="text-xs text-slate-500 hover:text-slate-800 font-medium"
                  >
                    Remove File
                  </button>
                  <button
                    type="button"
                    onClick={handleUploadDirectory}
                    disabled={directoryUploading}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 shadow-sm transition disabled:opacity-50"
                  >
                    {directoryUploading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Processing & Merging Records…</span>
                      </>
                    ) : (
                      <>
                        <FileUp className="w-3.5 h-3.5" />
                        <span>Upload & Merge Into Directory</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Upload Result Feedback */}
              {directoryUploadResult && (
                <div className="rounded-xl border border-emerald-300 bg-emerald-50/90 p-3.5 text-xs text-emerald-900 space-y-2">
                  <p className="font-bold flex items-center gap-1.5 text-emerald-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{directoryUploadResult.message}</span>
                  </p>
                  <div className="grid grid-cols-3 gap-2 pt-1 text-center text-[11px]">
                    <div className="p-2 rounded-lg bg-white border border-emerald-200">
                      <p className="font-bold text-emerald-700 text-sm">{directoryUploadResult.inserted}</p>
                      <p className="text-slate-500 text-[9px] uppercase font-bold">New Added</p>
                    </div>
                    <div className="p-2 rounded-lg bg-white border border-emerald-200">
                      <p className="font-bold text-blue-700 text-sm">{directoryUploadResult.updated}</p>
                      <p className="text-slate-500 text-[9px] uppercase font-bold">Updated</p>
                    </div>
                    <div className="p-2 rounded-lg bg-white border border-emerald-200">
                      <p className="font-bold text-slate-700 text-sm">{directoryUploadResult.total_processed}</p>
                      <p className="text-slate-500 text-[9px] uppercase font-bold">Total Processed</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* CARD 2: Event Autofill & Identity Locking Controls */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Event Prefill & Anti-Proxy Controls</h3>
                    <p className="text-[11px] text-slate-500">Toggle whether registrations require verified student records</p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-purple-200 bg-purple-50/60 p-3 text-xs text-purple-950 space-y-1">
                <p className="font-bold">🛡️ How identity locking works:</p>
                <p className="text-[11px] leading-relaxed text-purple-900">
                  When enabled, public registration queries this directory by roll number. The student can only enter their roll number, phone number, and email. Name and Department are auto-filled and locked, preventing anyone from booking a ticket under a fake name.
                </p>
              </div>

              {/* Event toggle list */}
              <div className="space-y-3 pt-1">
                {events.map((ev) => (
                  <div
                    key={ev.id}
                    className="flex items-center justify-between gap-4 p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 transition"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-900 truncate">{ev.title}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Slug: <span className="font-mono text-slate-700">{ev.slug}</span>
                      </p>
                      <div className="mt-1.5 flex items-center gap-2">
                        {ev.allow_autofill ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md border border-emerald-300">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Directory Prefill Enforced
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 bg-slate-200 px-2 py-0.5 rounded-md">
                            Manual Entry Allowed
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleToggleEventAutofill(ev.id, ev.allow_autofill)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition ${
                        ev.allow_autofill
                          ? "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                          : "bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700"
                      }`}
                    >
                      {ev.allow_autofill ? "Turn Off" : "Enable Lock"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* CARD 3: Directory Table & Search */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Student Directory Roster</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Showing verified students ({directoryTotal} total records)
                </p>
              </div>

              {/* Department pills */}
              {directoryStats && directoryStats.departments.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setDirectoryDeptFilter("")}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition ${
                      !directoryDeptFilter
                        ? "bg-indigo-600 text-white border-indigo-700"
                        : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                    }`}
                  >
                    All ({directoryStats.total_students})
                  </button>
                  {directoryStats.departments.slice(0, 6).map((d) => (
                    <button
                      key={d.department}
                      type="button"
                      onClick={() => setDirectoryDeptFilter(d.department === directoryDeptFilter ? "" : d.department)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition ${
                        directoryDeptFilter === d.department
                          ? "bg-indigo-600 text-white border-indigo-700"
                          : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                      }`}
                    >
                      {d.department} ({d.count})
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Search and Filters */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="relative min-w-[260px] max-w-md flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={directorySearch}
                  onChange={(e) => setDirectorySearch(e.target.value)}
                  placeholder="Search by Roll Number, Full Name, or Branch…"
                  className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-indigo-500 transition"
                />
                {directorySearch && (
                  <button
                    onClick={() => setDirectorySearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void loadDirectoryData(directoryPage)}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${directoryLoading ? "animate-spin text-indigo-600" : ""}`} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto max-h-[500px]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 sticky top-0 border-b border-slate-200 z-10">
                    <tr>
                      <th className="px-4 py-3">Roll Number</th>
                      <th className="px-4 py-3">Full Name</th>
                      <th className="px-4 py-3">Branch</th>
                      <th className="px-4 py-3">Institution</th>
                      <th className="px-4 py-3">Mobile</th>
                      <th className="px-4 py-3">Official Mail</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {directoryLoading ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                          <RefreshCw className="w-5 h-5 animate-spin mx-auto text-indigo-600 mb-2" />
                          <span>Loading student records…</span>
                        </td>
                      </tr>
                    ) : directoryStudents.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                          <Database className="w-7 h-7 mx-auto text-slate-400 mb-2" />
                          <p className="font-bold text-slate-700">No student records found</p>
                          <p className="text-xs text-slate-400 mt-1">
                            {directorySearch
                              ? "No students match your search criteria."
                              : "Upload an Excel (.xlsx) or CSV file above to populate the directory."}
                          </p>
                        </td>
                      </tr>
                    ) : (
                      directoryStudents.map((st) => (
                        <tr key={st.id} className="hover:bg-slate-50/80 transition">
                          <td className="px-4 py-3 font-mono font-bold text-indigo-700">
                            {st.roll_number}
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-900">
                            {st.full_name}
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              {st.department}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-600 truncate max-w-[180px]">
                            {st.college_name || "Sphoorthy Engineering College"}
                          </td>
                          <td className="px-4 py-3 text-slate-600 font-mono text-[11px]">
                            {st.phone || "—"}
                          </td>
                          <td className="px-4 py-3 text-slate-600 text-[11px] truncate max-w-[180px]">
                            {st.email || "—"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => void handleDeleteDirectoryRecord(st.id, st.full_name)}
                              className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition"
                              title="Delete record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination Controls */}
            {directoryTotalPages > 1 && (
              <div className="flex items-center justify-between gap-4 pt-2">
                <p className="text-xs text-slate-500">
                  Page <span className="font-bold text-slate-800">{directoryPage}</span> of{" "}
                  <span className="font-bold text-slate-800">{directoryTotalPages}</span> ({directoryTotal} students)
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={directoryPage <= 1}
                    onClick={() => void loadDirectoryData(directoryPage - 1)}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={directoryPage >= directoryTotalPages}
                    onClick={() => void loadDirectoryData(directoryPage + 1)}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Modal: Clear Directory Confirmation */}
          {showClearDirectoryModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl border border-rose-200 space-y-4">
                <div className="flex items-center gap-3 text-rose-600">
                  <div className="p-2 bg-rose-100 rounded-xl">
                    <Trash2 className="w-6 h-6 text-rose-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Clear Student Directory?</h3>
                    <p className="text-xs text-slate-500">Irreversible operation</p>
                  </div>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  This will remove all <strong>{directoryTotal}</strong> student records from the database. Event registrations will no longer be able to auto-verify against this directory until a new roster is uploaded.
                </p>
                <div className="flex gap-2 pt-2 justify-end">
                  <button
                    type="button"
                    disabled={clearingDirectory}
                    onClick={() => setShowClearDirectoryModal(false)}
                    className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={clearingDirectory}
                    onClick={handleClearDirectory}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-50"
                  >
                    {clearingDirectory ? "Clearing Directory…" : "Yes, Delete All Records"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {/* TAB: Daily Report */}
      {activeTab === "daily-report" && (
        <div className="space-y-6">
          <div className="border-b border-slate-200 pb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="eyebrow">Financial Operations</p>
              <h2 className="editorial-title mt-2 text-3xl">Daily Revenue Report</h2>
              <p className="mt-1 text-xs text-slate-500">
                Per-day breakdown of tickets issued and revenue collected — online and cash separately.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
              <span>Event:</span>
              <span className="font-bold text-slate-900">
                {events.find(e => e.id === (selectedEventId || events[0]?.id))?.title || "Active Event"}
              </span>
            </div>
          </div>

          {(!selectedEventId && events.length === 0) ? (
            <div className="panel p-8 text-center text-sm text-slate-500">
              <BarChart3 className="w-8 h-8 mx-auto text-slate-300 mb-3" />
              Please create an event to view the daily report.
            </div>
          ) : dailyReportLoading ? (
            <div className="flex items-center justify-center p-10 gap-2 text-slate-400">
              <RefreshCw className="w-4 h-4 animate-spin text-violet-600" />
              <span className="text-sm">Loading daily report...</span>
            </div>
          ) : (
            <>
              {/* Channel toggle */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDailyChannel("ONLINE")}
                  className={`px-4 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wider border transition ${
                    dailyChannel === "ONLINE"
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  💳 Online (Razorpay)
                </button>
                <button
                  onClick={() => setDailyChannel("CASH")}
                  className={`px-4 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wider border transition ${
                    dailyChannel === "CASH"
                      ? "bg-pink-600 text-white border-pink-600"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  💵 Cash (Offline)
                </button>
                <button
                  onClick={() => void loadDailyReport()}
                  className="ml-auto px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Grand total summary cards */}
              {dailyRevenue && (
                <div className={`grid gap-4 ${isSuperAdmin ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-1 md:grid-cols-3"}`}>
                  <div className="panel p-4 bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-200">
                    <div className="text-[10px] font-extrabold uppercase text-emerald-700">Online Tickets Issued</div>
                    <div className="text-2xl font-black text-emerald-800 mt-1">{dailyRevenue.totals.total_online_tickets}</div>
                    <div className="text-[11px] font-semibold text-emerald-600 mt-1">
                      1st Yr: {dailyRevenue.totals.total_online_first_year_tickets ?? 0} &bull; 2nd Yr: {dailyRevenue.totals.total_online_second_year_tickets ?? 0}
                    </div>
                  </div>
                  <div className="panel p-4 bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200">
                    <div className="text-[10px] font-extrabold uppercase text-emerald-700">
                      {isSuperAdmin ? "Institution Online Revenue" : "Online Revenue"}
                    </div>
                    <div className="text-2xl font-black text-emerald-800 mt-1">₹{dailyRevenue.totals.total_online_amount.toLocaleString()}</div>
                    <div className="text-[11px] font-semibold text-emerald-600 mt-1">
                      {isSuperAdmin ? "₹500 / ₹600 Base Ticket Share" : "₹500 / ₹600 Ticket Collection"}
                    </div>
                  </div>
                  <div className="panel p-4 bg-gradient-to-br from-pink-50 to-rose-50 border-pink-200">
                    <div className="text-[10px] font-extrabold uppercase text-pink-700">Offline Cash Revenue</div>
                    <div className="text-2xl font-black text-pink-800 mt-1">₹{dailyRevenue.totals.total_cash_amount.toLocaleString()}</div>
                    <div className="text-[11px] font-semibold text-pink-600 mt-1">
                      {dailyRevenue.totals.total_cash_tickets} tickets (1st: {dailyRevenue.totals.total_cash_first_year_tickets ?? 0}, 2nd: {dailyRevenue.totals.total_cash_second_year_tickets ?? 0})
                    </div>
                  </div>
                  {isSuperAdmin && (
                    <div className="panel p-4 bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
                      <div className="text-[10px] font-extrabold uppercase text-amber-700">Rudvay Tech &bull; GST &amp; Convenience</div>
                      <div className="text-2xl font-black text-amber-900 mt-1">₹{(dailyRevenue.totals.total_convenience_fee ?? 0).toLocaleString()}</div>
                      <div className="text-[11px] font-semibold text-amber-700 mt-1">
                        ₹3.79 per transaction ({dailyRevenue.totals.total_online_tickets} online payments)
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Grand Total Banner */}
              {dailyRevenue && (
                <div className="panel p-4 flex flex-wrap justify-between items-center gap-4 bg-gradient-to-r from-violet-50 to-indigo-50 border-violet-200">
                  <div>
                    <div className="text-[10px] font-extrabold uppercase text-violet-700">Total Tickets Issued (All Channels)</div>
                    <div className="flex items-baseline gap-3 mt-1">
                      <div className="text-3xl font-black text-violet-900">{dailyRevenue.totals.total_tickets}</div>
                      <div className="flex items-center gap-2 text-xs font-bold text-violet-800 bg-violet-100/90 px-3 py-1 rounded-lg border border-violet-200">
                        <span>1st Year: <span className="text-violet-950 font-black">{dailyRevenue.totals.total_first_year_tickets ?? 0}</span></span>
                        <span className="text-violet-400">|</span>
                        <span>2nd Year: <span className="text-violet-950 font-black">{dailyRevenue.totals.total_second_year_tickets ?? 0}</span></span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-extrabold uppercase text-violet-700">
                      {isSuperAdmin ? "Institution Total (Excluding Fee)" : "Total Revenue"}
                    </div>
                    <div className="text-3xl font-black text-violet-900 mt-0.5">₹{dailyRevenue.totals.total_amount.toLocaleString()}</div>
                    {isSuperAdmin && (
                      <div className="text-[11px] font-semibold text-slate-500 mt-0.5">
                        Gross Collected: ₹{(dailyRevenue.totals.total_gross_amount ?? dailyRevenue.totals.total_amount).toLocaleString()} &bull; Rudvay Fee: ₹{(dailyRevenue.totals.total_convenience_fee ?? 0).toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Daily Revenue Table */}
              <div className="panel overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-violet-600" />
                    {dailyChannel === "ONLINE" ? "Online (Razorpay) Daily Breakdown" : "Cash (Offline) Daily Breakdown"}
                  </h3>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {(dailyChannel === "ONLINE" ? dailyRevenue?.online : dailyRevenue?.cash)?.length ?? 0} day(s) of data
                  </span>
                </div>
                <div className="overflow-x-auto max-h-96 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 text-left font-extrabold text-slate-700">Date</th>
                        <th className="px-4 py-3 text-right font-extrabold text-indigo-700 bg-indigo-50/50">1st Year (26)</th>
                        <th className="px-4 py-3 text-right font-extrabold text-purple-700 bg-purple-50/50">2nd Year (25)</th>
                        <th className="px-4 py-3 text-right font-extrabold text-slate-900 bg-slate-100/50">Total Tickets</th>
                        <th className="px-4 py-3 text-right font-extrabold text-emerald-700">
                          {isSuperAdmin ? "Institution Share (₹)" : "Amount (₹)"}
                        </th>
                        {isSuperAdmin && dailyChannel === "ONLINE" && (
                          <th className="px-4 py-3 text-right font-extrabold text-amber-700 bg-amber-50/50">Rudvay Fee (₹3.79)</th>
                        )}
                        {isSuperAdmin && dailyChannel === "ONLINE" && (
                          <th className="px-4 py-3 text-right font-extrabold text-slate-700">Gross Gateway (₹)</th>
                        )}
                        <th className="px-4 py-3 text-right font-extrabold text-slate-500">Cumulative Tickets</th>
                        <th className="px-4 py-3 text-right font-extrabold text-slate-500">
                          {isSuperAdmin ? "Cumulative Institution (₹)" : "Cumulative Amount (₹)"}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(() => {
                        const rows = dailyChannel === "ONLINE" ? dailyRevenue?.online : dailyRevenue?.cash;
                        if (!rows || rows.length === 0) {
                          return (
                            <tr>
                              <td colSpan={(dailyChannel === "ONLINE" && isSuperAdmin) ? 9 : 7} className="px-4 py-8 text-center text-slate-400">
                                No {dailyChannel.toLowerCase()} transactions recorded yet.
                              </td>
                            </tr>
                          );
                        }
                        return rows.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition">
                            <td className="px-4 py-3 font-mono font-bold text-slate-900">{row.date}</td>
                            <td className="px-4 py-3 text-right font-bold text-indigo-700 bg-indigo-50/20">
                              <span className="inline-flex items-center justify-end px-2 py-0.5 rounded-md bg-indigo-50/80 border border-indigo-200/60 font-mono text-[11px]">
                                {row.first_year_tickets ?? 0}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-purple-700 bg-purple-50/20">
                              <span className="inline-flex items-center justify-end px-2 py-0.5 rounded-md bg-purple-50/80 border border-purple-200/60 font-mono text-[11px]">
                                {row.second_year_tickets ?? 0}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-black text-slate-900 bg-slate-50/30">
                              {row.tickets_issued}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-emerald-700">₹{row.amount.toLocaleString()}</td>
                            {isSuperAdmin && dailyChannel === "ONLINE" && (
                              <td className="px-4 py-3 text-right font-semibold text-amber-800 bg-amber-50/20">
                                ₹{(row.convenience_fee ?? 0).toLocaleString()}
                              </td>
                            )}
                            {isSuperAdmin && dailyChannel === "ONLINE" && (
                              <td className="px-4 py-3 text-right font-semibold text-slate-600">
                                ₹{(row.gross_amount ?? row.amount).toLocaleString()}
                              </td>
                            )}
                            <td className="px-4 py-3 text-right text-slate-500">{row.cumulative_tickets}</td>
                            <td className="px-4 py-3 text-right text-slate-500">₹{row.cumulative_amount.toLocaleString()}</td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                    {/* Grand Total Row */}
                    {dailyRevenue && (
                      <tfoot>
                        <tr className="bg-slate-900 text-white">
                          <td className="px-4 py-3 font-extrabold text-[11px] uppercase tracking-wider">TOTAL</td>
                          <td className="px-4 py-3 text-right font-extrabold text-indigo-300">
                            {dailyChannel === "ONLINE"
                              ? (dailyRevenue.totals.total_online_first_year_tickets ?? 0)
                              : (dailyRevenue.totals.total_cash_first_year_tickets ?? 0)}
                          </td>
                          <td className="px-4 py-3 text-right font-extrabold text-purple-300">
                            {dailyChannel === "ONLINE"
                              ? (dailyRevenue.totals.total_online_second_year_tickets ?? 0)
                              : (dailyRevenue.totals.total_cash_second_year_tickets ?? 0)}
                          </td>
                          <td className="px-4 py-3 text-right font-black text-white">
                            {dailyChannel === "ONLINE" ? dailyRevenue.totals.total_online_tickets : dailyRevenue.totals.total_cash_tickets}
                          </td>
                          <td className="px-4 py-3 text-right font-extrabold text-emerald-400">
                            ₹{(dailyChannel === "ONLINE" ? dailyRevenue.totals.total_online_amount : dailyRevenue.totals.total_cash_amount).toLocaleString()}
                          </td>
                          {isSuperAdmin && dailyChannel === "ONLINE" && (
                            <td className="px-4 py-3 text-right font-extrabold text-amber-300">
                              ₹{(dailyRevenue.totals.total_online_convenience_fee ?? 0).toLocaleString()}
                            </td>
                          )}
                          {isSuperAdmin && dailyChannel === "ONLINE" && (
                            <td className="px-4 py-3 text-right font-extrabold text-slate-300">
                              ₹{(dailyRevenue.totals.total_online_gross_amount ?? dailyRevenue.totals.total_online_amount).toLocaleString()}
                            </td>
                          )}
                          <td className="px-4 py-3 text-right" colSpan={2}></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>

              {/* Per-Collector Breakdown */}
              <div className="panel overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                    <Users className="w-4 h-4 text-pink-600" />
                    Cash Collector Breakdown
                  </h3>
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] font-bold text-slate-600 uppercase">Filter by date:</label>
                    <input
                      type="date"
                      value={collectorDateFilter}
                      onChange={(e) => setCollectorDateFilter(e.target.value)}
                      className="field-control !py-1 !px-2 !text-xs !w-auto"
                    />
                    {collectorDateFilter && (
                      <button
                        onClick={() => setCollectorDateFilter("")}
                        className="text-xs text-slate-400 hover:text-slate-700 font-bold"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 text-left font-extrabold text-slate-700">Date</th>
                        <th className="px-4 py-3 text-left font-extrabold text-slate-700">Collector Name</th>
                        <th className="px-4 py-3 text-left font-extrabold text-slate-700">Email</th>
                        <th className="px-4 py-3 text-right font-extrabold text-slate-700">Tickets Collected</th>
                        <th className="px-4 py-3 text-right font-extrabold text-slate-700">Cash Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {dailyCollectors.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                            No cash collector records {collectorDateFilter ? `for ${collectorDateFilter}` : "yet"}.
                          </td>
                        </tr>
                      ) : (
                        dailyCollectors.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition">
                            <td className="px-4 py-3 font-mono font-bold text-slate-800">{row.date}</td>
                            <td className="px-4 py-3 font-bold text-slate-900">{row.collector_name}</td>
                            <td className="px-4 py-3 text-slate-500 font-mono text-[10px]">{row.collector_email}</td>
                            <td className="px-4 py-3 text-right font-bold">{row.tickets_count}</td>
                            <td className="px-4 py-3 text-right font-bold text-pink-700">₹{row.total_cash.toLocaleString()}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {dailyCollectors.length > 0 && (
                      <tfoot>
                        <tr className="bg-slate-900 text-white">
                          <td className="px-4 py-3 font-extrabold text-[11px] uppercase" colSpan={3}>TOTAL</td>
                          <td className="px-4 py-3 text-right font-extrabold">
                            {dailyCollectors.reduce((s, r) => s + r.tickets_count, 0)}
                          </td>
                          <td className="px-4 py-3 text-right font-extrabold text-emerald-400">
                            ₹{dailyCollectors.reduce((s, r) => s + r.total_cash, 0).toLocaleString()}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB: Settlements */}
      {activeTab === "settlements" && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <p className="eyebrow">Finance Management</p>
              <h2 className="editorial-title mt-2 text-3xl">Settlements</h2>
              <p className="mt-1 text-xs text-slate-500">
                Track daily collections and mark them as settled to the organizing committee.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => void loadSettlements()}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${settlementsLoading ? "animate-spin" : ""}`} />
              </button>
              {isSuperAdmin && (
                <button
                  onClick={() => setShowCreateSettlementModal(true)}
                  className="button-primary button-accent !min-h-10 !px-4 !text-[10px]"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Settlement Record</span>
                </button>
              )}
            </div>
          </div>

          {settlementsLoading ? (
            <div className="flex items-center justify-center p-10 gap-2 text-slate-400">
              <RefreshCw className="w-4 h-4 animate-spin text-amber-600" />
              <span className="text-sm">Loading settlements...</span>
            </div>
          ) : settlements.length === 0 ? (
            <div className="panel p-10 text-center">
              <Receipt className="w-8 h-8 mx-auto text-slate-300 mb-3" />
              <p className="text-sm text-slate-500">
                No settlement records found.
                {isSuperAdmin && " Create one using the button above."}
              </p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left font-extrabold text-slate-700">Receipt No.</th>
                      <th className="px-4 py-3 text-left font-extrabold text-slate-700">Date</th>
                      <th className="px-4 py-3 text-left font-extrabold text-slate-700">Event</th>
                      <th className="px-4 py-3 text-right font-extrabold text-slate-700">Online (₹)</th>
                      <th className="px-4 py-3 text-right font-extrabold text-slate-700">Cash (₹)</th>
                      <th className="px-4 py-3 text-right font-extrabold text-slate-700">Total (₹)</th>
                      <th className="px-4 py-3 text-center font-extrabold text-slate-700">Status</th>
                      <th className="px-4 py-3 text-right font-extrabold text-slate-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {settlements.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50 transition">
                        <td className="px-4 py-3 font-mono font-bold text-slate-800 text-[11px]">{s.receipt_number || "—"}</td>
                        <td className="px-4 py-3 font-mono font-bold text-slate-900">{s.settlement_date}</td>
                        <td className="px-4 py-3 text-slate-600">{s.event_title || "All Events"}</td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-700">₹{s.total_online_amount.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right font-bold text-pink-700">₹{s.total_cash_amount.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right font-extrabold text-slate-900">₹{s.total_amount.toLocaleString()}</td>
                        <td className="px-4 py-3 text-center">
                          {s.is_settled ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckSquare className="w-3 h-3" /> SETTLED
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200">
                              <AlertCircle className="w-3 h-3" /> PENDING
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1.5">
                            {s.is_settled ? (
                              <button
                                onClick={() => setReceiptSettlement(s)}
                                className="px-2.5 py-1 bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-200 font-bold rounded-lg text-[10px] inline-flex items-center gap-1 transition"
                              >
                                <Receipt className="w-3 h-3" /> View Receipt
                              </button>
                            ) : isSuperAdmin ? (
                              <button
                                onClick={() => {
                                  setSettlingId(s.id);
                                  setSettlementForm({
                                    receiver_name: "",
                                    bank_name: "",
                                    account_number: "",
                                    ifsc_code: "",
                                    transaction_id: "",
                                    transaction_date: new Date().toISOString().slice(0, 10),
                                    notes: "",
                                    authorized_by_name: "",
                                  });
                                  setShowSettleModal(true);
                                }}
                                className="px-2.5 py-1 bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 font-bold rounded-lg text-[10px] inline-flex items-center gap-1 transition"
                              >
                                <CheckSquare className="w-3 h-3" /> Mark Settled
                              </button>
                            ) : (
                              <span className="text-slate-400 text-[10px] font-medium">Pending settlement</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Create Settlement Modal */}
          {showCreateSettlementModal && isSuperAdmin && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200">
                <div className="p-6 border-b border-slate-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900">Create Settlement Record</h3>
                      <p className="text-xs text-slate-500 mt-0.5">Enter the daily totals for this settlement period.</p>
                    </div>
                    <button onClick={() => setShowCreateSettlementModal(false)} className="text-slate-400 hover:text-slate-700">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <form onSubmit={handleCreateSettlement} className="p-6 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="text-[10px] font-extrabold uppercase text-slate-600">Settlement Date *</label>
                      <input
                        type="date"
                        required
                        value={newSettlementForm.settlement_date}
                        onChange={(e) => setNewSettlementForm((f) => ({ ...f, settlement_date: e.target.value }))}
                        className="field-control mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-extrabold uppercase text-slate-600">Event (leave blank = all events)</label>
                      <select
                        value={newSettlementForm.event_id}
                        onChange={(e) => setNewSettlementForm((f) => ({ ...f, event_id: e.target.value }))}
                        className="field-control mt-1"
                      >
                        <option value="">All Events</option>
                        {events.map((ev) => (
                          <option key={ev.id} value={ev.id}>{ev.title}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-extrabold uppercase text-slate-600">Online Amount (₹) *</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        value={newSettlementForm.total_online_amount}
                        onChange={(e) => setNewSettlementForm((f) => ({ ...f, total_online_amount: Number(e.target.value) }))}
                        className="field-control mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-extrabold uppercase text-slate-600">Cash Amount (₹) *</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        value={newSettlementForm.total_cash_amount}
                        onChange={(e) => setNewSettlementForm((f) => ({ ...f, total_cash_amount: Number(e.target.value) }))}
                        className="field-control mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-extrabold uppercase text-slate-600">Tickets Issued *</label>
                      <input
                        type="number"
                        min="0"
                        required
                        value={newSettlementForm.total_tickets_issued}
                        onChange={(e) => setNewSettlementForm((f) => ({ ...f, total_tickets_issued: Number(e.target.value) }))}
                        className="field-control mt-1"
                      />
                    </div>
                    <div className="flex items-end">
                      <div className="field-control mt-1 bg-slate-50 flex items-center justify-between px-3 py-2.5">
                        <span className="text-[10px] text-slate-500 font-bold uppercase">Total Amount</span>
                        <span className="font-extrabold text-slate-900">
                          ₹{(Number(newSettlementForm.total_online_amount) + Number(newSettlementForm.total_cash_amount)).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowCreateSettlementModal(false)}
                      className="flex-1 px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={creatingSettlement}
                      className="flex-1 button-primary button-accent"
                    >
                      {creatingSettlement ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                      {creatingSettlement ? "Creating..." : "Create Record"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Mark as Settled Modal */}
          {showSettleModal && settlingId && isSuperAdmin && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-amber-200 max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-amber-100 bg-amber-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-amber-100 rounded-xl">
                        <Building2 className="w-5 h-5 text-amber-700" />
                      </div>
                      <div>
                        <h3 className="text-base font-extrabold text-slate-900">Mark as Settled</h3>
                        <p className="text-xs text-amber-700 mt-0.5">Enter bank transfer details to generate settlement receipt.</p>
                      </div>
                    </div>
                    <button onClick={() => setShowSettleModal(false)} className="text-slate-400 hover:text-slate-700">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <form onSubmit={handleMarkSettled} className="p-6 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-extrabold uppercase text-slate-600">Receiver / Beneficiary Name *</label>
                      <input
                        type="text"
                        required
                        value={settlementForm.receiver_name}
                        onChange={(e) => setSettlementForm((f) => ({ ...f, receiver_name: e.target.value }))}
                        placeholder="e.g. Sphoorthy Engineering College"
                        className="field-control mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-extrabold uppercase text-slate-600">Bank Name *</label>
                      <input
                        type="text"
                        required
                        value={settlementForm.bank_name}
                        onChange={(e) => setSettlementForm((f) => ({ ...f, bank_name: e.target.value }))}
                        placeholder="e.g. State Bank of India"
                        className="field-control mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-extrabold uppercase text-slate-600">Account Number *</label>
                      <input
                        type="text"
                        required
                        value={settlementForm.account_number}
                        onChange={(e) => setSettlementForm((f) => ({ ...f, account_number: e.target.value }))}
                        placeholder="Bank account number"
                        className="field-control mt-1 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-extrabold uppercase text-slate-600">IFSC Code *</label>
                      <input
                        type="text"
                        required
                        value={settlementForm.ifsc_code}
                        onChange={(e) => setSettlementForm((f) => ({ ...f, ifsc_code: e.target.value.toUpperCase() }))}
                        placeholder="e.g. SBIN0001234"
                        className="field-control mt-1 font-mono uppercase"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-extrabold uppercase text-slate-600">UTR / Transaction ID *</label>
                      <input
                        type="text"
                        required
                        value={settlementForm.transaction_id}
                        onChange={(e) => setSettlementForm((f) => ({ ...f, transaction_id: e.target.value }))}
                        placeholder="e.g. UTR123456789012"
                        className="field-control mt-1 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-extrabold uppercase text-slate-600">Transaction Date</label>
                      <input
                        type="date"
                        value={settlementForm.transaction_date}
                        onChange={(e) => setSettlementForm((f) => ({ ...f, transaction_date: e.target.value }))}
                        className="field-control mt-1"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-extrabold uppercase text-slate-600">Authorized By (Name & Designation)</label>
                      <input
                        type="text"
                        value={settlementForm.authorized_by_name}
                        onChange={(e) => setSettlementForm((f) => ({ ...f, authorized_by_name: e.target.value }))}
                        placeholder="e.g. Dr. Rajesh Kumar, Principal"
                        className="field-control mt-1"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-extrabold uppercase text-slate-600">Notes / Remarks</label>
                      <textarea
                        rows={2}
                        value={settlementForm.notes}
                        onChange={(e) => setSettlementForm((f) => ({ ...f, notes: e.target.value }))}
                        placeholder="Optional remarks for this settlement..."
                        className="field-control mt-1"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowSettleModal(false)}
                      className="flex-1 px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submittingSettle}
                      className="flex-1 button-primary button-accent"
                    >
                      {submittingSettle ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckSquare className="w-3.5 h-3.5" />}
                      {submittingSettle ? "Processing..." : "Confirm Settlement & Generate Receipt"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Settlement Receipt Modal */}
          {receiptSettlement && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
              <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 max-h-[95vh] overflow-y-auto">
                <div className="flex items-center justify-between p-4 border-b border-slate-100 no-print">
                  <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-violet-600" /> Settlement Receipt
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={handlePrintReceipt}
                      className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition"
                    >
                      <Printer className="w-3.5 h-3.5" /> Print / Save PDF
                    </button>
                    <button
                      onClick={() => setReceiptSettlement(null)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition"
                    >
                      Close
                    </button>
                  </div>
                </div>

                {/* Receipt Content */}
                <div id="settlement-receipt" ref={receiptRef} className="p-8 space-y-6">
                  {/* Header */}
                  <div className="text-center border-b-2 border-slate-900 pb-5">
                    <div className="text-2xl font-extrabold text-slate-900 tracking-tight">SPHOORTHY ENGINEERING COLLEGE</div>
                    <div className="text-sm text-slate-600 mt-1">Student Event Management — Financial Settlement Receipt</div>
                    <div className="mt-3 inline-block bg-slate-900 text-white px-4 py-1 rounded-full text-xs font-extrabold tracking-widest">
                      {receiptSettlement.receipt_number || "RECEIPT"}
                    </div>
                  </div>

                  {/* Two-column summary */}
                  <div className="grid grid-cols-2 gap-6 text-sm">
                    <div className="space-y-2">
                      <div>
                        <span className="text-[10px] font-extrabold uppercase text-slate-500">Settlement Date</span>
                        <div className="font-bold text-slate-900">{receiptSettlement.settlement_date}</div>
                      </div>
                      <div>
                        <span className="text-[10px] font-extrabold uppercase text-slate-500">Event</span>
                        <div className="font-bold text-slate-900">{receiptSettlement.event_title || "All Events"}</div>
                      </div>
                      <div>
                        <span className="text-[10px] font-extrabold uppercase text-slate-500">Tickets Issued</span>
                        <div className="font-bold text-slate-900">{receiptSettlement.total_tickets_issued}</div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <span className="text-[10px] font-extrabold uppercase text-slate-500">Receipt Generated At</span>
                        <div className="font-bold text-slate-900">
                          {receiptSettlement.settled_at ? new Date(receiptSettlement.settled_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "—"}
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] font-extrabold uppercase text-slate-500">Processed By</span>
                        <div className="font-bold text-slate-900">{receiptSettlement.settler_name || receiptSettlement.settler_email || "—"}</div>
                      </div>
                    </div>
                  </div>

                  {/* Amount Breakdown */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="bg-slate-50 px-4 py-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-600">Amount Breakdown</div>
                    <table className="w-full text-sm">
                      <tbody>
                        <tr className="border-b border-slate-100">
                          <td className="px-4 py-2.5 text-slate-600">Online Collections (Razorpay)</td>
                          <td className="px-4 py-2.5 text-right font-bold text-emerald-700">₹{receiptSettlement.total_online_amount.toLocaleString()}</td>
                        </tr>
                        <tr className="border-b border-slate-100">
                          <td className="px-4 py-2.5 text-slate-600">Cash Collections (Offline)</td>
                          <td className="px-4 py-2.5 text-right font-bold text-pink-700">₹{receiptSettlement.total_cash_amount.toLocaleString()}</td>
                        </tr>
                        <tr className="bg-slate-900 text-white">
                          <td className="px-4 py-3 font-extrabold">TOTAL SETTLED AMOUNT</td>
                          <td className="px-4 py-3 text-right font-extrabold text-emerald-400 text-base">₹{receiptSettlement.total_amount.toLocaleString()}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Bank Details */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="bg-slate-50 px-4 py-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-600">Bank Transfer Details</div>
                    <div className="grid grid-cols-2 gap-4 p-4 text-sm">
                      <div>
                        <div className="text-[10px] font-extrabold uppercase text-slate-500">Beneficiary Name</div>
                        <div className="font-bold text-slate-900">{receiptSettlement.receiver_name || "—"}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-extrabold uppercase text-slate-500">Bank Name</div>
                        <div className="font-bold text-slate-900">{receiptSettlement.bank_name || "—"}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-extrabold uppercase text-slate-500">Account Number</div>
                        <div className="font-bold font-mono text-slate-900">{receiptSettlement.account_number || "—"}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-extrabold uppercase text-slate-500">IFSC Code</div>
                        <div className="font-bold font-mono text-slate-900">{receiptSettlement.ifsc_code || "—"}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-extrabold uppercase text-slate-500">UTR / Transaction ID</div>
                        <div className="font-bold font-mono text-slate-900">{receiptSettlement.transaction_id || "—"}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-extrabold uppercase text-slate-500">Transaction Date</div>
                        <div className="font-bold text-slate-900">{receiptSettlement.transaction_date || "—"}</div>
                      </div>
                    </div>
                    {receiptSettlement.notes && (
                      <div className="px-4 pb-4">
                        <div className="text-[10px] font-extrabold uppercase text-slate-500">Notes</div>
                        <div className="text-sm text-slate-700 mt-0.5">{receiptSettlement.notes}</div>
                      </div>
                    )}
                  </div>

                  {/* Signature Block */}
                  <div className="grid grid-cols-2 gap-8 pt-4">
                    <div className="border-t-2 border-slate-300 pt-3">
                      <div className="text-[10px] font-extrabold uppercase text-slate-500">Authorized By</div>
                      <div className="font-bold text-slate-900 mt-1">{receiptSettlement.authorized_by_name || "—"}</div>
                      <div className="text-[10px] text-slate-400">Signature</div>
                    </div>
                    <div className="border-t-2 border-slate-300 pt-3">
                      <div className="text-[10px] font-extrabold uppercase text-slate-500">Received By (Organizing Committee)</div>
                      <div className="mt-6 h-px bg-slate-300" />
                      <div className="text-[10px] text-slate-400 mt-1">Signature & Date</div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="text-center text-[10px] text-slate-400 border-t border-slate-100 pt-4">
                    This is a computer-generated settlement receipt. Generated by Sphoorthy Events Platform.
                  </div>
                </div>
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
  return dateOnly
    ? date.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })
    : date.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
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
