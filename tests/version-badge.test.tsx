import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VersionBadge } from "../client/components/VersionBadge";
import { version } from "../package.json";

afterEach(() => vi.unstubAllEnvs());

describe("deployment version marker", () => {
  it("shows the release and short Git revision embedded in the client build", () => {
    vi.stubEnv("VITE_BUILD_REVISION", "abcdef123456789");
    const markup = renderToStaticMarkup(<VersionBadge />);
    expect(markup).toContain(`v${version} · abcdef1`);
    expect(markup).toContain("build abcdef123456789");
  });

  it("labels local builds instead of pretending they are a GitHub deployment", () => {
    vi.stubEnv("VITE_BUILD_REVISION", "");
    expect(renderToStaticMarkup(<VersionBadge />)).toContain(`v${version} · local`);
  });
});
