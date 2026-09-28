import { registerPlugin } from "@capacitor/core";
import type { PluginListenerHandle } from "@capacitor/core";
import type { DriveDisconnectedEvent, DriveInfo, VaultInfo } from "./types";

export interface DrivePlugin {
  pickDrive(): Promise<DriveInfo>;
  getDrive(): Promise<DriveInfo | null>;
  initVault(opts: { layoutTemplate: string }): Promise<VaultInfo>;

  addListener(
    eventName: "driveConnected",
    listenerFunc: (event: DriveInfo) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: "driveDisconnected",
    listenerFunc: (event: DriveDisconnectedEvent) => void,
  ): Promise<PluginListenerHandle>;
  removeAllListeners(): Promise<void>;
}

export const Drive = registerPlugin<DrivePlugin>("Drive", {
  web: () => import("./drive.web").then((m) => new m.DriveWeb()),
});
