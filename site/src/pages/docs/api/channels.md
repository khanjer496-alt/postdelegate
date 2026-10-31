---
layout: ../../../layouts/DocsLayout.astro
title: Channels and customers API
description: List your channels and customer groups, read the settings a network needs, call helper lookups and start a connection.
---

All paths are relative to `https://app.postdelegate.com/api/public/v1`.

Each channel has an `identifier` that names its network. For the networks you can connect today the identifiers are `youtube`, `bluesky`, `devto`, `hashnode`, `lemmy`, `listmonk`, `medium`, `nostr` and `wordpress`.

### `GET /integrations`

Lists the channels in your workspace.

| Parameter | Notes |
| --- | --- |
| `group` | Optional customer (group) id. Only channels in that group are returned. |

```bash
curl https://app.postdelegate.com/api/public/v1/integrations \
  -H "Authorization: YOUR_API_KEY"
```

```json
[
  {
    "id": "cm3x7q1ab0000wxyz",
    "name": "My Bluesky",
    "identifier": "bluesky",
    "picture": "https://…",
    "disabled": false,
    "profile": "name.bsky.social",
    "customer": { "id": "cm3x6p0aa0000cust", "name": "Acme" }
  }
]
```

`customer` is left out for channels that are not in a group. Use `id` as `integration.id` when [creating a post](/docs/api/posts#post-posts). A channel with `disabled: true` is paused.

### `GET /groups`

Lists your customer groups, see [Team and customers](/docs/team#customers).

```json
[{ "id": "cm3x6p0aa0000cust", "name": "Acme" }]
```

### `GET /integration-settings/:id`

Returns what you need to build a valid post for one channel: its length limit, any rules, the settings fields and the helper lookups available.

```json
{
  "output": {
    "rules": "Bluesky can have maximum 1 video or 4 pictures in one post, it can also be without attachments",
    "maxLength": 300,
    "settings": "No additional settings required",
    "tools": []
  }
}
```

For networks with settings, `settings` is a JSON schema of the fields. For example WordPress asks for `title` and `type`. `tools` lists helper lookups you can run with [`POST /integration-trigger/:id`](#post-integration-triggerid). A `404` with `Integration not found` means the id is not in your workspace.

### `POST /integration-trigger/:id`

Runs a helper lookup for a channel, for example fetching the categories of a WordPress site or the lists of a Listmonk. Take the `methodName` from the channel's `tools`.

```json
{ "methodName": "categoriesList", "data": {} }
```

```json
{ "output": [{ "id": 4, "name": "News" }, { "id": 7, "name": "Releases" }] }
```

| Network | Helper methods |
| --- | --- |
| WordPress | `postTypes`, `categoriesList`, `tagsList` |
| Listmonk | `list`, `templates` |
| Medium | `publications` |
| DEV.to | `tags`, `organizations` |
| Hashnode | `tagsList`, `publications` |
| Dribbble | `teams` |
| Slack | `channels` |

Use the ids and labels these return in a post's `settings`. A `404` with `Tool not found` means the method does not exist for that network. If the network rejects the saved login you get `401` and the channel is disconnected, so reconnect it.

### `GET /social/:integration`

Starts a connection for a network that signs in on the network's own page, which today means `youtube`, `kick`, `twitch`, `tumblr`, `dribbble` and `slack`. It returns the address to open.

```bash
curl https://app.postdelegate.com/api/public/v1/social/youtube \
  -H "Authorization: YOUR_API_KEY"
```

```json
{ "url": "https://accounts.google.com/o/oauth2/v2/auth?…" }
```

Open `url` in a browser as the person who owns the account. After they approve, they land back in the app to finish connecting. Pass `?refresh=CHANNEL_ID` to reconnect an existing channel. The route needs room under your plan's channel limit and answers `400` with `Integration not allowed` for an unknown identifier.

Networks where you paste a credential, such as Bluesky or WordPress, are connected from **Add Channel** in the app, not through the API.

### `DELETE /integrations/:id`

Removes a channel and deletes the posts on it. Removal starts access revocation and data cleanup for networks that use the network's own sign-in. Deleting is permanent.
