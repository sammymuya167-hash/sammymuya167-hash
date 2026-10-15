declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    SHADOWSOCIAL_OWNER_EMAIL?: string;
    SHADOWSOCIAL_RELEASE_KEY?: string;
  }
}
