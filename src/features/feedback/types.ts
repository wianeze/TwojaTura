export type FeedbackStatus = "new" | "in_progress" | "completed" | "rejected";

export type AdminFeedbackSubmissionRow = {
  id: string;
  authorDisplayName: string;
  content: string;
  status: FeedbackStatus;
  adminNote: string | null;
  createdAt: string;
};
