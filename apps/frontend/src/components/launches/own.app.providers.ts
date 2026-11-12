// "Bring your own app" providers: the customer pastes their own OAuth app's
// keys, the backend starts the OAuth flow against that app
// (POST /integrations/social/:identifier/own-app), and the platform sends them
// back to the redirect uri below, which they register on their app.
export const ownAppProviders: Record<
  string,
  { platform: string; appsUrl: string; steps: string[] }
> = {
  'reddit-own-key': {
    platform: 'Reddit',
    appsUrl: 'https://www.reddit.com/prefs/apps',
    steps: [
      'Open reddit.com/prefs/apps while signed in to the Reddit account you want to post from, and choose "create another app".',
      'Pick "web app", give it a name, and paste the redirect uri below.',
      'Copy the client id (the string under "web app") and the secret into the fields below.',
      'Your own Reddit app is for your personal, non-commercial use under Reddit’s Data API terms.',
    ],
  },
};

export const ownAppRedirectUri = (frontEndUrl: string, identifier: string) =>
  `${(frontEndUrl || window.location.origin).replace(/\/$/, '')}/integrations/social/${identifier}`;
