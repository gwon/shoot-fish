import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GameInstanceManagerService } from './game-instance-manager/game-instance-manager.service';
import { CLEAR_INSTANCE_TIMEOUT, PHYSIC_FPS } from './settings';

@WebSocketGateway()
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  constructor(private gameInstanceManager: GameInstanceManagerService) {}

  async handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
    const instanceId = client.handshake.query.instanceId as string;
    const gameInstance = await this.gameInstanceManager.createInstance(
      instanceId,
    );
    gameInstance.addPlayer(client.id);
    client.join(instanceId);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
    const instanceId = client.handshake.query.instanceId as string;
    const gameInstance = this.gameInstanceManager.getInstance(instanceId);
    if (gameInstance) {
      gameInstance.removePlayer(client.id);

      setTimeout(() => {
        if (gameInstance.playerCount === 0) {
          this.gameInstanceManager.removeInstance(instanceId);
        }
      }, CLEAR_INSTANCE_TIMEOUT);
    }
    client.leave(instanceId);
  }

  @SubscribeMessage('shoot')
  handleShoot(client: Socket, direction: { x: number; y: number }) {
    // console.log(`Client ${client.id} shoot ${direction.x}:${direction.y}`);
    const instanceId = client.handshake.query.instanceId as string;
    const gameInstance = this.gameInstanceManager.getInstance(instanceId);
    if (gameInstance) {
      gameInstance.playerShoot(client.id, direction);
    }
  }

  afterInit(server: Server) {
    setInterval(() => this.updateAndBroadcastGameState(), 1000 / PHYSIC_FPS);
  }

  private updateAndBroadcastGameState() {
    for (const [instanceId, gameInstance] of this.gameInstanceManager
      .Instance) {
      gameInstance.updateGameState(1 / PHYSIC_FPS);
      const gameState = gameInstance.getGameState();
      this.server.to(instanceId).emit('gameState', gameState);
    }
  }
}
