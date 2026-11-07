// Image sizes per network for /tools/social-image-sizes and the per-network tool pages.
// Only sizes stated on each platform's own help or developer pages, checked in November 2026.
// Anything a platform does not publish is left out rather than guessed.
export const CHECKED = 'November 2026';
export type SizeRow = [string, string, string];
export type SizeSection = { key: string; rows: SizeRow[]; sources: [string, string][]; note?: string };
export const IMAGE_SIZES: SizeSection[] = [
  { key: 'youtube', rows: [
    ['Video thumbnail', '16:9, recommended 3840×2160', 'At least 640 wide. JPG or PNG. Up to 2 MB when uploaded on mobile, 50 MB on a computer.'],
    ['Shorts thumbnail', '9:16, recommended 2160×3840', 'At least 640 tall.'],
    ['Channel banner', '2560×1440 recommended', 'At least 2048×1152 at 16:9. Keep text and logos inside the 1235×338 safe area at the minimum size. Up to 6 MB.'],
    ['Profile picture', 'Shown at 98×98', 'JPG, GIF, BMP or PNG, without animation. Up to 15 MB.'],
  ], sources: [['YouTube Help: thumbnails', 'https://support.google.com/youtube/answer/72431?hl=en'], ['YouTube Help: banner and profile picture', 'https://support.google.com/youtube/answer/10456525?hl=en']] },
  { key: 'bluesky', rows: [
    ['Post images', 'No size published', 'Up to four images per post.'],
  ], sources: [['Bluesky developer docs: posts', 'https://docs.bsky.app/docs/advanced-guides/posts']], note: 'Bluesky does not publish recommended pixel sizes. PostDelegate scales an image down before posting it to Bluesky if the file is larger than about 1 MB.' },
  { key: 'dribbble', rows: [
    ['Shot (through PostDelegate)', '800×600 or 400×300', 'Images of at least 400×300 are cropped from the centre to 800×600 or 400×300. GIFs must already be exactly one of those sizes.'],
    ['Avatar', 'No size published', 'JPG, GIF or PNG, up to 800 KB.'],
    ['Pro masthead banner', 'At least 1600×1200', 'JPG or PNG, up to 5 MB.'],
  ], sources: [['Dribbble Help: your profile', 'https://help.dribbble.com/en/articles/11056066-creating-managing-your-dribbble-profile']] },
  { key: 'twitch', rows: [
    ['Profile picture', '256×256', 'GIF, JPG or PNG, up to 10 MB.'],
    ['Profile banner', '1200×480', 'Up to 10 MB.'],
    ['Panel image', 'Up to 320×300', 'Under 2.9 MB.'],
  ], sources: [['Twitch Help: account settings', 'https://help.twitch.tv/s/article/twitch-account-settings?language=en_US'], ['Twitch Help: channel page setup', 'https://help.twitch.tv/s/article/channel-page-setup?language=en_US']] },
  { key: 'tumblr', rows: [
    ['Avatar', '128×128', 'Up to 10 MB.'],
    ['Header', '2048×1152 (16:9)', 'Up to 10 MB.'],
    ['Post image', '540×810 recommended', 'Up to 20 MB. Up to 10 images per post in the apps, 30 on the web.'],
  ], sources: [['Tumblr Help: images and GIFs', 'https://help.tumblr.com/knowledge-base/image-gif-troubleshooting/']] },
  { key: 'medium', rows: [
    ['Story image', 'At least 1192 wide', 'Needed for every placement option. JPG, GIF or PNG, up to 25 MB.'],
  ], sources: [['Medium Help: using images', 'https://help.medium.com/hc/en-us/articles/215679797-Using-images']] },
  { key: 'devto', rows: [
    ['Cover image', '1000×420', 'The size DEV calls best in its editor guide.'],
  ], sources: [['DEV editor guide', 'https://dev.to/p/editor_guide']] },
  { key: 'instagram', rows: [
    ['Feed photo', '1080 wide, 1080×566 to 1080×1440', 'Aspect ratio between 1.91:1 and 3:4. Photos narrower than 320 are enlarged; wider than 1080 are reduced.'],
    ['Reel cover', '420×654 (1:1.55)', ''],
  ], sources: [['Instagram Help: photo resolution', 'https://help.instagram.com/1631821640426723'], ['Instagram Help: reels', 'https://help.instagram.com/1038071743007909']] },
  { key: 'facebook', rows: [
    ['Page cover photo', 'Loads fastest at 851×315', 'At least 400×150. An sRGB JPG under 100 KB loads fastest; PNG suits logos and text.'],
    ['Page profile picture', '320×320', 'Shown at 176×176 on computers and 196×196 on phones.'],
    ['Link share image (Open Graph)', 'At least 1200×630', 'Aim for 1.91:1. At least 600×315 for a large link preview, 200×200 at the smallest. Up to 8 MB.'],
  ], sources: [['Facebook Help: Page cover and profile picture', 'https://www.facebook.com/help/125379114252045'], ['Meta for Developers: sharing images', 'https://developers.facebook.com/docs/sharing/webmasters/images/']] },
  { key: 'linkedin', rows: [
    ['Page logo', '400×400 recommended', 'At least 268×268. PNG or JPEG, up to 3 MB.'],
    ['Page cover image', '1512×256', 'PNG or JPEG, up to 3 MB.'],
    ['Profile photo', '400×400 to 7680×4320', 'PNG or JPG, up to 8 MB.'],
    ['Profile background', '1584×396 recommended', 'JPG or PNG, under 8 MB.'],
    ['Link preview image', '1200×627 (1.91:1)', 'Wider than 200.'],
  ], sources: [['LinkedIn Help: Page images', 'https://www.linkedin.com/help/linkedin/answer/a563309'], ['LinkedIn Help: profile photo', 'https://www.linkedin.com/help/linkedin/answer/a549049'], ['LinkedIn Help: background photo', 'https://www.linkedin.com/help/linkedin/answer/a566232'], ['LinkedIn Help: link previews', 'https://www.linkedin.com/help/linkedin/answer/a566445']] },
  { key: 'x', rows: [
    ['Profile photo', '400×400', 'JPEG, GIF or PNG, up to 2 MB.'],
    ['Header', '1500×500', 'Up to 60 pixels may be cropped at the top and bottom.'],
    ['Post photo', 'No size published', 'GIF, JPEG or PNG, up to 5 MB. Animated GIFs up to 5 MB on mobile and 15 MB on the web.'],
  ], sources: [['X Help: profile photo and header', 'https://help.x.com/en/managing-your-account/common-issues-when-uploading-profile-photo'], ['X Help: posting GIFs and pictures', 'https://help.x.com/en/using-x/posting-gifs-and-pictures']] },
  { key: 'threads', rows: [
    ['Post image (API)', '320 to 1440 wide', 'JPEG or PNG, up to 8 MB, aspect ratio up to 10:1, sRGB. Wider images are scaled down to 1440.'],
  ], sources: [['Meta for Developers: Threads posts', 'https://developers.facebook.com/docs/threads/posts/']] },
  { key: 'pinterest', rows: [
    ['Standard pin', '2:3, 1000×1500', 'PNG or JPEG, up to 20 MB on a computer and 32 MB in the app. Taller pins may be cut off in feeds.'],
  ], sources: [['Pinterest Business Help: product specs', 'https://help.pinterest.com/en/business/article/pinterest-product-specs']] },
  { key: 'tiktok', rows: [
    ['Photo post (API)', 'Up to 1080p', 'JPEG or WebP, up to 20 MB per image.'],
  ], sources: [['TikTok for Developers: media transfer guide', 'https://developers.tiktok.com/doc/content-posting-api-media-transfer-guide']] },
  { key: 'mastodon', rows: [
    ['Avatar', '400×400', 'Larger images are reduced to this size. WEBP, PNG, GIF or JPG, up to 2 MB.'],
    ['Header', '1500×500', 'Larger images are reduced to this size. WEBP, PNG, GIF or JPG, up to 2 MB.'],
    ['Post image', 'Reduced to 8.3 megapixels', 'Up to 16 MB and four images per post. Your server’s limits may differ.'],
  ], sources: [['Mastodon docs: profile', 'https://docs.joinmastodon.org/user/profile/'], ['Mastodon docs: posting', 'https://docs.joinmastodon.org/user/posting/']] },
  { key: 'google_business', rows: [
    ['Photo', '720×720 recommended', 'At least 250×250. JPG or PNG, between 10 KB and 5 MB.'],
  ], sources: [['Google Business Profile Help: photos', 'https://support.google.com/business/answer/6103862?hl=en']] },
  { key: 'reddit', rows: [
    ['Community banner', 'At least 1072×128', 'At least 1080×128 on mobile.'],
    ['Community icon', '300×300', ''],
  ], sources: [['Reddit Help: banner', 'https://support.reddithelp.com/hc/en-us/articles/15484339588884-Banner'], ['Reddit Help: community icon', 'https://support.reddithelp.com/hc/en-us/articles/15484265952660-Community-icon']] },
  { key: 'discord', rows: [
    ['Server banner', 'At least 960×540 (16:9)', 'A 1920×1080 image is resized automatically.'],
    ['Server invite background', '1920×1080', 'JPG or PNG.'],
  ], sources: [['Discord Support: server banner', 'https://support.discord.com/hc/en-us/articles/360028716472-Server-Banner-Background-Invite-Splash-Image'], ['Discord Support: invite background', 'https://support.discord.com/hc/en-us/articles/4415841146391-Server-Invite-Background']] },
];

