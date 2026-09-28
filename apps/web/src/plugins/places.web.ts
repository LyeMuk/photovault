import { WebPlugin } from "@capacitor/core";
import type { PlacesPlugin } from "./places";
import { buildDemoPlaces } from "./demoData";
import type { PlaceNode } from "./types";

export class PlacesWeb extends WebPlugin implements PlacesPlugin {
  async listPlaces(): Promise<PlaceNode[]> {
    return buildDemoPlaces();
  }
}
