import type { AppVersionResponse } from '@/src/types/domain';
import {
  getAppUpdatePromptKey,
  parseNativeBuildNumber,
  shouldShowAppUpdatePrompt,
} from '../app-version-policy';

const response: AppVersionResponse = {
  currentBuildNumber: 20,
  policy: {
    platform: 'android',
    enabled: true,
    latestBuildNumber: 24,
    minSupportedBuildNumber: 20,
    storeUrl: 'https://play.google.com/store/apps/details?id=com.nsappsdev.language',
    message: 'A newer app version is available.',
  },
  update: {
    available: true,
    required: false,
  },
};

describe('app version policy helpers', () => {
  it('parses native build number strings', () => {
    expect(parseNativeBuildNumber('20')).toBe(20);
    expect(parseNativeBuildNumber(null)).toBeNull();
    expect(parseNativeBuildNumber('20.1')).toBeNull();
    expect(parseNativeBuildNumber('abc')).toBeNull();
  });

  it('shows a prompt only when policy is enabled, update is available, and a store URL exists', () => {
    expect(shouldShowAppUpdatePrompt(response)).toBe(true);
    expect(shouldShowAppUpdatePrompt({ ...response, update: { available: false, required: false } })).toBe(false);
    expect(shouldShowAppUpdatePrompt({ ...response, policy: { ...response.policy, enabled: false } })).toBe(false);
    expect(shouldShowAppUpdatePrompt({ ...response, policy: { ...response.policy, storeUrl: '' } })).toBe(false);
  });

  it('builds a stable optional-dismiss key from current and policy build numbers', () => {
    expect(getAppUpdatePromptKey(response)).toBe('android:20:24:20');
  });
});
