export type FeedbackFormState = {
  status: "idle" | "error" | "success";
  message?: string;
};

export const INITIAL_FEEDBACK_FORM_STATE: FeedbackFormState = {
  status: "idle",
};
