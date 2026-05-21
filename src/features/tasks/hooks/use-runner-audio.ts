import { useEffect, useState } from 'react';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { resolveApiAssetUrl } from '@/src/config/env';
import {
  ensureAudioCached,
  prefetchAudio,
} from '@/src/features/tasks/services/audio-cache';
import type { LessonItem } from '@/src/types/domain';

export function useRunnerAudio({
  currentAudioUrl,
  currentItemIndex,
  items,
}: {
  currentAudioUrl: string | null;
  currentItemIndex: number;
  items: LessonItem[];
}) {
  const [playableAudioUrl, setPlayableAudioUrl] = useState<string | null>(null);
  const [isAudioCaching, setIsAudioCaching] = useState(false);
  const player = useAudioPlayer(playableAudioUrl ?? undefined, { updateInterval: 200 });
  const playbackStatus = useAudioPlayerStatus(player);

  useEffect(() => {
    if (!currentAudioUrl) {
      setPlayableAudioUrl(null);
      setIsAudioCaching(false);
      return;
    }

    let cancelled = false;

    const cacheAudio = async () => {
      setPlayableAudioUrl(currentAudioUrl);
      setIsAudioCaching(true);

      const cachedUri = await ensureAudioCached(currentAudioUrl).catch(() => currentAudioUrl);
      if (!cancelled) {
        setPlayableAudioUrl(cachedUri);
        setIsAudioCaching(false);
      }

      const nextItem = items[currentItemIndex + 1];
      if (nextItem?.audioUrl) {
        void prefetchAudio(resolveApiAssetUrl(nextItem.audioUrl));
      }
    };

    cacheAudio().catch(() => {
      if (!cancelled) {
        setPlayableAudioUrl(currentAudioUrl);
        setIsAudioCaching(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [currentAudioUrl, currentItemIndex, items]);

  return {
    isAudioCaching,
    playableAudioUrl,
    playbackStatus,
    player,
  };
}
