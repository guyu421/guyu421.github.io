import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { SportCategoryId } from '@/types/common';

interface AppContextValue {
  activeCategory: SportCategoryId;
  setActiveCategory: (category: SportCategoryId) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  bookmarkedIds: string[];
  toggleBookmark: (articleId: string) => void;
  isBookmarked: (articleId: string) => boolean;
}

const BOOKMARK_STORAGE_KEY = 'saiyuan_bookmarks';

const AppContext = createContext<AppContextValue | undefined>(undefined);

function readInitialBookmarks(): string[] {
  try {
    const raw = window.localStorage.getItem(BOOKMARK_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [activeCategory, setActiveCategory] = useState<SportCategoryId>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>(readInitialBookmarks);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        BOOKMARK_STORAGE_KEY,
        JSON.stringify(bookmarkedIds),
      );
    } catch {
      // Ignore storage quota errors in restricted environments
    }
  }, [bookmarkedIds]);

  const toggleBookmark = useCallback((articleId: string) => {
    setBookmarkedIds((prev) =>
      prev.includes(articleId)
        ? prev.filter((id) => id !== articleId)
        : [...prev, articleId],
    );
  }, []);

  const isBookmarked = useCallback(
    (articleId: string) => bookmarkedIds.includes(articleId),
    [bookmarkedIds],
  );

  const value = useMemo<AppContextValue>(
    () => ({
      activeCategory,
      setActiveCategory,
      searchQuery,
      setSearchQuery,
      bookmarkedIds,
      toggleBookmark,
      isBookmarked,
    }),
    [activeCategory, searchQuery, bookmarkedIds, toggleBookmark, isBookmarked],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppStore(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppStore must be used within an AppProvider');
  }
  return context;
}
