export interface User {
  id: string;
  username: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface CommentItem {
  id: number;
  articleId: number;
  userId: string;
  username: string;
  content: string;
  createdAt: string;
}
