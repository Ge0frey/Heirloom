import { describe, it, expect } from "vitest";
import { Cl, ClarityType } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!; // heir 1
const wallet2 = accounts.get("wallet_2")!; // heir 2
const wallet3 = accounts.get("wallet_3")!; // guardian

function createDefaultVault(sender = deployer) {
  return simnet.callPublicFn(
    "heirloom-vault-v8",
    "create-vault",
    [
      Cl.uint(120), // 2 min interval
      Cl.uint(60), // 1 min grace
      Cl.list([
        Cl.tuple({
          heir: Cl.principal(wallet1),
          "split-bps": Cl.uint(7000),
        }),
        Cl.tuple({
          heir: Cl.principal(wallet2),
          "split-bps": Cl.uint(3000),
        }),
      ]),
      Cl.none(), // no guardian
    ],
    sender
  );
}

describe("Heirloom Vault", () => {
  describe("create-vault", () => {
    it("creates a vault with valid heirs", () => {
      const result = createDefaultVault();
      expect(result.result).toBeOk(Cl.bool(true));
    });

    it("rejects splits that don't sum to 10000", () => {
      const result = simnet.callPublicFn(
        "heirloom-vault-v8",
        "create-vault",
        [
          Cl.uint(120),
          Cl.uint(60),
          Cl.list([
            Cl.tuple({
              heir: Cl.principal(wallet1),
              "split-bps": Cl.uint(5000),
            }),
            Cl.tuple({
              heir: Cl.principal(wallet2),
              "split-bps": Cl.uint(3000),
            }),
          ]),
          Cl.none(),
        ],
        deployer
      );
      expect(result.result).toBeErr(Cl.uint(106)); // ERR-INVALID-SPLITS
    });

    it("rejects duplicate vault creation", () => {
      createDefaultVault();
      const result = createDefaultVault();
      expect(result.result).toBeErr(Cl.uint(109)); // ERR-VAULT-ALREADY-EXISTS
    });

    it("creates vault with guardian", () => {
      const result = simnet.callPublicFn(
        "heirloom-vault-v8",
        "create-vault",
        [
          Cl.uint(120),
          Cl.uint(60),
          Cl.list([
            Cl.tuple({
              heir: Cl.principal(wallet1),
              "split-bps": Cl.uint(10000),
            }),
          ]),
          Cl.some(Cl.principal(wallet3)),
        ],
        deployer
      );
      expect(result.result).toBeOk(Cl.bool(true));
    });
  });

  describe("heartbeat", () => {
    it("resets the heartbeat timer", () => {
      createDefaultVault();
      simnet.mineEmptyBlocks(10);

      const result = simnet.callPublicFn(
        "heirloom-vault-v8",
        "heartbeat",
        [],
        deployer
      );
      expect(result.result).toBeOk(Cl.bool(true));
    });

    it("rejects heartbeat from non-owner", () => {
      createDefaultVault();

      const result = simnet.callPublicFn(
        "heirloom-vault-v8",
        "heartbeat",
        [],
        wallet1
      );
      expect(result.result).toBeErr(Cl.uint(103)); // ERR-VAULT-NOT-FOUND
    });
  });

  describe("get-vault-status", () => {
    it("returns active status for fresh vault", () => {
      createDefaultVault();

      const result = simnet.callReadOnlyFn(
        "heirloom-vault-v8",
        "get-vault-status",
        [Cl.principal(deployer)],
        deployer
      );

      // Result is (ok { state: "active", ... })
      expect(result.result.type).toBe(ClarityType.ResponseOk);
      const okValue = (result.result as any).value;
      expect(okValue.type).toBe(ClarityType.Tuple);
      // Check state field exists in the tuple
      expect(okValue.value.state).toBeDefined();
      // Check usdcx-balance field exists
      expect(okValue.value["usdcx-balance"]).toBeDefined();
    });
  });

  describe("deposit-sbtc", () => {
    it("rejects zero amount", () => {
      createDefaultVault();

      const result = simnet.callPublicFn(
        "heirloom-vault-v8",
        "deposit-sbtc",
        [Cl.uint(0)],
        deployer
      );
      expect(result.result).toBeErr(Cl.uint(113)); // ERR-NO-BALANCE
    });
  });

  describe("deposit-usdcx", () => {
    it("rejects zero amount", () => {
      createDefaultVault();

      const result = simnet.callPublicFn(
        "heirloom-vault-v8",
        "deposit-usdcx",
        [Cl.uint(0)],
        deployer
      );
      expect(result.result).toBeErr(Cl.uint(113)); // ERR-NO-BALANCE
    });
  });

  describe("emergency-withdraw", () => {
    it("marks vault as distributed", () => {
      createDefaultVault();

      const result = simnet.callPublicFn(
        "heirloom-vault-v8",
        "emergency-withdraw",
        [],
        deployer
      );
      expect(result.result).toBeOk(Cl.bool(true));
    });

    it("rejects withdraw on distributed vault", () => {
      createDefaultVault();
      simnet.callPublicFn(
        "heirloom-vault-v8",
        "emergency-withdraw",
        [],
        deployer
      );

      const result = simnet.callPublicFn(
        "heirloom-vault-v8",
        "emergency-withdraw",
        [],
        deployer
      );
      expect(result.result).toBeErr(Cl.uint(110)); // ERR-VAULT-DISTRIBUTED
    });
  });

  describe("update-heirs", () => {
    it("replaces heir list", () => {
      createDefaultVault();

      const result = simnet.callPublicFn(
        "heirloom-vault-v8",
        "update-heirs",
        [
          Cl.list([
            Cl.tuple({
              heir: Cl.principal(wallet1),
              "split-bps": Cl.uint(5000),
            }),
            Cl.tuple({
              heir: Cl.principal(wallet3),
              "split-bps": Cl.uint(5000),
            }),
          ]),
        ],
        deployer
      );
      expect(result.result).toBeOk(Cl.bool(true));
    });

    it("validates splits sum to 10000", () => {
      createDefaultVault();

      const result = simnet.callPublicFn(
        "heirloom-vault-v8",
        "update-heirs",
        [
          Cl.list([
            Cl.tuple({
              heir: Cl.principal(wallet1),
              "split-bps": Cl.uint(5000),
            }),
          ]),
        ],
        deployer
      );
      expect(result.result).toBeErr(Cl.uint(106)); // ERR-INVALID-SPLITS
    });
  });

  describe("get-heir-info", () => {
    it("returns heir split and claimed status", () => {
      createDefaultVault();

      const result = simnet.callReadOnlyFn(
        "heirloom-vault-v8",
        "get-heir-info",
        [Cl.principal(deployer), Cl.principal(wallet1)],
        deployer
      );

      expect(result.result.type).toBe(ClarityType.ResponseOk);
      const okValue = (result.result as any).value;
      expect(okValue.type).toBe(ClarityType.Tuple);
      expect(okValue.value["split-bps"]).toBeDefined();
    });

    it("rejects non-heir lookup", () => {
      createDefaultVault();

      const result = simnet.callReadOnlyFn(
        "heirloom-vault-v8",
        "get-heir-info",
        [Cl.principal(deployer), Cl.principal(wallet3)],
        deployer
      );
      expect(result.result).toBeErr(Cl.uint(101)); // ERR-NOT-HEIR
    });
  });

  describe("get-heir-list", () => {
    it("returns list of heir addresses", () => {
      createDefaultVault();

      const result = simnet.callReadOnlyFn(
        "heirloom-vault-v8",
        "get-heir-list",
        [Cl.principal(deployer)],
        deployer
      );

      expect(result.result.type).toBe(ClarityType.ResponseOk);
      const okValue = (result.result as any).value;
      expect(okValue.type).toBe(ClarityType.List);
      expect(okValue.value.length).toBe(2);
    });
  });

  describe("heartbeat on distributed vault", () => {
    it("rejects heartbeat after emergency withdraw", () => {
      createDefaultVault();
      simnet.callPublicFn(
        "heirloom-vault-v8",
        "emergency-withdraw",
        [],
        deployer
      );

      const result = simnet.callPublicFn(
        "heirloom-vault-v8",
        "heartbeat",
        [],
        deployer
      );
      expect(result.result).toBeErr(Cl.uint(110)); // ERR-VAULT-DISTRIBUTED
    });
  });

  describe("re-create vault after distribution", () => {
    it("allows creating a new vault after emergency-withdraw", () => {
      createDefaultVault();
      simnet.callPublicFn(
        "heirloom-vault-v8",
        "emergency-withdraw",
        [],
        deployer
      );

      // Should succeed because old vault is distributed
      const result = createDefaultVault();
      expect(result.result).toBeOk(Cl.bool(true));
    });

    it("new vault after re-creation is active with fresh state", () => {
      createDefaultVault();
      simnet.callPublicFn(
        "heirloom-vault-v8",
        "emergency-withdraw",
        [],
        deployer
      );

      // Re-create vault
      createDefaultVault();

      const status = simnet.callReadOnlyFn(
        "heirloom-vault-v8",
        "get-vault-status",
        [Cl.principal(deployer)],
        deployer
      );
      expect(status.result.type).toBe(ClarityType.ResponseOk);
      const okValue = (status.result as any).value;
      // Vault should not be distributed (BoolCV uses type, not value)
      expect(okValue.value["is-distributed"].type).toBe(ClarityType.BoolFalse);
    });

    it("rejects re-creation if vault is not distributed", () => {
      createDefaultVault();

      // Try to create again without distributing first
      const result = createDefaultVault();
      expect(result.result).toBeErr(Cl.uint(109)); // ERR-VAULT-ALREADY-EXISTS
    });
  });

  describe("claim auto-distribution", () => {
    it("marks vault as distributed after all heirs claim", () => {
      createDefaultVault();

      // Advance time past the deadline (interval=120 + grace=60 = 180s)
      simnet.mineEmptyBlocks(200);

      // Heir 1 claims
      const claim1 = simnet.callPublicFn(
        "heirloom-vault-v8",
        "claim",
        [Cl.principal(deployer)],
        wallet1
      );
      expect(claim1.result).toBeOk(Cl.bool(true));

      // Vault should NOT be distributed yet (1 of 2 heirs claimed)
      const statusMid = simnet.callReadOnlyFn(
        "heirloom-vault-v8",
        "get-vault-status",
        [Cl.principal(deployer)],
        deployer
      );
      expect((statusMid.result as any).value.value["is-distributed"].type).toBe(
        ClarityType.BoolFalse
      );

      // Heir 2 claims
      const claim2 = simnet.callPublicFn(
        "heirloom-vault-v8",
        "claim",
        [Cl.principal(deployer)],
        wallet2
      );
      expect(claim2.result).toBeOk(Cl.bool(true));

      // Now vault SHOULD be distributed (2 of 2 heirs claimed)
      const statusEnd = simnet.callReadOnlyFn(
        "heirloom-vault-v8",
        "get-vault-status",
        [Cl.principal(deployer)],
        deployer
      );
      expect((statusEnd.result as any).value.value["is-distributed"].type).toBe(
        ClarityType.BoolTrue
      );
    });

    it("allows re-creation after all heirs claim", () => {
      createDefaultVault();
      simnet.mineEmptyBlocks(200);

      // Both heirs claim
      simnet.callPublicFn(
        "heirloom-vault-v8",
        "claim",
        [Cl.principal(deployer)],
        wallet1
      );
      simnet.callPublicFn(
        "heirloom-vault-v8",
        "claim",
        [Cl.principal(deployer)],
        wallet2
      );

      // Owner can now re-create vault
      const result = createDefaultVault();
      expect(result.result).toBeOk(Cl.bool(true));
    });

    it("rejects re-creation when only some heirs have claimed", () => {
      createDefaultVault();
      simnet.mineEmptyBlocks(200);

      // Only heir 1 claims
      simnet.callPublicFn(
        "heirloom-vault-v8",
        "claim",
        [Cl.principal(deployer)],
        wallet1
      );

      // Owner cannot re-create yet
      const result = createDefaultVault();
      expect(result.result).toBeErr(Cl.uint(109)); // ERR-VAULT-ALREADY-EXISTS
    });
  });
});
