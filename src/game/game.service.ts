import { Injectable } from '@nestjs/common';
import Ammo from 'ammojs-typed';
import {
  BULLET_RADIUS,
  BULLET_SPEED,
  ENEMY_COUNT,
  ENEMY_RADIUS,
  ENEMY_SPEED,
  PLAYER_RADIUS,
  WALLBOTTOM,
  WALLLEFT,
  WALLRIGHT,
  WALLTOP,
} from 'src/settings';

interface GameObject {
  id: number;
  socketId?: string;
  body: Ammo.btRigidBody;
  type: 'player' | 'enemy' | 'bullet';
}

@Injectable()
export class GameService {
  private ammo: typeof Ammo;
  private physicsWorld: Ammo.btDiscreteDynamicsWorld;
  private gameObjects: Map<number, GameObject> = new Map();
  private _playerCount: number = 0;
  private nextId: number = 0;

  private startPositions = [
    { x: WALLLEFT, y: WALLBOTTOM },
    { x: WALLRIGHT, y: WALLBOTTOM },
    { x: WALLLEFT, y: WALLTOP },
    { x: WALLRIGHT, y: WALLTOP },
  ];

  get playerCount(): number {
    return this._playerCount;
  }

  NextId() {
    return this.nextId++;
  }

  async init(id: string) {
    return Ammo().then((AmmoLib) => {
      this.ammo = AmmoLib;
      console.log(`Ammo.js room ${id} loaded`);
      this.initPhysic();
    });
  }

  randomPosition() {
    return this.startPositions[
      Math.floor(Math.random() * this.startPositions.length)
    ];
  }

  initPhysic() {
    const collisionConfiguration =
      new this.ammo.btDefaultCollisionConfiguration();
    const dispatcher = new this.ammo.btCollisionDispatcher(
      collisionConfiguration,
    );
    const overlappingPairCache = new this.ammo.btDbvtBroadphase();
    const solver = new this.ammo.btSequentialImpulseConstraintSolver();
    this.physicsWorld = new this.ammo.btDiscreteDynamicsWorld(
      dispatcher,
      overlappingPairCache,
      solver,
      collisionConfiguration,
    );
    this.physicsWorld.setGravity(new this.ammo.btVector3(0, 0, 0));
  }

  private createRigidBody(
    x: number,
    y: number,
    radian: number,
    mass: number,
    type: 'player' | 'enemy' | 'bullet',
  ): GameObject {
    const shape = new this.ammo.btSphereShape(radian);
    const transform = new this.ammo.btTransform();
    transform.setIdentity();
    transform.setOrigin(new this.ammo.btVector3(x, y, 0));
    const motionState = new this.ammo.btDefaultMotionState(transform);
    const localInertia = new this.ammo.btVector3(0, 0, 0);
    shape.calculateLocalInertia(mass, localInertia);
    const rbInfo = new this.ammo.btRigidBodyConstructionInfo(
      mass,
      motionState,
      shape,
      localInertia,
    );

    const body = new this.ammo.btRigidBody(rbInfo);

    // Set collision filtering
    let group = 1;
    let mask = -1;
    if (type === 'bullet') {
      group = 2;
      mask = 4; // Only collide with enemies
    } else if (type === 'enemy') {
      group = 4;
      mask = 3; // Collide with players and bullets
    }

    const id = this.NextId();
    body.setUserIndex(id);
    //CF_NO_CONTACT_RESPONSE = 4 collission only
    body.setCollisionFlags(body.getCollisionFlags() | 4);
    this.physicsWorld.addRigidBody(body, group, mask);

    const data: GameObject = { id, body, type };
    return data;
  }

  addPlayer(socketId: string) {
    const pos = this.randomPosition();
    const object = this.createRigidBody(
      pos.x,
      pos.y,
      PLAYER_RADIUS,
      1,
      'player',
    );
    object.socketId = socketId;
    this.gameObjects.set(object.id, object);
    console.log(`Adding player ${object.id}`);
    this._playerCount++;

    let count = this.gameObjects.size - this._playerCount;
    for (; count < ENEMY_COUNT; count++) {
      this.spawnEnemy();
    }
  }

  removePlayer(socketId: string) {
    let playerFound: GameObject = null;
    for (const [key, value] of this.gameObjects) {
      if (value.socketId === socketId) {
        playerFound = value;
        break;
      }
    }

    if (playerFound && playerFound.socketId) {
      this.physicsWorld.removeRigidBody(playerFound.body);
      this.gameObjects.delete(playerFound.id);
      this._playerCount--;
    }
  }
  findPlayer(socketId: string) {
    for (const [key, value] of this.gameObjects) {
      if (value.socketId === socketId) {
        return value;
      }
    }
    return null;
  }

