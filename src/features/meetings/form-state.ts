import type {
  MeetingAvailabilityFormState,
  MeetingFormState,
  MeetingVoteState,
} from "./types";

export const INITIAL_MEETING_FORM_STATE: MeetingFormState = {
  status: "idle",
};

export const INITIAL_MEETING_AVAILABILITY_STATE: MeetingAvailabilityFormState =
  {
    status: "idle",
  };

export const INITIAL_MEETING_VOTE_STATE: MeetingVoteState = {
  status: "idle",
};
