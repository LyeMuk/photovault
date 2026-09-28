import type { Person } from "@/plugins/types";
import { demoThumbnailDataUrl } from "@/plugins/demoThumbnail";

export interface PersonAvatarProps {
  person: Person;
  size?: number;
  onClick?: () => void;
}

export function PersonAvatar({ person, size = 64, onClick }: PersonAvatarProps) {
  const src = person.coverFaceThumbId
    ? demoThumbnailDataUrl(person.coverFaceThumbId, "photo", size)
    : undefined;
  return (
    <button
      type="button"
      onClick={onClick}
      className="btn btn-link p-0 d-flex flex-column align-items-center text-decoration-none"
      style={{ width: size + 16 }}
    >
      <span
        className="rounded-circle overflow-hidden d-inline-block bg-secondary-subtle"
        style={{ width: size, height: size }}
      >
        {src && <img src={src} alt="" width={size} height={size} />}
      </span>
      <span className="small text-truncate w-100 text-center mt-1">{person.name ?? "Unnamed"}</span>
    </button>
  );
}
