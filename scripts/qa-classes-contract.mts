import {
  assertQaEnvironment,
  QA_PASSWORD,
} from "./qa-achievements-contract.mts";

export { assertQaEnvironment, QA_PASSWORD };

export function qaClassEmail(classKey: string) {
  return `qa-class-${classKey}@twojatura.local`;
}
