import { WebPlugin } from "@capacitor/core";
import type { DrivePlugin } from "./drive";
import { DEMO_DRIVE } from "./demoData";
import type { DriveInfo, VaultInfo } from "./types";

export class DriveWeb extends WebPlugin implements DrivePlugin {
  private drive: DriveInfo = { ...DEMO_DRIVE, vaultId: null };
  private vault: VaultInfo | null = null;

  async pickDrive(): Promise<DriveInfo> {
    // The web demo has no real document picker — "picking" just connects the fake drive.
    this.drive = { ...DEMO_DRIVE, vaultId: null };
    this.notifyListeners("driveConnected", this.drive);
    return this.drive;
  }

  async getDrive(): Promise<DriveInfo | null> {
    return this.drive.connected ? this.drive : null;
  }

  async initVault(opts: { layoutTemplate: string }): Promise<VaultInfo> {
    this.vault = {
      vaultId: DEMO_DRIVE.vaultId!,
      layoutTemplate: opts.layoutTemplate,
      createdAt: new Date().toISOString(),
      itemCount: 0,
      totalBytes: 0,
    };
    this.drive = { ...this.drive, vaultId: this.vault.vaultId };
    return this.vault;
  }
}
