import { Vector3, Quaternion, Matrix } from "@babylonjs/core/Maths/math.vector";

/**
 * Base class for all game entities with optimized parent-child transforms.
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

    // Local transform properties with dirty flag tracking
    this._position = Vector3.Zero();
    this._rotation = Quaternion.Identity();
    this._scale = new Vector3(1, 1, 1);

    // Cached world transform properties
    this._worldPosition = new Vector3();
    this._worldRotation = Quaternion.Identity();
    this._worldScale = new Vector3(1, 1, 1);

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

    // Matrix and state tracking
    this._localMatrix = new Matrix();
    this._worldMatrix = new Matrix();
    this._worldMatrixDirty = true;
    this._localMatrixDirty = true;
    this._transformDirty = true;

    // Rendering and identification
    this._renderComponent = null;
    this._renderComponentCallback = null;
    this._started = false;
    this._uuid = null;
  }

  // Position property with dirty flag handling
  get position() {
    return this._position;
  }
  
  set position(value) {
    if (!this._position.equalsWithEpsilon(value, 0.0001)) {
      this._position.copyFrom(value);
      this._markDirty();
    }
  }

  // Rotation property with dirty flag handling
  get rotation() {
    return this._rotation;
  }
  
  set rotation(value) {
    if (!this._rotation.equalsWithEpsilon(value, 0.0001)) {
      this._rotation.copyFrom(value);
      this._markDirty();
    }
  }

  // Scale property with dirty flag handling
  get scale() {
    return this._scale;
  }
  
  set scale(value) {
    if (!this._scale.equalsWithEpsilon(value, 0.0001)) {
      this._scale.copyFrom(value);
      this._markDirty();
    }
  }

  /**
   * A transformation matrix representing the world space of this game entity.
   * @type {Matrix}
   * @readonly
   */
  get worldMatrix() {
    this._updateWorldMatrix();
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
    entity._worldMatrixDirty = true; // Mark child as dirty
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
      entity._worldMatrixDirty = true; // Mark child as dirty
    }
    return this;
  }

  /**
   * Computes the current direction (forward) vector of this game entity.
   * @param {Vector3} result - The direction vector of this game entity.
   * @return {Vector3} The direction vector of this game entity.
   */
  getDirection(result) {
    return this.forward.rotateByQuaternionToRef(this.rotation, result).normalize();
  }

  /**
   * Computes the current direction vector in world space.
   * @param {Vector3} result - The direction vector in world space.
   * @return {Vector3} The direction vector in world space.
   */
  getWorldDirection(result) {
    this._updateWorldMatrix();
    Vector3.TransformNormalToRef(this.forward, this._worldMatrix, result);
    return result.normalize();
  }

  /**
   * Computes the current position in world space.
   * @param {Vector3} result - The position in world space.
   * @return {Vector3} The position in world space.
   */
  getWorldPosition(result) {
    this._updateWorldMatrix();
    return this._worldMatrix.getTranslationToRef(result);
  }

  /**
   * Computes the current rotation in world space.
   * @param {Quaternion} result - The rotation in world space.
   * @return {Quaternion} The rotation in world space.
   */
  getWorldRotation(result) {
    this._updateWorldMatrix();
    this._worldMatrix.decompose(this._worldScale, result, this._worldPosition);
    return result;
  }

  /**
   * Computes the current scale in world space.
   * @param {Vector3} result - The scale in world space.
   * @return {Vector3} The scale in world space.
   */
  getWorldScale(result) {
    this._updateWorldMatrix();
    this._worldMatrix.decompose(result, this._worldRotation, this._worldPosition);
    return result;
  }

  /**
   * Directly rotates the entity so it faces the given target position.
   * @param {Vector3} target - The target position.
   * @return {GameEntity} A reference to this game entity.
   */
  lookAt(target) {
    const targetDirection = new Vector3();
    const positionWorld = new Vector3();
    
    this.getWorldPosition(positionWorld);
    targetDirection.copyFrom(target).subtractInPlace(positionWorld).normalize();
    
    const targetRotation = Quaternion.FromLookDirectionLH(targetDirection, this.up);
    
    if (this.parent) {
      const parentWorldRotation = new Quaternion();
      this.parent.getWorldRotation(parentWorldRotation).invertInPlace();
      this.rotation = parentWorldRotation.multiply(targetRotation);
    } else {
      this.rotation = targetRotation;
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
    const targetDirection = new Vector3();
    const positionWorld = new Vector3();
    
    this.getWorldPosition(positionWorld);
    targetDirection.copyFrom(target).subtractInPlace(positionWorld).normalize();
    
    const targetRotation = Quaternion.FromLookDirectionLH(targetDirection, this.up);
    
    if (this.parent) {
      const parentWorldRotation = new Quaternion();
      this.parent.getWorldRotation(parentWorldRotation).invertInPlace();
      return this._rotateTowards(parentWorldRotation.multiply(targetRotation), this.maxTurnRate * delta, tolerance);
    }
    
    return this._rotateTowards(targetRotation, this.maxTurnRate * delta, tolerance);
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
      position: this._position.asArray(),
      rotation: this._rotation.asArray(),
      scale: this._scale.asArray(),
      forward: this.forward.asArray(),
      up: this.up.asArray(),
      boundingRadius: this.boundingRadius,
      maxTurnRate: this.maxTurnRate,
      canActivateTrigger: this.canActivateTrigger,
      worldMatrix: this.worldMatrix.asArray(),
      _localMatrix: this._localMatrix.asArray(),
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
    
    this._position.fromArray(json.position);
    this._rotation.fromArray(json.rotation);
    this._scale.fromArray(json.scale);
    
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

    this._started = json._started;
    this._uuid = json.uuid;

    // Mark matrices as dirty to force update on next access
    this._localMatrixDirty = true;
    this._worldMatrixDirty = true;

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
    
    // Mark matrices as dirty since hierarchy may have changed
    this._worldMatrixDirty = true;
    
    return this;
  }

  // Private methods

  _updateLocalMatrix() {
    if (this._localMatrixDirty) {
      Matrix.ComposeToRef(this._scale, this._rotation, this._position, this._localMatrix);
      this._localMatrixDirty = false;
      this._worldMatrixDirty = true;
    }
  }

  _updateWorldMatrix() {
    if (!this._worldMatrixDirty) return;
    
    this._updateLocalMatrix();
    
    if (this.parent) {
      this.parent._updateWorldMatrix();
      this._localMatrix.multiplyToRef(this.parent._worldMatrix, this._worldMatrix);
    } else {
      this._worldMatrix.copyFrom(this._localMatrix);
    }
    
    this._worldMatrixDirty = false;
    this._transformDirty = true;
    
    // Mark children as dirty
    for (const child of this.children) {
      child._worldMatrixDirty = true;
    }
  }

  _markDirty() {
    this._localMatrixDirty = true;
    this._worldMatrixDirty = true;
    
    // Mark children as dirty
    for (const child of this.children) {
      child._worldMatrixDirty = true;
    }
  }

  _rotateTowards(targetRotation, maxAngle, tolerance) {
    this.rotation.normalize();
    targetRotation.normalize();

    const dot = Quaternion.Dot(this.rotation, targetRotation);
    const clampedDot = Math.max(-1, Math.min(1, dot));
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