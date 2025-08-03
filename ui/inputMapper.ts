export type Player = 0 | 1 | 2 | 3;

export type HitRect = { x: number; y: number; w: number; h: number; player: Player };

export class InputMapper {
  private regions: Map<number, HitRect> = new Map();
  private priority: number[] = [];

  setHitRegions(regions: Map<number, HitRect>): void {
    this.regions = new Map(regions);
  }

  setPriority(idsInOrder: number[]): void {
    this.priority = idsInOrder.slice();
  }

  pick(x: number, y: number, filter?: (id: number) => boolean): number | null {
    const ids = this.priority.length > 0 ? this.priority : Array.from(this.regions.keys());
    for (const id of ids) {
      const rect = this.regions.get(id);
      if (!rect) continue;
      if (filter && !filter(id)) continue;
      if (x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h) {
        return id;
      }
    }
    return null;
  }
}
