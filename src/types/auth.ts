export interface User {
  id: string;
  email: string;
  username: string;
}

export interface CommentItem {
  id: number;
  articleId: number;
  userId: string;
  username: string;
  level: number;
  content: string;
  createdAt: string;
}
