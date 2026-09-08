import type { QueryClient } from "@tanstack/react-query";
import { fetchDashboardData, fetchUnfollowedLeads } from "@/lib/queries/dashboard";
import { fetchTodayAttendance } from "@/lib/queries/attendance";
import { fetchCustomers, fetchCustomerCounts } from "@/lib/queries/customers";
import { fetchCustomer, fetchCustomerRelated } from "@/lib/queries/customer-detail";
import {
  LIST_STALE_MS,
  fetchConstructions,
  fetchContracts,
  fetchCraftsmen,
  fetchEstimates,
  fetchInvoices,
  fetchProfiles,
} from "@/lib/queries/lists";
import { getCurrentFiscalYear } from "@/lib/bi-utils";

const LIST = LIST_STALE_MS;
const DETAIL = 60_000;

function pathOnly(href: string) {
  return href.split("?")[0];
}

/** サイドバー hover / グループ展開時に React Query へ先読みする */
export function prefetchRouteData(queryClient: QueryClient, href: string) {
  const path = pathOnly(href);
  switch (path) {
    case "/dashboard":
      void queryClient.prefetchQuery({ queryKey: ["dashboard-data"], queryFn: fetchDashboardData, staleTime: LIST });
      void queryClient.prefetchQuery({ queryKey: ["today-attendance"], queryFn: fetchTodayAttendance, staleTime: LIST });
      void queryClient.prefetchQuery({ queryKey: ["unfollowed-leads", 7], queryFn: () => fetchUnfollowedLeads(7), staleTime: LIST });
      break;
    case "/crm":
      void queryClient.prefetchQuery({
        queryKey: ["customers", 1, ""],
        queryFn: () => fetchCustomers({ page: 1, limit: 50 }),
        staleTime: LIST,
      });
      void queryClient.prefetchQuery({ queryKey: ["customer-counts"], queryFn: fetchCustomerCounts, staleTime: LIST });
      break;
    case "/quotes":
      void queryClient.prefetchQuery({ queryKey: ["estimates"], queryFn: fetchEstimates, staleTime: LIST });
      void queryClient.prefetchQuery({
        queryKey: ["quotes-customers"],
        queryFn: () => fetchCustomers({ page: 1, limit: 100 }).then((r) => r.customers),
        staleTime: LIST,
      });
      break;
    case "/constructions":
      void queryClient.prefetchQuery({ queryKey: ["constructions"], queryFn: fetchConstructions, staleTime: LIST });
      void queryClient.prefetchQuery({ queryKey: ["profiles"], queryFn: fetchProfiles, staleTime: 5 * 60_000 });
      break;
    case "/contracts":
      void queryClient.prefetchQuery({ queryKey: ["contracts"], queryFn: fetchContracts, staleTime: LIST });
      break;
    case "/invoices":
      void queryClient.prefetchQuery({ queryKey: ["invoices"], queryFn: fetchInvoices, staleTime: LIST });
      break;
    case "/craftsmen":
      void queryClient.prefetchQuery({ queryKey: ["craftsmen"], queryFn: fetchCraftsmen, staleTime: LIST });
      break;
    case "/bi":
    case "/bi2": {
      const year = getCurrentFiscalYear();
      void queryClient.prefetchQuery({
        queryKey: ["bi-settings", year],
        queryFn: () => import("@/lib/actions/bi").then((m) => m.getBiSettings(year)),
        staleTime: LIST,
      });
      void queryClient.prefetchQuery({
        queryKey: ["bi-actuals", year],
        queryFn: () => import("@/lib/actions/bi").then((m) => m.getBiActuals(year)),
        staleTime: LIST,
      });
      break;
    }
    case "/workflow":
      void queryClient.prefetchQuery({
        queryKey: ["workflow-requests"],
        queryFn: () => import("@/lib/queries/lists").then((m) => m.fetchWorkflowRequests()),
        staleTime: LIST,
      });
      break;
    case "/leads":
      void queryClient.prefetchQuery({
        queryKey: ["inbound-leads", "all"],
        queryFn: () => import("@/lib/queries/lists").then((m) => m.fetchInboundLeads("all")),
        staleTime: LIST,
      });
      break;
    case "/fulfillment":
    case "/ledger":
    case "/account-items":
      void queryClient.prefetchQuery({
        queryKey: ["procurement-orders"],
        queryFn: () => import("@/lib/queries/portal").then((m) => m.fetchProcurementOrders()),
        staleTime: LIST,
      });
      void queryClient.prefetchQuery({
        queryKey: ["procurement-masters"],
        queryFn: () => import("@/lib/queries/portal").then((m) => m.fetchProcurementMasters()),
        staleTime: 5 * 60_000,
      });
      break;
    case "/mail":
      void queryClient.prefetchQuery({
        queryKey: ["mail-accounts"],
        queryFn: () => import("@/lib/queries/portal").then((m) => m.fetchMailAccounts()),
        staleTime: LIST,
      });
      void queryClient.prefetchQuery({
        queryKey: ["mail-threads"],
        queryFn: () => import("@/lib/queries/portal").then((m) => m.fetchMailThreads()),
        staleTime: LIST,
      });
      break;
    case "/attendance":
      void queryClient.prefetchQuery({
        queryKey: ["company"],
        queryFn: () => import("@/lib/queries/portal").then((m) => m.fetchCompany()),
        staleTime: 5 * 60_000,
      });
      {
        const month = new Date().toISOString().slice(0, 7);
        void queryClient.prefetchQuery({
          queryKey: ["attendance", month],
          queryFn: () => import("@/lib/queries/portal").then((m) => m.fetchAttendanceEntries(month)),
          staleTime: LIST,
        });
      }
      break;
    case "/circulation":
      void queryClient.prefetchQuery({
        queryKey: ["announcements"],
        queryFn: () => import("@/lib/queries/portal").then((m) => m.fetchAnnouncements()),
        staleTime: LIST,
      });
      break;
    case "/calendar": {
      void import("@/lib/queries/calendar").then(({ CAL_QK, CALENDAR_STALE_MS, currentCalendarWeekRange, fetchCalendarEvents, fetchCompanyMembersWithCalendar }) => {
        const { start, end } = currentCalendarWeekRange();
        void queryClient.prefetchQuery({
          queryKey: CAL_QK.events(start, end),
          queryFn: () => fetchCalendarEvents(start, end),
          staleTime: CALENDAR_STALE_MS,
        });
        void queryClient.prefetchQuery({
          queryKey: CAL_QK.membersWithCalendar,
          queryFn: fetchCompanyMembersWithCalendar,
          staleTime: 5 * 60_000,
        });
      });
      break;
    }
    case "/budget":
      void queryClient.prefetchQuery({
        queryKey: ["budgets"],
        queryFn: () => import("@/lib/queries/portal").then((m) => m.fetchBudgets()),
        staleTime: LIST,
      });
      break;
    case "/performance": {
      const year = getCurrentFiscalYear();
      void queryClient.prefetchQuery({
        queryKey: ["performance", year, "__all__"],
        queryFn: () => import("@/lib/queries/portal").then((m) => m.fetchPerformance(year)),
        staleTime: LIST,
      });
      break;
    }
    case "/financials":
      void queryClient.prefetchQuery({
        queryKey: ["financials"],
        queryFn: () => import("@/lib/queries/portal").then((m) => m.fetchFinancialsBundle()),
        staleTime: LIST,
      });
      break;
    case "/documents":
      void queryClient.prefetchQuery({
        queryKey: ["documents"],
        queryFn: () => import("@/lib/queries/portal").then((m) => m.fetchDocuments()),
        staleTime: LIST,
      });
      void queryClient.prefetchQuery({
        queryKey: ["document-categories"],
        queryFn: () => import("@/lib/queries/portal").then((m) => m.fetchDocumentCategories()),
        staleTime: LIST,
      });
      break;
    case "/settings":
      void queryClient.prefetchQuery({
        queryKey: ["settings-bundle"],
        queryFn: () => import("@/lib/queries/portal").then((m) => m.fetchSettingsBundle()),
        staleTime: LIST,
      });
      break;
    default:
      break;
  }
}

