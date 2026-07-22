import {
  assertQaEnvironment,
  QA_PASSWORD,
} from "./qa-achievements-contract.mts";

export { assertQaEnvironment, QA_PASSWORD };

export function qaBadgeEmail(kind: string) {
  return `qa-badge-${kind}@twojatura.local`;
}
