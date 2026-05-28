import type { AppVersionResponse } from '@/src/types/domain';

export function parseNativeBuildNumber(buildNumber: string | null): number | null {
  if (!buildNumber || !/^\d+$/.test(buildNumber)) {
    return null;
  }

  const parsed = Number(buildNumber);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function shouldShowAppUpdatePrompt(response: AppVersionResponse): boolean {
  return response.policy.enabled && response.update.available && response.policy.storeUrl.trim().length > 0;
}

export function getAppUpdatePromptKey(response: AppVersionResponse): string {
  return [
    response.policy.platform,
    response.currentBuildNumber,
    response.policy.latestBuildNumber,
    response.policy.minSupportedBuildNumber,
  ].join(':');
}
