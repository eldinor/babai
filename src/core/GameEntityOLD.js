import { Vector3, Quaternion, Matrix } from "@babylonjs/core/Maths/math.vector";
/**
 * Base class for all game entities.
 */
export class GameEntity {
  /**
   * Constructs a new game entity.
   */
  constructor() {
    /**
     * The name of this game entity.
     * @type {string}
     */
    this.name = "";

    /**
     * Whether this game entity is active or not.
     * @type {boolean}
     * @default true
     */
    this.active = true;

    /**
     * The child entities of this game entity.
     * @type {Array<GameEntity>}
     */
    this.children = [];

    /**
     * A reference to the parent entity of this game entity.
     * @type {?GameEntity}
     * @default null
     * @readonly
     */
    this.parent = null;

    /**
     * A list of neighbors of this game entity.
     * @type {Array<GameEntity>}
     * @readonly
     */
    this.neighbors = [];

    /**
     * Game entities within this radius are considered as neighbors of this entity.
     * @type {number}
     * @default 1
     */
    this.neighborhoodRadius = 1;

    /**
     * Whether the neighborhood of this game entity is updated or not.
     * @type {boolean}
     * @default false
     */
    this.updateNeighborhood = false;

    /**
     * The position of this game entity.
     * @type {Vector3}
     */
    this.position =  Vector3.Zero(); //??

    /**
     * The rotation of this game entity.
     * @type {Quaternion}
     */
    this.rotation =  Quaternion.Identity();

    /**
     * The scaling of this game entity.
     * @type {Vector3}
     */
    this.scale = new Vector3(1, 1, 1);

    /**
     * The default forward vector of this game entity.
     * @type {Vector3}
     * @default (0,0,1)
     */
    this.forward = new Vector3(0, 0, 1);

    /**
     * The default up vector of this game entity.
     * @type {Vector3}
     * @default (0,1,0)
     */
    this.up = new Vector3(0, 1, 0);

    /**
     * The bounding radius of this game entity in world units.
     * @type {number}
     * @default 0
     */
    this.boundingRadius = 0;

    /**
     * The maximum turn rate of this game entity in radians per seconds.
     * @type {number}
     * @default Math.PI
     */
    this.maxTurnRate = Math.PI;

    /**
     * Whether the entity can activate a trigger or not.
     * @type {boolean}
     * @default true
     */
    this.canActivateTrigger = true;

    /**
     * A reference to the entity manager of this game entity.
     * @type {EntityManager}
     * @default null
     * @readonly
     */
    this.manager = null;

    // Private properties
    this._localMatrix = new Matrix();
    this._worldMatrix = new Matrix();
    this._cache = {
      position: new Vector3(),
      rotation: new Quaternion(),
      scale: new Vector3(1, 1, 1),
    };
    this._renderComponent = null;
    this._renderComponentCallback = null;
    this._started = false;
    this._uuid = null;
    this._worldMatrixDirty = false;
  }

  /**
   * A transformation matrix representing the world space of this game entity.
   * @type {Matrix}
   * @readonly
   */
  get worldMatrix() {
    this._updateWorldMatrix(); //Ensure matrix is current
    return this._worldMatrix;
  }

  /**
   * Unique ID, primarily used in context of serialization/deserialization.
   * @type {string}
   * @readonly
   */
  get uuid() {
    if (this._uuid === null) {
      this._uuid = this._generateUUID();
    }
    return this._uuid;
  }

  /**
   * Executed when this game entity is updated for the first time by its manager.
   * @return {GameEntity} A reference to this game entity.
   */
  start() {
    return this;
  }

  /**
   * Updates the internal state of this game entity.
   * @param {number} delta - The time delta.
   * @return {GameEntity} A reference to this game entity.
   */
  update(/* delta */) {
    return this;
  }

  /**
   * Adds a game entity as a child to this game entity.
   * @param {GameEntity} entity - The game entity to add.
   * @return {GameEntity} A reference to this game entity.
   */
  add(entity) {
    if (entity.parent !== null) {
      entity.parent.remove(entity);
    }

    this.children.push(entity);
    entity.parent = this;
    return this;
  }

  /**
   * Removes a game entity as a child from this game entity.
   * @param {GameEntity} entity - The game entity to remove.
   * @return {GameEntity} A reference to this game entity.
   */
  remove(entity) {
    const index = this.children.indexOf(entity);
    if (index !== -1) {
      this.children.splice(index, 1);
      entity.parent = null;
    }
    return this;
  }

  /**
   * Computes the current direction (forward) vector of this game entity.
   * @param {Vector3} result - The direction vector of this game entity.
   * @return {Vector3} The direction vector of this game entity.
   */
  getDirection(result) {
    // First rotate the forward vector by the quaternion
    this.forward.rotateByQuaternionToRef(this.rotation, result);
    // Then normalize the result
    result.normalize();
    return result;
  }

