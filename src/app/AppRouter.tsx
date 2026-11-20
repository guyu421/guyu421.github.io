import { Navigate, Route, Routes } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { ArticleDetailPage } from '@/pages/ArticleDetailPage';
import { CategoryPage } from '@/pages/CategoryPage';
import { MatchDetailPage } from '@/pages/MatchDetailPage';
import { MatchesPage } from '@/pages/MatchesPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { ParticipantProfilePage } from '@/pages/ParticipantProfilePage';
import { ProfilePage } from '@/pages/ProfilePage';
import { PublishArticlePage } from '@/pages/PublishArticlePage';
import { SearchPage } from '@/pages/SearchPage';
import { TournamentDetailPage } from '@/pages/TournamentDetailPage';

export function AppRouter() {
  return (
    <MainLayout>
      <Routes>
        <Route path="/" element={<Navigate to="/category/renju" replace />} />
        <Route path="/matches" element={<MatchesPage />} />
        <Route path="/category/:categoryId" element={<CategoryPage />} />
        <Route path="/article/:id" element={<ArticleDetailPage />} />
        <Route path="/publish" element={<PublishArticlePage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/team/:teamName" element={<ParticipantProfilePage kind="team" />} />
        <Route path="/player/:playerId" element={<ParticipantProfilePage kind="player" />} />
        <Route path="/:tournamentId" element={<TournamentDetailPage />} />
        <Route path="/:tournamentId/round/:roundNo" element={<TournamentDetailPage />} />
        <Route path="/:tournamentId/standings" element={<TournamentDetailPage />} />
        <Route
          path="/:tournamentId/standings/round/:roundNo"
          element={<TournamentDetailPage />}
        />
        <Route path="/:tournamentId/match/:matchId" element={<MatchDetailPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </MainLayout>
  );
}
