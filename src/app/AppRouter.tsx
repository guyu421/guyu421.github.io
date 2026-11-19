import { Navigate, Route, Routes } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { ArticleDetailPage } from '@/pages/ArticleDetailPage';
import { CategoryPage } from '@/pages/CategoryPage';
import { MatchesPage } from '@/pages/MatchesPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { PublishArticlePage } from '@/pages/PublishArticlePage';
import { TournamentDetailPage } from '@/pages/TournamentDetailPage';

export function AppRouter() {
  return (
    <MainLayout>
      <Routes>
        <Route path="/" element={<Navigate to="/category/renju" replace />} />
        <Route path="/matches" element={<MatchesPage />} />
        <Route path="/matches/:tournamentId" element={<TournamentDetailPage />} />
        <Route path="/matches/:tournamentId/round/:roundNo" element={<TournamentDetailPage />} />
        <Route path="/matches/:tournamentId/standings" element={<TournamentDetailPage />} />
        <Route
          path="/matches/:tournamentId/standings/round/:roundNo"
          element={<TournamentDetailPage />}
        />
        <Route path="/category/:categoryId" element={<CategoryPage />} />
        <Route path="/article/:id" element={<ArticleDetailPage />} />
        <Route path="/publish" element={<PublishArticlePage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </MainLayout>
  );
}