  /**
   * Directly rotates the entity so it faces the given target position.
   * @param {Vector3} target - The target position.
   * @return {GameEntity} A reference to this game entity.
   */
  lookAt(target) {
    const parent = this.parent;
    const targetDirection = new Vector3();

    if (parent !== null) {
      const positionWorld = this.getWorldPosition(new Vector3());
      targetDirection.copyFrom(target).subtractInPlace(positionWorld).normalize();

      this.rotation = Quaternion.FromLookDirectionLH(targetDirection, this.up);

      const quaternionWorld = new Quaternion();
      quaternionWorld.fromRotationMatrix(parent.worldMatrix).invertInPlace();

      this.rotation = quaternionWorld.multiply(this.rotation);
    } else {
      targetDirection.copyFrom(target).subtractInPlace(this.position).normalize();
      this.rotation = Quaternion.FromLookDirectionLH(targetDirection, this.up);
    }

    return this;
  }

  /**
   * Rotates the entity to face a target position with a maximum turn rate.
   * @param {Vector3} target - The target position.
   * @param {number} delta - The time delta.
   * @param {number} tolerance - A tolerance value in radians.
   * @return {boolean} Whether the entity is faced to the target or not.
   */
  rotateTo(target, delta, tolerance = 0.0001) {
    const parent = this.parent;
    const targetDirection = new Vector3();
    let targetRotation; // Changed from const to let

    if (parent !== null) {
      const positionWorld = this.getWorldPosition(new Vector3());
      targetDirection.copyFrom(target).subtractInPlace(positionWorld).normalize();

      targetRotation = Quaternion.FromLookDirectionLH(targetDirection, this.up);

      const quaternionWorld = new Quaternion();
      quaternionWorld.fromRotationMatrix(parent.worldMatrix).invertInPlace();

      targetRotation = quaternionWorld.multiply(targetRotation);
    } else {
      targetDirection.copyFrom(target).subtractInPlace(this.position).normalize();
      targetRotation = Quaternion.FromLookDirectionLH(targetDirection, this.up);
    }

    return this._rotateTowards(targetRotation, this.maxTurnRate * delta, tolerance);
  }

  /**
   * Computes the current direction vector in world space.
   * @param {Vector3} result - The direction vector in world space.
   * @return {Vector3} The direction vector in world space.
   */


/*
  getWorldDirection(result) {
    // Ensure world matrix is updated
    this._updateWorldMatrix();
    
    // Create orientation from world matrix (most reliable method)
    const rotationMatrix = new Matrix();
    this.worldMatrix.getRotationMatrixToRef(rotationMatrix);
    
    const rot = new Quaternion();
    Quaternion.FromRotationMatrixToRef(rotationMatrix, rot);
    
    // Rotate forward vector and normalize
    return this.forward.rotateByQuaternionToRef(rot, result).normalize();
}
*/
getWorldDirection(result) {
    // Ensure world matrix is updated
    this._updateWorldMatrix();
    
    // Transform the forward vector directly by the world matrix
    Vector3.TransformNormalToRef(this.forward, this.worldMatrix, result);
    return result.normalize();
  }
  /**
   * Computes the current position in world space.
   * @param {Vector3} result - The position in world space.
   * @return {Vector3} The position in world space.
   */
  getWorldPosition(result) {
    return this.worldMatrix.getTranslationToRef(result);
  }

  /**
   * Sets a renderable component with a sync callback.
   * @param {Object} renderComponent - The renderable component.
   * @param {Function} callback - The sync callback.
   * @return {GameEntity} A reference to this game entity.
   */
  setRenderComponent(renderComponent, callback) {
    this._renderComponent = renderComponent;
    this._renderComponentCallback = callback;
    return this;
  }

  /**
   * Handles messages for this game entity.
   * @param {Telegram} telegram - The message data.
   * @return {boolean} Whether the message was processed or not.
   */
  handleMessage() {
    return false;
  }

  /**
   * Performs a line of sight test.
   * @param {Ray} ray - The ray representing the line of sight.
   * @param {Vector3} intersectionPoint - The intersection point.
   * @return {Vector3} The intersection point.
   */
  lineOfSightTest() {
    return null;
  }

  /**
   * Sends a message to another entity.
   * @param {GameEntity} receiver - The receiving entity.
   * @param {string} message - The message content.
   * @param {number} delay - Delay in milliseconds.
   * @param {Object} data - Additional data.
   * @return {GameEntity} A reference to this game entity.
   */
  sendMessage(receiver, message, delay = 0, data = null) {
    if (this.manager !== null) {
      this.manager.sendMessage(this, receiver, message, delay, data);
    } else {
      console.error("GameEntity: The game entity must be added to a manager to send a message.");
    }
    return this;
  }