  playerShoot(socketId: string, direction: { x: number; y: number }) {
    const playerObj = this.findPlayer(socketId);
    if (playerObj && playerObj.type === 'player') {
      const playerTransform = playerObj.body.getWorldTransform();
      const playerPos = playerTransform.getOrigin();
      const gameObject = this.createRigidBody(
        playerPos.x(),
        playerPos.y(),
        BULLET_RADIUS,
        1,
        'bullet',
      );

      const speed = 50; // Increased speed
      const velocity = new this.ammo.btVector3(direction.x, direction.y, 0);

      velocity.normalize();
      velocity.op_mul(BULLET_SPEED);

      gameObject.body.setLinearVelocity(velocity);
      this.gameObjects.set(gameObject.id, gameObject);
    }
  }

  randomRange(min: number, max: number) {
    return Math.random() * (max - min) + min;
  }
  private spawnEnemy() {
    const x = this.randomRange(WALLLEFT, WALLRIGHT);
    const y = this.randomRange(WALLBOTTOM, WALLTOP);
    const gameObject = this.createRigidBody(x, y, ENEMY_RADIUS, 1, 'enemy');
    this.gameObjects.set(gameObject.id, gameObject);
    this.randomForce(gameObject.body);
  }

  clampPV(position: Ammo.btVector3, velicity: Ammo.btVector3) {
    let clamping = false;
    if (position.x() < WALLLEFT) {
      position.setX(WALLLEFT);
      velicity.setX(Math.abs(velicity.x()));
      clamping = true;
    }

    if (position.x() > WALLRIGHT) {
      position.setX(WALLRIGHT);
      velicity.setX(-Math.abs(velicity.x()));
      clamping = true;
    }

    if (position.y() < WALLBOTTOM) {
      position.setY(WALLBOTTOM);
      velicity.setY(Math.abs(velicity.y()));
      clamping = true;
    }

    if (position.y() > WALLTOP) {
      position.setY(WALLTOP);
      velicity.setY(-Math.abs(velicity.y()));
      clamping = true;
    }

    return clamping;
  }

  randomForce(body: Ammo.btRigidBody) {
    const randomForce = new this.ammo.btVector3(
      Math.random() - 0.5,
      Math.random() - 0.5,
      0,
    );
    randomForce.normalize();
    randomForce.op_mul(ENEMY_SPEED);
    // body.applyCentralForce(randomForce);
    body.setLinearVelocity(randomForce);
  }

  updateGameState(deltaTime: number) {
    this.physicsWorld.stepSimulation(deltaTime, 10);

    // Update enemy movement

    for (const [key, obj] of this.gameObjects) {
      if (obj.type === 'enemy') {
        const transform = obj.body.getWorldTransform();
        const position = transform.getOrigin();
        const velocity = obj.body.getLinearVelocity();

        const clamping = this.clampPV(position, velocity);
        if (clamping) {
          transform.setOrigin(position);
          obj.body.setWorldTransform(transform);
          obj.body.setLinearVelocity(velocity);
          this.randomForce(obj.body);
        }
      } else if (obj.type === 'bullet') {
        const transform = obj.body.getWorldTransform();
        const position = transform.getOrigin();
        const velocity = obj.body.getLinearVelocity();

        const clamping = this.clampPV(position, velocity);
        if (clamping) {
          this.physicsWorld.removeRigidBody(obj.body);
          this.gameObjects.delete(obj.id);
        }
      }
    }
    this.ammoCheckCollisions();
  }

  private ammoCheckCollisions() {
    const dispatcher = this.physicsWorld.getDispatcher();
    const numManifolds = dispatcher.getNumManifolds();
    for (let i = 0; i < numManifolds; i++) {
      const contactManifold = dispatcher.getManifoldByIndexInternal(i);
      const numContacts = contactManifold.getNumContacts();

      if (numContacts > 0) {
        const body0 = contactManifold.getBody0();
        const body1 = contactManifold.getBody1();

        const index0 = body0.getUserIndex();
        const index1 = body1.getUserIndex();

        const obj0 = this.gameObjects.get(index0);
        const obj1 = this.gameObjects.get(index1);

        if (obj0 && obj1) {
          this.handleCollision(obj0, obj1);
        }
      }
    }
  }

  private handleCollision(obj1: GameObject, obj2: GameObject) {
    if (
      (obj1.type === 'bullet' && obj2.type === 'enemy') ||
      (obj2.type === 'bullet' && obj1.type === 'enemy')
    ) {
      const bullet = obj1.type === 'bullet' ? obj1 : obj2;
      const enemy = obj1.type === 'enemy' ? obj1 : obj2;

      this.physicsWorld.removeRigidBody(bullet.body);
      this.gameObjects.delete(bullet.id);

      this.physicsWorld.removeRigidBody(enemy.body);
      this.gameObjects.delete(enemy.id);

      this.spawnEnemy();
    }
  }

  getGameState() {
    const datas = [];
    for (const [key, obj] of this.gameObjects) {
      const transform = obj.body.getWorldTransform();
      const position = transform.getOrigin();

      datas.push({
        id: obj.id,
        socketId: obj.socketId,
        position: { x: position.x(), y: position.y() },
        type: obj.type,
      });
    }
    return datas;
  }
}
