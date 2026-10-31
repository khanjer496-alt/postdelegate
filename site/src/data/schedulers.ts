// Channel landing pages. Availability comes from NETWORKS (`available`); `docs` points to our own guide.
// Every fact on an available page comes from its channel guide in src/pages/docs/channels.
// Optional fields (action, description, about, steps, settings, faq, guides) add the search-facing
// sections of the template. Coming-soon entries leave them out and only get the shared FAQ.
export interface Scheduler {
  slug: string; key: string; name: string; h1: string; intro: string;
  /** Coming soon only: what the connection waits on, for example "Meta approves PostDelegate". */
  pending?: string;
  plan: string[]; limits: string[]; docs: string;
  /** Verb phrase used in the title and headings, for example "Schedule Tumblr Posts". */
  action?: string;
  /** Meta description override, 140-160 characters. */
  description?: string;
  /** Paragraphs under "What you can publish". */
  about?: string[];
  /** Numbered steps; they render as the how-to section and its HowTo JSON-LD. */
  steps?: { name: string; text: string }[];
  /** Rows of the post-settings table. */
  settings?: { label: string; note: string }[];
  /** Page-specific questions. Answers are plain text; [label](/path) links are allowed. */
  faq?: { q: string; a: string }[];
  /** Related guides shown near the end of the page. */
  guides?: { href: string; label: string }[];
}
export const SCHEDULERS: Scheduler[] = [
  {"slug": "instagram-scheduler", "key": "instagram", "pending": "Meta approves PostDelegate", "name": "Instagram", "h1": "Instagram content, ready to plan.", "intro": "Instagram publishing on PostDelegate is coming soon. It opens once Meta approves PostDelegate for publishing.", "plan": ["Instagram is planned through Facebook and as a standalone Instagram connection.", "Prepare captions and media in the post composer.", "Use a channel preview to review the post before scheduling."], "limits": ["The supported account type and permissions must be confirmed when connecting.", "Available media formats depend on the connection and account."], "docs": "/docs/channels/coming-soon"},
  {"slug": "linkedin-scheduler", "key": "linkedin", "pending": "LinkedIn approves PostDelegate", "name": "LinkedIn", "h1": "Keep your LinkedIn content in view.", "intro": "LinkedIn personal-profile and company-Page publishing on PostDelegate is coming soon, pending LinkedIn's approval.", "plan": ["Personal profiles and company Pages have separate connection routes.", "The composer supports text and media workflows.", "Destination and per-channel settings stay visible with the post."], "limits": ["Company Pages require the appropriate administrative access.", "The application must receive the LinkedIn permissions needed for the connection."], "docs": "/docs/channels/coming-soon"},
  {"slug": "facebook-scheduler", "key": "facebook", "pending": "Meta approves PostDelegate", "name": "Facebook", "h1": "A clearer plan for your Facebook Page.", "intro": "Facebook Page publishing on PostDelegate is coming soon. It opens once Meta approves PostDelegate for publishing.", "plan": ["Plan Page content with its caption and media together.", "Review the selected destination in the composer.", "Keep Facebook posts on the same calendar as your other channels."], "limits": ["Page access and account permissions affect what can connect.", "Publishing options vary with the media and permission granted."], "docs": "/docs/channels/coming-soon"},
  {"slug": "tiktok-scheduler", "key": "tiktok", "pending": "TikTok completes its review of PostDelegate", "name": "TikTok", "h1": "Give your TikTok content a place in the plan.", "intro": "TikTok publishing on PostDelegate is coming soon, pending TikTok's review of PostDelegate.", "plan": ["TikTok and TikTok Business connections are planned.", "Prepare a caption and media before choosing a schedule.", "Review the posting settings available to the connected account."], "limits": ["Account permissions, privacy choices and platform review affect publishing availability.", "A prepared or scheduled post is not proof that it has been published."], "docs": "/docs/channels/coming-soon"},
  {"slug": "threads-scheduler", "key": "threads", "pending": "Meta approves PostDelegate", "name": "Threads", "h1": "Keep your Threads ideas moving.", "intro": "Threads publishing on PostDelegate is coming soon. It opens once Meta approves PostDelegate for publishing.", "plan": ["Keep captions and media together while planning.", "Customize the content for its destination before scheduling.", "See Threads posts on the same calendar as your other channels."], "limits": ["Account permissions affect connection and publishing options.", "The platform validates the final post and media."], "docs": "/docs/channels/coming-soon"},
  {"slug": "pinterest-scheduler", "key": "pinterest", "pending": "Pinterest approves PostDelegate", "name": "Pinterest", "h1": "Put your next Pin in the plan.", "intro": "Pinterest publishing on PostDelegate is coming soon, pending Pinterest's approval.", "plan": ["Prepare the caption, media and destination link together.", "Review board and post settings when the connection is available.", "Plan Pins alongside the rest of your content."], "limits": ["Board access depends on the connected Pinterest account.", "App access and publishing permissions must be confirmed."], "docs": "/docs/channels/coming-soon"},
  {"slug": "google-business-scheduler", "key": "google_business", "pending": "Google approves Business Profile access", "name": "Google Business Profile", "h1": "Keep business updates on your calendar.", "intro": "Google Business Profile publishing on PostDelegate is coming soon as part of the channel rollout.", "plan": ["Plan business content alongside the rest of your posts.", "Review the destination location when connecting and composing.", "Keep updates and their media together in the composer."], "limits": ["A Google login does not by itself connect a Business Profile.", "Business Profile API access and location permissions affect availability."], "description": "Google Business Profile scheduling opens once Google approves access. Until then, try the networks open today: 7-day free trial, no card.", "docs": "/docs/channels/coming-soon"},
  {"slug": "mastodon-scheduler", "key": "mastodon", "name": "Mastodon", "h1": "Plan content for your Mastodon community.", "intro": "Mastodon publishing on PostDelegate is coming soon as part of the channel rollout.", "plan": ["Prepare a message for the instance you use.", "Keep channel-specific content with the planned post.", "Plan Mastodon posts on the same calendar as your other channels."], "limits": ["Your instance and its rules affect the connection and final post.", "Character and media rules can differ between instances."], "docs": "/docs/channels/coming-soon"},
  {
    slug: "youtube-scheduler", key: "youtube", name: "YouTube",
    action: "Schedule YouTube Videos",
    description: "Schedule YouTube video uploads with a title, public, private or unlisted visibility, a thumbnail and tags. 7-day free trial, no card required.",
    h1: "Schedule YouTube videos from one calendar.",
    intro: "Connect a YouTube channel to PostDelegate with Google sign-in and schedule video uploads with a title, visibility, thumbnail and tags.",
    about: [
      "A YouTube post is a video, a title and a visibility choice. Unlike a text network, nothing about it can be left until the last minute, so PostDelegate keeps the video file, the title, the description and the thumbnail together with the planned post. Everything is ready before the scheduled time arrives.",
      "The text you write in the composer becomes the video description, up to 5,000 characters. A planned video sits on the same calendar as your other channels, so you can see a launch video next to the posts that announce it.",
    ],
    steps: [
      { name: "Connect your YouTube channel", text: "On the calendar page choose Add Channel, then YouTube. Sign in with Google, approve the permissions and, if your Google account has more than one channel, choose the one to connect." },
      { name: "Start a post and add the video", text: "Choose Create Post and select the YouTube channel. Attach an MP4 video as the post's attachment. Every YouTube post needs a video." },
      { name: "Fill in the YouTube settings", text: "Add a title of 2 to 100 characters and choose Public, Private or Unlisted. Optionally set Made for kids, add a thumbnail and add tags. The post text becomes the description." },
      { name: "Pick a time and schedule it", text: "Choose a date and time, then Add to Calendar. Use Save as draft to hold the video back, or Post now to upload it right away." },
    ],
    plan: ["Connect from Add Channel, sign in with Google and choose the channel.", "Keep the title, description and video with the planned post.", "Set visibility to Public, Private or Unlisted, and add an optional thumbnail and tags."],
    settings: [
      { label: "Title", note: "Required. 2 to 100 characters." },
      { label: "Visibility", note: "Required. Public, Private or Unlisted." },
      { label: "Made for kids", note: "Optional. Yes or No." },
      { label: "Thumbnail", note: "Optional image. Custom thumbnails need a phone-verified YouTube channel, and YouTube may ignore them on videos it treats as Shorts. The video is still published if YouTube rejects a thumbnail." },
      { label: "Tags", note: "Optional. All tags together can use at most 500 characters; a tag with a space counts two extra characters." },
    ],
    limits: ["Signing in to PostDelegate with Google does not by itself connect a YouTube channel.", "Every YouTube post needs a video file. Uploads follow YouTube's own daily quota."],
    docs: "/docs/channels/youtube",
    faq: [
      { q: "Can I schedule a YouTube video as private or unlisted?", a: "Yes. Visibility is a required setting on every YouTube post, and you can choose Public, Private or Unlisted for each video." },
      { q: "Can I add a custom thumbnail to a scheduled YouTube video?", a: "Yes, add an optional thumbnail image to the post. Custom thumbnails need a phone-verified YouTube channel, and YouTube may ignore them on videos it treats as Shorts. If YouTube rejects the thumbnail, the video is still published." },
    ],
    guides: [{ href: "/guides/schedule-youtube-videos", label: "How to schedule YouTube videos" }],
  },
  {
    slug: "bluesky-scheduler", key: "bluesky", name: "Bluesky",
    action: "Schedule Bluesky Posts",
    description: "Schedule Bluesky posts and threads with images or video from one calendar, connected with an app password. 7-day free trial, no card required.",
    h1: "Schedule Bluesky posts and threads.",
    intro: "Connect a Bluesky account to PostDelegate with an app password and schedule posts and threads alongside the rest of your plan.",
    about: [
      "Bluesky posts are short, so the work is in timing and in the follow-ups. PostDelegate counts your characters as you type against Bluesky's 300-character limit, lets you attach up to four images or one video, and turns extra entries into a thread of replies.",
      "You connect with an app password instead of your main password. An app password is a separate password you can revoke in Bluesky at any time, so PostDelegate never holds the password you sign in with.",
    ],
    steps: [
      { name: "Create a Bluesky app password", text: "In the Bluesky app open Settings, Privacy and security, App passwords, and create one. Bluesky owns that screen, so its wording may change." },
      { name: "Connect the account", text: "On the calendar page choose Add Channel, then Bluesky. Leave Service as https://bsky.social unless your account lives on another Bluesky-compatible server, enter your handle as the Identifier, paste the app password and click Connect." },
      { name: "Write the post or thread", text: "Choose Create Post and select the Bluesky channel. Write up to 300 characters and attach up to four images or one MP4 video. Use Add post in a thread to add replies." },
      { name: "Schedule it", text: "Pick a date and time and choose Add to Calendar. Use Save as draft to review it first, or Post now to publish immediately." },
    ],
    plan: ["Connect from Add Channel with your handle and a Bluesky app password.", "Prepare the message and up to four images or one video in the composer.", "Add more entries to publish a thread of replies."],
    limits: ["Bluesky posts are limited to 300 characters, and images and video cannot be mixed in one post.", "Two-factor authentication on the Bluesky account is not supported for the connection."],
    docs: "/docs/channels/bluesky",
    faq: [
      { q: "Do I have to give PostDelegate my Bluesky password?", a: "No. You connect with an app password, which you create in Bluesky and can revoke without changing your main password. If two-factor authentication is turned on for the account, the connection does not support it." },
      { q: "Can I schedule a Bluesky thread?", a: "Yes. Add more entries to the post with Add post in a thread, and they are published as a thread of replies. You can also delay a follow-up so it appears after the first post." },
    ],
    guides: [{ href: "/guides/schedule-bluesky-posts", label: "How to schedule Bluesky posts and threads" }],
  },
  {
    slug: "devto-scheduler", key: "devto", name: "DEV.to",
    action: "Schedule DEV.to Articles",
    description: "Schedule DEV.to articles in Markdown with tags, a cover image, an organization and a canonical URL. 7-day free trial, no credit card required.",
    h1: "Schedule DEV.to articles in Markdown.",
    intro: "Connect a DEV Community account to PostDelegate with an API key and schedule Markdown articles with tags, a cover image and a canonical URL.",
    about: [
      "DEV articles are written in Markdown, and PostDelegate's composer switches to a Markdown editor when you select a DEV channel. You can set the title, up to four tags, a cover image, an optional organization and a canonical URL, then choose when the article goes out.",
      "If the article first appeared on your own blog or another site, the canonical URL setting tells DEV where the original lives. DEV rejects a canonical URL that another DEV article already uses, so the error shows up when you schedule rather than as a surprise later.",
    ],
    steps: [
      { name: "Generate a DEV API key", text: "In your DEV Community account settings, under Extensions, generate an API key. DEV owns that screen, so its wording may change." },
      { name: "Connect the account", text: "On the calendar page choose Add Channel, then Dev.to. Paste the key into API key and save. Your name and avatar appear on the channel when DEV recognises the key." },
      { name: "Write the article", text: "Choose Create Post, select the DEV channel, enter a title of at least two characters and write the body in Markdown." },
      { name: "Add settings and schedule", text: "Add up to four tags, an optional cover image, a canonical URL and an organization. Pick a date and time and choose Add to Calendar." },
    ],
    plan: ["Connect from Add Channel with a DEV API key.", "Write the article title and Markdown body in the composer.", "Add up to four tags, a cover image, a canonical URL or an organization."],
    settings: [
      { label: "Title", note: "Required, at least 2 characters." },
      { label: "Cover image", note: "Optional." },
      { label: "Canonical URL", note: "Optional. Use it when the article first appeared elsewhere. DEV rejects a canonical URL it already has." },
      { label: "Organization", note: "Optional. Publish under one of your DEV organizations." },
      { label: "Tags", note: "Up to 4, picked from DEV's tag list." },
    ],
    limits: ["DEV publishes the article straight away when the post goes out. Keep a draft in PostDelegate to hold it back.", "DEV rejects a canonical URL another article already uses."],
    docs: "/docs/channels/devto",
    faq: [
      { q: "Can I set a canonical URL on a scheduled DEV.to article?", a: "Yes. Canonical URL is an optional setting. Use it when the article first appeared on another site. DEV rejects a canonical URL that another DEV article already uses." },
      { q: "Will DEV keep my article as a draft until I publish it?", a: "No. DEV publishes the article straight away when the PostDelegate post goes out. To hold an article back, keep it as a draft in PostDelegate rather than relying on a draft on DEV." },
    ],
    guides: [{ href: "/guides/cross-post-blog-articles", label: "Cross-post articles with canonical URLs" }],
  },
  {
    slug: "tumblr-scheduler", key: "tumblr", name: "Tumblr",
    action: "Schedule Tumblr Posts",
    description: "Schedule Tumblr posts with text, up to 30 images or a video, plus a title, link and tags. Sign in with Tumblr. 7-day free trial, no card required.",
    h1: "Schedule Tumblr posts to your blog.",
    intro: "Connect a Tumblr blog to PostDelegate by signing in with Tumblr, then schedule posts with text, images or a video.",
    about: [
      "Tumblr is a blogging platform, and a PostDelegate post becomes one post on the blog you connected. It can hold long text, up to 30 images or a single MP4 video, with an optional title, a link, a source credit and tags.",
      "You connect through Tumblr's own sign-in, so PostDelegate never sees your Tumblr password. If your account has several blogs, connect each one as its own channel and pick the right one in the composer.",
    ],
    steps: [
      { name: "Sign in with Tumblr", text: "On the calendar page choose Add Channel, then Tumblr. Sign in with Tumblr and approve the permissions PostDelegate asks for: posting to your blogs and staying signed in." },
      { name: "Choose the blog", text: "Choose the blog to connect. To post to another blog on the same account, add it as a second channel." },
      { name: "Write the post", text: "Choose Create Post and select the Tumblr channel. Write the text, up to 32,768 characters, and add up to 30 images or one MP4 video." },
      { name: "Add settings and schedule", text: "Optionally add a title, link URL, source URL and tags separated by commas. Pick a date and time and choose Add to Calendar." },
    ],
    plan: ["Sign in with Tumblr and choose the blog to connect.", "Write text and add up to 30 images or one MP4 video.", "Add an optional title, link, source credit and tags."],
    settings: [
      { label: "Title", note: "Optional. Shown as a heading at the top of the post." },
      { label: "Link URL", note: "Optional. Added to the post as a link." },
      { label: "Source URL", note: "Optional. Credits where the content came from." },
      { label: "Tags", note: "Optional. Separate tags with commas." },
    ],
    limits: ["Each post is published straight away on the blog, not saved as a draft on Tumblr. Keep a draft in PostDelegate to hold it back.", "Tumblr caps how many posts, uploads and videos a blog can publish each day. A post over the cap fails with Tumblr's reason."],
    docs: "/docs/channels/tumblr",
    faq: [
      { q: "Can I schedule posts to more than one Tumblr blog?", a: "Yes. Each connection is one blog. To post to another blog on the same Tumblr account, add it as a second channel from Add Channel." },
      { q: "What happens if I hit Tumblr's daily limit?", a: "Tumblr caps how many posts, uploads and videos a blog can publish each day. A post that goes over the cap fails with Tumblr's reason shown on the calendar. Schedule it for the next day." },
    ],
  },
  {
    slug: "wordpress-scheduler", key: "wordpress", name: "WordPress",
    action: "Schedule WordPress Blog Posts",
    description: "Schedule WordPress posts and pages with categories, tags and a featured image through your site's REST API. 7-day free trial, no credit card needed.",
    h1: "Schedule WordPress posts from one calendar.",
    intro: "Connect a WordPress site to PostDelegate with an application password and schedule posts or pages with categories, tags and a featured image.",
    about: [
      "PostDelegate talks to your site through the WordPress REST API with an application password, a built-in WordPress feature. Your login password is never used. The post type, status, categories and tags are loaded from your own site, so you choose from what actually exists there.",
      "The composer writes HTML, so the post arrives in WordPress as you formatted it. Put pictures inside the content where they should appear, using images from the media library. A separate main image is uploaded to your WordPress media library and used as the featured image.",
    ],
    steps: [
      { name: "Create an application password", text: "In WordPress open Users, Profile, Application Passwords and create one for a user who is allowed to create posts. Some hosts and security plugins turn application passwords off." },
      { name: "Connect the site", text: "On the calendar page choose Add Channel, then WordPress. Enter the full Domain URL such as https://example.com, the WordPress username and the application password, then save. PostDelegate calls your site's REST API to check the details." },
      { name: "Write the post", text: "Choose Create Post and select the WordPress channel. Enter a title of at least two characters, choose a post type and write the body as HTML, up to 100,000 characters." },
      { name: "Choose status and schedule", text: "Set Status to Publish, Draft, Pending or Private, add categories, tags and a main image, then pick a date and time and choose Add to Calendar." },
    ],
    plan: ["Connect with your site address, username and an application password.", "Write the post as HTML, with categories, tags and a main image.", "Choose the post type and status, such as Publish, Draft, Pending or Private."],
    settings: [
      { label: "Title", note: "Required, at least 2 characters." },
      { label: "Post type", note: "Required. Choose from the types on your site, such as posts and pages." },
      { label: "Status", note: "Publish (the default), Draft, Pending or Private." },
      { label: "Categories", note: "Optional. Loaded from your site." },
      { label: "Tags", note: "Optional. Loaded from your site." },
      { label: "Main image", note: "Optional featured image. It is uploaded to your media library." },
    ],
    limits: ["The site must be reachable from the internet with the REST API turned on, and the user needs a role that can create posts.", "A security plugin or server setting that blocks the REST API or strips the Authorization header makes WordPress reject the login."],
    docs: "/docs/channels/wordpress",
    faq: [
      { q: "Does PostDelegate need a plugin on my WordPress site?", a: "Our guide asks for none. The connection uses your site's REST API and a WordPress application password, which is a built-in feature. Some hosts and security plugins turn application passwords or the REST API off, and then the connection fails with a message saying what to allow." },
      { q: "Can I save a scheduled post as a draft in WordPress?", a: "Yes. Status can be Publish, Draft, Pending or Private, and Publish is the default. Choosing Draft sends the post to WordPress as a draft when the scheduled time arrives." },
    ],
    guides: [{ href: "/guides/cross-post-blog-articles", label: "Cross-post articles with canonical URLs" }],
  },
  {
    slug: "medium-scheduler", key: "medium", name: "Medium",
    action: "Schedule Medium Stories",
    description: "Schedule Medium stories in Markdown with a title, subtitle, tags, canonical URL and optional publication. 7-day free trial, no credit card required.",
    h1: "Schedule Medium stories in Markdown.",
    intro: "Connect Medium to PostDelegate with an integration token and schedule Markdown stories, optionally to a publication you can write to.",
    about: [
      "A Medium story needs a title and a subtitle, and PostDelegate asks for both so a scheduled story is never missing one. The body is written in Markdown, up to 100,000 characters, with optional tags (up to four) and an optional canonical URL for stories that first appeared elsewhere.",
      "Where the story ends up depends on one setting. With no publication selected, it is published publicly on your profile. With a publication selected, it is sent to the publication as a draft, so an editor can review it first.",
    ],
    steps: [
      { name: "Get a Medium integration token", text: "Create one from your Medium security settings, if your account still offers them. Medium decides who can create tokens and owns that screen. If your account cannot create one, the connection cannot be made." },
      { name: "Connect Medium", text: "On the calendar page choose Add Channel, then Medium. Paste the token into API key and save. Your name and avatar appear on the channel." },
      { name: "Write the story", text: "Choose Create Post and select the Medium channel. Enter the title and subtitle, each at least two characters, and write the body in Markdown." },
      { name: "Add settings and schedule", text: "Optionally add a canonical URL, choose a publication and add up to four tags. Pick a date and time and choose Add to Calendar." },
    ],
    plan: ["Connect from Add Channel with a Medium integration token.", "Write the title, subtitle and Markdown body in the composer.", "Optionally add tags, a canonical URL and a publication."],
    settings: [
      { label: "Title", note: "Required, at least 2 characters." },
      { label: "Subtitle", note: "Required, at least 2 characters." },
      { label: "Canonical URL", note: "Optional. Use it when the story first appeared elsewhere." },
      { label: "Publication", note: "Optional. Choose one of the publications you can post to." },
      { label: "Tags", note: "Optional, up to 4." },
    ],
    limits: ["The connection needs a Medium integration token. Medium decides who can create tokens, so some accounts cannot connect.", "A story sent to a publication arrives as a draft for an editor, not as a published story."],
    docs: "/docs/channels/medium",
    faq: [
      { q: "Do I need a Medium integration token?", a: "Yes. PostDelegate connects to Medium with an integration token from your Medium security settings. Medium decides who can create tokens and owns that screen. If your account cannot create one, the connection cannot be made." },
      { q: "Does a scheduled Medium story go live or stay a draft?", a: "It depends on the Publication setting. With no publication selected, the story is published publicly on your profile. With a publication selected, it is sent to the publication as a draft so an editor can review it." },
    ],
    guides: [{ href: "/guides/cross-post-blog-articles", label: "Cross-post articles with canonical URLs" }],
  },
  {
    slug: "hashnode-scheduler", key: "hashnode", name: "Hashnode",
    action: "Schedule Hashnode Articles",
    description: "Schedule Hashnode articles in Markdown to your publication, with a subtitle, cover image, tags and canonical URL. 7-day free trial, no card required.",
    h1: "Schedule Hashnode articles to your publication.",
    intro: "Connect a Hashnode account to PostDelegate with an API key and schedule Markdown articles to one of your publications.",
    about: [
      "A Hashnode article always belongs to a publication, so PostDelegate loads the publications on your account and asks you to choose one. It also asks for at least one tag from Hashnode's tag list, because Hashnode requires it. The title needs at least six characters, and the subtitle and cover image are optional.",
      "The article body is written in Markdown, up to 10,000 characters. If the article first appeared on another site, add its address as the canonical URL so Hashnode knows where the original lives.",
    ],
    steps: [
      { name: "Generate a Hashnode token", text: "In your Hashnode account's developer settings, generate a personal access token. Hashnode calls it that and PostDelegate calls it the API key. Hashnode owns that screen, so its wording may change." },
      { name: "Connect Hashnode", text: "On the calendar page choose Add Channel, then Hashnode. Paste the token into API key and save. Your name and avatar appear on the channel." },
      { name: "Write the article", text: "Choose Create Post and select the Hashnode channel. Enter a title of at least six characters and write the body in Markdown." },
      { name: "Choose the publication and schedule", text: "Choose the publication, add at least one tag, and optionally a subtitle, cover image and canonical URL. Pick a date and time and choose Add to Calendar." },
    ],
    plan: ["Connect from Add Channel with a Hashnode personal access token.", "Write the title and Markdown body, and choose a publication.", "Add at least one tag, plus an optional subtitle, cover image and canonical URL."],
    settings: [
      { label: "Title", note: "Required, at least 6 characters." },
      { label: "Subtitle", note: "Optional, at least 2 characters." },
      { label: "Cover image", note: "Optional." },
      { label: "Canonical URL", note: "Optional. Use it when the article first appeared elsewhere." },
      { label: "Publication", note: "Required. Choose from the publications on your account." },
      { label: "Tags", note: "Required, at least one, picked from Hashnode's tag list." },
    ],
    limits: ["The account needs at least one publication. If none is listed, create one on Hashnode first.", "The article body is limited to 10,000 characters."],
    docs: "/docs/channels/hashnode",
    faq: [
      { q: "Do I need a Hashnode publication to schedule an article?", a: "Yes. Publication is a required setting, and the list comes from the publications on your Hashnode account. If the list is empty, create a publication on Hashnode first, then reopen the post." },
      { q: "Can I set a canonical URL on a Hashnode article?", a: "Yes. Canonical URL is an optional setting. Use it when the article first appeared on another site." },
    ],
    guides: [{ href: "/guides/cross-post-blog-articles", label: "Cross-post articles with canonical URLs" }],
  },
  {
    slug: "nostr-scheduler", key: "nostr", name: "Nostr",
    action: "Schedule Nostr Notes",
    description: "Schedule Nostr notes to public relays with a hex key, with images and video added as links and replies for follow-ups. 7-day free trial, no card.",
    h1: "Schedule Nostr notes to public relays.",
    intro: "Connect a Nostr identity to PostDelegate with its hex private key and schedule notes to a set of public relays.",
    about: [
      "Nostr has no accounts to sign in to, so a connection means handing PostDelegate a key that can sign notes for you. PostDelegate works out the public key, then looks up your profile name and picture on the relays. If it finds none, the channel is named No Name, and posting still works.",
      "When a note goes out, PostDelegate sends it to nos.lol, relay.damus.io, relay.snort.social, temp.iris.to and vault.iris.to. The note counts as published when a relay accepts it, and the link in your calendar points to the note on primal.net.",
    ],
    steps: [
      { name: "Get your private key in hex", text: "Many Nostr clients and sites such as iris.to can show or convert your key to hex. It is a long string of letters a to f and numbers, not the nsec form." },
      { name: "Connect the identity", text: "On the calendar page choose Add Channel, then Nostr. Paste the hex key into Nostr private key and save." },
      { name: "Write the note", text: "Choose Create Post and select the Nostr channel. Write the text. Images and video are added to the note as plain URLs after your text. Add more entries to create replies to the first note." },
      { name: "Schedule it", text: "Pick a date and time and choose Add to Calendar. Use Save as draft to hold it back, or Post now to send it right away." },
    ],
    plan: ["Connect from Add Channel with a hex private key.", "Write the note, with images and video added as URLs after the text.", "Add more entries to publish replies to the first note."],
    limits: ["Your private key controls your whole Nostr identity and is stored on the service so PostDelegate can sign notes. Consider a separate key pair just for scheduling.", "Nostr has no way to revoke a key, so only connect one you are comfortable with."],
    docs: "/docs/channels/nostr",
    faq: [
      { q: "Is it safe to give PostDelegate my Nostr private key?", a: "Your private key controls your whole Nostr identity, and PostDelegate needs it to sign notes for you, so it is stored on the service. If that is more than you want to hand over, create a separate key pair just for scheduling. Nostr has no way to revoke a key, so only connect one you are comfortable with." },
      { q: "Which relays does PostDelegate publish to?", a: "Each note is sent to nos.lol, relay.damus.io, relay.snort.social, temp.iris.to and vault.iris.to. The note counts as published when a relay accepts it." },
    ],
  },
  {
    slug: "lemmy-scheduler", key: "lemmy", name: "Lemmy",
    action: "Schedule Lemmy Posts",
    description: "Schedule Lemmy posts to one or more communities on your instance, with a title per community, an optional link and a cover image. 7-day free trial, no card.",
    h1: "Schedule Lemmy posts to your communities.",
    intro: "Connect to a Lemmy instance with your username and password and schedule posts to one or more communities.",
    about: [
      "Lemmy is made of separate instances, so PostDelegate asks which one you use, for example https://lemmy.world, along with your username or email and password. Each post goes to one or more communities, and every community needs its own title.",
      "A post can carry up to 10,000 characters of text and an optional link. The first image becomes the cover, as a PNG, JPG or GIF. If the instance rate-limits PostDelegate, the post is retried later, and a post that cannot go out fails with a readable reason.",
    ],
    steps: [
      { name: "Connect to your instance", text: "On the calendar page choose Add Channel, then Lemmy. Enter the instance address starting with http:// or https://, your username or email, and your password. PostDelegate signs in to the instance and shows your account on the channel." },
      { name: "Write the post", text: "Choose Create Post and select the Lemmy channel. Write the text and, if you like, attach an image. The first image is used as the cover." },
      { name: "Choose communities and titles", text: "Choose one or more communities. Each community needs its own title of at least two characters. Add an optional link in URL." },
      { name: "Schedule it", text: "Pick a date and time and choose Add to Calendar. Use Save as draft to review it first, or Post now." },
    ],
    plan: ["Connect with your instance address, username and password.", "Choose one or more communities and give each its own title.", "Add up to 10,000 characters of text, a cover image and an optional link."],
    settings: [
      { label: "Community", note: "Required. Choose one or more communities. Each one needs its own title." },
      { label: "Title", note: "Required, at least 2 characters, one per community." },
      { label: "URL", note: "Optional link to attach to the post." },
    ],
    limits: ["Lemmy has no app passwords, so you connect with your real account password. It is encrypted before it is stored.", "A post fails with a readable reason if your account is banned, the community no longer exists, or the instance blocks a link in the post."],
    docs: "/docs/channels/lemmy",
    faq: [
      { q: "Can I post to several Lemmy communities at once?", a: "Yes. Choose one or more communities in the Community setting. Each community needs its own title, so the same post can be titled differently for each one." },
      { q: "Is my Lemmy password stored?", a: "Lemmy has no app passwords, so you connect with your real account password. It is encrypted before it is stored, and you can change it later with Update Credentials in the channel's menu." },
    ],
  },
  {
    slug: "telegram-scheduler", key: "telegram", name: "Telegram",
    action: "Schedule Telegram Posts",
    description: "Schedule Telegram posts to your channel or group with photos, videos and albums. Add @PostDelegateBot and send one command. 7-day free trial, no card.",
    h1: "Schedule posts to your Telegram channel.",
    intro: "Add @PostDelegateBot to a Telegram channel or group, send one connect command, then schedule messages with text, photos, videos and files.",
    about: [
      "Telegram channels are a direct line to an audience, and groups are where communities talk. PostDelegate sends each scheduled post as a message from @PostDelegateBot, so announcements, links and media go out at the time you set without anyone online to press send.",
      "Text can run to 4,096 characters with basic formatting. One photo, video or file is sent with your text as its caption, and several attachments go out as an album of up to 10. With an attachment Telegram limits the caption to 1,024 characters. Follow-up entries are sent as replies to the first message.",
    ],
    steps: [
      { name: "Add the bot to your chat", text: "In Telegram, add @PostDelegateBot to your channel or group. In a channel, make it an admin that can post messages; only admins can post in channels. Use the Telegram app on your phone or computer for this, because the web version does not let you make a bot a channel admin." },
      { name: "Start the connection", text: "In PostDelegate, choose Add Channel on the calendar page, then Telegram, and choose Connect Telegram. PostDelegate shows a short command such as /connect AB12." },
      { name: "Send the command", text: "Copy the command and send it as a message in the channel or group. PostDelegate spots it within a few seconds and the chat appears on your calendar. If the bot is an admin, it removes the command for you." },
      { name: "Write and schedule", text: "Choose Create Post, select the Telegram chat, write the message and attach photos, videos or files. Pick a date and time and choose Add to Calendar." },
    ],
    plan: ["Add @PostDelegateBot to a channel or group, then connect from Add Channel.", "Write a message with formatting, links and attachments.", "Add follow-up entries to send replies to the first message."],
    settings: [
      { label: "Text", note: "Up to 4,096 characters. With an attachment, Telegram limits the caption to 1,024 characters." },
      { label: "Attachments", note: "Photos, videos or other files. Up to 10 items per album; more are sent as further albums." },
    ],
    limits: ["Channels need @PostDelegateBot as an admin that can post. Telegram's web version cannot appoint a bot as channel admin, so use the phone or desktop app for that step.", "Posts come from @PostDelegateBot, not from your own Telegram account."],
    docs: "/docs/channels/telegram",
    faq: [
      { q: "Do I need to give PostDelegate my Telegram password or phone number?", a: "No. You add @PostDelegateBot to your channel or group and send a short connect command there. PostDelegate never asks for your Telegram login." },
      { q: "Why can't I add the bot as a channel admin on Telegram Web?", a: "Telegram's web version does not offer that option. Open the Telegram app on your phone or computer, make @PostDelegateBot an admin of the channel, then finish connecting from PostDelegate in any browser. Groups can be connected from the web." },
      { q: "Can I post to a private Telegram channel or group?", a: "Yes. The bot works in private and public chats. It only needs to be a member of the group, or an admin of the channel, before you send the connect command." },
    ],
  },
  {
    slug: "slack-scheduler", key: "slack", name: "Slack",
    action: "Schedule Slack Messages",
    description: "Schedule Slack messages with text and images to the channel you pick, with replies sent in a thread. Add PostDelegate to your workspace. 7-day free trial.",
    h1: "Schedule Slack messages to any channel.",
    intro: "Add PostDelegate to a Slack workspace, then send scheduled messages with text and images to the channel you pick.",
    about: [
      "Slack is a workplace chat app, and scheduled messages are useful for announcements, reminders and updates that should land at a set time. PostDelegate sends each post as a message to the channel you choose, and text uses Slack's own formatting.",
      "Messages appear from the PostDelegate app, not from your own Slack account. Add images as PNG, JPG or GIF. Video is not supported. Follow-up entries in a post are sent as replies in a thread under the first message.",
    ],
    steps: [
      { name: "Add PostDelegate to Slack", text: "On the calendar page choose Add Channel, then Slack. Choose the workspace and allow PostDelegate. It asks to see the workspace's channels and members, join public channels and post messages. You need to be allowed to add apps to the workspace." },
      { name: "Write the message", text: "Choose Create Post and select the Slack workspace. Write the message with Slack's formatting and add PNG, JPG or GIF images if you like." },
      { name: "Pick the Slack channel", text: "Choose the Slack channel to post to. PostDelegate joins a public channel on its own before posting." },
      { name: "Schedule it", text: "Pick a date and time and choose Add to Calendar. Add more entries to send follow-ups as thread replies." },
    ],
    plan: ["Add PostDelegate to a workspace from Add Channel.", "Write a message and choose the Slack channel it goes to.", "Add follow-up entries to send replies in a thread."],
    settings: [
      { label: "Channel", note: "Required. Choose the Slack channel to post to. PostDelegate joins a public channel on its own before posting." },
    ],
    limits: ["PostDelegate cannot join private channels by itself. Invite the PostDelegate app to the channel in Slack, then pick it again.", "Messages are sent from the PostDelegate app, not your own Slack account."],
    docs: "/docs/channels/slack",
    faq: [
      { q: "Does the message come from my own Slack account?", a: "No. Posts appear from the PostDelegate app, not from your own Slack account." },
      { q: "Can I schedule a message to a private Slack channel?", a: "Yes, with one extra step. PostDelegate cannot join private channels by itself, so invite the PostDelegate app to the channel in Slack, then pick the channel again in the post settings." },
    ],
  },
  {
    slug: "dribbble-scheduler", key: "dribbble", name: "Dribbble",
    action: "Schedule Dribbble Shots",
    description: "Schedule Dribbble shots with a title, description and one image, cropped to Dribbble's size for you. Sign in with Dribbble. 7-day free trial, no card.",
    h1: "Schedule Dribbble shots to your profile.",
    intro: "Connect Dribbble by signing in with Dribbble and publish scheduled shots, each with a title and one image.",
    about: [
      "Dribbble is a showcase for designers, and each PostDelegate post becomes one shot with exactly one image. The title you set is the title of the shot, and the post text becomes its description. Video and MP4 files are not supported.",
      "Images are cropped from the centre to 800x600, or to 400x300 for smaller images, and the minimum size is 400x300. GIFs are not cropped, so they must already be exactly 400x300 or 800x600. Check the crop in the preview before you schedule.",
    ],
    steps: [
      { name: "Sign in with Dribbble", text: "On the calendar page choose Add Channel, then Dribbble. Sign in with Dribbble and approve the permissions. PostDelegate asks to read your public profile and to upload shots." },
      { name: "Create the post", text: "Choose Create Post and select the Dribbble channel. Attach exactly one image of at least 400x300, and write the shot description as the post text." },
      { name: "Add the title", text: "Enter the shot title. It is the one required Dribbble setting." },
      { name: "Schedule it", text: "Pick a date and time and choose Add to Calendar. Use Save as draft to hold it back." },
    ],
    plan: ["Sign in with Dribbble from Add Channel.", "Attach one image per shot, at least 400x300.", "Write the description as the post text and set the shot title."],
    settings: [
      { label: "Title", note: "Required. The title of the shot." },
    ],
    limits: ["Dribbble only lets accounts with upload rights publish shots publicly, so check that yours can upload shots before you schedule.", "Each post is one image. Video and MP4 files are not supported."],
    docs: "/docs/channels/dribbble",
    faq: [
      { q: "What size should my Dribbble image be?", a: "At least 400x300. Images are cropped from the centre to 800x600, or to 400x300 for smaller images. GIFs are not cropped, so they must already be exactly 400x300 or 800x600." },
      { q: "Can I schedule more than one image per shot?", a: "No. Each post becomes a shot with exactly one image, and video and MP4 files are not supported." },
    ],
  },
  {
    slug: "twitch-scheduler", key: "twitch", name: "Twitch",
    action: "Schedule Twitch Chat Messages",
    description: "Schedule Twitch chat messages and highlighted announcements to your channel's chat, with a colour you choose. 7-day free trial, no credit card needed.",
    h1: "Schedule Twitch chat messages and announcements.",
    intro: "Connect a Twitch channel by signing in with Twitch and send scheduled chat messages or announcements to your channel's chat.",
    about: [
      "Twitch is a live-streaming platform, and a scheduled message is a way to put a reminder, a schedule or a link in chat at a set time. Each post is sent to your channel's chat from your own Twitch account, up to 500 characters of text.",
      "You can send a regular chat message or an announcement, which Twitch highlights in chat. For an announcement you can choose Primary, Blue, Green, Orange or Purple. Messages are text only, so images and video are not sent.",
    ],
    steps: [
      { name: "Sign in with Twitch", text: "On the calendar page choose Add Channel, then Twitch. Sign in with Twitch and approve the permissions. PostDelegate asks to read and write chat messages and to manage announcements in your chat." },
      { name: "Write the message", text: "Choose Create Post and select the Twitch channel. Write the message, up to 500 characters of text." },
      { name: "Choose message type and colour", text: "Set Message Type to Chat Message, the default, or Announcement. For an announcement, pick the Announcement Color." },
      { name: "Schedule it", text: "Pick a date and time and choose Add to Calendar. Follow-up entries are sent as replies to the first message, or as further announcements when Announcement is chosen." },
    ],
    plan: ["Sign in with Twitch from Add Channel.", "Write a chat message of up to 500 characters.", "Choose Chat Message or Announcement, and a colour for announcements."],
    settings: [
      { label: "Message Type", note: "Chat Message (the default) or Announcement. An announcement is highlighted in chat." },
      { label: "Announcement Color", note: "Shown for announcements. Primary (the default), Blue, Green, Orange or Purple." },
    ],
    limits: ["Messages are text only. Images and video are not sent.", "If Twitch stops accepting the saved sign-in, the channel asks you to reconnect and scheduled messages will not send until you do."],
    docs: "/docs/channels/twitch",
    faq: [
      { q: "Can I schedule Twitch announcements as well as chat messages?", a: "Yes. Set Message Type to Announcement and choose a colour: Primary, Blue, Green, Orange or Purple. Announcements are highlighted in chat." },
      { q: "Does the message come from my own Twitch account?", a: "Yes. Each post is sent to your channel's chat from your own Twitch account, as text of up to 500 characters." },
    ],
  },
  {
    slug: "kick-scheduler", key: "kick", name: "Kick",
    action: "Schedule Kick Chat Messages",
    description: "Schedule Kick chat messages of up to 500 characters to your channel's chat after signing in with Kick. 7-day free trial, no credit card required.",
    h1: "Schedule Kick chat messages to your channel.",
    intro: "Connect a Kick channel by signing in with Kick and send scheduled text messages to your channel's chat.",
    about: [
      "Kick is a live-streaming platform. Connecting it lets PostDelegate send a scheduled message to your channel's chat, which is handy for a recurring reminder, a link or a schedule note at a time you choose.",
      "Each post is sent as a chat message of up to 500 characters. Messages are text only, so images and video are not sent. Follow-up entries in a post are sent as replies to the first message. Kick has no extra post settings.",
    ],
    steps: [
      { name: "Sign in with Kick", text: "On the calendar page choose Add Channel, then Kick. Sign in with Kick and approve the permissions. PostDelegate asks to read your user and channel details and to write chat messages." },
      { name: "Write the message", text: "Choose Create Post and select the Kick channel. Write the message, up to 500 characters of text." },
      { name: "Add replies if you need them", text: "Add more entries to the post if you want follow-ups. They are sent as replies to the first message." },
      { name: "Schedule it", text: "Pick a date and time and choose Add to Calendar. Use Save as draft to hold it back, or Post now to send it right away." },
    ],
    plan: ["Sign in with Kick from Add Channel.", "Write a chat message of up to 500 characters.", "Add follow-up entries to send replies to the first message."],
    limits: ["Messages are text only. Images and video are not sent.", "If Kick stops accepting the saved sign-in, the channel asks you to reconnect and scheduled messages will not send until you do."],
    docs: "/docs/channels/kick",
    faq: [
      { q: "Can I send images or video to Kick chat?", a: "No. Messages are text only, up to 500 characters, and images and video are not sent." },
      { q: "Can I send a follow-up message after the first one?", a: "Yes. Add more entries to the post, and they are sent as replies to the first message." },
    ],
  },
  {
    slug: "listmonk-scheduler", key: "listmonk", name: "Listmonk",
    action: "Schedule Email Campaigns",
    description: "Schedule Listmonk email campaigns to a list from PostDelegate, with a subject, preview text and template. 7-day free trial, no credit card required.",
    h1: "Schedule Listmonk email campaigns.",
    intro: "Send an email campaign through your own self-hosted Listmonk when a post goes out.",
    about: [
      "Listmonk is newsletter software you host yourself. Connecting it lets PostDelegate create a campaign in your Listmonk and start it on a schedule, so a newsletter can sit on the same calendar as the social posts that announce it.",
      "The editor writes HTML, and you put pictures inside the content where they should appear, using images from the media library. Attachments are not sent. You choose the subject, the preview text shown beside it in many inboxes, the list and an optional template.",
    ],
    steps: [
      { name: "Check your Listmonk", text: "You need a running Listmonk reachable from the internet over http:// or https://, and a Listmonk username and password that can read settings and lists and create campaigns." },
      { name: "Connect Listmonk", text: "On the calendar page choose Add Channel, then ListMonk. Enter the URL of your Listmonk, your username and your password, then save. PostDelegate reads your Listmonk settings to check the details and uses your site name as the channel name." },
      { name: "Write the campaign", text: "Choose Create Post and select the Listmonk channel. Enter the subject, optional preview text, and write the email body as HTML." },
      { name: "Choose list and template, then schedule", text: "Choose the list, and a template or Default. Pick a date and time and choose Add to Calendar. Send a test through Listmonk itself first." },
    ],
    plan: ["Connect your own Listmonk with its URL, username and password.", "Write the email as HTML, with a subject and preview text.", "Choose the list and an optional template."],
    settings: [
      { label: "Subject", note: "Required. The email subject." },
      { label: "Preview", note: "The preview text shown next to the subject in many inboxes." },
      { label: "List", note: "Required. Choose from the lists in your Listmonk." },
      { label: "Template", note: "Optional. Choose a Listmonk template, or Default." },
    ],
    limits: ["Publishing starts the campaign. When the post goes out, PostDelegate creates a regular campaign on your chosen list and sets it to running, which sends it.", "Use a PostDelegate draft to hold a campaign back, and send a test through Listmonk itself first."],
    docs: "/docs/channels/listmonk",
    faq: [
      { q: "Does PostDelegate send the email itself?", a: "No. PostDelegate creates a regular campaign in your own Listmonk and sets it to running, and your Listmonk sends it. Use a draft in PostDelegate to hold a campaign back, and send a test through Listmonk first." },
      { q: "Can I attach files to a Listmonk campaign?", a: "No. Attachments are not sent. Put pictures inside the HTML content where they should appear, using images from the media library." },
    ],
  },
];
