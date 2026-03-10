import { describe, it, expect } from "vitest";
import { canAccessPage, hasRole } from "./rbac";
import type { Role } from "./rbac";

describe("canAccessPage", () => {
  it("ADMIN can access /crm/users", () => {
    expect(canAccessPage("/crm/users", "ADMIN")).toBe(true);
  });

  it("COUNSELOR cannot access /crm/users", () => {
    expect(canAccessPage("/crm/users", "COUNSELOR")).toBe(false);
  });

  it("HOSPITAL_STAFF cannot access /crm/users", () => {
    expect(canAccessPage("/crm/users", "HOSPITAL_STAFF")).toBe(false);
  });

  it("ADMIN can access /crm/settings", () => {
    expect(canAccessPage("/crm/settings", "ADMIN")).toBe(true);
  });

  it("COUNSELOR cannot access /crm/settings", () => {
    expect(canAccessPage("/crm/settings", "COUNSELOR")).toBe(false);
  });

  it("all roles can access /crm/calendar", () => {
    expect(canAccessPage("/crm/calendar", "ADMIN")).toBe(true);
    expect(canAccessPage("/crm/calendar", "COUNSELOR")).toBe(true);
    expect(canAccessPage("/crm/calendar", "HOSPITAL_STAFF")).toBe(true);
  });

  it("ADMIN and COUNSELOR can access /crm", () => {
    expect(canAccessPage("/crm", "ADMIN")).toBe(true);
    expect(canAccessPage("/crm", "COUNSELOR")).toBe(true);
  });

  it("HOSPITAL_STAFF cannot access /crm", () => {
    expect(canAccessPage("/crm", "HOSPITAL_STAFF")).toBe(false);
  });

  it("prefix match: /crm/settings/sub accessible only to ADMIN", () => {
    expect(canAccessPage("/crm/settings/telegram", "ADMIN")).toBe(true);
    expect(canAccessPage("/crm/settings/telegram", "COUNSELOR")).toBe(false);
  });

  it("non-crm paths are accessible to all", () => {
    expect(canAccessPage("/login", "HOSPITAL_STAFF")).toBe(true);
    expect(canAccessPage("/other", "COUNSELOR")).toBe(true);
  });
});

describe("hasRole", () => {
  it("returns true when role is in allowed list", () => {
    expect(hasRole("ADMIN", ["ADMIN", "COUNSELOR"])).toBe(true);
  });

  it("returns false when role is not in allowed list", () => {
    expect(hasRole("HOSPITAL_STAFF", ["ADMIN", "COUNSELOR"])).toBe(false);
  });

  it("returns true for exact single match", () => {
    expect(hasRole("COUNSELOR", ["COUNSELOR"])).toBe(true);
  });

  it("returns false for empty allowed list", () => {
    expect(hasRole("ADMIN", [])).toBe(false);
  });
});
