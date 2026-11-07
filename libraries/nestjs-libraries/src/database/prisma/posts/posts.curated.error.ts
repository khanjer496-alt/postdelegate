// Post.error persists the raw serialized workflow failure; only curated
// provider messages are surfaced to a customer (the calendar, the public API
// and the weekly summary email). bad_body failures whose message came from a
// provider handleErrors mapping or a hand-written provider throw are kept
// (unmapped API responses carry the 'Unknown Error' placeholder instead).
// Internal debug strings (e.g. 'Refresh channel needed') and unmapped
// failures come out as null, because they can carry stack traces, decrypted
// channel credentials or anything else the runtime put in the message.

export const curatedPostError = (error?: string | null): string | null => {
  if (!error) {
    return null;
  }
  try {
    const parsed = JSON.parse(error);
    const [type, message] = parsed?.cause?.failure?.message
      ? [parsed?.cause?.type, parsed?.cause?.failure?.message]
      : [
          parsed?.failure?.cause?.applicationFailureInfo?.type,
          parsed?.failure?.cause?.message,
        ];
    return type === 'bad_body' && message && message !== 'Unknown Error'
      ? message
      : null;
  } catch (err) {
    return null;
  }
};
