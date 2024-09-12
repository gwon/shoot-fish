import { Injectable } from '@nestjs/common';
import { GameService } from 'src/game/game.service';

@Injectable()
export class GameInstanceManagerService {
  private instances: Map<string, GameService> = new Map();

  async createInstance(instanceId: string): Promise<GameService> {
    if (!this.instances.has(instanceId)) {
      const newInstance = new GameService();
      // get size of the map

      await newInstance.init(this.currentName());

      this.instances.set(instanceId, newInstance);
    }
    return this.instances.get(instanceId);
  }

  currentName(): string {
    return 'game:' + this.instances.size;
  }

  getInstance(instanceId: string): GameService | undefined {
    return this.instances.get(instanceId);
  }

  removeInstance(instanceId: string): void {
    this.instances.delete(instanceId);
  }

  get Instance() {
    return this.instances;
  }
}
