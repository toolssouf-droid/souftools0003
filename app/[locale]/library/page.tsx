"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { motion, AnimatePresence } from "motion/react";
import {
  Film,
  Play,
  RotateCcw,
  Trash2,
  Clock,
  CheckCircle2,
  Search,
  Sparkles,
  SlidersHorizontal,
  Bookmark,
  Share2,
  ChevronRight,
  Info,
  Tv,
  ArrowRight,
  RefreshCw,
  X,
  Volume2,
  Maximize2,
  Compass,
  Heart,
  Layers,
  Flame,
  Award,
  Video,
  Clapperboard,
  Download,
  Eye,
  LayoutGrid,
  List,
  Star,
  BookOpen,
  Sparkle,
  Radio,
  ExternalLink
} from "lucide-react";
import { AppNavigationHeader } from "@/components/ui/AppNavigationHeader";
import { Sidebar } from "@/components/ui/Sidebar";
import { useSession } from "@/lib/auth/authClient";
import { InlineMediaPlayer } from "@/components/media/InlineMediaPlayer";
import { PlaybackInformation, MediaQualityLevel } from "@/lib/media/types";

function formatTimestamp(totalSeconds: number): string {
  if (!totalSeconds || isNaN(totalSeconds) || totalSeconds < 0) return "00:00";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  if (hours > 0) {
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function calculateWatchPercentage(positionSeconds: number, durationSeconds: number): number {
  if (!durationSeconds || durationSeconds <= 0 || !positionSeconds || positionSeconds <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((positionSeconds / durationSeconds) * 100)));
}

interface WatchHistoryItem {
  id?: string;
  userId: string;
  mediaId: string;
  positionSeconds: number;
  durationSeconds: number;
  completed: boolean;
  lastWatchedAt: string;
  rating?: number;
  metadata?: {
    title?: string;
    posterUrl?: string;
    mediaType?: "video" | "audio" | "hls" | "dash";
    url?: string;
    description?: string;
    overview?: string;
    story?: string;
    year?: string | number;
    creator?: string;
    qualities?: Array<{ label: string; url: string; quality?: string }>;
    identifier?: string;
    [key: string]: any;
  };
}

const AI_MOOD_PRESETS = [
  { id: "all", label: "جميع الأفلام", query: "" },
  { id: "classics", label: "🎬 كلاسيكيات السينما الخالدة", query: "Night of the Living Dead" },
  { id: "scifi", label: "🚀 خيال علمي وفضاء كوزمولوجي", query: "Metropolis 1927" },
  { id: "thriller", label: "🕵️ غموض وإثارة نوار (Film Noir)", query: "Charade 1963" },
  { id: "anime", label: "🇯🇵 أنمي ورسوم متحركة كلاسيكية", query: "Princess Mononoke" },
  { id: "vintage", label: "🎞️ أفلام صامتة ووثائقيات نادرة", query: "Voyage dans la Lune" },
  { id: "horror", label: "🕯️ رعب قوطي وظلال سينمائية", query: "Nosferatu 1922" },
];

export default function MediaLibraryPage() {
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || "ar";
  const isRtl = locale === "ar";

  const { data: session } = useSession();
  const currentUser = session?.user;
  const [historyList, setHistoryList] = useState<WatchHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"all" | "in_progress" | "completed" | "favorites">("all");
  const [sortBy, setSortBy] = useState<"recent" | "progress" | "title" | "rating">("recent");
  const [viewLayout, setViewLayout] = useState<"grid" | "list">("grid");
  
  // Favorites and User Ratings stored in local storage
  const [favorites, setFavorites] = useState<string[]>([]);
  const [ratings, setRatings] = useState<Record<string, number>>({});

  // Active Inspect Details Dossier (In-Flow, No popups!)
  const [selectedInspectItem, setSelectedInspectItem] = useState<WatchHistoryItem | null>(null);

  // Seamless Inline Cinema Theater (No detached popup modals!)
  const [activePlaybackItem, setActivePlaybackItem] = useState<{
    payload: PlaybackInformation;
    item: WatchHistoryItem;
  } | null>(null);

  // In-Flow Discover Archive Explorer
  const [isDiscoverExpanded, setIsDiscoverExpanded] = useState<boolean>(false);
  const [discoverQuery, setDiscoverQuery] = useState<string>("");
  const [discoverResults, setDiscoverResults] = useState<any[]>([]);
  const [isDiscovering, setIsDiscovering] = useState<boolean>(false);
  const [discoverError, setDiscoverError] = useState<string | null>(null);
  const [selectedMood, setSelectedMood] = useState<string>("all");

  // Load User & History with seamless local storage fallback
  const fetchWatchHistory = useCallback(async (userId?: string) => {
    setIsLoading(true);
    const uId = userId || currentUser?.id || "guest_anonymous";
    let items: WatchHistoryItem[] = [];

    // 1. Instantly load from local storage cache
    if (typeof window !== "undefined") {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith("souf_media_meta_")) {
            const cached = JSON.parse(localStorage.getItem(key) || "{}");
            if (cached && cached.mediaId && !items.some((it) => it.mediaId === cached.mediaId)) {
              items.push({
                userId: uId,
                mediaId: cached.mediaId,
                positionSeconds: cached.positionSeconds || 0,
                durationSeconds: cached.durationSeconds || 0,
                completed: cached.completed || false,
                lastWatchedAt: cached.lastWatchedAt || new Date().toISOString(),
                metadata: cached.metadata || {},
              });
            }
          }
        }
      } catch {}
    }

    if (items.length > 0) {
      setHistoryList([...items]);
    }

    // 2. Fetch from backend API
    try {
      const res = await fetch(`/api/v1/watch-history?userId=${encodeURIComponent(uId)}&limit=100`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && Array.isArray(data.data)) {
          const serverItems: WatchHistoryItem[] = data.data;
          // Merge server items with local items
          const mergedMap = new Map<string, WatchHistoryItem>();
          for (const sItem of serverItems) {
            mergedMap.set(sItem.mediaId, sItem);
          }
          for (const lItem of items) {
            if (!mergedMap.has(lItem.mediaId)) {
              mergedMap.set(lItem.mediaId, lItem);
            }
          }
          items = Array.from(mergedMap.values()).sort(
            (a, b) => new Date(b.lastWatchedAt).getTime() - new Date(a.lastWatchedAt).getTime()
          );
          setHistoryList(items);
        }
      }
    } catch (err) {
      console.warn("Watch history offline fallback mode active:", err);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchWatchHistory(currentUser?.id);

    try {
      const savedFavs = localStorage.getItem("souf_library_favorites");
      if (savedFavs) {
        setFavorites(JSON.parse(savedFavs));
      }
      const savedRatings = localStorage.getItem("souf_library_ratings");
      if (savedRatings) {
        setRatings(JSON.parse(savedRatings));
      }
    } catch {}
  }, [currentUser?.id, fetchWatchHistory]);

  // Toggle favorite
  const toggleFavorite = (mediaId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setFavorites(prev => {
      const next = prev.includes(mediaId) ? prev.filter(id => id !== mediaId) : [...prev, mediaId];
      try {
        localStorage.setItem("souf_library_favorites", JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Set Rating
  const handleSetRating = (mediaId: string, score: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setRatings(prev => {
      const next = { ...prev, [mediaId]: score };
      try {
        localStorage.setItem("souf_library_ratings", JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Delete item from history
  const handleDeleteItem = async (mediaId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm(isRtl ? "هل أنت متأكد من حذف هذا الفيلم من سجل المشاهدة؟" : "Remove this movie from your watch history?")) {
      return;
    }

    try {
      const uId = currentUser?.id || "guest_anonymous";
      await fetch(`/api/v1/watch-history?mediaId=${encodeURIComponent(mediaId)}&userId=${encodeURIComponent(uId)}`, {
        method: "DELETE",
      });
      try {
        localStorage.removeItem(`souf_media_meta_${mediaId}`);
        localStorage.removeItem(`souf_media_pos_${mediaId}`);
      } catch {}
      setHistoryList(prev => prev.filter(item => item.mediaId !== mediaId));
      if (activePlaybackItem?.item.mediaId === mediaId) {
        setActivePlaybackItem(null);
      }
      if (selectedInspectItem?.mediaId === mediaId) {
        setSelectedInspectItem(null);
      }
    } catch (err) {
      console.error("Failed to delete history item:", err);
    }
  };

  // Clear all history
  const handleClearAllHistory = async () => {
    if (!confirm(isRtl ? "هل أنت متأكد من مسح كافة سجل المشاهدة؟" : "Are you sure you want to clear all watch history?")) {
      return;
    }

    try {
      const uId = currentUser?.id || "guest_anonymous";
      await fetch(`/api/v1/watch-history?clearAll=true&userId=${encodeURIComponent(uId)}`, {
        method: "DELETE",
      });
      setHistoryList([]);
      setActivePlaybackItem(null);
      setSelectedInspectItem(null);
    } catch (err) {
      console.error("Failed to clear history:", err);
    }
  };

  // Launch Inline Seamless Theater Player
  const handleResumePlayback = async (item: WatchHistoryItem, customStartSeconds?: number) => {
    const startPos = typeof customStartSeconds === "number" ? customStartSeconds : (item.positionSeconds || 0);
    const meta = item.metadata || {};

    let mediaUrl = meta.url || "";
    let rawQualities: MediaQualityLevel[] = Array.isArray(meta.qualities)
      ? meta.qualities.map((q: any, idx: number) => ({
          id: q.id || `q_${idx}`,
          label: q.label || "Auto",
          url: q.url || meta.url || "",
        }))
      : [];

    const identifier = meta.identifier || (item.mediaId.startsWith("arc_") ? item.mediaId.replace(/^arc_/, "") : item.mediaId);

    // If URL is missing or empty, resolve it from Archive.org API
    if (!mediaUrl && identifier) {
      try {
        setIsLoading(true);
        const res = await fetch(`/api/v1/media/archive-org?action=resolve&id=${encodeURIComponent(identifier)}&t=${startPos}`);
        if (res.ok) {
          const data = await res.json();
          const resolved = data.payload || data.data;
          if (data.success && resolved) {
            setActivePlaybackItem({
              payload: resolved,
              item: {
                ...item,
                metadata: {
                  ...item.metadata,
                  ...resolved.metadata,
                  url: resolved.url,
                  qualities: resolved.qualities,
                },
              },
            });
            setSelectedInspectItem(null);
            if (typeof window !== "undefined") {
              window.scrollTo({ top: 0, behavior: "smooth" });
            }
            return;
          }
        }
      } catch (e) {
        console.warn("Failed to auto-resolve media URL:", e);
      } finally {
        setIsLoading(false);
      }
    }

    const payload: PlaybackInformation = {
      mediaId: item.mediaId,
      url: mediaUrl,
      mediaType: (meta.mediaType as any) || "video",
      title: meta.title || item.mediaId,
      poster: meta.posterUrl || meta.poster,
      description: meta.description || meta.overview || meta.story || "",
      durationSeconds: item.durationSeconds || undefined,
      initialPositionSeconds: startPos,
      qualities: rawQualities,
      audioTracks: [],
      subtitles: [],
      sourceProvider: "archive_org",
      metadata: {
        ...meta,
        resumeTimestamp: startPos,
      },
    };

    setActivePlaybackItem({ payload, item });
    setSelectedInspectItem(null); // Close inspect when watching
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // Search Discover Films in Archive.org
  const handleDiscoverSearch = async (queryToSearch?: string) => {
    const q = (queryToSearch !== undefined ? queryToSearch : discoverQuery).trim();
    if (!q) return;

    setIsDiscovering(true);
    setDiscoverError(null);
    try {
      const res = await fetch(`/api/v1/media/archive-org?action=search&q=${encodeURIComponent(q)}&type=movies`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.results)) {
          setDiscoverResults(data.results);
        } else {
          setDiscoverResults([]);
          setDiscoverError(data.error || (isRtl ? "لم يتم العثور على نتائج في الأرشيف" : "No archive titles found"));
        }
      } else {
        setDiscoverError(isRtl ? "حدث خطأ في الخادم" : "Server error");
      }
    } catch (err: any) {
      setDiscoverError(err?.message || (isRtl ? "تعذر الاتصال بخادم الأرشيف" : "Connection failed"));
    } finally {
      setIsDiscovering(false);
    }
  };

  // Play discovered Archive movie directly into the seamless theater
  const handlePlayDiscoveredItem = async (discovered: any) => {
    try {
      setIsDiscovering(true);
      const res = await fetch(`/api/v1/media/archive-org?action=resolve&id=${encodeURIComponent(discovered.identifier)}&t=0`);
      if (res.ok) {
        const data = await res.json();
        const playbackData = data.payload || data.data;

        if (data.success && playbackData) {
          const newItem: WatchHistoryItem = {
            userId: currentUser?.id || "guest_anonymous",
            mediaId: playbackData.mediaId,
            positionSeconds: 0,
            durationSeconds: playbackData.durationSeconds || 0,
            completed: false,
            lastWatchedAt: new Date().toISOString(),
            metadata: {
              title: playbackData.title,
              posterUrl: playbackData.posterUrl || playbackData.poster,
              description: playbackData.description,
              overview: playbackData.description,
              year: discovered.year,
              creator: discovered.creator,
              qualities: playbackData.qualities,
              identifier: discovered.identifier,
            }
          };

          setActivePlaybackItem({
            payload: playbackData,
            item: newItem,
          });

          // Add to history list immediately
          setHistoryList(prev => [newItem, ...prev.filter(x => x.mediaId !== newItem.mediaId)]);
          window.scrollTo({ top: 0, behavior: "smooth" });
        } else {
          setDiscoverError(data.error || (isRtl ? "تعذر تشغيل هذا الفيلم من الأرشيف" : "Failed to resolve film stream"));
        }
      }
    } catch (err) {
      console.error("Failed to play discovered film:", err);
      setDiscoverError(isRtl ? "حدث خطأ أثناء تحميل الفيلم" : "Error playing movie");
    } finally {
      setIsDiscovering(false);
    }
  };

  // Filter and sort items
  const filteredItems = useMemo(() => {
    return historyList
      .filter((item) => {
        // Search query filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const title = (item.metadata?.title || item.mediaId).toLowerCase();
          const desc = (item.metadata?.description || item.metadata?.overview || item.metadata?.story || "").toLowerCase();
          const creator = (item.metadata?.creator || "").toLowerCase();
          if (!title.includes(q) && !desc.includes(q) && !creator.includes(q)) {
            return false;
          }
        }

        // Tab filter
        if (activeTab === "in_progress") {
          return !item.completed && item.positionSeconds > 5 && (item.durationSeconds === 0 || item.positionSeconds < item.durationSeconds - 10);
        }
        if (activeTab === "completed") {
          return item.completed || (item.durationSeconds > 0 && item.positionSeconds >= item.durationSeconds - 10);
        }
        if (activeTab === "favorites") {
          return favorites.includes(item.mediaId);
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "recent") {
          return new Date(b.lastWatchedAt).getTime() - new Date(a.lastWatchedAt).getTime();
        }
        if (sortBy === "progress") {
          const pctA = calculateWatchPercentage(a.positionSeconds, a.durationSeconds);
          const pctB = calculateWatchPercentage(b.positionSeconds, b.durationSeconds);
          return pctB - pctA;
        }
        if (sortBy === "rating") {
          const rA = ratings[a.mediaId] || 0;
          const rB = ratings[b.mediaId] || 0;
          return rB - rA;
        }
        if (sortBy === "title") {
          const titleA = (a.metadata?.title || a.mediaId).toLowerCase();
          const titleB = (b.metadata?.title || b.mediaId).toLowerCase();
          return titleA.localeCompare(titleB);
        }
        return 0;
      });
  }, [historyList, searchQuery, activeTab, sortBy, favorites, ratings]);

  // Spotlight Item
  const spotlightItem = useMemo(() => {
    return historyList.find(
      (item) => !item.completed && item.positionSeconds > 10 && (item.durationSeconds === 0 || item.positionSeconds < item.durationSeconds - 20)
    ) || historyList[0] || null;
  }, [historyList]);

  // Overall Statistics
  const stats = useMemo(() => {
    const total = historyList.length;
    const inProgress = historyList.filter(it => !it.completed && it.positionSeconds > 5).length;
    const completed = historyList.filter(it => it.completed).length;
    const totalWatchedMinutes = Math.floor(
      historyList.reduce((acc, it) => acc + (it.positionSeconds || 0), 0) / 60
    );
    return { total, inProgress, completed, totalWatchedMinutes };
  }, [historyList]);

  return (
    <div className="flex h-screen w-full bg-[#050808] text-[#e0f0f0] overflow-hidden select-none font-sans" dir={isRtl ? "rtl" : "ltr"}>
      {/* Universal Sidebar */}
      <Sidebar locale={locale} />

      {/* Main Library Stage */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
        {/* App Navigation Header */}
        <AppNavigationHeader
          locale={locale}
          title={isRtl ? "المكتبة السينمائية الفاخرة" : "Cinematic Library & Hub"}
          subtitle={isRtl ? "استئناف فوري، تجربة سينمائية متكاملة، وقصص الأفلام" : "Unified streaming, resume tracking & cinematic stories"}
          icon={<Film className="w-5 h-5 text-purple-400" />}
          backHref={`/${locale}/chat`}
          backLabel={isRtl ? "العودة للدردشة" : "Back to Chat"}
        />

        {/* Scrollable Stage Content */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-10 py-6 space-y-8 custom-scrollbar">
          
          {/* ========================================================= */}
          {/* 1. SEAMLESS INLINE THEATER STAGE (No popup windows/dialogs!) */}
          {/* ========================================================= */}
          <AnimatePresence>
            {activePlaybackItem && (
              <motion.section
                initial={{ opacity: 0, height: 0, scale: 0.98 }}
                animate={{ opacity: 1, height: "auto", scale: 1 }}
                exit={{ opacity: 0, height: 0, scale: 0.98 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden rounded-3xl border border-purple-500/40 bg-gradient-to-b from-[#0e1717] to-[#080d0d] shadow-[0_0_50px_rgba(168,85,247,0.2)]"
              >
                {/* Cinema Player Top Control Strip */}
                <div className="flex items-center justify-between px-5 py-3.5 bg-black/40 border-b border-purple-500/20">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#00d4aa] animate-pulse" />
                    <span className="text-xs font-mono font-bold text-purple-300 uppercase tracking-widest">
                      {isRtl ? "شاشة العرض المباشر (المسرح السينمائي)" : "Live Cinema Theater"}
                    </span>
                    <span className="text-xs text-[#6b9090] truncate max-w-sm">
                      • {activePlaybackItem.payload.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setActivePlaybackItem(null);
                        fetchWatchHistory();
                      }}
                      className="px-3 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                      <span>{isRtl ? "إغلاق الشاشة" : "Close Theater"}</span>
                    </button>
                  </div>
                </div>

                {/* Inline Player Frame */}
                <div className="relative w-full bg-black">
                  <InlineMediaPlayer
                    payload={activePlaybackItem.payload}
                    isRtl={isRtl}
                    userId={currentUser?.id || "guest_anonymous"}
                  />
                </div>

                {/* Film Narrative Strip under Player */}
                <div className="p-5 sm:p-6 bg-gradient-to-r from-[#0d1616] via-[#111c1c] to-[#151025] flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-t border-[#1e2e2e]">
                  <div className="space-y-1 max-w-3xl">
                    <h3 className="text-base sm:text-lg font-bold text-[#e0f0f0]">
                      {activePlaybackItem.payload.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-[#8db3b3] leading-relaxed line-clamp-2">
                      {activePlaybackItem.payload.description || (isRtl ? "فيلم من الأرشيف السينمائي. يتم حفظ موضع المشاهدة بدقة متناهية على السيرفر." : "Cinema stream. Watch progress synchronized to server.")}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* 5-Star Rating */}
                    <div className="flex items-center gap-1 bg-[#101818] p-1.5 rounded-xl border border-[#1e2e2e]">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => handleSetRating(activePlaybackItem.payload.mediaId, star)}
                          className="text-[#6b9090] hover:text-amber-400 transition-colors p-0.5"
                        >
                          <Star
                            className={`w-3.5 h-3.5 ${
                              (ratings[activePlaybackItem.payload.mediaId] || 0) >= star
                                ? "text-amber-400 fill-current"
                                : ""
                            }`}
                          />
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={() => toggleFavorite(activePlaybackItem.payload.mediaId)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-colors cursor-pointer ${
                        favorites.includes(activePlaybackItem.payload.mediaId)
                          ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                          : "bg-[#111a1a] text-[#8db3b3] hover:text-white border-[#1e2e2e]"
                      }`}
                    >
                      <Heart className={`w-4 h-4 ${favorites.includes(activePlaybackItem.payload.mediaId) ? "fill-current" : ""}`} />
                      <span>{favorites.includes(activePlaybackItem.payload.mediaId) ? (isRtl ? "في المفضلة" : "Favorited") : (isRtl ? "إضافة للمفضلة" : "Favorite")}</span>
                    </button>
                  </div>
                </div>
              </motion.section>
            )}
          </AnimatePresence>

          {/* ========================================================= */}
          {/* 2. IN-FLOW NARRATIVE DOSSIER (Inspect item without popup) */}
          {/* ========================================================= */}
          <AnimatePresence>
            {selectedInspectItem && !activePlaybackItem && (
              <motion.section
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="overflow-hidden rounded-3xl bg-gradient-to-r from-[#0e1717] via-[#121c1c] to-[#161226] border border-purple-500/40 p-6 sm:p-8 shadow-2xl relative"
              >
                <button
                  onClick={() => setSelectedInspectItem(null)}
                  className="absolute top-4 left-4 sm:left-6 p-2 rounded-xl bg-black/40 hover:bg-black/70 text-[#8db3b3] hover:text-white transition-colors cursor-pointer"
                  title={isRtl ? "إغلاق التفاصيل" : "Close Dossier"}
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="flex flex-col md:flex-row items-start gap-6">
                  {/* Poster Thumbnail */}
                  <div className="w-36 sm:w-44 aspect-[2/3] rounded-2xl bg-black/50 overflow-hidden shrink-0 border border-purple-500/30 shadow-lg relative">
                    {selectedInspectItem.metadata?.posterUrl ? (
                      <img
                        src={selectedInspectItem.metadata.posterUrl}
                        alt={selectedInspectItem.metadata?.title || selectedInspectItem.mediaId}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-purple-400/50">
                        <Film className="w-10 h-10 mb-2" />
                        <span className="text-[10px] font-mono text-[#8db3b3]">Cinematic</span>
                      </div>
                    )}
                  </div>

                  {/* Story & Meta Details */}
                  <div className="flex-1 space-y-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 text-xs font-bold flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-purple-400" />
                        <span>{isRtl ? "ملف القصة والسيناريو" : "Film Dossier"}</span>
                      </span>

                      {selectedInspectItem.metadata?.year && (
                        <span className="px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-[#8db3b3]">
                          {selectedInspectItem.metadata.year}
                        </span>
                      )}

                      {selectedInspectItem.metadata?.creator && (
                        <span className="text-xs text-[#8db3b3]">
                          {isRtl ? `المخرج / المؤلف: ${selectedInspectItem.metadata.creator}` : `Creator: ${selectedInspectItem.metadata.creator}`}
                        </span>
                      )}
                    </div>

                    <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-[#f0fbfb]">
                      {selectedInspectItem.metadata?.title || selectedInspectItem.mediaId}
                    </h2>

                    <p className="text-xs sm:text-sm text-[#a8cccc] leading-relaxed max-w-3xl">
                      {selectedInspectItem.metadata?.description ||
                        selectedInspectItem.metadata?.overview ||
                        selectedInspectItem.metadata?.story ||
                        (isRtl
                          ? "عمل سينمائي رائد من مكتبة السينما العالمية. يتم استرجاع المسار الزمني والتشغيل بدقة عالية بدون أي انقطاع."
                          : "Cinema masterwork tracked in your library. Seamless playback synchronization.")}
                    </p>

                    {/* Progress Bar & Actions */}
                    <div className="pt-2 flex flex-wrap items-center gap-4">
                      <button
                        onClick={() => handleResumePlayback(selectedInspectItem)}
                        className="px-6 py-3 rounded-2xl bg-gradient-to-r from-purple-500 to-[#00d4aa] hover:opacity-95 text-[#050808] font-extrabold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-purple-500/25 cursor-pointer active:scale-95"
                      >
                        <Play className="w-4 h-4 fill-current" />
                        <span>
                          {selectedInspectItem.positionSeconds > 5
                            ? (isRtl ? `استئناف عند ${formatTimestamp(selectedInspectItem.positionSeconds)}` : `Resume at ${formatTimestamp(selectedInspectItem.positionSeconds)}`)
                            : (isRtl ? "بدء المشاهدة الآن" : "Watch Now")}
                        </span>
                      </button>

                      <button
                        onClick={() => handleResumePlayback(selectedInspectItem, 0)}
                        className="px-4 py-3 rounded-2xl bg-[#0a1212] hover:bg-[#121e1e] border border-[#1e2e2e] text-[#9ec4c4] text-xs font-semibold flex items-center gap-2 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>{isRtl ? "من البداية" : "Start from 0:00"}</span>
                      </button>

                      <div className="flex items-center gap-1 bg-black/40 px-3 py-2 rounded-2xl border border-white/5">
                        <span className="text-xs text-[#6b9090] me-1">{isRtl ? "تقييمك:" : "Rating:"}</span>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            onClick={() => handleSetRating(selectedInspectItem.mediaId, star)}
                            className="p-0.5 text-[#6b9090] hover:text-amber-400 transition-colors"
                          >
                            <Star
                              className={`w-4 h-4 ${
                                (ratings[selectedInspectItem.mediaId] || 0) >= star
                                  ? "text-amber-400 fill-current"
                                  : ""
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.section>
            )}
          </AnimatePresence>

          {/* ========================================================= */}
          {/* 3. PANORAMIC BACKDROP HERO (High-End Spatial Cinema) */}
          {/* ========================================================= */}
          {!activePlaybackItem && !selectedInspectItem && spotlightItem && (
            <section className="relative overflow-hidden rounded-3xl border border-[#1b2b2b] bg-[#091010] shadow-2xl">
              {/* Full-bleed Ambient Poster Backdrop */}
              {spotlightItem.metadata?.posterUrl && (
                <div
                  className="absolute inset-0 bg-cover bg-center opacity-30 filter blur-md scale-105 transition-all duration-1000"
                  style={{ backgroundImage: `url(${spotlightItem.metadata.posterUrl})` }}
                />
              )}
              {/* Dark Vignette Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-[#050808] via-[#050808]/90 to-transparent z-10" />

              <div className="relative z-20 p-6 sm:p-8 md:p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
                {/* Story & Spotlight Metadata */}
                <div className="max-w-2xl space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[11px] font-bold flex items-center gap-1.5 shadow-sm">
                      <Flame className="w-3.5 h-3.5 text-amber-400" />
                      <span>{isRtl ? "استئناف المتابعة الفورية" : "Ready to Resume"}</span>
                    </span>

                    {spotlightItem.metadata?.year && (
                      <span className="px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-[#8db3b3]">
                        {spotlightItem.metadata.year}
                      </span>
                    )}

                    {spotlightItem.metadata?.creator && (
                      <span className="text-xs text-[#6b9090]">
                        {isRtl ? `إخراج: ${spotlightItem.metadata.creator}` : `Dir: ${spotlightItem.metadata.creator}`}
                      </span>
                    )}
                  </div>

                  <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#f0fbfb] tracking-tight leading-tight">
                    {spotlightItem.metadata?.title || spotlightItem.mediaId}
                  </h1>

                  <p className="text-xs sm:text-sm text-[#9ec4c4] leading-relaxed line-clamp-3">
                    {spotlightItem.metadata?.description ||
                      spotlightItem.metadata?.overview ||
                      spotlightItem.metadata?.story ||
                      (isRtl ? "فيلم مميز مسجل في مكتبتك السينمائية. بنقرة واحدة تستأنف المشاهدة بالضبط من المكان الذي توقفت عنده." : "Selected cinema title. Click to resume exactly where you left off.")}
                  </p>

                  {/* Progress Strip & Action Buttons */}
                  <div className="pt-3 flex flex-wrap items-center gap-4">
                    <button
                      onClick={() => handleResumePlayback(spotlightItem)}
                      className="px-6 py-3 rounded-2xl bg-gradient-to-r from-purple-500 via-indigo-500 to-[#00d4aa] hover:opacity-95 text-[#050808] font-extrabold text-xs sm:text-sm flex items-center gap-2.5 transition-all shadow-[0_0_30px_rgba(168,85,247,0.35)] cursor-pointer active:scale-95"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>
                        {isRtl
                          ? `استئناف عند ${formatTimestamp(spotlightItem.positionSeconds)}`
                          : `Resume at ${formatTimestamp(spotlightItem.positionSeconds)}`}
                      </span>
                    </button>

                    <button
                      onClick={() => handleResumePlayback(spotlightItem, 0)}
                      className="px-4 py-3 rounded-2xl bg-[#101818]/90 hover:bg-[#182424] border border-[#223535] text-[#9ec4c4] hover:text-white text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{isRtl ? "من البداية" : "Start Over"}</span>
                    </button>

                    <button
                      onClick={() => setSelectedInspectItem(spotlightItem)}
                      className="px-4 py-3 rounded-2xl bg-[#101818]/90 hover:bg-[#182424] border border-[#223535] text-[#9ec4c4] hover:text-white text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <BookOpen className="w-3.5 h-3.5 text-purple-400" />
                      <span>{isRtl ? "ملف القصة" : "Story Dossier"}</span>
                    </button>

                    <button
                      onClick={(e) => toggleFavorite(spotlightItem.mediaId, e)}
                      className={`p-3 rounded-2xl border transition-colors cursor-pointer ${
                        favorites.includes(spotlightItem.mediaId)
                          ? "bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-[0_0_15px_rgba(244,63,94,0.3)]"
                          : "bg-[#101818]/90 hover:bg-[#182424] border-[#223535] text-[#8db3b3] hover:text-rose-400"
                      }`}
                      title={isRtl ? "إضافة للمفضلة" : "Bookmark"}
                    >
                      <Heart className={`w-4 h-4 ${favorites.includes(spotlightItem.mediaId) ? "fill-current" : ""}`} />
                    </button>
                  </div>
                </div>

                {/* HUD Minimal Metric Pill Strip (No isolated box cards!) */}
                <div className="w-full md:w-auto flex md:flex-col items-center md:items-end justify-between gap-3 border-t md:border-t-0 md:border-s border-[#1e2e2e]/80 pt-4 md:pt-0 md:ps-8">
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-[10px] text-[#6b9090] uppercase tracking-wider block">
                        {isRtl ? "نسبة المشاهدة" : "Progress"}
                      </span>
                      <span className="text-lg font-extrabold font-mono text-purple-300">
                        {calculateWatchPercentage(spotlightItem.positionSeconds, spotlightItem.durationSeconds)}%
                      </span>
                    </div>
                    <div className="w-12 h-1.5 bg-black/50 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-purple-400 to-[#00d4aa]"
                        style={{ width: `${calculateWatchPercentage(spotlightItem.positionSeconds, spotlightItem.durationSeconds)}%` }}
                      />
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-[#6b9090] uppercase tracking-wider block">
                      {isRtl ? "الوقت المنقضي" : "Timestamp"}
                    </span>
                    <span className="text-xs font-mono text-[#9ec4c4]">
                      {formatTimestamp(spotlightItem.positionSeconds)} / {spotlightItem.durationSeconds > 0 ? formatTimestamp(spotlightItem.durationSeconds) : "--:--"}
                    </span>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ========================================================= */}
          {/* 4. CINEMA STATS HUD & DISCOVERY EXPANDER (Harmonious Strip) */}
          {/* ========================================================= */}
          <section className="flex flex-wrap items-center justify-between gap-4 py-2 border-y border-[#182424]">
            {/* Live Stats Inline Strip */}
            <div className="flex items-center gap-6 text-xs text-[#8db3b3]">
              <div className="flex items-center gap-2">
                <Film className="w-4 h-4 text-purple-400" />
                <span>{isRtl ? "إجمالي الأفلام:" : "Total Films:"}</span>
                <strong className="text-[#f0fbfb] font-mono">{stats.total}</strong>
              </div>

              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>{isRtl ? "قيد المتابعة:" : "In Progress:"}</span>
                <strong className="text-amber-300 font-mono">{stats.inProgress}</strong>
              </div>

              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#00d4aa]" />
                <span>{isRtl ? "المكتملة:" : "Completed:"}</span>
                <strong className="text-[#00d4aa] font-mono">{stats.completed}</strong>
              </div>

              <div className="hidden sm:flex items-center gap-2">
                <Eye className="w-4 h-4 text-sky-400" />
                <span>{isRtl ? "ساعات المشاهدة:" : "Hours:"}</span>
                <strong className="text-sky-300 font-mono">{(stats.totalWatchedMinutes / 60).toFixed(1)} س</strong>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2.5 ms-auto">
              <button
                onClick={() => setIsDiscoverExpanded(!isDiscoverExpanded)}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                  isDiscoverExpanded
                    ? "bg-purple-500 text-white shadow-[0_0_20px_rgba(168,85,247,0.4)]"
                    : "bg-[#0d1515] hover:bg-[#142020] border border-[#1e2e2e] text-purple-300 hover:text-white"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>{isRtl ? (isDiscoverExpanded ? "إخفاء مستكشف الأرشيف" : "استكشاف أفلام الأرشيف") : "Archive Explorer"}</span>
              </button>

              <button
                onClick={() => fetchWatchHistory()}
                disabled={isLoading}
                className="p-2 rounded-xl bg-[#0d1515] hover:bg-[#142020] border border-[#1e2e2e] text-[#8db3b3] hover:text-[#00d4aa] transition-colors cursor-pointer"
                title={isRtl ? "تحديث السجل" : "Refresh"}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-[#00d4aa]" : ""}`} />
              </button>

              {historyList.length > 0 && (
                <button
                  onClick={handleClearAllHistory}
                  className="p-2 rounded-xl bg-[#0d1515] hover:bg-red-950/40 border border-[#1e2e2e] hover:border-red-500/40 text-[#8db3b3] hover:text-red-400 transition-colors cursor-pointer"
                  title={isRtl ? "مسح السجل بالكامل" : "Clear all"}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </section>

          {/* ========================================================= */}
          {/* 5. IN-FLOW ARCHIVE DISCOVERY STRIP (Zero Popups!) */}
          {/* ========================================================= */}
          <AnimatePresence>
            {isDiscoverExpanded && (
              <motion.section
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden rounded-3xl bg-gradient-to-b from-[#0e1616] to-[#070c0c] border border-purple-500/30 p-5 sm:p-6 shadow-xl space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-amber-300" />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-[#f0fbfb]">
                        {isRtl ? "مستكشف الأرشيف السينمائي المفتوح" : "Open Cinema Archive Explorer"}
                      </h3>
                      <p className="text-[11px] text-[#8db3b3]">
                        {isRtl ? "ابحث وشاهد آلاف الأفلام والأنمي والوثائقيات مباشرة بدون نوافذ منبثقة" : "Stream thousands of open cinema and anime titles directly in-flow"}
                      </p>
                    </div>
                  </div>

                  {/* Search Input */}
                  <div className="flex items-center gap-2 max-w-md w-full">
                    <div className="relative flex-1">
                      <Search className={`w-3.5 h-3.5 absolute top-3 text-[#4a7070] ${isRtl ? "right-3" : "left-3"}`} />
                      <input
                        type="text"
                        value={discoverQuery}
                        onChange={(e) => setDiscoverQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleDiscoverSearch();
                        }}
                        placeholder={isRtl ? "ابحث بالاسم (Night of the Living Dead, Metropolis...)" : "Search archive titles..."}
                        className={`w-full py-2 text-xs bg-[#050808] border border-[#1e2e2e] focus:border-purple-500 rounded-xl text-[#f0fbfb] placeholder-[#4a7070] outline-none ${
                          isRtl ? "pr-8 pl-3" : "pl-8 pr-3"
                        }`}
                      />
                    </div>
                    <button
                      onClick={() => handleDiscoverSearch()}
                      disabled={isDiscovering || !discoverQuery.trim()}
                      className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
                    >
                      {isDiscovering ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                      <span>{isRtl ? "بحث" : "Search"}</span>
                    </button>
                  </div>
                </div>

                {/* Mood / Category Pills */}
                <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1 text-xs">
                  {AI_MOOD_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => {
                        setSelectedMood(preset.id);
                        if (preset.query) {
                          setDiscoverQuery(preset.query);
                          handleDiscoverSearch(preset.query);
                        }
                      }}
                      className={`px-3 py-1.5 rounded-xl font-medium transition-all whitespace-nowrap cursor-pointer ${
                        selectedMood === preset.id
                          ? "bg-purple-500/30 text-purple-200 border border-purple-500/50"
                          : "bg-[#050808] text-[#8db3b3] hover:text-white border border-[#1e2e2e]"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {/* Results Horizontal / Grid Flow */}
                {isDiscovering ? (
                  <div className="py-8 text-center text-[#8db3b3]">
                    <RefreshCw className="w-6 h-6 animate-spin text-purple-400 mx-auto mb-2" />
                    <p className="text-xs">{isRtl ? "جاري البحث في الأرشيف العالمي..." : "Searching archive repository..."}</p>
                  </div>
                ) : discoverResults.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5 pt-2">
                    {discoverResults.map((item) => (
                      <div
                        key={item.identifier}
                        onClick={() => handlePlayDiscoveredItem(item)}
                        className="group relative rounded-2xl bg-[#050808] border border-[#1e2e2e] hover:border-purple-500/50 p-2.5 flex flex-col justify-between transition-all cursor-pointer shadow hover:shadow-xl"
                      >
                        <div className="relative w-full aspect-[2/3] rounded-xl bg-[#091010] overflow-hidden mb-2">
                          {item.posterUrl ? (
                            <img
                              src={item.posterUrl}
                              alt={item.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-purple-400/50">
                              <Film className="w-8 h-8" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <div className="w-9 h-9 rounded-full bg-purple-500 text-white flex items-center justify-center shadow-lg">
                              <Play className="w-4 h-4 fill-current ms-0.5" />
                            </div>
                          </div>
                        </div>

                        <div>
                          <h4 className="text-xs font-bold text-[#e0f0f0] group-hover:text-purple-300 truncate">
                            {item.title}
                          </h4>
                          <span className="text-[10px] text-[#6b9090] font-mono block mt-0.5">
                            {item.year || "Archive"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : discoverError ? (
                  <div className="py-4 text-center text-amber-400 text-xs">{discoverError}</div>
                ) : null}
              </motion.section>
            )}
          </AnimatePresence>

          {/* ========================================================= */}
          {/* 6. FILTER TABS & VIEW CONTROLS */}
          {/* ========================================================= */}
          <section className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
            {/* Filter Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1">
              <button
                onClick={() => setActiveTab("all")}
                className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  activeTab === "all"
                    ? "bg-purple-500/25 text-purple-200 border border-purple-500/40 shadow-sm"
                    : "text-[#8db3b3] hover:text-white bg-[#0a1111] border border-[#1e2e2e]"
                }`}
              >
                {isRtl ? "جميع الأفلام" : "All"} ({historyList.length})
              </button>

              <button
                onClick={() => setActiveTab("in_progress")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  activeTab === "in_progress"
                    ? "bg-amber-500/25 text-amber-300 border border-amber-500/40 shadow-sm"
                    : "text-[#8db3b3] hover:text-white bg-[#0a1111] border border-[#1e2e2e]"
                }`}
              >
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>{isRtl ? "قيد المتابعة" : "In Progress"}</span> ({stats.inProgress})
              </button>

              <button
                onClick={() => setActiveTab("completed")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  activeTab === "completed"
                    ? "bg-[#00d4aa]/25 text-[#00d4aa] border border-[#00d4aa]/40 shadow-sm"
                    : "text-[#8db3b3] hover:text-white bg-[#0a1111] border border-[#1e2e2e]"
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-[#00d4aa]" />
                <span>{isRtl ? "المكتملة" : "Completed"}</span> ({stats.completed})
              </button>

              <button
                onClick={() => setActiveTab("favorites")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  activeTab === "favorites"
                    ? "bg-rose-500/25 text-rose-300 border border-rose-500/40 shadow-sm"
                    : "text-[#8db3b3] hover:text-white bg-[#0a1111] border border-[#1e2e2e]"
                }`}
              >
                <Heart className="w-3.5 h-3.5 text-rose-400" />
                <span>{isRtl ? "المفضلة" : "Favorites"}</span> ({favorites.length})
              </button>
            </div>

            {/* Search, Sort & View Toggle */}
            <div className="flex items-center gap-2">
              {/* Search */}
              <div className="relative flex-1 sm:w-56">
                <Search className={`w-3.5 h-3.5 absolute top-3 text-[#4a7070] ${isRtl ? "right-3" : "left-3"}`} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={isRtl ? "بحث في أفلامك..." : "Search..."}
                  className={`w-full py-2 text-xs bg-[#0a1111] border border-[#1e2e2e] rounded-xl text-[#f0fbfb] placeholder-[#4a7070] focus:outline-none focus:border-purple-500/50 transition-colors ${
                    isRtl ? "pr-8 pl-3" : "pl-8 pr-3"
                  }`}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className={`absolute top-2.5 text-[#6b9090] hover:text-[#e8f5f5] ${isRtl ? "left-2.5" : "right-2.5"}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Sort Dropdown */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="py-2 px-3 text-xs bg-[#0a1111] border border-[#1e2e2e] rounded-xl text-[#8db3b3] focus:outline-none focus:border-purple-500/50 cursor-pointer"
              >
                <option value="recent">{isRtl ? "آخر مشاهدة" : "Recent"}</option>
                <option value="progress">{isRtl ? "أعلى نسبة إنجاز" : "Progress"}</option>
                <option value="rating">{isRtl ? "أعلى تقييم" : "Highest Rated"}</option>
                <option value="title">{isRtl ? "أبجدياً" : "A-Z"}</option>
              </select>

              {/* View Layout Switcher */}
              <div className="flex items-center bg-[#0a1111] border border-[#1e2e2e] rounded-xl p-0.5">
                <button
                  onClick={() => setViewLayout("grid")}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    viewLayout === "grid" ? "bg-purple-500/30 text-purple-200" : "text-[#6b9090] hover:text-white"
                  }`}
                  title={isRtl ? "عرض شبكي (بوسترات)" : "Grid view"}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setViewLayout("list")}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    viewLayout === "list" ? "bg-purple-500/30 text-purple-200" : "text-[#6b9090] hover:text-white"
                  }`}
                  title={isRtl ? "عرض شريطي (قائمة)" : "List view"}
                >
                  <List className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </section>

          {/* ========================================================= */}
          {/* 7. CINEMATIC POSTERS WALL / LIST VIEW */}
          {/* ========================================================= */}
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {[1, 2, 3, 4, 5, 6].map((idx) => (
                <div key={idx} className="aspect-[2/3] rounded-2xl bg-[#091010] border border-[#1a2626] animate-pulse" />
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            /* Honest Designed Empty State */
            <div className="py-20 px-6 rounded-3xl bg-[#080d0d] border border-[#162424] text-center max-w-lg mx-auto space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-300 mx-auto">
                <Film className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-[#f0fbfb]">
                {searchQuery
                  ? (isRtl ? "لم نعثر على أفلام تطابق بحثك" : "No films matched your query")
                  : (isRtl ? "مكتبتك فارغة حالياً" : "Your cinema collection is empty")}
              </h3>
              <p className="text-xs sm:text-sm text-[#7a9e9e] max-w-sm mx-auto leading-relaxed">
                {searchQuery
                  ? (isRtl ? "جرب كتابة اسم آخر أو استعراض تصنيفات الأرشيف المفتوح." : "Try adjusting your search criteria.")
                  : (isRtl
                    ? "عندما تشاهد أو تطلب أي فيلم من الذكاء الاصطناعي، سيتم تتبعه وحفظ موضع توقفك على السيرفر فوراً."
                    : "Whenever you stream movies, your timestamps and stories will be synced here automatically.")}
              </p>
              <div className="pt-2 flex items-center justify-center gap-3">
                <button
                  onClick={() => setIsDiscoverExpanded(true)}
                  className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-purple-500/20 cursor-pointer active:scale-95"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>{isRtl ? "استكشف أفلام الأرشيف الآن" : "Explore Cinema Archive"}</span>
                </button>
              </div>
            </div>
          ) : viewLayout === "grid" ? (
            /* 2:3 Cinematic Poster Grid */
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {filteredItems.map((item) => {
                const percentage = calculateWatchPercentage(item.positionSeconds, item.durationSeconds);
                const isFav = favorites.includes(item.mediaId);
                const isCompleted = item.completed || percentage >= 95;
                const userRating = ratings[item.mediaId] || 0;

                return (
                  <motion.div
                    key={item.mediaId}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="group relative flex flex-col justify-between rounded-2xl bg-[#091010] border border-[#192626] hover:border-purple-500/60 transition-all duration-300 shadow hover:shadow-2xl hover:shadow-purple-500/15 overflow-hidden"
                  >
                    {/* Poster Frame */}
                    <div
                      className="relative w-full aspect-[2/3] bg-[#050808] overflow-hidden cursor-pointer"
                      onClick={() => handleResumePlayback(item)}
                    >
                      {item.metadata?.posterUrl ? (
                        <img
                          src={item.metadata.posterUrl}
                          alt={item.metadata?.title || item.mediaId}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-purple-400/60 p-3 text-center">
                          <Film className="w-10 h-10 mb-2 opacity-40" />
                          <span className="text-[10px] font-mono text-[#8db3b3] truncate max-w-full">
                            {item.mediaId}
                          </span>
                        </div>
                      )}

                      {/* Ambient Glass Badges on Poster */}
                      <div className="absolute top-2 inset-x-2 flex items-center justify-between pointer-events-none">
                        {isCompleted ? (
                          <span className="px-2 py-0.5 rounded-full bg-[#00d4aa]/90 text-[#050808] text-[9px] font-bold flex items-center gap-1 shadow">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>{isRtl ? "مكتمل" : "Watched"}</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-black/75 text-purple-200 border border-purple-500/40 text-[9px] font-mono font-bold backdrop-blur-md">
                            {percentage}%
                          </span>
                        )}

                        <div className="flex items-center gap-1 pointer-events-auto">
                          <button
                            onClick={(e) => toggleFavorite(item.mediaId, e)}
                            className={`p-1.5 rounded-full backdrop-blur-md transition-colors ${
                              isFav
                                ? "bg-rose-500 text-white shadow-[0_0_10px_rgba(244,63,94,0.5)]"
                                : "bg-black/60 text-white/80 hover:text-rose-400"
                            }`}
                            title={isRtl ? "المفضلة" : "Favorite"}
                          >
                            <Heart className={`w-3 h-3 ${isFav ? "fill-current" : ""}`} />
                          </button>
                        </div>
                      </div>

                      {/* Hover Center Play Button */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="w-11 h-11 rounded-full bg-purple-500 text-white flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                          <Play className="w-5 h-5 fill-current ms-0.5" />
                        </div>
                      </div>

                      {/* Progress Line on Poster Bottom */}
                      <div className="absolute bottom-0 inset-x-0 h-1 bg-black/70">
                        <div
                          className={`h-full ${isCompleted ? "bg-[#00d4aa]" : "bg-gradient-to-r from-purple-400 to-[#00d4aa]"}`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>

                    {/* Poster Info & Quick Actions */}
                    <div className="p-3 flex flex-col justify-between flex-1 gap-2">
                      <div>
                        <h4 className="text-xs font-bold text-[#f0fbfb] group-hover:text-purple-300 transition-colors line-clamp-1">
                          {item.metadata?.title || item.mediaId}
                        </h4>
                        <div className="flex items-center justify-between text-[10px] font-mono text-[#6b9090] mt-1">
                          <span>{item.metadata?.year || "Cinema"}</span>
                          <span className="text-purple-300">
                            {formatTimestamp(item.positionSeconds)}
                          </span>
                        </div>
                      </div>

                      {/* Quick Rating & Story Toggle */}
                      <div className="flex items-center justify-between pt-1 border-t border-[#1a2626] text-[10px]">
                        <button
                          onClick={() => setSelectedInspectItem(item)}
                          className="text-[#8db3b3] hover:text-purple-300 flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <BookOpen className="w-3 h-3" />
                          <span>{isRtl ? "القصة" : "Story"}</span>
                        </button>

                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              onClick={(e) => handleSetRating(item.mediaId, star, e)}
                              className="text-[#4a7070] hover:text-amber-400 p-0.5"
                            >
                              <Star
                                className={`w-2.5 h-2.5 ${
                                  userRating >= star ? "text-amber-400 fill-current" : ""
                                }`}
                              />
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1 pt-1.5 border-t border-[#1a2626]">
                        <button
                          onClick={() => handleResumePlayback(item)}
                          className="flex-1 py-1.5 px-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>{isCompleted ? (isRtl ? "إعادة" : "Rewatch") : (isRtl ? "استئناف" : "Resume")}</span>
                        </button>

                        <button
                          onClick={(e) => handleDeleteItem(item.mediaId, e)}
                          className="p-1.5 rounded-xl bg-[#0e1717] hover:bg-red-950/40 text-[#6b9090] hover:text-red-400 border border-[#1a2626] transition-colors cursor-pointer"
                          title={isRtl ? "حذف" : "Delete"}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            /* Streamlined List Rows Mode */
            <div className="space-y-2.5">
              {filteredItems.map((item) => {
                const percentage = calculateWatchPercentage(item.positionSeconds, item.durationSeconds);
                const isFav = favorites.includes(item.mediaId);
                const isCompleted = item.completed || percentage >= 95;
                const userRating = ratings[item.mediaId] || 0;

                return (
                  <motion.div
                    key={item.mediaId}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="group rounded-2xl bg-[#091010] hover:bg-[#0e1717] border border-[#192626] hover:border-purple-500/40 p-3 flex items-center justify-between gap-4 transition-all"
                  >
                    {/* Thumbnail & Title */}
                    <div className="flex items-center gap-3.5 min-w-0 flex-1 cursor-pointer" onClick={() => handleResumePlayback(item)}>
                      <div className="relative w-16 h-12 rounded-xl bg-[#050808] overflow-hidden shrink-0">
                        {item.metadata?.posterUrl ? (
                          <img src={item.metadata.posterUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-purple-400/50">
                            <Film className="w-5 h-5" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Play className="w-3.5 h-3.5 text-white fill-current" />
                        </div>
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs sm:text-sm font-bold text-[#f0fbfb] group-hover:text-purple-300 transition-colors truncate">
                            {item.metadata?.title || item.mediaId}
                          </h4>
                          {item.metadata?.year && (
                            <span className="text-[10px] font-mono text-[#6b9090] bg-white/5 px-1.5 py-0.5 rounded">
                              {item.metadata.year}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#7a9e9e] line-clamp-1 mt-0.5">
                          {item.metadata?.description || item.metadata?.overview || (isRtl ? "سجل مشاهدة سينمائي" : "Cinema title")}
                        </p>
                      </div>
                    </div>

                    {/* Progress & Time */}
                    <div className="hidden sm:flex flex-col items-end shrink-0 font-mono text-xs text-[#8db3b3]">
                      <span className="text-purple-300 font-bold">{percentage}%</span>
                      <span className="text-[10px] text-[#6b9090]">
                        {formatTimestamp(item.positionSeconds)} / {item.durationSeconds > 0 ? formatTimestamp(item.durationSeconds) : "--:--"}
                      </span>
                    </div>

                    {/* Story Dossier Button */}
                    <button
                      onClick={() => setSelectedInspectItem(item)}
                      className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0e1717] hover:bg-[#152222] border border-[#1e2e2e] text-xs text-[#8db3b3] hover:text-white transition-colors cursor-pointer"
                    >
                      <BookOpen className="w-3.5 h-3.5 text-purple-400" />
                      <span>{isRtl ? "القصة" : "Story"}</span>
                    </button>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleResumePlayback(item)}
                        className="p-2.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 transition-colors cursor-pointer"
                        title={isRtl ? "تشغيل" : "Play"}
                      >
                        <Play className="w-4 h-4 fill-current" />
                      </button>

                      <button
                        onClick={(e) => toggleFavorite(item.mediaId, e)}
                        className={`p-2.5 rounded-xl border transition-colors cursor-pointer ${
                          isFav ? "bg-rose-500/20 text-rose-300 border-rose-500/40" : "bg-[#0e1717] text-[#6b9090] hover:text-rose-400 border-[#1a2626]"
                        }`}
                        title={isRtl ? "المفضلة" : "Favorite"}
                      >
                        <Heart className={`w-4 h-4 ${isFav ? "fill-current" : ""}`} />
                      </button>

                      <button
                        onClick={(e) => handleDeleteItem(item.mediaId, e)}
                        className="p-2.5 rounded-xl bg-[#0e1717] hover:bg-red-950/40 text-[#6b9090] hover:text-red-400 border border-[#1a2626] transition-colors cursor-pointer"
                        title={isRtl ? "حذف" : "Delete"}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
