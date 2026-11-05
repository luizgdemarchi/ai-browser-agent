import { describe, expect, it } from "vitest";
import { iconState } from "../../src/extension/icon-state.js";

describe("iconState (spec R13/R14)", () => {
  it.each([
    [false, false, { variant: "padrao", badgeText: "", badgeColor: null, badgeTextColor: null, title: "AI Browser Agent — desligada" }],
    [false, true, { variant: "padrao", badgeText: "", badgeColor: null, badgeTextColor: null, title: "AI Browser Agent — desligada" }],
    [true, true, { variant: "ativo", badgeText: "", badgeColor: null, badgeTextColor: null, title: "AI Browser Agent — IA com controle" }],
    [true, false, { variant: "padrao", badgeText: "!", badgeColor: "#C0392B", badgeTextColor: "#FFFFFF", title: "AI Browser Agent — sem conexão com o servidor" }],
  ])("enabled=%s connected=%s", (enabled, connected, expected) => {
    expect(iconState(enabled, connected)).toEqual(expected);
  });
});
