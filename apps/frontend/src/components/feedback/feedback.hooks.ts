import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import type { FeedbackKind } from '@gitroom/nestjs-libraries/dtos/feedback/feedback.answer.dto';

// The server decides which one-question survey, if any, this person sees now
export const useFeedbackQuestion = () => {
  const fetch = useFetch();
  return useSWR<{ question: FeedbackKind | null }>(
    '/feedback',
    async () => {
      const response = await fetch('/feedback');
      if (!response.ok) {
        throw new Error('Failed to load the question');
      }
      return response.json();
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
    }
  );
};
