import { registerPlugin } from "@capacitor/core";
import type { PlaceNode } from "./types";

export interface PlacesPlugin {
  listPlaces(): Promise<PlaceNode[]>;
}

export const Places = registerPlugin<PlacesPlugin>("Places", {
  web: () => import("./places.web").then((m) => new m.PlacesWeb()),
});
