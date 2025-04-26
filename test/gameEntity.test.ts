import { describe, it, expect, beforeEach, vi } from "vitest";
import { Vector3, Quaternion, Matrix } from "@babylonjs/core/Maths/math.vector";
import { GameEntity } from "../src/core/GameEntity"; // Adjust the import path as needed

describe("GameEntity", () => {
  let entity;

  beforeEach(() => {
    entity = new GameEntity();
  });

  describe("Initialization", () => {
    it("should initialize with default values", () => {
      expect(entity.name).toBe("");
      expect(entity.active).toBe(true);
      expect(entity.children).toEqual([]);
      expect(entity.parent).toBeNull();
      expect(entity.neighbors).toEqual([]);
      expect(entity.neighborhoodRadius).toBe(1);
      expect(entity.updateNeighborhood).toBe(false);
      expect(entity.position).toBeInstanceOf(Vector3);
      expect(entity.rotation).toBeInstanceOf(Quaternion);
      expect(entity.scale).toBeInstanceOf(Vector3);
      expect(entity.scale).toEqual(new Vector3(1, 1, 1));
      expect(entity.forward).toEqual(new Vector3(0, 0, 1));
      expect(entity.up).toEqual(new Vector3(0, 1, 0));
      expect(entity.boundingRadius).toBe(0);
      expect(entity.maxTurnRate).toBe(Math.PI);
      expect(entity.canActivateTrigger).toBe(true);
      expect(entity.manager).toBeNull();
    });

    it("should generate a UUID when accessed", () => {
      expect(entity._uuid).toBeNull();
      const uuid = entity.uuid;
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(entity.uuid).toBe(uuid); // Should be the same on subsequent accesses
    });
  });

  describe("Hierarchy Management", () => {
    let parent, child1, child2;

    beforeEach(() => {
      parent = new GameEntity();
      child1 = new GameEntity();
      child2 = new GameEntity();
    });

    it("should add a child entity", () => {
      parent.add(child1);
      expect(parent.children).toContain(child1);
      expect(child1.parent).toBe(parent);
    });

    it("should remove a child from its previous parent when adding to new parent", () => {
      parent.add(child1);
      const newParent = new GameEntity();
      newParent.add(child1);

      expect(parent.children).not.toContain(child1);
      expect(newParent.children).toContain(child1);
      expect(child1.parent).toBe(newParent);
    });

    it("should remove a child entity", () => {
      parent.add(child1);
      parent.add(child2);

      parent.remove(child1);
      expect(parent.children).not.toContain(child1);
      expect(parent.children).toContain(child2);
      expect(child1.parent).toBeNull();
    });

    it("should do nothing when removing a non-child entity", () => {
      parent.add(child1);
      parent.remove(child2);
      expect(parent.children).toContain(child1);
      expect(parent.children.length).toBe(1);
    });
  });

  describe("Transformations", () => {
    it("should update local matrix when transform properties change", () => {
      const originalMatrix = entity._localMatrix.clone();

      entity.position.set(1, 2, 3);
      entity._updateMatrix();
      expect(entity._localMatrix).not.toEqual(originalMatrix);
      expect(entity._worldMatrixDirty).toBe(true);
    });

    it("should not update local matrix when transform properties are unchanged", () => {
      const originalMatrix = entity._localMatrix.clone();
      entity._updateMatrix();
      expect(entity._localMatrix).toEqual(originalMatrix);
      expect(entity._worldMatrixDirty).toBe(false);
    });

    it("should update world matrix for root entity", () => {
      entity.position.set(1, 0, 0);
      entity._updateWorldMatrix();

      const translation = new Vector3();
      entity.worldMatrix.getTranslationToRef(translation);
      expect(translation).toEqual(new Vector3(1, 0, 0));
    });

    it("should update world matrix for child entity", () => {
      const parent = new GameEntity();
      parent.position.set(1, 0, 0);

      const child = new GameEntity();
      child.position.set(0, 1, 0);

      parent.add(child);
      child._updateWorldMatrix();

      const translation = new Vector3();
      child.worldMatrix.getTranslationToRef(translation);
      expect(translation).toEqual(new Vector3(1, 1, 0));
    });

    it("should get world position", () => {
      entity.position.set(1, 2, 3);
      const result = new Vector3();
      entity.getWorldPosition(result);
      expect(result).toEqual(new Vector3(1, 2, 3));
    });

    it("should get direction", () => {
      const result = new Vector3();
      entity.getDirection(result);
      expect(result).toEqual(new Vector3(0, 0, 1)); // Default forward

      // Rotate 90 degrees around Y axis
      entity.rotation = Quaternion.RotationAxis(new Vector3(0, 1, 0), Math.PI / 2);
      entity.getDirection(result);
      expect(result.x).toBeCloseTo(1);
      expect(result.y).toBeCloseTo(0);
      expect(result.z).toBeCloseTo(0);
    });
    /*
    it("should get world direction", () => {
      const parent = new GameEntity();
      parent.rotation = Quaternion.RotationAxis(new Vector3(0, 1, 0), Math.PI / 2);

      const child = new GameEntity();
      parent.add(child);

      const result = new Vector3();
      child.getWorldDirection(result);
      expect(result.x).toBeCloseTo(1);
      expect(result.y).toBeCloseTo(0);
      expect(result.z).toBeCloseTo(0);
    });
    */
  });

  /*
  describe("LookAt and RotateTo", () => {
    it("should look at target position (no parent)", () => {
      const target = new Vector3(1, 0, 0);
      entity.lookAt(target);

      const direction = new Vector3();
      entity.getDirection(direction);
      expect(direction.x).toBeCloseTo(1);
      expect(direction.y).toBeCloseTo(0);
      expect(direction.z).toBeCloseTo(0);
    });

    it("should look at target position (with parent)", () => {
      const parent = new GameEntity();
      parent.position.set(1, 0, 0);

      const child = new GameEntity();
      parent.add(child);

      const target = new Vector3(2, 0, 0);
      child.lookAt(target);

      const direction = new Vector3();
      child.getDirection(direction);
      expect(direction.x).toBeCloseTo(1);
      expect(direction.y).toBeCloseTo(0);
      expect(direction.z).toBeCloseTo(0);
    });

    it("should rotate towards target position", () => {
      const target = new Vector3(1, 0, 0);
      const result = entity.rotateTo(target, 0.1); // Small delta

      // First call shouldn't complete the rotation
      expect(result).toBe(false);

      const direction = new Vector3();
      entity.getDirection(direction);
      expect(direction.x).toBeGreaterThan(0); // Should have started rotating

      // Complete the rotation
      for (let i = 0; i < 10; i++) {
        entity.rotateTo(target, Math.PI);
      }
      const finalResult = entity.rotateTo(target, Math.PI);
      expect(finalResult).toBe(true);

      entity.getDirection(direction);
      expect(direction.x).toBeCloseTo(1);
      expect(direction.y).toBeCloseTo(0);
      expect(direction.z).toBeCloseTo(0);
    });
  });

  describe("Serialization", () => {
    it("should serialize to JSON", () => {
      entity.name = "Test Entity";
      entity.position.set(1, 2, 3);

      const json = entity.toJSON();
      expect(json.name).toBe("Test Entity");
      expect(json.position).toEqual([1, 2, 3]);
      expect(json.type).toBe("GameEntity");
      expect(json.uuid).toBe(entity.uuid);
    });

    it("should deserialize from JSON", () => {
      const json = {
        name: "Test Entity",
        position: [1, 2, 3],
        rotation: [0, 0, 0, 1],
        scale: [1, 1, 1],
        forward: [0, 0, 1],
        up: [0, 1, 0],
        active: true,
        children: [],
        neighbors: [],
        parent: null,
        neighborhoodRadius: 1,
        updateNeighborhood: false,
        boundingRadius: 0,
        maxTurnRate: Math.PI,
        canActivateTrigger: true,
        worldMatrix: Matrix.Identity().asArray(),
        _localMatrix: Matrix.Identity().asArray(),
        _cache: {
          position: [0, 0, 0],
          rotation: [0, 0, 0, 1],
          scale: [1, 1, 1],
        },
        _started: false,
        uuid: "test-uuid",
      };

      const newEntity = new GameEntity();
      newEntity.fromJSON(json);

      expect(newEntity.name).toBe("Test Entity");
      expect(newEntity.position).toEqual(new Vector3(1, 2, 3));
      expect(newEntity.uuid).toBe("test-uuid");
    });

    it("should resolve references after deserialization", () => {
      const entities = new Map();
      const parent = new GameEntity();
      parent._uuid = "parent-uuid";
      entities.set("parent-uuid", parent);

      const child = new GameEntity();
      child._uuid = "child-uuid";
      entities.set("child-uuid", child);

      const neighbor = new GameEntity();
      neighbor._uuid = "neighbor-uuid";
      entities.set("neighbor-uuid", neighbor);

      const json = {
        parent: "parent-uuid",
        children: ["child-uuid"],
        neighbors: ["neighbor-uuid"],
        // ... other properties
      };

      const entity = new GameEntity();
      entity.fromJSON(json);
      entity.resolveReferences(entities);

      expect(entity.parent).toBe(parent);
      expect(entity.children).toContain(child);
      expect(entity.neighbors).toContain(neighbor);
    });
  });
 */
  describe("Miscellaneous", () => {
    it("should set render component", () => {
      const renderComponent = {};
      const callback = vi.fn();

      entity.setRenderComponent(renderComponent, callback);
      expect(entity._renderComponent).toBe(renderComponent);
      expect(entity._renderComponentCallback).toBe(callback);
    });

    it("should send message through manager", () => {
      const manager = { sendMessage: vi.fn() };
      const receiver = new GameEntity();
      entity.manager = manager;

      entity.sendMessage(receiver, "test", 100, { data: 123 });
      expect(manager.sendMessage).toHaveBeenCalledWith(entity, receiver, "test", 100, { data: 123 });
    });

    it("should not send message without manager", () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      const receiver = new GameEntity();

      entity.sendMessage(receiver, "test");
      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });
  });
  /*
  describe("GameEntity getWorldDirection", () => {
    let entity;

    beforeEach(() => {
      entity = new GameEntity();
    });

    it("should return default forward direction when no rotation is applied", () => {
      const result = new Vector3();
      entity.getWorldDirection(result);

      expect(result.x).toBeCloseTo(0);
      expect(result.y).toBeCloseTo(0);
      expect(result.z).toBeCloseTo(1);
    });

    it("should return a normalized vector", () => {
      const result = new Vector3();
      entity.getWorldDirection(result);

      const length = Math.sqrt(result.x * result.x + result.y * result.y + result.z * result.z);
      expect(length).toBeCloseTo(1);
    });

    it("should correctly reflect rotation around Y axis", () => {
      const result = new Vector3();

      // Rotate 90 degrees around Y axis
      entity.rotation = Quaternion.RotationYawPitchRoll(Math.PI / 2, 0, 0);
      entity.getWorldDirection(result);

      expect(result.x).toBeCloseTo(1);
      expect(result.y).toBeCloseTo(0);
      expect(result.z).toBeCloseTo(0);
    });

    it("should correctly reflect rotation around X axis", () => {
      const result = new Vector3();

      // Rotate 90 degrees around X axis (should point downward)
      entity.rotation = Quaternion.RotationYawPitchRoll(0, Math.PI / 2, 0);
      entity.getWorldDirection(result);

      expect(result.x).toBeCloseTo(0);
      expect(result.y).toBeCloseTo(-1);
      expect(result.z).toBeCloseTo(0);
    });

    it("should use the provided result vector", () => {
      const result = new Vector3(10, 20, 30); // Initial values should be overwritten
      entity.getWorldDirection(result);

      // expect(result.x).toBeCloseTo(0);
      //  expect(result.y).toBeCloseTo(0);
      //  expect(result.z).toBeCloseTo(1);
    });

    it("should return the same vector that was passed in", () => {
      const result = new Vector3();
      const returned = entity.getWorldDirection(result);

      expect(returned).toBe(result);
    });

    it("should handle non-default forward vectors", () => {
      const result = new Vector3();
      entity.forward = new Vector3(1, 0, 0); // Change default forward to X axis

      // Rotate 90 degrees around Z axis (should now point downward)
      entity.rotation = Quaternion.RotationYawPitchRoll(0, 0, Math.PI / 2);
      entity.getWorldDirection(result);

      expect(result.x).toBeCloseTo(0);
      expect(result.y).toBeCloseTo(1);
      expect(result.z).toBeCloseTo(0);
    });
  });
  */
});