export function prefetchCustomerDetail(queryClient: QueryClient, id: string) {
  void queryClient.prefetchQuery({
    queryKey: ["customer", id],
    queryFn: () => fetchCustomer(id),
    staleTime: DETAIL,
  });
  void queryClient.prefetchQuery({
    queryKey: ["customer-related", id],
    queryFn: () => fetchCustomerRelated(id),
    staleTime: DETAIL,
  });
}

export function prefetchConstructionDetail(queryClient: QueryClient, id: string) {
  void queryClient.prefetchQuery({
    queryKey: ["construction", id],
    queryFn: () => import("@/lib/queries/details").then((m) => m.fetchConstruction(id)),
    staleTime: DETAIL,
  });
}

export function prefetchEstimateDetail(queryClient: QueryClient, id: string) {
  void queryClient.prefetchQuery({
    queryKey: ["estimate", id],
    queryFn: () => import("@/lib/queries/details").then((m) => m.fetchEstimate(id)),
    staleTime: DETAIL,
  });
}

export function prefetchContractDetail(queryClient: QueryClient, id: string) {
  void queryClient.prefetchQuery({
    queryKey: ["contract", id],
    queryFn: () => import("@/lib/queries/details").then((m) => m.fetchContract(id)),
    staleTime: DETAIL,
  });
}

export function prefetchInvoiceDetail(queryClient: QueryClient, id: string) {
  void queryClient.prefetchQuery({
    queryKey: ["invoice", id],
    queryFn: () => import("@/lib/queries/portal").then((m) => m.fetchInvoice(id)),
    staleTime: DETAIL,
  });
}

export function prefetchCraftsmanDetail(queryClient: QueryClient, id: string) {
  void queryClient.prefetchQuery({
    queryKey: ["craftsman", id],
    queryFn: () => import("@/lib/queries/portal").then((m) => m.fetchCraftsman(id)),
    staleTime: DETAIL,
  });
}

export function prefetchWorkflowDetail(queryClient: QueryClient, id: string) {
  void queryClient.prefetchQuery({
    queryKey: ["workflow-request", id],
    queryFn: async () => {
      const { fetchWorkflowRequest, fetchWorkflowApprovalSupport } = await import("@/lib/queries/portal");
      const detail = await fetchWorkflowRequest(id).catch(() => null);
      if (!detail) return { detail: null, support: null };
      const payload = (detail as { payload?: Record<string, unknown> }).payload;
      const support = payload?.estimate_id ? await fetchWorkflowApprovalSupport(id) : null;
      return { detail, support };
    },
    staleTime: DETAIL,
  });
}

export function prefetchAnnouncementDetail(queryClient: QueryClient, id: string) {
  void queryClient.prefetchQuery({
    queryKey: ["announcement", id],
    queryFn: () => import("@/lib/queries/portal").then((m) => m.fetchAnnouncement(id)),
    staleTime: DETAIL,
  });
}
