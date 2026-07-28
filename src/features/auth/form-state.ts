export type FormState = {
  status: "idle" | "error" | "success";
  message?: string;
  // Optional safe error code (e.g. "same_password") a form can use to
  // render a specific UI affordance (like a link) beyond the plain message.
  code?: string;
};

export const INITIAL_FORM_STATE: FormState = { status: "idle" };
