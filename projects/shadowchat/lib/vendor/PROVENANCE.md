# Vendored TweetNaCl.js

Source: https://github.com/dchest/tweetnacl-js

The fetched upstream package identifies version **1.0.3**. Files are preserved unchanged, apart from filename extensions selecting CommonJS and its matching TypeScript declaration:

| Local file | Upstream file | Git blob SHA-1 |
| --- | --- | --- |
| `nacl-fast.cjs` | `nacl-fast.js` | `7ea5fb5883289b49f8d543f2d48af7132c3c6a6d` |
| `nacl-fast.d.cts` | `nacl.d.ts` | `78c4f787dfea7125cd982506b317fc29f7412201` |
| `LICENSE` | `LICENSE` | `cf1ab25da0349f84a3fdd40032f0ce99db813b8b` |
| `upstream-package.json` | `package.json` | `9815b6af9d810c0aac518ef8a8c9b66aec4492d0` |

The crypto tests verify the implementation's Git blob hash against this record. No changes were made to the cryptographic implementation. The upstream README links the Cure53 2017 independent audit, which applies to the library, not to the ShadowChat application.
