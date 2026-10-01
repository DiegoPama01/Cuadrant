import { InstallationOption, InstallationSummary } from './installation.model';

export interface HasInstallation {
  installation?: string | null;
}

export function collectInstallationOptions(
  items: HasInstallation[],
  installations: InstallationSummary[] = [],
): InstallationOption[] {
  const installationNames = new Map(installations.map((installation) => [installation.id, installation.name]));
  const installationIds = new Set<string>();

  for (const installation of installations) {
    installationIds.add(installation.id);
  }

  for (const item of items) {
    if (item.installation) {
      installationIds.add(item.installation);
    }
  }

  return Array.from(installationIds).map((id, index) => ({
    id,
    name: installationNames.get(id) ?? `Installation ${index + 1}`,
  }));
}
