import { supabase } from "@/lib/supabase";
import { getApiBaseUrl } from "@/lib/api-url";
import type {
  AuditLog,
  CollectorSummary,
  DashboardMetrics,
  Event,
  EventCreateInput,
  EventUpdateInput,
  OfflineRegistrationInput,
  OfflineRegistrationResult,
  PaymentOrder,
  PaymentVerification,
  RegistrationResponse,
  RegistrationInput,
  ReportRow,
  StudentDirectoryRecord,
  Ticket,
  ValidationResult,
} from "@/lib/types";

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const { data: sessionData } = supabase
    ? await supabase.auth.getSession()
    : { data: { session: null } };
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (sessionData.session?.access_token) {
    headers.set("Authorization", `Bearer ${sessionData.session.access_token}`);
  }

  const response = await fetch(`${getApiBaseUrl()}${endpoint}`, {
    ...options,
    headers,
  });
  const data: unknown = await response.json().catch(() => ({}));

  if (!response.ok) {
    let message = `HTTP ${response.status}: Request failed`;
    if (typeof data === "object" && data !== null) {
      if ("error" in data && typeof data.error === "string") {
        message = data.error;
      }
      if (
        "details" in data &&
        Array.isArray(data.details) &&
        data.details.length > 0 &&
        (!("error" in data) || data.error === "Validation error")
      ) {
        const detailMsgs = (data.details as Array<{ loc?: string[]; msg?: string }>)
          .map((d) => {
            const field = Array.isArray(d.loc) && d.loc.length > 0 ? d.loc[d.loc.length - 1] : "";
            return d.msg ? `${field ? field + ": " : ""}${d.msg}` : null;
          })
          .filter(Boolean);
        if (detailMsgs.length > 0) {
          message = `Validation error: ${detailMsgs.join("; ")}`;
        }
      }
    }
    throw new Error(message);
  }

  return data as T;
}

