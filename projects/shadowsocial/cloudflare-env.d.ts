declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    SHADOWSOCIAL_SFU_APP_ID?: string;
    SHADOWSOCIAL_SFU_SECRET?: string;
    SHADOWSOCIAL_TURN_KEY_ID?: string;
    SHADOWSOCIAL_TURN_SECRET?: string;
    SHADOWSOCIAL_OWNER_EMAIL?: string;
    SHADOWSOCIAL_RELEASE_KEY?: string;
    SHADOWSOCIAL_OWNER_RECOVERY?: string;
  }
}