  /**
   * Converts this instance to a JSON object.
   * @return {Object} The JSON object.
   */
  toJSON() {
    return {
      type: this.constructor.name,
      uuid: this.uuid,
      name: this.name,
      active: this.active,
      children: this._entitiesToIds(this.children),
      parent: this.parent !== null ? this.parent.uuid : null,
      neighbors: this._entitiesToIds(this.neighbors),
      neighborhoodRadius: this.neighborhoodRadius,
      updateNeighborhood: this.updateNeighborhood,
      position: this.position.asArray(),
      rotation: this.rotation.asArray(),
      scale: this.scale.asArray(),
      forward: this.forward.asArray(),
      up: this.up.asArray(),
      boundingRadius: this.boundingRadius,
      maxTurnRate: this.maxTurnRate,
      canActivateTrigger: this.canActivateTrigger,
      worldMatrix: this.worldMatrix.asArray(),
      _localMatrix: this._localMatrix.asArray(),
      _cache: {
        position: this._cache.position.asArray(),
        rotation: this._cache.rotation.asArray(),
        scale: this._cache.scale.asArray(),
      },
      _started: this._started,
    };
  }

  /**
   * Restores this instance from a JSON object.
   * @param {Object} json - The JSON object.
   * @return {GameEntity} A reference to this game entity.
   */
  fromJSON(json) {
    this.name = json.name;
    this.active = json.active;
    this.neighborhoodRadius = json.neighborhoodRadius;
    this.updateNeighborhood = json.updateNeighborhood;
    this.position.fromArray(json.position);
    this.rotation.fromArray(json.rotation);
    this.scale.fromArray(json.scale);
    this.forward.fromArray(json.forward);
    this.up.fromArray(json.up);
    this.boundingRadius = json.boundingRadius;
    this.maxTurnRate = json.maxTurnRate;
    this.canActivateTrigger = json.canActivateTrigger;

    this.children = json.children.slice();
    this.neighbors = json.neighbors.slice();
    this.parent = json.parent;

    this._localMatrix.fromArray(json._localMatrix);
    this._worldMatrix.fromArray(json.worldMatrix);

    this._cache.position.fromArray(json._cache.position);
    this._cache.rotation.fromArray(json._cache.rotation);
    this._cache.scale.fromArray(json._cache.scale);

    this._started = json._started;
    this._uuid = json.uuid;

    return this;
  }

  /**
   * Restores UUIDs with references to GameEntity objects.
   * @param {Map<string, GameEntity>} entities - Maps game entities to UUIDs.
   * @return {GameEntity} A reference to this game entity.
   */
  resolveReferences(entities) {
    this.neighbors = this.neighbors.map((id) => entities.get(id));
    this.children = this.children.map((id) => entities.get(id));
    this.parent = entities.get(this.parent) || null;
    return this;
  }

  // Private methods

  _updateMatrix() {
    const cache = this._cache;

    if (
      cache.position.equals(this.position) &&
      cache.rotation.equals(this.rotation) &&
      cache.scale.equals(this.scale)
    ) {
      return;
    }

    Matrix.ComposeToRef(this.scale, this.rotation, this.position, this._localMatrix);

    cache.position.copyFrom(this.position);
    cache.rotation.copyFrom(this.rotation);
    cache.scale.copyFrom(this.scale);

    this._worldMatrixDirty = true;
  }

  _updateWorldMatrix() {
    const parent = this.parent;

    if (parent !== null) {
      parent._updateWorldMatrix();
    }

    this._updateMatrix();

    if (this._worldMatrixDirty === true) {
      if (parent === null) {
        this._worldMatrix.copyFrom(this._localMatrix);
      } else {
        // CORRECTED: Using Matrix.multiply() instead of Matrix.Multiply()
        this._localMatrix.multiplyToRef(parent._worldMatrix, this._worldMatrix);
      }

      this._worldMatrixDirty = false;

      // Invalidate world matrices of children
      for (const child of this.children) {
        child._worldMatrixDirty = true;
      }
    }
  }
  _rotateTowards(targetRotation, maxAngle, tolerance) {
    // Ensure quaternions are normalized
    this.rotation.normalize();
    targetRotation.normalize();

    // Calculate dot product and clamp to valid range
    const dot = Quaternion.Dot(this.rotation, targetRotation);
    const clampedDot = Math.max(-1, Math.min(1, dot)); // Clamp between -1 and 1
    const angle = 2 * Math.acos(clampedDot);

    if (angle < tolerance || isNaN(angle)) {
      this.rotation.copyFrom(targetRotation);
      return true;
    }

    const t = Math.min(1, maxAngle / angle);
    Quaternion.SlerpToRef(this.rotation, targetRotation, t, this.rotation);
    return false;
  }
  _generateUUID() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  _entitiesToIds(array) {
    return array.map((entity) => entity.uuid);
  }
}
