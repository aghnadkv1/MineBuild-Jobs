"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownUp,
  ArrowRight,
  Bell,
  Bookmark,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileText,
  Filter,
  MapPin,
  MessageCircle,
  Pencil,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Trophy,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/client-api";
import { authClient } from "@/lib/auth-client";

const tabs = [
  { key: "jobs", label: "Daftar Lowongan" },
  { key: "ai", label: "AI Cari Kerja Aman" },
  { key: "chat", label: "Chat Customer" },
  { key: "profile", label: "Profil Builder" },
] as const;

type TabKey = (typeof tabs)[number]["key"];

type Job = {
  id: string;
  source: string;
  externalId: string | null;
  sourceUrl: string | null;
  discoveredAt: string;
  currency: string;
  pricingType: string | null;
  projectDuration: string | null;
  experienceLevel: string | null;
  applicantsCount: number | null;
  sourceClientInfo: {
    totalHires: number | null;
    totalPostedJobs: number | null;
    totalSpent: string | null;
    totalSpentCurrency: string | null;
    feedbackScore: number | null;
    verificationStatus: string | null;
  } | null;
  title: string;
  description: string;
  projectType: string | null;
  style: string[];
  minecraftVersion: string | null;
  requiredSkills: string[];
  budgetMin: number | null;
  budgetMax: number | null;
  budgetNegotiable: boolean;
  deadline: string | null;
  complexity: string | null;
  estimatedSize: string | null;
  deliverables: string[];
  status: string;
  postedAt: string;
  clientId: string | null;
  clientName: string | null;
  matchScore?: number | null;
};

type Profile = {
  id: string;
  displayName: string;
  bio: string;
  skills: string[];
  styles: string[];
  projectTypes: string[];
  minecraftVersions: string[];
  tools: string[];
  experience: string | null;
  availability: string;
  preferredBudgetMin: number | null;
  preferredBudgetMax: number | null;
  isPublic: boolean;
};

type PortfolioProject = {
  id: string;
  title: string;
  description: string;
  category: string;
  style: string[];
  minecraftVersion: string | null;
  dimensions: string | null;
  isPublic: boolean;
  createdAt: string;
};

type Conversation = {
  id: string;
  jobId: string;
  jobTitle: string | null;
  otherPartyName: string | null;
  updatedAt: string;
  lastMessage: { body: string; createdAt: string; senderId: string } | null;
};

type ChatMessage = {
  id: string;
  senderId: string;
  body: string;
  createdAt: string;
};

type MatchResult = {
  jobId: string;
  score: number;
  skillScore: number;
  projectTypeScore: number;
  styleScore: number;
  budgetScore: number;
  complexityScore: number;
  portfolioScore: number;
  missingRequirements: string[];
  strengths: string[];
  reasons: string[];
  risks: string[];
  jobTitle: string;
  jobDescription: string;
  jobStyles: string[];
  budgetMin: number | null;
  budgetMax: number | null;
  deadline: string | null;
};

type Proposal = {
  id: string;
  jobId: string;
  content: string;
  status: string;
  updatedAt: string;
};

type Notification = {
  id: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

function formatBudget(
  min: number | null,
  max: number | null,
  negotiable = false,
  currency = "IDR",
) {
  const format = (value: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: /^[A-Z]{3}$/.test(currency) ? currency : "IDR",
      maximumFractionDigits: 0,
    }).format(value);
  if (min !== null && max !== null) return min === max ? format(min) : `${format(min)} – ${format(max)}`;
  if (max !== null) return `Maks. ${format(max)}`;
  if (min !== null) return `Mulai ${format(min)}`;
  return negotiable ? "Bisa dinegosiasikan" : "Belum ditentukan";
}

function jobSourceLabel(source: string) {
  if (source === "upwork") return "Upwork";
  if (source === "fiverr") return "Fiverr";
  return "MineBuild";
}

function relativeDate(value: string) {
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  const hours = Math.floor(elapsed / 3_600_000);
  if (hours < 1) return "baru saja";
  if (hours < 24) return `${hours} jam lalu`;
  return `${Math.floor(hours / 24)} hari lalu`;
}

function deadlineLabel(value: string | null) {
  if (!value) return "Belum ditentukan";
  const remaining = Math.ceil((new Date(`${value}T23:59:59`).getTime() - Date.now()) / 86_400_000);
  return remaining < 0 ? "Terlewat" : `${remaining} hari`;
}

const classPill =
  "rounded-md border border-slate-700/80 bg-slate-800/80 px-2 py-1 text-[10px] font-medium text-slate-300";

