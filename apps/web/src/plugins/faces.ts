import { registerPlugin } from "@capacitor/core";
import type { FaceCluster, Person } from "./types";

export interface FacesPlugin {
  listPeople(): Promise<Person[]>;
  listClusters(): Promise<FaceCluster[]>;
  nameCluster(id: string, name: string): Promise<void>;
  mergeClusters(ids: string[]): Promise<void>;
  splitFaces(faceIds: string[]): Promise<void>;
  rejectFace(faceId: string, personId: string): Promise<void>;
  hideCluster(id: string): Promise<void>;
  deleteAllFaceData(): Promise<void>;
}

export const Faces = registerPlugin<FacesPlugin>("Faces", {
  web: () => import("./faces.web").then((m) => new m.FacesWeb()),
});
