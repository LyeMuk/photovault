# apps/mobile/

The Capacitor iOS shell (docs/CONTEXT.md §4.1/§12): `capacitor.config.ts` plus the
generated `ios/` Xcode project (`npx cap add ios`).

Not yet generated — `npx cap add ios` needs full Xcode to configure signing and open
the workspace correctly, and only Xcode Command Line Tools are installed on the
current build machine (see [../../docs/DECISIONS.md](../../docs/DECISIONS.md), entry
0002). This is the first task once Xcode is confirmed installed:

```bash
cd apps/web && npm run build   # produces dist/, which Capacitor bundles into the app
cd ../..
npm install --workspace apps/web @capacitor/core @capacitor/ios  # already pinned in apps/web/package.json
npx cap init PhotoVault com.<owner>.photovault --web-dir apps/web/dist
npx cap add ios
```