function SectionEyebrow({
  children,
  color = "text-emerald-300",
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <div
      className={`mb-1 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.18em] ${color}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </div>
  );
}

function StatusDot({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] text-slate-400">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
      {children}
    </span>
  );
}

export default function Home() {
  const { data: sessionData, isPending: authPending, refetch: refreshSession } =
    authClient.useSession();
  const currentUser = sessionData?.user ?? null;
  const [activeTab, setActiveTab] = useState<TabKey>("jobs");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [totalJobs, setTotalJobs] = useState(0);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [savedJobs, setSavedJobs] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [jobReloadKey, setJobReloadKey] = useState(0);
  const [isSyncingJobs, setIsSyncingJobs] = useState(false);
  const [jobSourceMessage, setJobSourceMessage] = useState("");
  const [category, setCategory] = useState("Semua Gaya");
  const [sort, setSort] = useState<"newest" | "match">("newest");
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const [versionFilter, setVersionFilter] = useState("");
  const [skillFilter, setSkillFilter] = useState("");
  const [complexityFilter, setComplexityFilter] = useState("");
  const [deadlineFilter, setDeadlineFilter] = useState("");
  const [minBudgetFilter, setMinBudgetFilter] = useState("");
  const [maxBudgetFilter, setMaxBudgetFilter] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioProject[]>([]);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [draftContent, setDraftContent] = useState("");
  const [draftProposalId, setDraftProposalId] = useState<string | null>(null);
  const [isLoadingJobs, setIsLoadingJobs] = useState(true);
  const [isLoadingMoreJobs, setIsLoadingMoreJobs] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authRole, setAuthRole] = useState<"builder" | "client">("builder");
  const [authError, setAuthError] = useState("");
  const [messageText, setMessageText] = useState("");
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [profileEditing, setProfileEditing] = useState(false);
  const [profileDraft, setProfileDraft] = useState({
    displayName: "",
    bio: "",
    skills: "",
    styles: "",
    projectTypes: "",
    minecraftVersions: "",
    tools: "",
  });
  const [portfolioTitle, setPortfolioTitle] = useState("");
  const [portfolioCategory, setPortfolioCategory] = useState("");
  const [portfolioDescription, setPortfolioDescription] = useState("");
  const [jobFormOpen, setJobFormOpen] = useState(false);
  const [jobTitle, setJobTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [jobProjectType, setJobProjectType] = useState("");
  const [jobStyles, setJobStyles] = useState("");
  const [jobSkills, setJobSkills] = useState("");
  const [jobBudgetMin, setJobBudgetMin] = useState("");
  const [jobBudgetMax, setJobBudgetMax] = useState("");
  const [appError, setAppError] = useState("");
  const [refreshProtectedData, setRefreshProtectedData] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ limit: "50", sort });
    if (sourceFilter !== "all") params.set("source", sourceFilter);
    if (search.trim()) params.set("q", search.trim());
    if (category !== "Semua Gaya") params.set("category", category);
    if (versionFilter.trim()) params.set("version", versionFilter.trim());
    if (skillFilter.trim()) params.set("skill", skillFilter.trim());
    if (complexityFilter) params.set("complexity", complexityFilter);
    if (deadlineFilter) params.set("deadlineBefore", deadlineFilter);
    if (minBudgetFilter) params.set("budgetMin", minBudgetFilter);
    if (maxBudgetFilter) params.set("budgetMax", maxBudgetFilter);
    apiRequest<{ data: Job[]; pagination: { total: number } }>(`/api/jobs?${params}`, {
      signal: controller.signal,
    })
      .then(({ data, pagination }) => {
        setJobs(data);
        setTotalJobs(pagination.total);
        setSelectedJobId((selected) =>
          selected && data.some((job) => job.id === selected)
            ? selected
            : data[0]?.id ?? null,
        );
        setAppError("");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setAppError(error instanceof Error ? error.message : "Gagal memuat lowongan.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingJobs(false);
      });
    return () => controller.abort();
  }, [category, search, sort, sourceFilter, versionFilter, skillFilter, complexityFilter, deadlineFilter, minBudgetFilter, maxBudgetFilter, jobReloadKey]);

  useEffect(() => {
    if (authPending) return;
    if (!currentUser) {
      return;
    }

    let cancelled = false;
    const requests: Promise<void>[] = [
      apiRequest<{ data: { id: string }[] }>("/api/saved-jobs").then(({ data }) => {
        if (!cancelled) setSavedJobs(data.map((job) => job.id));
      }),
      apiRequest<{ data: Conversation[] }>("/api/conversations").then(({ data }) => {
        if (!cancelled) {
          setConversations(data);
          setActiveConversationId((active) =>
            active && data.some((conversation) => conversation.id === active)
              ? active
              : data[0]?.id ?? null,
          );
        }
      }),
      apiRequest<{ data: Notification[] }>("/api/notifications?limit=30").then(({ data }) => {
        if (!cancelled) setNotifications(data);
      }),
    ];
    const role =
      "role" in currentUser && typeof currentUser.role === "string"
        ? currentUser.role
        : "builder";
    if (role === "builder" || role === "admin") {
      requests.push(
        apiRequest<{ data: Profile | null; portfolio: PortfolioProject[] }>("/api/profile/me")
          .then(({ data, portfolio: projects }) => {
            if (cancelled) return;
            setProfile(data);
            setPortfolio(projects);
            if (data) {
              setProfileDraft({
                displayName: data.displayName,
                bio: data.bio,
                skills: data.skills.join(", "),
                styles: data.styles.join(", "),
                projectTypes: data.projectTypes.join(", "),
                minecraftVersions: data.minecraftVersions.join(", "),
                tools: data.tools.join(", "),
              });
            } else {
              setProfileDraft((draft) => ({
                ...draft,
                displayName: currentUser.name,
              }));
            }
          }),
        apiRequest<{ data: MatchResult[] }>("/api/matches").then(({ data }) => {
          if (!cancelled) setMatches(data);
        }),
        apiRequest<{ data: Proposal[] }>("/api/proposals").then(({ data }) => {
          if (!cancelled) setProposals(data);
        }),
      );
    }
    Promise.allSettled(requests).then((results) => {
      if (cancelled) return;
      const failed = results.find((result) => result.status === "rejected");
      if (failed?.status === "rejected") {
        setAppError(
          failed.reason instanceof Error ? failed.reason.message : "Gagal memuat data akun.",
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [authPending, currentUser, refreshProtectedData]);

  useEffect(() => {
    if (!activeConversationId || !currentUser) {
      return;
    }
    let cancelled = false;
    apiRequest<{ data: ChatMessage[] }>(
      `/api/conversations/${activeConversationId}/messages?limit=100`,
    )
      .then(({ data }) => {
        if (!cancelled) setChatMessages(data);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setAppError(error instanceof Error ? error.message : "Gagal memuat pesan.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeConversationId, currentUser]);

  const filteredJobs = useMemo(() => {
    return jobs;
  }, [jobs]);
  const selectedJob = filteredJobs.find((job) => job.id === selectedJobId) ?? filteredJobs[0] ?? null;
  const activeConversation =
    conversations.find((conversation) => conversation.id === activeConversationId) ?? null;
  const isSignedIn = Boolean(currentUser);
  const currentRole =
    currentUser && "role" in currentUser && typeof currentUser.role === "string"
      ? currentUser.role
      : null;
  const showError = (error: unknown) => {
    setAppError(error instanceof Error ? error.message : "Terjadi kesalahan. Silakan coba lagi.");
  };
  const requireSignIn = () => {
    if (isSignedIn) return true;
    setAuthMode("signin");
    setIsAuthOpen(true);
    return false;
  };
  const refreshAccountData = () => setRefreshProtectedData((value) => value + 1);

  const syncUpworkJobs = async () => {
    setIsSyncingJobs(true);
    setJobSourceMessage("");
    try {
      const { data } = await apiRequest<{
        data: { discovered: number; imported: number; duplicates: number };
      }>("/api/integrations/jobs/sync?source=upwork", { method: "POST" });
      setJobSourceMessage(
        `Upwork: ditemukan ${data.discovered}, ditambahkan ${data.imported}, duplikat ${data.duplicates}.`,
      );
      setJobReloadKey((value) => value + 1);
    } catch (error) {
      showError(error);
    } finally {
      setIsSyncingJobs(false);
    }
  };

  const loadMoreJobs = async () => {
    if (isLoadingMoreJobs || jobs.length >= totalJobs) return;
    const params = new URLSearchParams({ limit: "50", offset: String(jobs.length), sort });
    if (sourceFilter !== "all") params.set("source", sourceFilter);
    if (search.trim()) params.set("q", search.trim());
    if (category !== "Semua Gaya") params.set("category", category);
    if (versionFilter.trim()) params.set("version", versionFilter.trim());
    if (skillFilter.trim()) params.set("skill", skillFilter.trim());
    if (complexityFilter) params.set("complexity", complexityFilter);
    if (deadlineFilter) params.set("deadlineBefore", deadlineFilter);
    if (minBudgetFilter) params.set("budgetMin", minBudgetFilter);
    if (maxBudgetFilter) params.set("budgetMax", maxBudgetFilter);
    setIsLoadingMoreJobs(true);
    try {
      const { data, pagination } = await apiRequest<{
        data: Job[];
        pagination: { total: number };
      }>(`/api/jobs?${params}`);
      setJobs((current) => {
        const knownIds = new Set(current.map((job) => job.id));
        return [...current, ...data.filter((job) => !knownIds.has(job.id))];
      });
      setTotalJobs(pagination.total);
    } catch (error) {
      showError(error);
    } finally {
      setIsLoadingMoreJobs(false);
    }
  };

  const toggleSaved = async (jobId: string) => {
    if (!requireSignIn()) return;
    const willSave = !savedJobs.includes(jobId);
    try {
      await apiRequest(`/api/jobs/${jobId}/save`, { method: willSave ? "POST" : "DELETE" });
      setSavedJobs((current) =>
        willSave ? [...current, jobId] : current.filter((id) => id !== jobId),
      );
    } catch (error) {
      showError(error);
    }
  };

  const submitMessage = async () => {
    const content = message.trim();
    if (!content || !activeConversationId || !requireSignIn()) return;
    setIsSaving(true);
    try {
      const { data } = await apiRequest<{ data: ChatMessage }>(
        `/api/conversations/${activeConversationId}/messages`,
        { method: "POST", body: JSON.stringify({ body: content }) },
      );
      setChatMessages((current) => [...current, data]);
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === activeConversationId
            ? { ...conversation, lastMessage: { body: content, createdAt: data.createdAt, senderId: data.senderId } }
            : conversation,
        ),
      );
      setMessage("");
    } catch (error) {
      showError(error);
    } finally {
      setIsSaving(false);
    }
  };

  const submitAuth = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setAuthError("");
    try {
      if (authMode === "signin") {
        const result = await authClient.signIn.email({
              email: authEmail,
              password: authPassword,
            });
        if (result.error) {
          setAuthError(result.error.message ?? "Autentikasi gagal.");
          return;
        }
      } else {
        const response = await fetch("/api/auth/sign-up/email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
              name: authName,
              email: authEmail,
              password: authPassword,
              role: authRole,
              callbackURL: "/",
          }),
        });
        const result = (await response.json().catch(() => null)) as
          | { message?: string; error?: { message?: string } }
          | null;
        if (!response.ok) {
          setAuthError(result?.message ?? result?.error?.message ?? "Pendaftaran gagal.");
          return;
        }
      }
      setIsAuthOpen(false);
      setAuthPassword("");
      await refreshSession();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Autentikasi gagal.");
    } finally {
      setIsSaving(false);
    }
  };

  const signOut = async () => {
    try {
      await authClient.signOut();
      setSavedJobs([]);
      setConversations([]);
      setChatMessages([]);
      setProfile(null);
      setPortfolio([]);
      setMatches([]);
      setProposals([]);
      setNotifications([]);
      await refreshSession();
      setActiveTab("jobs");
      setAppError("");
    } catch (error) {
      showError(error);
    }
  };

  const startConversation = async () => {
    if (!selectedJob || !requireSignIn()) return;
    setIsSaving(true);
    try {
      const { data } = await apiRequest<{
        data: { id: string; jobId: string; updatedAt: string };
      }>("/api/conversations", {
        method: "POST",
        body: JSON.stringify({ jobId: selectedJob.id }),
      });
      setActiveConversationId(data.id);
      refreshAccountData();
      setActiveTab("chat");
    } catch (error) {
      showError(error);
    } finally {
      setIsSaving(false);
    }
  };

  const saveProposalDraft = async () => {
    if (!selectedJob || !requireSignIn()) return;
    const content = draftContent.trim();
    if (content.length < 20) {
      setAppError("Draft proposal harus berisi setidaknya 20 karakter.");
      return;
    }
    setIsSaving(true);
    try {
      const result = draftProposalId
        ? await apiRequest<{ data: Proposal }>(`/api/proposals/${draftProposalId}`, {
            method: "PATCH",
            body: JSON.stringify({ content }),
          })
        : await apiRequest<{ data: Proposal }>("/api/proposals", {
            method: "POST",
            body: JSON.stringify({ jobId: selectedJob.id, content, aiGenerated: false }),
          });
      setDraftProposalId(result.data.id);
      setProposals((current) => [
        result.data,
        ...current.filter((proposal) => proposal.id !== result.data.id),
      ]);
      setAppError("");
      setMessageText("Draft proposal tersimpan. Proposal belum dikirim.");
    } catch (error) {
      showError(error);
    } finally {
      setIsSaving(false);
    }
  };

  const sendProposal = async () => {
    if (!draftProposalId || !requireSignIn()) {
      if (!draftProposalId) setAppError("Simpan draft proposal terlebih dahulu.");
      return;
    }
    if (selectedJob?.source !== "minebuild") {
      setAppError("Proposal lowongan eksternal harus ditinjau dan dikirim manual melalui situs sumber.");
      return;
    }
    if (!window.confirm("Kirim proposal ini kepada klien? Tindakan ini tidak dapat dibatalkan.")) return;
    setIsSaving(true);
    try {
      const { data } = await apiRequest<{ data: Proposal }>(
        `/api/proposals/${draftProposalId}/send`,
        { method: "POST" },
      );
      setProposals((current) =>
        current.map((proposal) => proposal.id === data.id ? data : proposal),
      );
      setMessageText("Proposal terkirim ke percakapan klien.");
      refreshAccountData();
      setActiveTab("chat");
    } catch (error) {
      showError(error);
    } finally {
      setIsSaving(false);
    }
  };

  const calculateMatches = async () => {
    if (!requireSignIn()) return;
    if (!profile) {
      setAppError("Lengkapi profil builder terlebih dahulu untuk menghitung kecocokan.");
      setActiveTab("profile");
      return;
    }
    setIsSaving(true);
    try {
      await Promise.all(
        jobs.slice(0, 10).map((job) =>
          apiRequest(`/api/matches/${job.id}`, { method: "POST" }),
        ),
      );
      const { data } = await apiRequest<{ data: MatchResult[] }>("/api/matches");
      setMatches(data);
      setAppError("");
    } catch (error) {
      showError(error);
    } finally {
      setIsSaving(false);
    }
  };

  const saveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!requireSignIn()) return;
    setIsSaving(true);
    try {
      await apiRequest("/api/profile/me", {
        method: "PATCH",
        body: JSON.stringify({
          displayName: profileDraft.displayName,
          bio: profileDraft.bio,
          skills: profileDraft.skills.split(",").map((item) => item.trim()).filter(Boolean),
          styles: profileDraft.styles.split(",").map((item) => item.trim()).filter(Boolean),
          projectTypes: profileDraft.projectTypes.split(",").map((item) => item.trim()).filter(Boolean),
          minecraftVersions: profileDraft.minecraftVersions.split(",").map((item) => item.trim()).filter(Boolean),
          tools: profileDraft.tools.split(",").map((item) => item.trim()).filter(Boolean),
        }),
      });
      setProfileEditing(false);
      refreshAccountData();
    } catch (error) {
      showError(error);
    } finally {
      setIsSaving(false);
    }
  };

  const addPortfolioProject = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!requireSignIn()) return;
    setIsSaving(true);
    try {
      await apiRequest("/api/profile/me", {
        method: "POST",
        body: JSON.stringify({
          title: portfolioTitle,
          category: portfolioCategory,
          description: portfolioDescription,
          isPublic: true,
        }),
      });
      setPortfolioTitle("");
      setPortfolioCategory("");
      setPortfolioDescription("");
      refreshAccountData();
    } catch (error) {
      showError(error);
    } finally {
      setIsSaving(false);
    }
  };

  const deletePortfolioProject = async (projectId: string) => {
    if (!requireSignIn()) return;
    if (!window.confirm("Hapus proyek portfolio ini?")) return;
    setIsSaving(true);
    try {
      await apiRequest(`/api/profile/me/portfolio/${projectId}`, { method: "DELETE" });
      setPortfolio((current) => current.filter((project) => project.id !== projectId));
    } catch (error) {
      showError(error);
    } finally {
      setIsSaving(false);
    }
  };

  const createJob = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!requireSignIn()) return;
    setIsSaving(true);
    try {
      const { data } = await apiRequest<{ data: Job }>("/api/jobs", {
        method: "POST",
        body: JSON.stringify({
          title: jobTitle,
          description: jobDescription,
          projectType: jobProjectType || null,
          style: jobStyles.split(",").map((item) => item.trim()).filter(Boolean),
          requiredSkills: jobSkills.split(",").map((item) => item.trim()).filter(Boolean),
          budgetMin: jobBudgetMin ? Number(jobBudgetMin) : null,
          budgetMax: jobBudgetMax ? Number(jobBudgetMax) : null,
          budgetNegotiable: false,
          deliverables: [],
        }),
      });
      setJobs((current) => [data, ...current]);
      setSelectedJobId(data.id);
      setJobFormOpen(false);
      setJobTitle("");
      setJobDescription("");
      setJobProjectType("");
      setJobStyles("");
      setJobSkills("");
      setJobBudgetMin("");
      setJobBudgetMax("");
    } catch (error) {
      showError(error);
    } finally {
      setIsSaving(false);
    }
  };

  const markNotificationsRead = async () => {
    const unread = notifications.filter((notification) => !notification.readAt);
    if (!unread.length || !isSignedIn) return;
    try {
      await apiRequest("/api/notifications", {
        method: "PATCH",
        body: JSON.stringify({ all: true }),
      });
      setNotifications((current) =>
        current.map((notification) =>
          notification.readAt ? notification : { ...notification, readAt: new Date().toISOString() },
        ),
      );
    } catch (error) {
      showError(error);
    }
  };

  const renderHeader = () => (
    <header className="sticky top-0 z-50 border-b border-slate-800/70 bg-[#080f20]/95 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between gap-3 px-3 sm:px-5">
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-400/30 bg-emerald-400/10 font-bold text-emerald-300">
            M
          </div>
          <div className="leading-tight">
            <div className="text-sm font-bold tracking-tight text-white">
              MineBuild Jobs
            </div>
            <div className="text-[9px] text-slate-500">
              Builder Work Platform
            </div>
          </div>
        </div>

        <nav className="hidden items-center gap-0.5 md:flex">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`whitespace-nowrap rounded-md px-1.5 py-2 text-[9px] font-semibold transition-colors ${
                activeTab === tab.key
                  ? "bg-emerald-400 text-slate-950"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              {tab.label}
              {tab.key === "chat" && (
                <span className="ml-1.5 rounded-full bg-emerald-400/15 px-1.5 py-0.5 text-[9px] text-emerald-300">
                  {conversations.length}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="flex min-w-0 items-center gap-2">
          <label className="hidden min-w-0 items-center gap-2 rounded-md border border-slate-800 bg-[#050b18] px-2.5 py-1.5 md:flex">
            <Search className="h-3.5 w-3.5 shrink-0 text-slate-500" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-32 bg-transparent text-[10px] text-slate-200 outline-none placeholder:text-slate-600 xl:w-40"
              placeholder="Cari proyek, tag, modpack..."
              aria-label="Cari lowongan"
            />
          </label>
          {isSignedIn && (
            <div className="relative">
              <button
                type="button"
                aria-label="Notifikasi"
                onClick={() => setNotificationOpen((open) => !open)}
                className="relative rounded-md p-2 text-slate-400 hover:bg-slate-800"
              >
                <Bell className="h-4 w-4" />
                {notifications.some((notification) => !notification.readAt) && (
                  <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-emerald-400" />
                )}
              </button>
              {notificationOpen && (
                <div className="absolute right-0 top-10 z-[60] w-72 rounded-lg border border-slate-700 bg-[#111b2d] p-3 shadow-xl">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-white">Notifikasi</span>
                    <button type="button" onClick={markNotificationsRead} className="text-[9px] text-cyan-300">Tandai dibaca</button>
                  </div>
                  <div className="max-h-64 space-y-2 overflow-auto">
                    {notifications.length ? notifications.map((notification) => (
                      <div key={notification.id} className={`rounded-md p-2 ${notification.readAt ? "bg-slate-900/50" : "bg-emerald-500/10"}`}>
                        <div className="text-[10px] font-semibold text-white">{notification.title}</div>
                        <div className="mt-1 text-[9px] text-slate-400">{notification.body}</div>
                      </div>
                    )) : <p className="text-[10px] text-slate-500">Belum ada notifikasi.</p>}
                  </div>
                </div>
              )}
            </div>
          )}
          {currentUser ? (
            <>
              <div className="hidden items-center gap-2 border-l border-slate-800 pl-2 sm:flex">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-emerald-300 via-cyan-500 to-indigo-600 text-[10px] font-bold text-slate-950 ring-1 ring-slate-500">
                  {currentUser.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="hidden leading-tight xl:block">
                  <div className="max-w-32 truncate text-[10px] font-semibold text-white">{currentUser.name}</div>
                  <div className="text-[9px] text-emerald-300">{profile?.availability ?? currentRole ?? "Akun"}</div>
                </div>
              </div>
              <button type="button" onClick={signOut} className="rounded-md border border-slate-700 px-2 py-1.5 text-[9px] text-slate-300 hover:bg-slate-800">
                Keluar
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={authPending}
              onClick={() => { setAuthMode("signin"); setIsAuthOpen(true); }}
              className="rounded-md bg-emerald-400 px-2.5 py-1.5 text-[9px] font-semibold text-slate-950 hover:bg-emerald-300"
            >
              {authPending ? "Memuat..." : "Masuk"}
            </button>
          )}
        </div>
      </div>
      <div className="flex gap-1 overflow-x-auto border-t border-slate-800/70 px-3 py-1.5 md:hidden">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`whitespace-nowrap rounded-md px-2.5 py-1.5 text-[10px] ${
              activeTab === tab.key
                ? "bg-emerald-400 text-slate-950"
                : "text-slate-400"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </header>
  );

  const renderJobsTab = () => {
    const job = selectedJob;
    const categories = [
      "Semua Gaya",
      "Medieval",
      "Fantasy",
      "Modern City",
      "Lobby",
      "Survival",
      "Terraforming",
    ];
    return (
      <div className="space-y-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <SectionEyebrow>Lowongan MineBuild</SectionEyebrow>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-[27px]">
              Daftar Lowongan Aktif
            </h1>
            <p className="mt-1 max-w-2xl text-[11px] text-slate-400">
              Temukan proyek Minecraft dan bandingkan dengan keahlian builder Anda.
            </p>
          </div>
          <div className="flex gap-2">
            {[
              ["Lowongan", String(jobs.length)],
              ["Tersimpan", String(savedJobs.length)],
              ["Match Tersimpan", String(matches.length)],
            ].map(([label, value]) => (
              <div
                key={label}
                className="min-w-[86px] rounded-md border border-slate-800 bg-slate-900/80 px-2.5 py-2"
              >
                <div className="text-[9px] text-slate-500">{label}</div>
                <div className="mt-0.5 font-mono text-sm font-semibold text-white">
                  {value}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2 rounded-xl border border-slate-800/80 bg-slate-950/40 p-3">
          {currentRole === "client" && (
            <div className="flex justify-end">
              <Button size="sm" className="h-8 rounded-md text-[10px]" onClick={() => setJobFormOpen((open) => !open)}>
                <Plus className="h-3 w-3" /> {jobFormOpen ? "Tutup Form" : "Pasang Lowongan"}
              </Button>
            </div>
          )}
          {jobFormOpen && currentRole === "client" && (
            <form onSubmit={createJob} className="grid gap-2 rounded-md border border-slate-700 bg-[#111b2d] p-3 md:grid-cols-2">
              <input required minLength={5} maxLength={160} value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} placeholder="Judul proyek" className="rounded border border-slate-700 bg-slate-950 px-2 py-2 text-[10px] text-white" />
              <input maxLength={80} value={jobProjectType} onChange={(event) => setJobProjectType(event.target.value)} placeholder="Tipe proyek" className="rounded border border-slate-700 bg-slate-950 px-2 py-2 text-[10px] text-white" />
              <textarea required minLength={30} maxLength={12000} value={jobDescription} onChange={(event) => setJobDescription(event.target.value)} placeholder="Jelaskan brief proyek (minimal 30 karakter)" className="min-h-20 rounded border border-slate-700 bg-slate-950 px-2 py-2 text-[10px] text-white md:col-span-2" />
              <input value={jobStyles} onChange={(event) => setJobStyles(event.target.value)} placeholder="Gaya (pisahkan dengan koma)" className="rounded border border-slate-700 bg-slate-950 px-2 py-2 text-[10px] text-white" />
              <input value={jobSkills} onChange={(event) => setJobSkills(event.target.value)} placeholder="Keahlian (pisahkan dengan koma)" className="rounded border border-slate-700 bg-slate-950 px-2 py-2 text-[10px] text-white" />
              <input type="number" min="0" value={jobBudgetMin} onChange={(event) => setJobBudgetMin(event.target.value)} placeholder="Budget minimum (Rp)" className="rounded border border-slate-700 bg-slate-950 px-2 py-2 text-[10px] text-white" />
              <input type="number" min="0" value={jobBudgetMax} onChange={(event) => setJobBudgetMax(event.target.value)} placeholder="Budget maksimum (Rp)" className="rounded border border-slate-700 bg-slate-950 px-2 py-2 text-[10px] text-white" />
              <div className="md:col-span-2"><Button size="sm" className="h-8 text-[9px]" disabled={isSaving}>{isSaving ? "Menyimpan..." : "Terbitkan Lowongan"}</Button></div>
            </form>
          )}
          <div className="flex gap-2">
            <label className="flex flex-1 items-center gap-2 rounded-md border border-slate-800 bg-slate-950 px-3 py-2 md:hidden">
              <Search className="h-3.5 w-3.5 text-slate-500" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full bg-transparent text-[11px] outline-none placeholder:text-slate-600"
                placeholder="Cari kata kunci, nama server, tools..."
              />
            </label>
            <Button
              variant="secondary"
              size="sm"
              className="h-8 rounded-md text-[10px]"
              onClick={() => setSort((value) => value === "match" ? "newest" : "match")}
              disabled={!isSignedIn}
            >
              <ArrowDownUp className="h-3 w-3" /> {sort === "match" ? "Terbaru" : "Match Tertinggi"}
            </Button>
            <Button variant="secondary" size="sm" className="h-8 rounded-md text-[10px]" onClick={() => setAdvancedFiltersOpen((open) => !open)}>
              <Filter className="h-3 w-3" /> Filter Detail
            </Button>
            <select
              aria-label="Filter sumber lowongan"
              value={sourceFilter}
              onChange={(event) => setSourceFilter(event.target.value)}
              className="h-8 rounded-md border border-slate-700 bg-slate-900 px-2 text-[10px] text-slate-200"
            >
              <option value="all">Semua sumber</option>
              <option value="minebuild">MineBuild</option>
              <option value="upwork">Upwork</option>
              <option value="fiverr">Fiverr</option>
            </select>
            {currentRole === "admin" && (
              <>
                <a
                  href="/api/integrations/upwork/connect"
                  className="inline-flex h-8 items-center rounded-md border border-slate-700 px-2 text-[9px] text-slate-200 hover:bg-slate-800"
                >
                  Hubungkan Upwork
                </a>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-8 rounded-md text-[9px]"
                  onClick={() => void syncUpworkJobs()}
                  disabled={isSyncingJobs}
                >
                  {isSyncingJobs ? "Sinkronisasi..." : "Sinkronkan Upwork"}
                </Button>
              </>
            )}
          </div>
          {currentRole === "admin" && (
            <p className="text-[9px] text-slate-500">
              Fiverr menunggu dokumentasi API resminya. MineBuild hanya mengambil data peluang; tidak mengirim proposal atau pesan ke platform eksternal.
            </p>
          )}
          {jobSourceMessage && (
            <p role="status" className="text-[9px] text-emerald-300">{jobSourceMessage}</p>
          )}
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {categories.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setCategory(tag)}
                className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-[9px] transition-colors ${
                  category === tag
                    ? "border-emerald-400/30 bg-emerald-400 text-slate-950"
                    : "border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-600"
                }`}
              >
                {tag}
              </button>
            ))}
            <span className="ml-auto hidden whitespace-nowrap self-center font-mono text-[9px] text-cyan-300 sm:block">
              Versi 1.20+ • Rp 500k – Rp 10jt+
            </span>
          </div>
          {advancedFiltersOpen && (
            <div className="grid gap-2 border-t border-slate-800 pt-2 sm:grid-cols-3 lg:grid-cols-6">
              <input aria-label="Versi Minecraft" value={versionFilter} onChange={(event) => setVersionFilter(event.target.value)} placeholder="Versi Minecraft" className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-[9px] text-white" />
              <input aria-label="Keahlian dibutuhkan" value={skillFilter} onChange={(event) => setSkillFilter(event.target.value)} placeholder="Keahlian" className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-[9px] text-white" />
              <select aria-label="Kompleksitas" value={complexityFilter} onChange={(event) => setComplexityFilter(event.target.value)} className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-[9px] text-white">
                <option value="">Semua kompleksitas</option>
                <option value="low">Rendah</option>
                <option value="medium">Menengah</option>
                <option value="high">Tinggi</option>
                <option value="expert">Ahli</option>
              </select>
              <input aria-label="Batas tenggat" type="date" value={deadlineFilter} onChange={(event) => setDeadlineFilter(event.target.value)} className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-[9px] text-white" />
              <input aria-label="Budget minimum" type="number" min="0" value={minBudgetFilter} onChange={(event) => setMinBudgetFilter(event.target.value)} placeholder="Budget min" className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-[9px] text-white" />
              <input aria-label="Budget maksimum" type="number" min="0" value={maxBudgetFilter} onChange={(event) => setMaxBudgetFilter(event.target.value)} placeholder="Budget max" className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-[9px] text-white" />
            </div>
          )}
        </div>

        <div className="jobs-layout grid gap-3">
          <section className="min-w-0">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[9px] uppercase tracking-[0.15em] text-slate-500">
                Menampilkan {filteredJobs.length} proyek rekomendasi unggulan
              </span>
              <span className="hidden font-mono text-[9px] text-emerald-300 sm:block">
                Lowongan dari sumber yang terhubung
              </span>
            </div>
            <div className="space-y-2">
              {filteredJobs.map((item) => {
                const tags = [
                  item.minecraftVersion,
                  item.projectType,
                  ...item.style,
                  ...item.requiredSkills,
                ].filter((tag): tag is string => Boolean(tag));
                return (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => setSelectedJobId(item.id)}
                    className={`w-full rounded-md border border-l-2 p-3 text-left transition-colors ${
                      selectedJobId === item.id
                        ? "border-slate-700 border-l-emerald-400 bg-[#192337]"
                        : "border-slate-800 border-l-transparent bg-[#141e31] hover:bg-[#192337]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-[9px] text-slate-400">
                          <span className="font-semibold text-slate-200">
                            {item.clientName ?? (item.source === "minebuild" ? "Klien MineBuild" : jobSourceLabel(item.source))}
                          </span>
                          {item.clientId && <CheckCircle2 className="h-3 w-3 text-emerald-400" />}
                          <span className="rounded border border-slate-700 px-1.5 py-0.5">{jobSourceLabel(item.source)}</span>
                          <span>Diposting {relativeDate(item.postedAt)}</span>
                        </div>
                        <h2 className="mt-2 text-[14px] font-semibold text-white">
                          {item.title}
                        </h2>
                      </div>
                      <Badge className="shrink-0 rounded-full border-emerald-500/30 bg-emerald-400/10 text-[9px] text-emerald-300">
                        {item.matchScore == null ? "MATCH —" : `${item.matchScore}% MATCH`}
                      </Badge>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-[10px] leading-4 text-slate-400">
                      {item.description}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {tags.slice(0, 4).map((tag) => (
                        <span key={tag} className={classPill}>
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="mt-2.5 flex items-center justify-between border-t border-slate-800/80 pt-2">
                      <div className="flex gap-5 text-[9px]">
                        <span>
                          <span className="block text-slate-500">Budget proyek</span>
                          <span className="font-mono text-emerald-300">{formatBudget(item.budgetMin, item.budgetMax, item.budgetNegotiable, item.currency)}</span>
                        </span>
                        <span>
                          <span className="block text-slate-500">Tenggat waktu</span>
                          <span className="font-mono text-slate-200">{deadlineLabel(item.deadline)}</span>
                        </span>
                      </div>
                      <span className="text-[9px] text-cyan-300">
                        Detail Proyek <ChevronDown className="inline h-3 w-3 -rotate-90" />
                      </span>
                    </div>
                  </button>
                );
              })}
              {filteredJobs.length === 0 && (
                <div className="rounded-md border border-slate-800 bg-slate-900 p-6 text-center text-sm text-slate-400">
                  {isLoadingJobs ? "Memuat lowongan..." : "Belum ada lowongan yang cocok. Ubah kata kunci atau kategori."}
                </div>
              )}
            </div>
            {jobs.length < totalJobs && (
              <Button variant="secondary" size="sm" className="mx-auto mt-3 flex h-8 text-[10px]" onClick={loadMoreJobs} disabled={isLoadingMoreJobs}>
                {isLoadingMoreJobs ? "Memuat..." : `Muat lebih banyak (${jobs.length}/${totalJobs})`}
              </Button>
            )}
          </section>

          <aside className="space-y-3">
            {job ? (
            <>
            <div className="rounded-md border border-slate-700 bg-[#1a2638] p-3.5">
              <div className="flex items-center justify-between">
                <SectionEyebrow>Detail Lowongan</SectionEyebrow>
              </div>
              <h2 className="mt-1 text-[18px] font-semibold leading-tight text-white">
                {job.title}
              </h2>
              <div className="mt-2 flex items-center gap-2 text-[9px] text-slate-400">
                <span className="text-emerald-300">● {job.clientName ?? (job.source === "minebuild" ? "Klien MineBuild" : jobSourceLabel(job.source))}</span>
                <span>•</span>
                <span>Diposting {relativeDate(job.postedAt)}</span>
              </div>
              {job.source !== "minebuild" && (
                <div className="mt-2 rounded-md border border-slate-700/80 bg-slate-900/60 p-2 text-[9px] text-slate-400">
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    <span>Sumber: <b className="text-cyan-300">{jobSourceLabel(job.source)}</b></span>
                    {job.pricingType && <span>Skema: <b className="text-slate-200">{job.pricingType}</b></span>}
                    {job.experienceLevel && <span>Level: <b className="text-slate-200">{job.experienceLevel}</b></span>}
                    {job.projectDuration && <span>Durasi: <b className="text-slate-200">{job.projectDuration}</b></span>}
                    {job.applicantsCount !== null && <span>Pelamar: <b className="text-slate-200">{job.applicantsCount}</b></span>}
                  </div>
                  {job.sourceClientInfo && (
                    <div className="mt-1 border-t border-slate-800 pt-1">
                      Informasi klien: {job.sourceClientInfo.totalHires ?? 0} perekrutan · feedback{" "}
                      {job.sourceClientInfo.feedbackScore === null
                        ? "belum tersedia"
                        : `${job.sourceClientInfo.feedbackScore}/5`}
                      {job.sourceClientInfo.verificationStatus
                        ? ` · pembayaran ${job.sourceClientInfo.verificationStatus.toLowerCase()}`
                        : ""}
                    </div>
                  )}
                </div>
              )}
              <div className="minecraft-scene castle-scene mt-3 flex h-[116px] items-end rounded-md border border-slate-700 p-2">
                <span className="rounded-full bg-slate-950/75 px-2 py-1 font-mono text-[9px] text-emerald-300">
                  ● {job.projectType ?? "Proyek Minecraft"}
                </span>
              </div>
              <div className="mt-2 rounded-md bg-slate-900/80 p-3">
                <div className="flex items-center gap-2 text-[11px] font-semibold text-white">
                  <Sparkles className="h-3.5 w-3.5 text-violet-300" />
                  Match & Safety Insight
                  <span className="ml-auto rounded-full bg-emerald-400/10 px-2 py-0.5 font-mono text-[9px] text-emerald-300">
                    {job.matchScore == null ? "Belum dihitung" : `${job.matchScore}% match`}
                  </span>
                </div>
                <p className="mt-2 text-[10px] leading-4 text-slate-400">
                  {job.description}
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div className="rounded bg-slate-950/70 p-2">
                    <div className="text-[8px] uppercase text-slate-500">Ukuran proyek</div>
                    <div className="mt-1 text-[10px] text-slate-200">{job.estimatedSize ?? "Belum ditentukan"}</div>
                    <div className="text-[8px] text-emerald-300">Kompleksitas: {job.complexity ?? "Belum ditentukan"}</div>
                  </div>
                  <div className="rounded bg-slate-950/70 p-2">
                    <div className="text-[8px] uppercase text-slate-500">Tenggat waktu</div>
                    <div className="mt-1 text-[10px] text-slate-200">{deadlineLabel(job.deadline)}</div>
                    <div className="text-[8px] text-emerald-300">Status: {job.status}</div>
                  </div>
                </div>
              </div>
              <div className="mt-2 rounded-md bg-slate-900/80 p-3">
                <div className="text-[8px] uppercase tracking-wider text-slate-500">
                  Spesifikasi Deliverables
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-[9px]">
                  <div><span className="block text-slate-500">Minecraft Engine</span>{job.minecraftVersion ?? "Belum ditentukan"}</div>
                  <div><span className="block text-slate-500">Tipe proyek</span><span className="font-mono text-cyan-300">{job.projectType ?? "Umum"}</span></div>
                  <div><span className="block text-slate-500">Keahlian</span>{job.requiredSkills.join(", ") || "Belum ditentukan"}</div>
                  <div><span className="block text-slate-500">Deliverables</span>{job.deliverables.join(", ") || "Belum ditentukan"}</div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[9px] text-slate-500">Nilai Proyek <b className="mt-0.5 block font-mono text-[15px] text-emerald-300">{formatBudget(job.budgetMin, job.budgetMax, job.budgetNegotiable, job.currency)}</b></span>
                <span className="text-right text-[9px] text-slate-500">Skema Pembayaran<b className="mt-0.5 block text-cyan-300">3 Termin Bertahap</b></span>
              </div>
              <div className="mt-3 flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-9 rounded-md"
                  onClick={() => void toggleSaved(job.id)}
                >
                  <Bookmark className="h-3.5 w-3.5" />
                  {savedJobs.includes(job.id) ? "Tersimpan" : "Simpan"}
                </Button>
                {job.source === "minebuild" && currentRole !== "client" && <Button
                  size="sm"
                  variant="secondary"
                  className="h-9 rounded-md"
                  onClick={() => void startConversation()}
                  disabled={isSaving}
                >
                  <MessageCircle className="h-3.5 w-3.5" /> Chat
                </Button>}
                {job.source === "minebuild" ? <Button
                  size="sm"
                  className="h-9 flex-1 rounded-md"
                  onClick={() => {
                    setDraftContent(`Halo ${job.clientName ?? "Tim Klien"},\n\nSaya tertarik mengerjakan proyek ${job.title}. Keahlian saya yang relevan adalah ${(profile?.skills ?? []).join(", ") || "Minecraft building"}. Saya akan menyusun pendekatan dan estimasi berdasarkan brief proyek.\n\nMari diskusikan detail dan deliverables yang dibutuhkan.`);
                    setDraftProposalId(null);
                    setMessageText("");
                    setActiveTab("ai");
                  }}
                >
                  <Send className="h-3.5 w-3.5" /> Ajukan Proposal
                </Button> : (
                  <div className="flex flex-1 flex-col gap-2">
                    <Button
                      size="sm"
                      className="h-9 rounded-md"
                      onClick={() => {
                        setDraftContent(`Halo,\n\nSaya tertarik mengerjakan proyek ${job.title}. Keahlian saya yang relevan adalah ${(profile?.skills ?? []).join(", ") || "Minecraft building"}. Saya akan menyusun pendekatan kerja berdasarkan brief dan deliverables yang tersedia.\n\nSilakan tinjau dan sesuaikan draft ini sebelum mengirimkannya secara manual melalui ${jobSourceLabel(job.source)}.`);
                        setDraftProposalId(null);
                        setMessageText("");
                        setActiveTab("ai");
                      }}
                    >
                      <FileText className="h-3.5 w-3.5" /> Buat Draf Proposal
                    </Button>
                    {job.sourceUrl && (
                      <a
                        href={job.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-8 items-center justify-center rounded-md border border-slate-700 text-[9px] text-cyan-300 hover:bg-slate-800"
                      >
                        Tinjau di {jobSourceLabel(job.source)}
                        <ArrowRight className="ml-1 h-3 w-3" />
                      </a>
                    )}
                  </div>
                )}
              </div>
              {job.source !== "minebuild" && (
                <p className="mt-2 text-center text-[8px] text-amber-300">
                  Draft tidak dikirim otomatis. Tinjau lowongan dan kirim sendiri di situs sumber.
                </p>
              )}
              <p className="mt-2 text-center text-[8px] text-slate-500">
              Negosiasi dan pembayaran escrow belum terintegrasi pada versi ini.
              </p>
            </div>
            <div className="rounded-md border border-slate-800 bg-slate-900/80 p-3 text-[9px] text-slate-400">
              <div className="mb-1 flex items-center gap-2 text-slate-200">
                <MapPin className="h-3.5 w-3.5 text-cyan-300" /> Tips Master Builder
              </div>
              Kirim miniatur progress render 3D via Chunky atau Blender. Sertakan link portfolio interaktif.
            </div>
            </>
            ) : (
              <div className="rounded-md border border-slate-800 bg-slate-900/70 p-5 text-center text-xs text-slate-400">
                Pilih lowongan yang tersedia untuk melihat detail.
              </div>
            )}
          </aside>
        </div>
      </div>
    );
  };

  const renderAiTab = () => {
    if (currentRole === "client") {
      return (
        <div className="rounded-md border border-slate-800 bg-[#151f32] p-5 text-sm text-slate-300">
          Rekomendasi match dan proposal tersedia untuk akun builder. Akun klien dapat mengelola lowongan dan percakapan.
        </div>
      );
    }
    const rankedMatches = matches.slice(0, 3);
    const savedDrafts = proposals.filter((proposal) => proposal.status === "draft");
    const featuredMatch = rankedMatches[0];
    const featuredJob = featuredMatch
      ? jobs.find((job) => job.id === featuredMatch.jobId)
      : null;
    const targetJob = selectedJob ?? featuredJob ?? null;
    return (
      <div className="space-y-4">
        <section className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <SectionEyebrow>Rekomendasi berdasarkan profil builder</SectionEyebrow>
            <h1 className="text-2xl font-bold tracking-tight text-white">Asisten Cari Kerja Aman</h1>
            <p className="mt-1 max-w-2xl text-[11px] text-slate-400">
              Skor kecocokan dijelaskan dari keahlian, gaya, portfolio, budget, dan kompleksitas—bukan hasil model AI.
            </p>
          </div>
          <Button variant="secondary" size="sm" className="h-8 rounded-md text-[10px]" onClick={calculateMatches} disabled={isSaving}>
            <CheckCheck className="h-3.5 w-3.5" /> {isSaving ? "Menghitung..." : "Hitung Ulang Match"}
          </Button>
        </section>

        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/15 bg-emerald-400/10 px-3 py-2.5">
          <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-300" />
          <div>
            <div className="text-[10px] font-semibold text-white">ZERO-AUTO-SEND</div>
            <div className="text-[9px] text-slate-400">Proposal hanya terkirim setelah Anda menyimpan draft dan menekan tombol kirim.</div>
          </div>
        </div>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold text-white"><Sparkles className="h-4 w-4 text-emerald-300" />Rekomendasi Match</h2>
            <span className="text-[9px] text-slate-500">{matches.length} hasil tersimpan</span>
          </div>
          {featuredMatch ? (
            <div className="ai-layout grid gap-3">
              <article className="rounded-md border border-slate-800 border-t-2 border-t-emerald-400 bg-[#151f32] p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-mono text-[9px] text-emerald-300">Match tertinggi</div>
                    <h3 className="mt-1 text-sm font-semibold text-white">{featuredMatch.jobTitle}</h3>
                    <p className="mt-1 text-[9px] text-slate-400">{featuredMatch.jobDescription}</p>
                  </div>
                  <div className="shrink-0 rounded-full border-2 border-emerald-400 px-2 py-1 font-mono text-sm font-bold text-white">{featuredMatch.score}%</div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3">
                  {[
                    ["Keahlian", featuredMatch.skillScore],
                    ["Tipe proyek", featuredMatch.projectTypeScore],
                    ["Gaya", featuredMatch.styleScore],
                    ["Budget", featuredMatch.budgetScore],
                    ["Kompleksitas", featuredMatch.complexityScore],
                    ["Portfolio", featuredMatch.portfolioScore],
                  ].map(([label, score]) => (
                    <div key={label} className="rounded bg-slate-950/60 p-2 text-[9px] text-slate-400">{label}<b className="ml-2 font-mono text-emerald-300">{score}%</b></div>
                  ))}
                </div>
                <div className="mt-3 space-y-1 text-[9px] text-slate-300">
                  {featuredMatch.reasons.map((reason) => <p key={reason}>• {reason}</p>)}
                  {featuredMatch.risks.map((risk) => <p key={risk} className="text-amber-300">• {risk}</p>)}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" className="h-8 rounded-md text-[9px]" onClick={() => {
                    if (!featuredJob) return;
                    setSelectedJobId(featuredJob.id);
                    setDraftProposalId(null);
                    setDraftContent(`Halo ${featuredJob.clientName ?? "Tim Klien"},\n\nSaya tertarik mengerjakan proyek ${featuredJob.title}. Keahlian saya yang relevan adalah ${(profile?.skills ?? []).join(", ") || "Minecraft building"}. Saya akan menyusun pendekatan kerja berdasarkan brief dan deliverables yang tersedia.\n\nMari diskusikan detail proyek ini.`);
                  }}>
                    <FileText className="h-3 w-3" /> Siapkan Draft Proposal
                  </Button>
                  {featuredJob && <Button size="sm" variant="secondary" className="h-8 rounded-md text-[9px]" onClick={() => { setSelectedJobId(featuredJob.id); setActiveTab("jobs"); }}>Detail Lowongan</Button>}
                </div>
              </article>
              <div className="space-y-3">
                {rankedMatches.slice(1).map((match) => (
                  <article key={match.jobId} className="rounded-md border border-slate-800 bg-[#151f32] p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-white">{match.jobTitle}</h3>
                      <span className="font-mono text-[11px] text-emerald-300">{match.score}%</span>
                    </div>
                    <p className="mt-2 text-[9px] text-slate-400">{match.reasons.join(" ")}</p>
                    <button type="button" className="mt-2 text-[9px] text-cyan-300" onClick={() => {
                      const job = jobs.find((item) => item.id === match.jobId);
                      if (job) {
                        setSelectedJobId(job.id);
                        setDraftProposalId(null);
                        setDraftContent(`Halo ${job.clientName ?? "Tim Klien"},\n\nSaya tertarik mengerjakan proyek ${job.title}. Keahlian saya yang relevan adalah ${(profile?.skills ?? []).join(", ") || "Minecraft building"}.\n\nMari diskusikan kebutuhan dan deliverables proyek ini.`);
                      }
                    }}>Siapkan draft →</button>
                  </article>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-slate-800 bg-[#151f32] p-5 text-center text-[10px] text-slate-400">
              <p>{isSignedIn ? "Belum ada hasil kecocokan. Hitung match untuk membuat rekomendasi dari profil Anda." : "Masuk untuk menghitung kecocokan dari profil builder."}</p>
            </div>
          )}
        </section>

        <section className="rounded-md border border-slate-800 bg-[#151f32] p-3.5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-white">Draft Proposal</h2>
              <p className="text-[9px] text-slate-500">Draft disimpan ke akun Anda dan tidak terkirim otomatis.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {savedDrafts.length > 0 && (
                <select
                  aria-label="Muat draft tersimpan"
                  value={draftProposalId ?? ""}
                  onChange={(event) => {
                    const proposal = proposals.find((item) => item.id === event.target.value);
                    if (!proposal) {
                      setDraftProposalId(null);
                      return;
                    }
                    setDraftProposalId(proposal.id);
                    setDraftContent(proposal.content);
                    setSelectedJobId(proposal.jobId);
                  }}
                  className="max-w-48 rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-[8px] text-slate-200"
                >
                  <option value="">Draft tersimpan ({savedDrafts.length})</option>
                  {savedDrafts.map((proposal) => (
                    <option key={proposal.id} value={proposal.id}>
                      {jobs.find((job) => job.id === proposal.jobId)?.title ?? "Lowongan"} · {proposal.status}
                    </option>
                  ))}
                </select>
              )}
              <Badge className="border-emerald-500/30 bg-emerald-400/10 text-[8px] text-emerald-300">{targetJob?.title ?? "Pilih target lowongan"}</Badge>
            </div>
          </div>
          <textarea
            aria-label="Draft proposal"
            value={draftContent}
            onChange={(event) => setDraftContent(event.target.value)}
            placeholder={targetJob ? "Tulis proposal (minimal 20 karakter)..." : "Pilih lowongan terlebih dahulu dari tab Daftar Lowongan."}
            className="mt-3 min-h-40 w-full resize-y rounded-md border border-slate-700 bg-[#080f20] p-3 text-[10px] leading-5 text-slate-200 outline-none focus:border-emerald-500/50"
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[8px] text-slate-500">{draftContent.length} karakter {messageText && <span className="ml-2 text-emerald-300">{messageText}</span>}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" className="h-8 rounded-md text-[9px]" onClick={saveProposalDraft} disabled={isSaving || !targetJob}>
                <Pencil className="h-3 w-3" /> Simpan Draft
              </Button>
              {targetJob?.source === "minebuild" ? (
                <Button size="sm" className="h-8 rounded-md text-[9px]" onClick={sendProposal} disabled={isSaving || !draftProposalId || proposals.find((proposal) => proposal.id === draftProposalId)?.status !== "draft"}>
                  <Send className="h-3 w-3" /> Kirim Proposal
                </Button>
              ) : targetJob?.sourceUrl ? (
                <a
                  href={targetJob.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-8 items-center rounded-md border border-slate-700 px-3 text-[9px] text-cyan-300 hover:bg-slate-800"
                >
                  Tinjau dan kirim manual di {jobSourceLabel(targetJob.source)}
                </a>
              ) : (
                <span className="self-center text-[9px] text-amber-300">
                  Draft eksternal tidak dapat dikirim otomatis.
                </span>
              )}
            </div>
          </div>
          <div className="mt-2 flex gap-2 overflow-x-auto">
            {portfolio.slice(0, 2).map((item) => <span key={item.id} className="whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-[8px] text-slate-400">{item.title} · {item.category}</span>)}
          </div>
        </section>
      </div>
    );
  };

  const renderChatTab = () => (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[10px]">
          <span className="text-slate-400">Direct Studio Chat /</span>
          <span className="text-cyan-300">{activeConversation?.jobTitle ?? "Pilih percakapan"}</span>
          {activeConversation && <span className="ml-2 rounded bg-slate-800 px-2 py-1 font-mono text-[8px] text-slate-400">Room {activeConversation.id.slice(0, 8)}</span>}
        </div>
        <div className="flex gap-2"><StatusDot>Percakapan privat</StatusDot></div>
      </div>
      <div className="chat-layout grid min-h-[calc(100vh-170px)] overflow-hidden rounded-lg border border-slate-800 bg-[#101a2c]">
        <aside className="flex flex-col border-b border-slate-800 bg-[#121d30] md:border-b-0 md:border-r">
          <div className="flex items-center justify-between border-b border-slate-800 px-3 py-3">
            <h1 className="text-sm font-semibold text-white">Percakapan Proyek</h1>
            <MessageCircle className="h-3.5 w-3.5 text-slate-400" />
          </div>
          <div className="flex gap-2 overflow-x-auto px-3 py-3 md:block md:space-y-1">
            {conversations.map((conversation) => (
              <button
                type="button"
                key={conversation.id}
                onClick={() => setActiveConversationId(conversation.id)}
                className={`min-w-[210px] rounded-md border border-l-2 p-2.5 text-left lg:w-full ${activeConversationId === conversation.id ? "border-slate-700 border-l-emerald-400 bg-[#1b293d]" : "border-transparent bg-transparent hover:bg-slate-800/60"}`}
              >
                <div className="text-[10px] font-semibold text-slate-100">{conversation.otherPartyName ?? "Pengguna MineBuild"}</div>
                <div className="mt-1 truncate text-[8px] text-slate-500">{conversation.jobTitle ?? "Proyek"}</div>
                <div className="mt-1 truncate text-[8px] text-slate-400">{conversation.lastMessage?.body ?? "Belum ada pesan"}</div>
              </button>
            ))}
            {!conversations.length && <p className="px-2 py-4 text-[9px] text-slate-500">{isSignedIn ? "Belum ada percakapan. Mulai dari tombol Hubungi Klien di detail lowongan." : "Masuk untuk mengakses percakapan."}</p>}
          </div>
          <div className="mt-auto hidden border-t border-slate-800 p-3 text-[8px] text-slate-500 md:block"><ShieldCheck className="mr-1 inline h-3 w-3 text-emerald-400" /> Pesan hanya terlihat oleh peserta percakapan.</div>
        </aside>
        <section className="flex min-h-[620px] min-w-0 flex-col bg-[#0d1729]">
          <div className="flex items-center justify-between gap-2 border-b border-slate-800 bg-[#172236] px-3 py-2.5">
            <div>
              <div className="text-[11px] font-semibold text-white">{activeConversation?.otherPartyName ?? "Belum ada percakapan"}</div>
              <div className="text-[8px] text-cyan-300">{activeConversation?.jobTitle ?? "Pilih atau mulai percakapan dari detail lowongan"}</div>
            </div>
            {activeConversation && <Button variant="secondary" size="sm" className="h-7 rounded-md text-[9px]" onClick={() => setActiveTab("ai")}><FileText className="h-3 w-3" /> Buka Draft Proposal</Button>}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-slate-800 bg-[#121d30] px-3 py-2 text-[8px] text-slate-400">
            <span>{chatMessages.length} pesan</span>
            <span>Data tersimpan di MineBuild</span>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-8">
            {chatMessages.map((chatMessage) => {
              const isOwnMessage = chatMessage.senderId === currentUser?.id;
              return (
                <div key={chatMessage.id} className={isOwnMessage ? "flex justify-end" : "flex justify-start"}>
                  <div className={`max-w-[82%] rounded-lg border px-3 py-2.5 text-[10px] leading-5 ${isOwnMessage ? "border-emerald-500/20 bg-emerald-500/10 text-slate-100" : "border-slate-800 bg-[#172236] text-slate-200"}`}>
                    <div className={`mb-1 text-[8px] ${isOwnMessage ? "text-right text-emerald-300" : "text-slate-500"}`}>{isOwnMessage ? "Anda" : activeConversation?.otherPartyName ?? "Klien"} · {new Date(chatMessage.createdAt).toLocaleString("id-ID")}</div>
                    {chatMessage.body}
                  </div>
                </div>
              );
            })}
            {!chatMessages.length && <div className="m-auto rounded-full bg-slate-800 px-3 py-1 text-[8px] text-slate-400">{activeConversation ? "Belum ada pesan. Mulai percakapan dengan mengirim pesan." : "Percakapan yang dipilih akan ditampilkan di sini."}</div>}
          </div>
          <div className="border-t border-slate-800 bg-[#111b2d] p-3">
            <div className="flex items-center gap-2 rounded-md border border-slate-700 bg-slate-950 px-2 py-2">
              <input
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submitMessage(); } }}
                disabled={!activeConversation || isSaving}
                className="min-w-0 flex-1 bg-transparent text-[10px] text-slate-200 outline-none placeholder:text-slate-600"
                placeholder={activeConversation ? "Tulis pesan..." : "Pilih percakapan terlebih dahulu"}
              />
              <Button onClick={() => void submitMessage()} disabled={!activeConversation || isSaving || !message.trim()} size="sm" className="h-8 rounded-md text-[9px]">Kirim <Send className="h-3 w-3" /></Button>
            </div>
            <div className="mt-2 text-[8px] text-slate-500"><ShieldCheck className="mr-1 inline h-3 w-3 text-emerald-400" />Lampiran belum tersedia. Tekan Enter untuk mengirim.</div>
          </div>
        </section>
      </div>
    </div>
  );

  const renderProfileTab = () => {
    if (currentRole === "client") {
      return (
        <div className="rounded-md border border-slate-800 bg-[#151f32] p-5 text-sm text-slate-300">
          Profil builder dan portfolio hanya tersedia untuk akun builder.
        </div>
      );
    }
    return (
    <div className="space-y-0">
      <section className="rounded-b-xl border border-t-0 border-slate-800 bg-[#172236] px-4 py-4">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-slate-600 bg-gradient-to-br from-emerald-300/30 via-cyan-400/20 to-violet-500/30 text-xl font-bold text-white">
              {(profile?.displayName ?? currentUser?.name ?? "B").slice(0, 1).toUpperCase()}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-white">{profile?.displayName ?? currentUser?.name ?? "Profil Builder"}</h1>
                {profile && <Badge className="rounded-full border-emerald-500/30 bg-emerald-400/10 text-[8px] text-emerald-300">Builder</Badge>}
              </div>
              <div className="mt-1 flex flex-wrap gap-3 text-[9px] text-slate-300">
                <span className="font-mono text-cyan-300">{profile?.availability ?? "Profil belum dibuat"}</span>
                <span>{profile?.isPublic ? "Profil publik" : "Profil privat"}</span>
              </div>
              <p className="mt-1 max-w-2xl text-[9px] text-slate-400">{profile?.bio || "Tambahkan ringkasan untuk memperkenalkan pengalaman dan gaya build Anda."}</p>
            </div>
          </div>
          <div className="flex gap-2 sm:shrink-0">
            <Button variant="secondary" size="sm" className="h-8 rounded-md text-[9px]" onClick={() => { if (!requireSignIn()) return; setProfileEditing((editing) => !editing); }}><Pencil className="h-3 w-3" /> {profileEditing ? "Tutup Editor" : "Edit Profil"}</Button>
            <Button size="sm" className="h-8 rounded-md text-[9px]" onClick={() => { if (!requireSignIn()) return; void navigator.clipboard.writeText(window.location.origin + `/api/profiles/${currentUser?.id ?? ""}`).then(() => setMessageText("Tautan profil publik disalin.")).catch(showError); }}><ArrowRight className="h-3 w-3" /> Salin Tautan Profil</Button>
          </div>
        </div>
      </section>

      <div className="grid gap-2 py-3 md:grid-cols-3">
        {[
          { label: "Total Portfolio", value: String(portfolio.length), hint: "Proyek yang Anda unggah", icon: Trophy },
          { label: "Pengalaman", value: profile?.experience ?? "—", hint: "Diatur di profil", icon: Clock3 },
          { label: "Ketersediaan", value: profile?.availability ?? "—", hint: "Status profil saat ini", icon: MessageCircle },
        ].map((stat) => (
          <div key={stat.label} className="flex items-center justify-between rounded-md border border-slate-800 bg-[#151f32] px-3 py-2.5">
            <div>
              <div className="text-[8px] uppercase tracking-[0.14em] text-slate-500">{stat.label}</div>
              <div className="mt-0.5 text-xl font-bold text-white">{stat.value}</div>
              <div className="text-[8px] text-emerald-300">◉ {stat.hint}</div>
            </div>
            <stat.icon className="h-4 w-4 text-emerald-300" />
          </div>
        ))}
      </div>

      <section className="rounded-md border border-slate-800 bg-[#151f32] p-3.5">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-semibold text-white">♙ Spesialisasi & Lingkungan Kerja Arsitek</h2>
          <span className="font-mono text-[8px] text-slate-500">Axiom v2.4 Certified</span>
        </div>
        <div className="mt-3 grid gap-4 md:grid-cols-3">
          {[
            ["Keahlian Utama", profile?.skills ?? []],
            ["Gaya & Tipe Proyek", [...(profile?.styles ?? []), ...(profile?.projectTypes ?? [])]],
            ["Tools & Versi", [...(profile?.tools ?? []), ...(profile?.minecraftVersions ?? [])]],
          ].map(([heading, values]) => (
            <div key={heading as string}>
              <div className="mb-1.5 text-[8px] uppercase tracking-wider text-slate-500">{heading as string}</div>
              <div className="flex flex-wrap gap-1">
                {(values as string[]).length ? (values as string[]).map((value) => (
                  <span key={value} className="rounded-full bg-emerald-500/10 px-2 py-1 text-[8px] text-emerald-200">{value}</span>
                )) : <span className="text-[8px] text-slate-500">Belum ditambahkan</span>}
              </div>
            </div>
          ))}
        </div>
      </section>

      {profileEditing && (
        <form onSubmit={saveProfile} className="mt-3 grid gap-2 rounded-md border border-slate-800 bg-[#151f32] p-3 md:grid-cols-2">
          {([
            ["displayName", "Nama tampilan"],
            ["bio", "Bio"],
            ["skills", "Keahlian (pisahkan dengan koma)"],
            ["styles", "Gaya (pisahkan dengan koma)"],
            ["projectTypes", "Tipe proyek (pisahkan dengan koma)"],
            ["minecraftVersions", "Versi Minecraft (pisahkan dengan koma)"],
            ["tools", "Tools (pisahkan dengan koma)"],
          ] as const).map(([field, label]) => (
            <label key={field} className="text-[9px] text-slate-400">{label}
              {field === "bio" ? (
                <textarea value={profileDraft[field]} onChange={(event) => setProfileDraft((draft) => ({ ...draft, [field]: event.target.value }))} className="mt-1 min-h-16 w-full rounded border border-slate-700 bg-slate-950 p-2 text-[10px] text-white" />
              ) : (
                <input value={profileDraft[field]} onChange={(event) => setProfileDraft((draft) => ({ ...draft, [field]: event.target.value }))} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2 text-[10px] text-white" />
              )}
            </label>
          ))}
          <div className="flex items-end"><Button size="sm" className="h-8 text-[9px]" disabled={isSaving}>Simpan Profil</Button></div>
        </form>
      )}

      <section className="mt-5 border-t border-slate-800 pt-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-[16px] font-semibold text-white">Portfolio Builder</h2>
            <p className="text-[9px] text-slate-500">Proyek portfolio yang tersimpan pada profil Anda.</p>
          </div>
          <span className="font-mono text-[8px] text-slate-500">{portfolio.length} proyek</span>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {portfolio.map((project, index) => (
            <article key={project.id} className="overflow-hidden rounded-md border border-slate-800 bg-[#151f32]">
              <div className={`portfolio-scene ${["castle", "haven", "canyon"][index % 3]} relative flex h-32 items-start justify-between p-2`}>
                <span className="rounded-full bg-slate-950/75 px-2 py-1 font-mono text-[8px] text-cyan-300">{project.minecraftVersion ?? "Minecraft"}</span>
                <span className="rounded-full bg-slate-800 px-2 py-1 text-[8px] text-slate-200">{project.isPublic ? "Publik" : "Privat"}</span>
                <div className="absolute inset-x-2 bottom-2 flex justify-between font-mono text-[8px] text-white [text-shadow:0_1px_4px_black]">
                  <span>Dimensi: {project.dimensions ?? "—"}</span>
                  <span>{project.createdAt ? new Date(project.createdAt).toLocaleDateString("id-ID") : ""}</span>
                </div>
              </div>
              <div className="p-3">
                <div className="flex items-center justify-between">
                  <div className="text-[8px] uppercase tracking-wider text-slate-500">{project.category}</div>
                  <div className="font-mono text-[8px] text-emerald-300">{project.style.join(" · ")}</div>
                </div>
                <h3 className="mt-1 text-[12px] font-semibold text-white">{project.title}</h3>
                <p className="mt-1 line-clamp-3 text-[8px] leading-4 text-slate-400">{project.description || "Belum ada deskripsi."}</p>
                {currentRole === "builder" && (
                  <button type="button" onClick={() => void deletePortfolioProject(project.id)} disabled={isSaving} className="mt-2 text-[8px] text-rose-300">Hapus proyek</button>
                )}
              </div>
            </article>
          ))}
          {!portfolio.length && <p className="text-[9px] text-slate-500">{isSignedIn ? "Portfolio Anda masih kosong." : "Masuk untuk melihat dan mengelola portfolio."}</p>}
        </div>
      </section>

      <form onSubmit={addPortfolioProject} className="mt-4 grid gap-2 rounded-md border border-slate-800 bg-[#111b2d] p-3.5 md:grid-cols-4">
        <h2 className="md:col-span-4 text-[12px] font-semibold text-white">Tambah Proyek Portfolio</h2>
        <input required minLength={2} maxLength={120} value={portfolioTitle} onChange={(event) => setPortfolioTitle(event.target.value)} placeholder="Nama proyek" className="rounded border border-slate-700 bg-slate-950 px-2 py-2 text-[9px] text-white" />
        <input required minLength={2} maxLength={80} value={portfolioCategory} onChange={(event) => setPortfolioCategory(event.target.value)} placeholder="Kategori" className="rounded border border-slate-700 bg-slate-950 px-2 py-2 text-[9px] text-white" />
        <input maxLength={3000} value={portfolioDescription} onChange={(event) => setPortfolioDescription(event.target.value)} placeholder="Deskripsi (opsional)" className="rounded border border-slate-700 bg-slate-950 px-2 py-2 text-[9px] text-white" />
        <Button size="sm" className="h-9 text-[9px]" disabled={isSaving}><Plus className="h-3 w-3" /> Tambah</Button>
      </form>
    </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#0b1326] text-slate-50">
      {renderHeader()}
      <main className="mx-auto max-w-[1440px] px-3 pb-5 pt-4 sm:px-5">
        {appError && (
          <div role="alert" className="mb-3 flex items-center justify-between gap-3 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[10px] text-rose-200">
            <span>{appError}</span>
            <button type="button" aria-label="Tutup notifikasi error" onClick={() => setAppError("")} className="text-rose-100">×</button>
          </div>
        )}
        {activeTab === "jobs" && renderJobsTab()}
        {activeTab === "ai" && renderAiTab()}
        {activeTab === "chat" && renderChatTab()}
        {activeTab === "profile" && renderProfileTab()}
      </main>
      {isAuthOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4" role="dialog" aria-modal="true" aria-labelledby="auth-title">
          <form onSubmit={submitAuth} className="w-full max-w-sm space-y-3 rounded-xl border border-slate-700 bg-[#111b2d] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="auth-title" className="text-lg font-semibold text-white">{authMode === "signin" ? "Masuk ke MineBuild" : "Buat akun MineBuild"}</h2>
                <p className="mt-1 text-[10px] text-slate-400">Autentikasi aman dengan Better Auth.</p>
              </div>
              <button type="button" aria-label="Tutup" onClick={() => setIsAuthOpen(false)} className="text-slate-400">×</button>
            </div>
            {authMode === "signup" && (
              <>
                <label className="block text-[10px] text-slate-300">Nama
                  <input required maxLength={80} value={authName} onChange={(event) => setAuthName(event.target.value)} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white" />
                </label>
                <label className="block text-[10px] text-slate-300">Daftar sebagai
                  <select value={authRole} onChange={(event) => setAuthRole(event.target.value as "builder" | "client")} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white">
                    <option value="builder">Builder</option>
                    <option value="client">Klien</option>
                  </select>
                </label>
              </>
            )}
            <label className="block text-[10px] text-slate-300">Email
              <input required type="email" autoComplete="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white" />
            </label>
            <label className="block text-[10px] text-slate-300">Password
              <input required type="password" minLength={authMode === "signup" ? 12 : 1} autoComplete={authMode === "signup" ? "new-password" : "current-password"} value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white" />
              {authMode === "signup" && <span className="mt-1 block text-[9px] text-slate-500">Minimal 12 karakter.</span>}
            </label>
            {authError && <p role="alert" className="text-[10px] text-rose-300">{authError}</p>}
            <Button type="submit" className="w-full" disabled={isSaving}>{isSaving ? "Memproses..." : authMode === "signin" ? "Masuk" : "Buat Akun"}</Button>
            <p className="text-center text-[10px] text-slate-400">
              {authMode === "signin" ? "Belum punya akun?" : "Sudah punya akun?"}{" "}
              <button type="button" onClick={() => { setAuthError(""); setAuthMode((mode) => mode === "signin" ? "signup" : "signin"); }} className="text-emerald-300">
                {authMode === "signin" ? "Daftar" : "Masuk"}
              </button>
            </p>
          </form>
        </div>
      )}
      <footer className="border-t border-slate-800/80 bg-[#080f20]">
        <div className="mx-auto flex max-w-[1440px] flex-col items-center justify-between gap-1 px-4 py-2.5 text-[8px] text-slate-400 sm:flex-row">
          <div>© 2026 MineBuild Platform. Untuk builder dan studio Minecraft.</div>
          <div className="flex items-center gap-2 font-mono">
            <span>API MineBuild</span>
            <span className="text-slate-400">Pembayaran tidak tersedia</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
