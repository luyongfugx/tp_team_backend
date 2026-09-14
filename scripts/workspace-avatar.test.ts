import assert from "node:assert/strict";
import test from "node:test";
import { workspaceAvatarURL } from "../lib/workspace/avatar";

test("avatar object keys resolve against the configured team bucket, not the current web route", () => {
  const names = ["COS_PUBLIC_BASE_URL", "TENCENT_COS_BUCKETS_JSON", "TENCENT_COS_TEAM_BUCKET", "TENCENT_COS_REGION"] as const;
  const previous = names.map(name => process.env[name]);
  try {
    for (const name of names) delete process.env[name];
    const key = "teamspace/avatar/user-1/2026/09/02/ios_avatar.png";
    assert.equal(workspaceAvatarURL(key), null);
    process.env.TENCENT_COS_TEAM_BUCKET = "legacy-123";
    process.env.TENCENT_COS_REGION = "ap-singapore";
    assert.equal(workspaceAvatarURL(key), `https://legacy-123.cos.ap-singapore.myqcloud.com/${key}`);
    process.env.TENCENT_COS_BUCKETS_JSON = JSON.stringify({ team: { bucket: "team-456", region: "ap-hongkong" } });
    assert.equal(workspaceAvatarURL(key), `https://team-456.cos.ap-hongkong.myqcloud.com/${key}`);
    process.env.COS_PUBLIC_BASE_URL = "https://cdn.example.com/media/";
    assert.equal(workspaceAvatarURL(`/${key}`), `https://cdn.example.com/media/${key}`);
    const external = "https://profile.example.com/avatar.png?signature=preserved";
    assert.equal(workspaceAvatarURL(external), external);
    assert.equal(workspaceAvatarURL("/logo.png"), "/logo.png");
    assert.equal(workspaceAvatarURL("javascript:alert(1)"), null);
    assert.equal(workspaceAvatarURL("teamspace/avatar/../private.png"), null);
    assert.equal(workspaceAvatarURL(""), null);
    delete process.env.COS_PUBLIC_BASE_URL;
    process.env.TENCENT_COS_BUCKETS_JSON = "malformed";
    assert.equal(workspaceAvatarURL(key), `https://legacy-123.cos.ap-singapore.myqcloud.com/${key}`);
  } finally {
    names.forEach((name, i) => {
      if (previous[i] === undefined) delete process.env[name];
      else process.env[name] = previous[i];
    });
  }
});