// Image resizer presets: [value, label, width, height, network key ('' for a size every network shares)].
// Sizes follow the official pages above where a platform publishes one.
// Dribbble sizes are the two the PostDelegate Dribbble connection posts at. X and Bluesky publish no
// post image size, so those presets use common shapes.
export type ResizerPreset = [string, string, number, number, string];
export const RESIZER_GROUPS: { label: string; items: ResizerPreset[] }[] = [
  { label: 'Posts', items: [
    ['bluesky', 'Bluesky square', 1000, 1000, 'bluesky'], ['ig-square', 'Instagram square', 1080, 1080, 'instagram'], ['ig-portrait', 'Instagram portrait 4:5', 1080, 1350, 'instagram'],
    ['ig-tall', 'Instagram portrait 3:4', 1080, 1440, 'instagram'], ['x', 'X landscape 16:9', 1600, 900, 'x'], ['pinterest', 'Pinterest pin 2:3', 1000, 1500, 'pinterest'],
    ['dribbble-800', 'Dribbble shot', 800, 600, 'dribbble'], ['dribbble-400', 'Dribbble shot, small', 400, 300, 'dribbble']] },
  { label: 'Video', items: [['yt-thumb', 'YouTube thumbnail', 1280, 720, 'youtube'], ['yt-thumb-4k', 'YouTube thumbnail, full resolution', 3840, 2160, 'youtube']] },
  { label: 'Link previews', items: [['og', 'Open Graph link image', 1200, 630, ''], ['linkedin', 'LinkedIn link image', 1200, 627, 'linkedin']] },
  { label: 'Profiles and banners', items: [['yt-banner', 'YouTube channel banner', 2560, 1440, 'youtube'], ['x-header', 'X header', 1500, 500, 'x'], ['mastodon-header', 'Mastodon header', 1500, 500, 'mastodon'],
    ['linkedin-bg', 'LinkedIn profile background', 1584, 396, 'linkedin'], ['twitch-banner', 'Twitch profile banner', 1200, 480, 'twitch']] },
];
/** The resizer presets for one network, in the same groups. */
export const resizerGroupsFor = (key: string) => RESIZER_GROUPS
  .map((group) => ({ ...group, items: group.items.filter((item) => item[4] === key) }))
  .filter((group) => group.items.length);
