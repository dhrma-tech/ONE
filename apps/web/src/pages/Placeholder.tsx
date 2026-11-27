import { Banner, Empty } from "@/ui";
import type { SceneId } from "@/ui/banner";

export default function Placeholder({ scene, title }: { scene: SceneId; title: string }) {
  return (
    <div className="page" data-section={scene}>
      <Banner scene={scene} label={title} />
      <h1 className="page-title">
        {title}
        <span className="dot">.</span>
      </h1>
      <Empty>Under construction. Patience is also a skill.</Empty>
    </div>
  );
}
