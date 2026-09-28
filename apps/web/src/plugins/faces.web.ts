import { WebPlugin } from "@capacitor/core";
import type { FacesPlugin } from "./faces";
import { DEMO_PEOPLE } from "./demoData";
import type { FaceCluster, Person } from "./types";

export class FacesWeb extends WebPlugin implements FacesPlugin {
  private people: Person[] = DEMO_PEOPLE.map((p) => ({ ...p }));

  async listPeople(): Promise<Person[]> {
    return this.people;
  }

  async listClusters(): Promise<FaceCluster[]> {
    return this.people.map((p) => ({
      id: `cluster-${p.id}`,
      personId: p.id,
      size: p.faceCount,
      coverThumbId: p.coverFaceThumbId ?? "",
    }));
  }

  async nameCluster(id: string, name: string): Promise<void> {
    const personId = id.replace("cluster-", "");
    const person = this.people.find((p) => p.id === personId);
    if (person) person.name = name;
  }

  async mergeClusters(_ids: string[]): Promise<void> {
    // Demo has a fixed 4 clusters; merging is a no-op placeholder.
  }

  async splitFaces(_faceIds: string[]): Promise<void> {}

  async rejectFace(_faceId: string, _personId: string): Promise<void> {}

  async hideCluster(id: string): Promise<void> {
    const personId = id.replace("cluster-", "");
    const person = this.people.find((p) => p.id === personId);
    if (person) person.hidden = true;
  }

  async deleteAllFaceData(): Promise<void> {
    this.people = [];
  }
}