export const api = {
  getEvents: (status = "PUBLISHED") =>
    apiFetch<{ events: Event[] }>(`/events?status=${encodeURIComponent(status)}`),
  getOperationalEvents: async () => {
    const [published, live] = await Promise.all([
      apiFetch<{ events: Event[] }>("/events?status=PUBLISHED"),
      apiFetch<{ events: Event[] }>("/events?status=LIVE"),
    ]);
    const uniqueEvents = new Map(
      [...published.events, ...live.events].map((event) => [event.id, event]),
    );
    return {
      events: Array.from(uniqueEvents.values()).sort(
        (first, second) => Date.parse(first.start_time) - Date.parse(second.start_time),
      ),
    };
  },
  getEventBySlug: (slug: string) =>
    apiFetch<Event>(`/events/${encodeURIComponent(slug)}`),
  autofillStudent: (eventId: string, rollNumber: string) =>
    apiFetch<StudentDirectoryRecord>(
      `/events/${encodeURIComponent(eventId)}/autofill/${encodeURIComponent(rollNumber)}`,
    ),

  registerStudent: (eventId: string, payload: RegistrationInput) =>
    apiFetch<RegistrationResponse>(
      `/events/${encodeURIComponent(eventId)}/register`,
      { method: "POST", body: JSON.stringify(payload) },
    ),

  sendPaymentLinkEmail: (registrationId: string, registrationToken: string) =>
    apiFetch<{ message: string }>(
      `/registrations/${encodeURIComponent(registrationId)}/payment-link-email`,
      {
        method: "POST",
        headers: { "X-Registration-Token": registrationToken },
      },
    ),

  createPaymentOrder: (registrationId: string, registrationToken?: string) =>
    apiFetch<PaymentOrder>("/payments/create-order", {
      method: "POST",
      body: JSON.stringify({ registration_id: registrationId }),
      headers: registrationToken ? { "X-Registration-Token": registrationToken } : undefined,
    }),
  verifyPayment: (payload: {
    registration_id: string;
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }, registrationToken?: string) =>
    apiFetch<PaymentVerification>("/payments/verify", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: registrationToken ? { "X-Registration-Token": registrationToken } : undefined,
    }),

  getTicket: (ticketId: string, registrationToken?: string, ticketToken?: string) =>
    apiFetch<{ ticket: Ticket }>(`/tickets/${encodeURIComponent(ticketId)}`, {
      headers: {
        ...(registrationToken ? { "X-Registration-Token": registrationToken } : {}),
        ...(ticketToken ? { "X-Ticket-Token": ticketToken } : {}),
      },
    }),
  resendTicket: (ticketId: string) =>
    apiFetch<{ message: string }>(`/tickets/${encodeURIComponent(ticketId)}/resend`, {
      method: "POST",
    }),

  validateGate: (payload: {
    event_id: string;
    qr_token?: string;
    ticket_code?: string;
    gate_location?: string;
  }) =>
    apiFetch<ValidationResult>("/validation/gate", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  validateFood: (payload: {
    event_id: string;
    qr_token?: string;
    ticket_code?: string;
    food_location?: string;
  }) =>
    apiFetch<ValidationResult>("/validation/food", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  registerOfflineCash: (payload: OfflineRegistrationInput) =>
    apiFetch<OfflineRegistrationResult>("/offline/registrations", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getCollectorSummary: (eventId?: string) =>
    apiFetch<CollectorSummary>(
      `/offline/summary${eventId ? `?event_id=${encodeURIComponent(eventId)}` : ""}`,
    ),

  getAdminMetrics: (eventId?: string) =>
    apiFetch<DashboardMetrics>(
      `/admin/dashboard${eventId ? `?event_id=${encodeURIComponent(eventId)}` : ""}`,
    ),
  getAuditLogs: (limit = 100) =>
    apiFetch<{ audit_logs: AuditLog[] }>(`/admin/audit-logs?limit=${limit}`),

  adminListEvents: (status?: string) =>
    apiFetch<{ events: Event[] }>(
      `/admin/events${status ? `?status=${encodeURIComponent(status)}` : ""}`,
    ),
  createEvent: (payload: EventCreateInput) =>
    apiFetch<{ message: string; event: Event }>("/admin/events", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateEvent: (eventId: string, payload: EventUpdateInput) =>
    apiFetch<{ message: string; event: Event }>(
      `/admin/events/${encodeURIComponent(eventId)}`,
      { method: "PATCH", body: JSON.stringify(payload) },
    ),
  createStaffAccount: (payload: {
    email: string;
    full_name: string;
    password: string;
    role: "EVENT_MANAGER" | "GATE_STAFF" | "FOOD_STAFF";
    event_id?: string;
  }) =>
    apiFetch<{
      message: string;
      account: { id: string; email: string; full_name: string; role: string };
    }>("/admin/staff-accounts", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  listStaffAccounts: () =>
    apiFetch<{ staff_accounts: import("./types").StaffAccount[] }>("/admin/staff-accounts"),
  setStaffPin: (userId: string, pin: string) =>
    apiFetch<{ message: string }>(`/admin/staff-accounts/${encodeURIComponent(userId)}/pin`, {
      method: "POST",
      body: JSON.stringify({ pin }),
    }),

  getRegistrationsReport: (eventId?: string) =>
    apiFetch<{ registrations: ReportRow[] }>(
      `/admin/reports/registrations${eventId ? `?event_id=${encodeURIComponent(eventId)}` : ""}`,
    ),
  getPaymentsReport: (eventId?: string) =>
    apiFetch<{ payments: ReportRow[] }>(
      `/admin/reports/payments${eventId ? `?event_id=${encodeURIComponent(eventId)}` : ""}`,
    ),
  getEntriesReport: (eventId?: string) =>
    apiFetch<{ entries: ReportRow[] }>(
      `/admin/reports/entries${eventId ? `?event_id=${encodeURIComponent(eventId)}` : ""}`,
    ),
  getOfflineReport: (eventId?: string) =>
    apiFetch<{ offline_collections: ReportRow[] }>(
      `/admin/reports/offline${eventId ? `?event_id=${encodeURIComponent(eventId)}` : ""}`,
    ),
  downloadRegistrationsCsv: async (eventId?: string): Promise<Blob> => {
    const { data: sessionData } = supabase
      ? await supabase.auth.getSession()
      : { data: { session: null } };
    const headers = new Headers();
    if (sessionData.session?.access_token) {
      headers.set("Authorization", `Bearer ${sessionData.session.access_token}`);
    }
    const query = eventId ? `?event_id=${encodeURIComponent(eventId)}` : "";
    const response = await fetch(`${getApiBaseUrl()}/admin/reports/registrations/csv${query}`, {
      headers,
    });
    if (!response.ok) {
      const data: unknown = await response.json().catch(() => ({}));
      const message =
        typeof data === "object" && data !== null && "error" in data && typeof data.error === "string"
          ? data.error
          : `HTTP ${response.status}: CSV export failed`;
      throw new Error(message);
    }
    return response.blob();
  },
  getCurrentUser: () =>
    apiFetch<{ user: { id: string; email: string | null; full_name: string }; roles: string[] }>(
      "/auth/me",
    ),
};
