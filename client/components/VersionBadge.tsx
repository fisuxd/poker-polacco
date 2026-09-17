import { version } from "../../package.json";

export function VersionBadge() {
  const revision = import.meta.env.VITE_BUILD_REVISION || "local";
  return (
    <span className="version-badge" aria-label={`App version ${version}, build ${revision}`} title={`Build ${revision}`}>
      v{version} · {revision.slice(0, 7)}
    </span>
  );
}
