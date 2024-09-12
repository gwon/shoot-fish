import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GameInstanceManagerService } from './game-instance-manager/game-instance-manager.service';
import { GameService } from './game/game.service';
import { GameGateway } from './game.gateway';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService, GameInstanceManagerService, GameGateway],
})
export class AppModule {}
